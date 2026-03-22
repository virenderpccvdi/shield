package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.service.AppTimeBudgetService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * PC-03 — Per-App Time Budget endpoints.
 *
 * All routes are under /api/v1/dns/budgets/{profileId}
 */
@RestController
@RequestMapping("/api/v1/dns/app-budgets")
@RequiredArgsConstructor
public class AppTimeBudgetController {

    private final AppTimeBudgetService budgetService;

    /** List per-app budgets + today's usage for a profile. */
    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getBudgets(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomerOrAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(budgetService.getBudgets(profileId)));
    }

    /** Create or update a per-app budget. */
    @PostMapping("/{profileId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upsertBudget(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody BudgetRequest req) {
        requireCustomerOrAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(
                budgetService.upsertBudget(profileId, req.getAppName(), req.getDomainPattern(), req.getDailyMinutes())));
    }

    /** Delete a budget entry. */
    @DeleteMapping("/{profileId}/{budgetId}")
    public ResponseEntity<ApiResponse<Void>> deleteBudget(
            @PathVariable UUID profileId,
            @PathVariable UUID budgetId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomerOrAdmin(role);
        budgetService.deleteBudget(profileId, budgetId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Budget deleted"));
    }

    /**
     * Report app usage from the Flutter child app.
     * No role check — child app is authenticated at the gateway level (JWT required).
     */
    @PostMapping("/{profileId}/usage")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reportUsage(
            @PathVariable UUID profileId,
            @Valid @RequestBody UsageReportRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                budgetService.reportUsage(profileId, req.getDomainPattern(), req.getAdditionalMinutes())));
    }

    /** Usage history for a profile over a date range (default: last 7 days). */
    @GetMapping("/{profileId}/history")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getHistory(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        requireCustomerOrAdmin(role);
        LocalDate effectiveTo   = to   != null ? to   : LocalDate.now();
        LocalDate effectiveFrom = from != null ? from : effectiveTo.minusDays(6);
        return ResponseEntity.ok(ApiResponse.ok(
                budgetService.getUsageHistory(profileId, effectiveFrom, effectiveTo)));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void requireCustomerOrAdmin(String role) {
        if (!List.of("GLOBAL_ADMIN", "ISP_ADMIN", "CUSTOMER").contains(role)) {
            throw ShieldException.forbidden("Access denied");
        }
    }

    // ── Request DTOs ──────────────────────────────────────────────────────────

    @Data
    static class BudgetRequest {
        @NotBlank private String appName;
        @NotBlank private String domainPattern;
        @Min(1) private int dailyMinutes = 60;
    }

    @Data
    static class UsageReportRequest {
        @NotBlank private String domainPattern;
        @Min(1) private int additionalMinutes;
    }
}
