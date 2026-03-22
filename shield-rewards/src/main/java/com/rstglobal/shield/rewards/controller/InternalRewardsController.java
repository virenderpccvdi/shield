package com.rstglobal.shield.rewards.controller;

import com.rstglobal.shield.rewards.dto.response.RewardBankResponse;
import com.rstglobal.shield.rewards.dto.response.TaskResponse;
import com.rstglobal.shield.rewards.service.RewardBankService;
import com.rstglobal.shield.rewards.service.TaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Internal endpoints used by the child app or other microservices.
 * These are accessible without JWT (gateway internal traffic only).
 */
@Slf4j
@RestController
@RequestMapping("/internal/rewards")
@RequiredArgsConstructor
public class InternalRewardsController {

    private final TaskService taskService;
    private final RewardBankService rewardBankService;

    /**
     * Child app submits task completion for parent review.
     */
    @PostMapping("/tasks/{taskId}/submit")
    public ResponseEntity<TaskResponse> submitTask(
            @PathVariable UUID taskId,
            @RequestHeader("X-User-Id") UUID profileId) {
        log.info("Internal: child {} submitting task {}", profileId, taskId);
        TaskResponse response = taskService.submitTaskCompletion(taskId, profileId);
        return ResponseEntity.ok(response);
    }

    /**
     * FC-08: Child app auto-completes a task — points are awarded immediately
     * without requiring parent approval. The task moves PENDING → COMPLETED.
     * A push notification is sent to the child's device after award.
     */
    @PostMapping("/tasks/{taskId}/complete")
    public ResponseEntity<TaskResponse> completeTask(
            @PathVariable UUID taskId,
            @RequestHeader("X-User-Id") UUID profileId) {
        log.info("Internal: child {} auto-completing task {}", profileId, taskId);
        TaskResponse response = taskService.completeTask(taskId, profileId);
        return ResponseEntity.ok(response);
    }

    /**
     * FC-08: Generic point award endpoint for inter-service calls.
     * Accepts profileId, points, reason, and type from the request body.
     * Used by shield-location and other services to award points programmatically.
     *
     * Body: { "profileId": "uuid", "points": 10, "reason": "...", "type": "TASK_COMPLETION" }
     */
    @PostMapping("/award")
    public ResponseEntity<RewardBankResponse> awardPoints(@RequestBody Map<String, Object> body) {
        UUID profileId = UUID.fromString((String) body.get("profileId"));
        int points = body.get("points") instanceof Number n ? n.intValue() : 10;
        String reason = (String) body.getOrDefault("reason", "Points awarded");
        String type   = (String) body.getOrDefault("type", "EARN");

        log.info("Internal: awarding {} points to profile {} — reason: {}", points, profileId, reason);
        RewardBankResponse response = rewardBankService.awardPoints(profileId, points, reason, type);
        return ResponseEntity.ok(response);
    }
}
