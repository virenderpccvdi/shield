package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import com.rstglobal.shield.dns.service.BudgetEnforcementService;
import com.rstglobal.shield.dns.service.BudgetTrackingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller for the simple daily internet budget stored in
 * {@code dns_rules.daily_budget_minutes}.
 *
 * <p>Endpoints:
 * <ul>
 *   <li>{@code GET  /api/v1/dns/time-limits/{profileId}} — get the current budget and today's
 *       real-time usage.</li>
 *   <li>{@code PUT  /api/v1/dns/time-limits/{profileId}} — set (or clear) the daily budget.</li>
 *   <li>{@code POST /api/v1/dns/time-limits/{profileId}/reset} — reset today's usage counter
 *       and clear the exhausted flag (parent grants a fresh start).</li>
 * </ul>
 *
 * <p>This is distinct from {@link BudgetController} which manages the per-app
 * {@code timeBudgets} JSONB map.  Here we expose the simpler top-level column.
 */
@RestController
@RequestMapping("/api/v1/dns/time-limits")
@RequiredArgsConstructor
public class TimeLimitsController {

    private final DnsRulesRepository rulesRepo;
    private final BudgetTrackingService budgetTracking;

    // ──────────────────────────────────────────────────────────────────────────
    //  GET — current budget and real-time usage
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Returns the daily budget (minutes), today's used minutes, remaining minutes,
     * and whether the budget is currently exhausted.
     */
    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTimeLimits(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);

        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));

        Integer limitMinutes = rules.getDailyBudgetMinutes();
        int usedMinutes = budgetTracking.getUsedMinutesToday(profileId);

        boolean exhausted = Boolean.TRUE.equals(
                rules.getEnabledCategories() != null
                        ? rules.getEnabledCategories().get(BudgetEnforcementService.BUDGET_EXHAUSTED_KEY)
                        : false);

        int remaining;
        if (limitMinutes == null || limitMinutes <= 0) {
            remaining = -1; // No limit configured
        } else {
            remaining = Math.max(0, limitMinutes - usedMinutes);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("profileId", profileId);
        body.put("dailyBudgetMinutes", limitMinutes);
        body.put("usedMinutes", usedMinutes);
        body.put("remainingMinutes", remaining);
        body.put("exhausted", exhausted);

        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  PUT — set or clear the daily budget
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Set the daily internet budget for a child profile.
     * Send {@code {"dailyBudgetMinutes": 120}} to allow 2 h/day.
     * Send {@code {"dailyBudgetMinutes": null}} or {@code {"dailyBudgetMinutes": 0}} to remove the limit.
     */
    @PutMapping("/{profileId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> setTimeLimits(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);

        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));

        Integer newLimit = null;
        Object raw = body.get("dailyBudgetMinutes");
        if (raw != null) {
            int parsed = ((Number) raw).intValue();
            newLimit = (parsed > 0) ? parsed : null; // 0 treated as "no limit"
        }

        rules.setDailyBudgetMinutes(newLimit);
        rulesRepo.save(rules);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("profileId", profileId);
        response.put("dailyBudgetMinutes", newLimit);
        response.put("message", newLimit != null
                ? "Daily budget set to " + newLimit + " minutes"
                : "Daily budget limit removed");

        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  POST — reset today's usage (parent grant)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Reset today's usage counter and clear the exhausted flag.
     * Useful when a parent wants to give the child a fresh start mid-day.
     */
    @PostMapping("/{profileId}/reset")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resetUsage(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        budgetTracking.resetTodayUsage(profileId);
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("profileId", profileId, "message", "Today's usage reset successfully")));
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
