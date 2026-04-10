package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.PublicPlanDto;
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

    /**
     * List plans:
     * - GLOBAL_ADMIN: all plans (query ?all=true) or active ISP-level plans
     * - ISP_ADMIN: their tenant's customer plans
     * - anyone: active ISP plans (for billing/subscription pages)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<SubscriptionPlan>>> list(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestParam(defaultValue = "false") boolean all) {
        if ("GLOBAL_ADMIN".equals(role)) {
            return ResponseEntity.ok(ApiResponse.ok(all ? planService.listAll() : planService.listActive()));
        }
        if ("ISP_ADMIN".equals(role) && tenantIdStr != null && !tenantIdStr.isBlank()) {
            UUID tenantId = UUID.fromString(tenantIdStr);
            return ResponseEntity.ok(ApiResponse.ok(all ? planService.listAllByTenant(tenantId) : planService.listByTenant(tenantId)));
        }
        // CUSTOMER role: return only their ISP's tenant-scoped customer plans
        if ("CUSTOMER".equals(role) && tenantIdStr != null && !tenantIdStr.isBlank()) {
            UUID tenantId = UUID.fromString(tenantIdStr);
            return ResponseEntity.ok(ApiResponse.ok(planService.listByTenant(tenantId)));
        }
        // Default fallback: ISP-level plans only
        return ResponseEntity.ok(ApiResponse.ok(planService.listIspPlans()));
    }

    /** ISP-level plans only (for ISP subscription pages) */
    @GetMapping("/isp")
    public ResponseEntity<ApiResponse<List<SubscriptionPlan>>> listIspPlans() {
        return ResponseEntity.ok(ApiResponse.ok(planService.listIspPlans()));
    }

    /**
     * Public pricing endpoint — NO authentication required.
     * Returns active ISP-level plans with display fields only (no internal IDs/Stripe keys).
     * Used by the marketing website pricing section.
     */
    @GetMapping("/public")
    @Operation(summary = "Public plans pricing — no auth required")
    public ResponseEntity<ApiResponse<List<PublicPlanDto>>> getPublicPlans() {
        List<PublicPlanDto> plans = planService.listIspPlans().stream()
                .map(PublicPlanDto::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(plans));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SubscriptionPlan>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(planService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SubscriptionPlan>> create(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestBody SubscriptionPlan plan,
            HttpServletRequest req) {
        SubscriptionPlan created;
        if ("ISP_ADMIN".equals(role) && tenantIdStr != null && !tenantIdStr.isBlank()) {
            UUID tenantId = UUID.fromString(tenantIdStr);
            created = planService.createForTenant(tenantId, plan);
        } else {
            requireGlobalAdmin(role);
            created = planService.create(plan);
        }
        auditLogService.log("PLAN_CREATED", "SubscriptionPlan", created.getId().toString(),
                getUserId(req), getUserName(req), req.getRemoteAddr(),
                Map.of("planName", created.getName()));
        return ResponseEntity.ok(ApiResponse.ok(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<SubscriptionPlan>> update(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID id,
            @RequestBody SubscriptionPlan plan,
            HttpServletRequest req) {
        SubscriptionPlan updated;
        if ("ISP_ADMIN".equals(role) && tenantIdStr != null && !tenantIdStr.isBlank()) {
            updated = planService.updateForTenant(id, UUID.fromString(tenantIdStr), plan);
        } else {
            requireGlobalAdmin(role);
            updated = planService.update(id, plan);
        }
        auditLogService.log("PLAN_UPDATED", "SubscriptionPlan", id.toString(),
                getUserId(req), getUserName(req), req.getRemoteAddr(),
                Map.of("planName", updated.getName()));
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID id,
            HttpServletRequest req) {
        if ("ISP_ADMIN".equals(role) && tenantIdStr != null && !tenantIdStr.isBlank()) {
            planService.deleteForTenant(id, UUID.fromString(tenantIdStr));
        } else {
            requireGlobalAdmin(role);
            planService.delete(id);
        }
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
