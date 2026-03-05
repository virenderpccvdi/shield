package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import com.rstglobal.shield.admin.service.AuditLogService;
import com.rstglobal.shield.admin.service.StripeService;
import com.rstglobal.shield.admin.service.SubscriptionPlanService;
import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/plans")
@RequiredArgsConstructor
public class SubscriptionPlanController {

    private final SubscriptionPlanService planService;
    private final AuditLogService auditLogService;
    private final StripeService stripeService;

    @GetMapping
    public ResponseEntity<List<SubscriptionPlan>> list(@RequestParam(defaultValue = "false") boolean all) {
        return ResponseEntity.ok(all ? planService.listAll() : planService.listActive());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SubscriptionPlan> get(@PathVariable UUID id) {
        return ResponseEntity.ok(planService.getById(id));
    }

    @PostMapping
    public ResponseEntity<SubscriptionPlan> create(@RequestBody SubscriptionPlan plan, HttpServletRequest req) {
        SubscriptionPlan created = planService.create(plan);
        auditLogService.log("PLAN_CREATED", "SubscriptionPlan", created.getId().toString(),
                getUserId(req), getUserName(req), req.getRemoteAddr(),
                Map.of("planName", created.getName()));
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<SubscriptionPlan> update(@PathVariable UUID id, @RequestBody SubscriptionPlan plan, HttpServletRequest req) {
        SubscriptionPlan updated = planService.update(id, plan);
        auditLogService.log("PLAN_UPDATED", "SubscriptionPlan", id.toString(),
                getUserId(req), getUserName(req), req.getRemoteAddr(),
                Map.of("planName", updated.getName()));
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, HttpServletRequest req) {
        planService.delete(id);
        auditLogService.log("PLAN_DELETED", "SubscriptionPlan", id.toString(),
                getUserId(req), getUserName(req), req.getRemoteAddr(), Map.of());
        return ResponseEntity.noContent().build();
    }

    private UUID getUserId(HttpServletRequest req) {
        String header = req.getHeader("X-User-Id");
        return header != null ? UUID.fromString(header) : null;
    }

    private String getUserName(HttpServletRequest req) {
        return req.getHeader("X-User-Name");
    }

    @PostMapping("/{id}/sync-stripe")
    @Operation(summary = "Sync plan to Stripe (creates Product + Price)")
    public ApiResponse<String> syncToStripe(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        stripeService.syncPlanToStripe(id);
        return ApiResponse.ok("Plan synced to Stripe successfully");
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }
}
