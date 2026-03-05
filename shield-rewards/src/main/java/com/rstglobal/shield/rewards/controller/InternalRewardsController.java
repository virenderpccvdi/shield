package com.rstglobal.shield.rewards.controller;

import com.rstglobal.shield.rewards.dto.response.TaskResponse;
import com.rstglobal.shield.rewards.service.TaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
