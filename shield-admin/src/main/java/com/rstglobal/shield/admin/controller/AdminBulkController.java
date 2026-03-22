package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.request.BulkActivateRequest;
import com.rstglobal.shield.admin.dto.request.BulkFeatureRequest;
import com.rstglobal.shield.admin.dto.request.BulkSuspendRequest;
import com.rstglobal.shield.admin.dto.response.BulkOpResult;
import com.rstglobal.shield.admin.dto.response.PlatformStatsResponse;
import com.rstglobal.shield.admin.service.AdminBulkService;
import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Global admin bulk management endpoints.
 *
 * All routes require GLOBAL_ADMIN role (validated via X-User-Role header injected
 * by the API Gateway after JWT verification). The AdminRoleFilter provides a
 * defence-in-depth check for all /api/v1/admin/** paths.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/tenants")
@RequiredArgsConstructor
@Tag(name = "Admin Bulk Operations", description = "Platform-wide tenant bulk management (GLOBAL_ADMIN only)")
public class AdminBulkController {

    private final AdminBulkService adminBulkService;

    /**
     * POST /api/v1/admin/tenants/bulk/suspend
     * Suspend one or more tenants in a single call.
     */
    @PostMapping("/bulk/suspend")
    @Operation(summary = "Bulk suspend tenants (GLOBAL_ADMIN)")
    public ResponseEntity<ApiResponse<BulkOpResult>> bulkSuspend(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody BulkSuspendRequest request) {
        requireGlobalAdmin(role);
        log.info("Bulk suspend requested for {} tenants", request.tenantIds().size());
        BulkOpResult result = adminBulkService.suspendTenants(request.tenantIds(), request.reason());
        return ResponseEntity.ok(ApiResponse.ok(result,
                "Bulk suspend complete: " + result.succeeded() + " succeeded, " + result.failed() + " failed"));
    }

    /**
     * POST /api/v1/admin/tenants/bulk/activate
     * Re-activate one or more suspended tenants.
     */
    @PostMapping("/bulk/activate")
    @Operation(summary = "Bulk activate tenants (GLOBAL_ADMIN)")
    public ResponseEntity<ApiResponse<BulkOpResult>> bulkActivate(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody BulkActivateRequest request) {
        requireGlobalAdmin(role);
        log.info("Bulk activate requested for {} tenants", request.tenantIds().size());
        BulkOpResult result = adminBulkService.activateTenants(request.tenantIds());
        return ResponseEntity.ok(ApiResponse.ok(result,
                "Bulk activate complete: " + result.succeeded() + " succeeded, " + result.failed() + " failed"));
    }

    /**
     * POST /api/v1/admin/tenants/bulk/feature
     * Toggle a named feature flag across a set of tenants.
     */
    @PostMapping("/bulk/feature")
    @Operation(summary = "Bulk toggle feature flag across tenants (GLOBAL_ADMIN)")
    public ResponseEntity<ApiResponse<BulkOpResult>> bulkFeature(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody BulkFeatureRequest request) {
        requireGlobalAdmin(role);
        log.info("Bulk feature toggle: feature={} enabled={} for {} tenants",
                request.feature(), request.enabled(), request.tenantIds().size());
        BulkOpResult result = adminBulkService.setFeatureFlag(
                request.tenantIds(), request.feature(), request.enabled());
        return ResponseEntity.ok(ApiResponse.ok(result,
                "Feature '" + request.feature() + "' set to " + request.enabled()
                + " — " + result.succeeded() + " succeeded, " + result.failed() + " failed"));
    }

    /**
     * GET /api/v1/admin/tenants/stats
     * Platform-wide tenant statistics aggregated from analytics service.
     */
    @GetMapping("/stats")
    @Operation(summary = "Platform-wide tenant statistics (GLOBAL_ADMIN)")
    public ResponseEntity<ApiResponse<PlatformStatsResponse>> platformStats(
            @RequestHeader("X-User-Role") String role) {
        requireGlobalAdmin(role);
        PlatformStatsResponse stats = adminBulkService.getPlatformStats();
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }
}
