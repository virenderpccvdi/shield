package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.UpdateBudgetsRequest;
import com.rstglobal.shield.dns.dto.response.BudgetTodayResponse;
import com.rstglobal.shield.dns.service.BudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dns/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> getBudgets(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(budgetService.getBudgets(profileId)));
    }

    @PutMapping("/{profileId}")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> updateBudgets(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateBudgetsRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(budgetService.updateBudgets(profileId, req)));
    }

    @GetMapping("/{profileId}/today")
    public ResponseEntity<ApiResponse<BudgetTodayResponse>> getTodayUsage(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(budgetService.getTodayUsage(profileId)));
    }

    @PostMapping("/{profileId}/extend")
    public ResponseEntity<ApiResponse<Map<String, Object>>> extendBudget(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);
        int minutes = body.containsKey("minutes") ? ((Number) body.get("minutes")).intValue() : 0;
        String reason = body.containsKey("reason") ? (String) body.get("reason") : "Parent granted extra time";
        if (minutes <= 0 || minutes > 480) {
            throw ShieldException.badRequest("Minutes must be between 1 and 480");
        }
        // Extend the daily budget for all apps or a specific "general" bucket
        String appName = body.containsKey("app") ? (String) body.get("app") : "general";
        budgetService.grantExtension(profileId, appName, minutes);
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("profileId", profileId, "extendedMinutes", minutes, "app", appName, "reason", reason),
                "Budget extended by " + minutes + " minutes"));
    }

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
