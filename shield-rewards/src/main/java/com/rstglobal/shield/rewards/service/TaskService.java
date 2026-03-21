package com.rstglobal.shield.rewards.service;

import com.rstglobal.shield.rewards.dto.request.CreateTaskRequest;
import com.rstglobal.shield.rewards.dto.request.TaskApprovalRequest;
import com.rstglobal.shield.rewards.dto.response.TaskResponse;
import com.rstglobal.shield.rewards.entity.Task;
import com.rstglobal.shield.rewards.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final RewardBankService rewardBankService;
    private final AchievementService achievementService;

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
        return toResponse(task);
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(UUID id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));
        return toResponse(task);
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
