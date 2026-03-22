package com.rstglobal.shield.rewards.service;

import com.rstglobal.shield.rewards.dto.request.CreateTaskRequest;
import com.rstglobal.shield.rewards.dto.request.TaskApprovalRequest;
import com.rstglobal.shield.rewards.dto.response.TaskResponse;
import com.rstglobal.shield.rewards.entity.Task;
import com.rstglobal.shield.rewards.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final TaskRepository taskRepository;
    private final RewardBankService rewardBankService;
    private final AchievementService achievementService;
    private final DiscoveryClient discoveryClient;

    @Value("${shield.notification.base-url:http://localhost:8286}")
    private String notifBaseUrl;

    private final RestClient restClient = RestClient.builder().build();

    @Transactional
    public TaskResponse createTask(CreateTaskRequest req, UUID createdBy, UUID tenantId) {
        Task task = Task.builder()
                .tenantId(tenantId)
                .profileId(req.getProfileId())
                .createdBy(createdBy)
                .title(req.getTitle())
                .description(req.getDescription())
                .rewardMinutes(req.getRewardMinutes())
                .rewardPoints(req.getRewardPoints())
                .dueDate(req.getDueDate())
                .recurrence(req.getRecurrence() != null ? req.getRecurrence() : "ONCE")
                .status("PENDING")
                .active(true)
                .build();

        task = taskRepository.save(task);
        log.info("Task created: {} for profile {}", task.getId(), task.getProfileId());
        final Task saved = task;
        // Notify child device via FCM so the task list updates in real-time
        sendTaskCreatedPush(saved);
        return toResponse(task);
    }

    /**
     * Fire-and-forget: push FCM notification to child's device when a task is created.
     * The child FCM token is registered under userId=profileId (child JWT sub = profileId).
     */
    @Async
    protected void sendTaskCreatedPush(Task task) {
        sendPush(task.getProfileId(),
                "📋 New Task Assigned!",
                task.getTitle() + " — earn " + task.getRewardPoints() + " points",
                Map.of("type", "TASK_CREATED", "taskId", task.getId().toString()));
    }

    @Async
    protected void sendTaskApprovedPush(Task task) {
        sendPush(task.getProfileId(),
                "🎉 Task Approved!",
                "You earned " + task.getRewardPoints() + " points for: " + task.getTitle(),
                Map.of("type", "TASK_APPROVED", "taskId", task.getId().toString()));
    }

    @Async
    protected void sendPushAsync(UUID userId, String title, String body, Map<String, String> data) {
        if (userId == null) return;
        sendPush(userId, title, body, data);
    }

    private void sendPush(UUID profileId, String title, String body, Map<String, String> data) {
        try {
            // userId for child devices = profileId (child JWT uses profileId as subject)
            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("userId",   profileId);
            payload.put("title",    title);
            payload.put("body",     body);
            payload.put("priority", "HIGH");
            payload.put("data",     data);
            restClient.post()
                    .uri(notifBaseUrl + "/internal/notifications/push")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Task push notification failed for profile {}: {}", profileId, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listTasks(UUID profileId, String status) {
        List<Task> tasks;
        if (status != null && !status.isBlank()) {
            tasks = taskRepository.findByProfileIdAndStatus(profileId, status.toUpperCase());
        } else {
            tasks = taskRepository.findByProfileId(profileId);
        }
        return tasks.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public TaskResponse submitTaskCompletion(UUID taskId, UUID profileId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        if (!task.getProfileId().equals(profileId)) {
            throw new IllegalArgumentException("Task does not belong to profile: " + profileId);
        }
        if (!"PENDING".equals(task.getStatus())) {
            throw new IllegalStateException("Task is not in PENDING status, current status: " + task.getStatus());
        }

        task.setStatus("SUBMITTED");
        task.setSubmittedAt(OffsetDateTime.now());
        task = taskRepository.save(task);
        log.info("Task {} submitted by profile {}", taskId, profileId);
        // Notify parent so they can review and approve
        final Task submitted = task;
        sendPushAsync(submitted.getCreatedBy(),
                "✅ Task Submitted for Review",
                submitted.getTitle() + " — tap to review",
                Map.of("type", "TASK_SUBMITTED",
                       "taskId", submitted.getId().toString(),
                       "profileId", submitted.getProfileId().toString()));
        return toResponse(task);
    }

    @Transactional
    public TaskResponse approveTask(UUID taskId, UUID approverId, TaskApprovalRequest req) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        if (!"SUBMITTED".equals(task.getStatus())) {
            throw new IllegalStateException("Task is not in SUBMITTED status, current status: " + task.getStatus());
        }

        if (Boolean.TRUE.equals(req.getApproved())) {
            task.setStatus("APPROVED");
            task.setApprovedAt(OffsetDateTime.now());
            task.setApprovedBy(approverId);

            // Credit reward bank
            rewardBankService.creditReward(
                    task.getProfileId(),
                    task.getRewardPoints(),
                    task.getRewardMinutes(),
                    task.getId(),
                    task.getTenantId()
            );

            // Update streak
            rewardBankService.updateStreak(task.getProfileId());

            // Check achievements
            achievementService.checkAndAwardAchievements(task.getProfileId());

            log.info("Task {} approved by {}, awarded {} points and {} minutes",
                    taskId, approverId, task.getRewardPoints(), task.getRewardMinutes());
            final Task approvedTask = task;
            sendTaskApprovedPush(approvedTask);
        } else {
            task.setStatus("REJECTED");
            task.setRejectionNote(req.getRejectionNote());
            log.info("Task {} rejected by {}", taskId, approverId);
            final Task rejectedTask = task;
            final String note = req.getRejectionNote();
            sendPushAsync(rejectedTask.getProfileId(),
                    "❌ Task Not Approved",
                    rejectedTask.getTitle() + (note != null && !note.isBlank() ? " — " + note : ""),
                    Map.of("type", "TASK_REJECTED", "taskId", rejectedTask.getId().toString()));
        }

        task = taskRepository.save(task);
        return toResponse(task);
    }

    @Transactional
    public TaskResponse rejectTask(UUID taskId, UUID approverId, String note) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        if (!"SUBMITTED".equals(task.getStatus())) {
            throw new IllegalStateException("Task is not in SUBMITTED status, current status: " + task.getStatus());
        }

        task.setStatus("REJECTED");
        task.setRejectionNote(note);
        task = taskRepository.save(task);
        log.info("Task {} rejected by {}", taskId, approverId);
        final Task rejected = task;
        sendPushAsync(rejected.getProfileId(),
                "❌ Task Not Approved",
                rejected.getTitle() + (note != null && !note.isBlank() ? " — " + note : ""),
                Map.of("type", "TASK_REJECTED", "taskId", rejected.getId().toString()));
        return toResponse(task);
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(UUID id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));
        return toResponse(task);
    }

    /**
     * FC-08: Child self-completes a task — auto-award points without parent approval.
     * Task must be in PENDING status and belong to the calling profileId.
     * Marks the task COMPLETED, credits the reward bank immediately, updates streak,
     * checks achievement milestones, and fires an async push to the child's device.
     */
    @Transactional
    public TaskResponse completeTask(UUID taskId, UUID profileId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        if (!task.getProfileId().equals(profileId)) {
            throw new IllegalArgumentException("Task does not belong to profile: " + profileId);
        }
        if (!"PENDING".equals(task.getStatus())) {
            throw new IllegalStateException(
                    "Task cannot be auto-completed from status: " + task.getStatus());
        }

        task.setStatus("COMPLETED");
        task.setSubmittedAt(OffsetDateTime.now());
        task.setApprovedAt(OffsetDateTime.now());
        task = taskRepository.save(task);
        log.info("Task {} auto-completed by profile {}, awarding {} points and {} minutes",
                taskId, profileId, task.getRewardPoints(), task.getRewardMinutes());

        // Credit reward bank immediately (no parent approval required)
        rewardBankService.creditReward(
                task.getProfileId(),
                task.getRewardPoints(),
                task.getRewardMinutes(),
                task.getId(),
                task.getTenantId()
        );

        // Update streak and check milestones
        rewardBankService.updateStreak(task.getProfileId());
        achievementService.checkAndAwardAchievements(task.getProfileId());

        // Async: notify the child device
        final Task completed = task;
        sendTaskCompletedPush(completed);

        return toResponse(task);
    }

    /**
     * Fire-and-forget: push reward notification to child when auto-complete succeeds.
     * Uses Eureka to resolve shield-notification URL dynamically.
     */
    @Async
    protected void sendTaskCompletedPush(Task task) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) {
                log.warn("No SHIELD-NOTIFICATION instance found — skipping task reward push for profile {}",
                        task.getProfileId());
                return;
            }

            int points = task.getRewardPoints();
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("userId", null);
            payload.put("topic", "profile-" + task.getProfileId());
            payload.put("title", "\u2b50 Task Complete!");
            payload.put("body", "You earned " + points + " points for completing '"
                    + task.getTitle() + "'!");
            payload.put("priority", "HIGH");
            payload.put("data", Map.of(
                    "type", "TASK_REWARD",
                    "points", String.valueOf(points),
                    "taskId", task.getId().toString()
            ));

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Task reward push sent: profileId={} points={} task='{}'",
                    task.getProfileId(), points, task.getTitle());
        } catch (Exception e) {
            log.warn("Task reward push notification failed for profile {}: {}",
                    task.getProfileId(), e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private TaskResponse toResponse(Task task) {
        return TaskResponse.builder()
                .id(task.getId())
                .tenantId(task.getTenantId())
                .profileId(task.getProfileId())
                .createdBy(task.getCreatedBy())
                .title(task.getTitle())
                .description(task.getDescription())
                .rewardMinutes(task.getRewardMinutes())
                .rewardPoints(task.getRewardPoints())
                .dueDate(task.getDueDate())
                .recurrence(task.getRecurrence())
                .status(task.getStatus())
                .active(task.isActive())
                .submittedAt(task.getSubmittedAt())
                .approvedAt(task.getApprovedAt())
                .approvedBy(task.getApprovedBy())
                .rejectionNote(task.getRejectionNote())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }
}
