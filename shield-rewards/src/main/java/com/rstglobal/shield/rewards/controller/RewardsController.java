package com.rstglobal.shield.rewards.controller;

import com.rstglobal.shield.rewards.dto.request.CreateTaskRequest;
import com.rstglobal.shield.rewards.dto.request.TaskApprovalRequest;
import com.rstglobal.shield.rewards.dto.request.RedeemRequest;
import com.rstglobal.shield.rewards.dto.response.*;
import com.rstglobal.shield.rewards.service.AchievementService;
import com.rstglobal.shield.rewards.service.RewardBankService;
import com.rstglobal.shield.rewards.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/rewards")
@RequiredArgsConstructor
public class RewardsController {

    private final TaskService taskService;
    private final RewardBankService rewardBankService;
    private final AchievementService achievementService;

    // ── Tasks ──────────────────────────────────────────────────────────────────

    /**
     * Parent creates a new task for a child profile.
     */
    @PostMapping("/tasks")
    public ResponseEntity<TaskResponse> createTask(
            @Valid @RequestBody CreateTaskRequest req,
            @RequestHeader("X-User-Id") UUID createdBy,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        log.info("Creating task for profile {} by parent {}", req.getProfileId(), createdBy);
        TaskResponse response = taskService.createTask(req, createdBy, tenantId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * List tasks for the calling user (parent). Returns all tasks created by this user.
     * Optionally filter by profileId and/or status via query params.
     */
    @GetMapping("/tasks")
    public ResponseEntity<List<TaskResponse>> listMyTasks(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(required = false) UUID profileId,
            @RequestParam(required = false) String status) {
        if (profileId != null) {
            return ResponseEntity.ok(taskService.listTasks(profileId, status));
        }
        return ResponseEntity.ok(taskService.listTasksByCreator(userId, status));
    }

    /**
     * List all tasks for a profile, optionally filtered by status.
     */
    @GetMapping("/tasks/{profileId}")
    public ResponseEntity<List<TaskResponse>> listTasks(
            @PathVariable UUID profileId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(taskService.listTasks(profileId, status));
    }

    /**
     * Parent approves a submitted task.
     */
    @PostMapping("/tasks/{taskId}/approve")
    public ResponseEntity<TaskResponse> approveTask(
            @PathVariable UUID taskId,
            @Valid @RequestBody TaskApprovalRequest req,
            @RequestHeader("X-User-Id") UUID approverId) {
        log.info("Approving task {} by parent {}", taskId, approverId);
        TaskResponse response = taskService.approveTask(taskId, approverId, req);
        return ResponseEntity.ok(response);
    }

    /**
     * Parent rejects a submitted task.
     */
    @PostMapping("/tasks/{taskId}/reject")
    public ResponseEntity<TaskResponse> rejectTask(
            @PathVariable UUID taskId,
            @RequestBody(required = false) TaskApprovalRequest req,
            @RequestHeader("X-User-Id") UUID approverId) {
        String note = req != null ? req.getRejectionNote() : null;
        log.info("Rejecting task {} by parent {}", taskId, approverId);
        TaskResponse response = taskService.rejectTask(taskId, approverId, note);
        return ResponseEntity.ok(response);
    }

    /**
     * Child marks a task as complete — sets status to SUBMITTED (pending parent approval).
     */
    @PostMapping("/tasks/{taskId}/complete")
    public ResponseEntity<TaskResponse> completeTask(
            @PathVariable UUID taskId,
            @RequestParam UUID profileId) {
        log.info("Task {} submitted for approval by profile {}", taskId, profileId);
        TaskResponse response = taskService.submitTaskCompletion(taskId, profileId);
        return ResponseEntity.ok(response);
    }

    // ── Reward Bank ────────────────────────────────────────────────────────────

    /**
     * Get reward bank balance for a profile.
     */
    @GetMapping("/bank/{profileId}")
    public ResponseEntity<RewardBankResponse> getBalance(@PathVariable UUID profileId) {
        return ResponseEntity.ok(rewardBankService.getBalance(profileId));
    }

    /**
     * Parent redeems rewards for a child profile.
     */
    @PostMapping("/bank/{profileId}/redeem")
    public ResponseEntity<RewardBankResponse> redeemRewards(
            @PathVariable UUID profileId,
            @Valid @RequestBody RedeemRequest req) {
        log.info("Redeeming rewards for profile {}: {} points, {} minutes", profileId, req.getPoints(), req.getMinutes());
        return ResponseEntity.ok(rewardBankService.redeemReward(profileId, req));
    }

    /**
     * Parent grants bonus points to a child profile.
     */
    @PostMapping("/{profileId}/bonus")
    public ResponseEntity<RewardBankResponse> grantBonus(
            @PathVariable UUID profileId,
            @RequestBody java.util.Map<String, Object> body,
            @RequestHeader("X-User-Id") UUID grantedBy,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        int points = body.containsKey("points") ? ((Number) body.get("points")).intValue() : 0;
        String reason = body.containsKey("reason") ? (String) body.get("reason") : "Bonus from parent";
        if (points <= 0 || points > 10000) {
            throw new IllegalArgumentException("Points must be between 1 and 10000");
        }
        log.info("Parent {} granting {} bonus points to profile {} — reason: {}", grantedBy, points, profileId, reason);
        RewardBankResponse response = rewardBankService.creditReward(profileId, points, 0, null, tenantId);
        return ResponseEntity.ok(response);
    }

    // ── Achievements ───────────────────────────────────────────────────────────

    /**
     * List achievements/badges earned by a profile.
     */
    @GetMapping("/achievements/{profileId}")
    public ResponseEntity<List<AchievementResponse>> listAchievements(@PathVariable UUID profileId) {
        return ResponseEntity.ok(achievementService.listAchievements(profileId));
    }

    // ── Daily Check-in ────────────────────────────────────────────────────────

    /**
     * Child daily check-in — awards 5 bonus points once per day.
     * Returns the updated reward bank balance.
     */
    @PostMapping("/checkin/{profileId}")
    public ResponseEntity<RewardBankResponse> dailyCheckin(
            @PathVariable UUID profileId,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        log.info("Daily check-in for profile {}", profileId);
        RewardBankResponse response = rewardBankService.awardPoints(profileId, 5, "Daily check-in", "CHECKIN");
        return ResponseEntity.ok(response);
    }

    // ── Streaks ─────────────────────────────────────────────────────────────────

    /**
     * Returns streak data (consecutive days with completed tasks).
     */
    @GetMapping("/{profileId}/streaks")
    public ResponseEntity<java.util.Map<String, Object>> getStreaks(@PathVariable UUID profileId) {
        RewardBankResponse bank = rewardBankService.getBalance(profileId);
        java.util.Map<String, Object> streakData = new java.util.LinkedHashMap<>();
        streakData.put("profileId", profileId);
        streakData.put("currentStreak", bank.getStreakDays());
        streakData.put("lastTaskDate", bank.getLastTaskDate());
        streakData.put("totalEarnedPoints", bank.getTotalEarnedPoints());
        streakData.put("totalEarnedMinutes", bank.getTotalEarnedMinutes());
        return ResponseEntity.ok(streakData);
    }

    // ── Transactions ───────────────────────────────────────────────────────────

    /**
     * Transaction history for a profile.
     */
    @GetMapping("/transactions/{profileId}")
    public ResponseEntity<List<TransactionResponse>> getTransactions(@PathVariable UUID profileId) {
        return ResponseEntity.ok(rewardBankService.getTransactions(profileId));
    }
}
