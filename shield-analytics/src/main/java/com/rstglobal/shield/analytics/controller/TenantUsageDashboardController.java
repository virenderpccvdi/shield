package com.rstglobal.shield.analytics.controller;

import com.rstglobal.shield.analytics.dto.response.CustomerActivityItem;
import com.rstglobal.shield.analytics.dto.response.HourlyCount;
import com.rstglobal.shield.analytics.dto.response.TenantOverviewResponse;
import com.rstglobal.shield.analytics.service.TenantUsageDashboardService;
import com.rstglobal.shield.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * IS-06: ISP Tenant Usage Dashboard endpoints.
 *
 * <pre>
 * GET /api/v1/analytics/tenant/overview?tenantId={uuid}
 * GET /api/v1/analytics/tenant/customers?tenantId={uuid}
 * GET /api/v1/analytics/tenant/hourly?tenantId={uuid}
 * </pre>
 *
 * Access: GLOBAL_ADMIN (any tenant) or ISP_ADMIN (own tenant only).
 * Gateway injects X-User-Role and X-Tenant-Id headers.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/analytics/tenant")
@RequiredArgsConstructor
public class TenantUsageDashboardController {

    private final TenantUsageDashboardService dashboardService;

    /**
     * Returns an aggregated overview for the tenant: active/total profiles,
     * today's query counts, top blocked domains/categories, and bandwidth saved.
     *
     * <p>GET /api/v1/analytics/tenant/overview?tenantId={uuid}
     * <p>OR GET /api/v1/analytics/tenant/overview  (tenantId from X-Tenant-Id header)
     */
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<TenantOverviewResponse>> getTenantOverview(
            @RequestParam(required = false) UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {

        UUID resolvedTenantId = resolvetenantId(tenantId, headerTenantId);
        requireTenantAccess(userRole, headerTenantId, resolvedTenantId);
        TenantOverviewResponse overview = dashboardService.getTenantOverview(resolvedTenantId);
        return ResponseEntity.ok(ApiResponse.ok(overview));
    }

    /**
     * Returns per-customer (per-profile) activity for all profiles in the tenant today.
     * Includes query counts, last-seen timestamp, and derived online status.
     *
     * <p>GET /api/v1/analytics/tenant/customers?tenantId={uuid}
     */
    @GetMapping("/customers")
    public ResponseEntity<ApiResponse<List<CustomerActivityItem>>> getCustomerActivity(
            @RequestParam(required = false) UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {

        UUID resolvedTenantId = resolvetenantId(tenantId, headerTenantId);
        requireTenantAccess(userRole, headerTenantId, resolvedTenantId);
        List<CustomerActivityItem> activity = dashboardService.getCustomerActivity(resolvedTenantId);
        return ResponseEntity.ok(ApiResponse.ok(activity));
    }

    /**
     * Returns 24 hourly buckets (hours 0–23) of total and blocked query counts
     * for the last 24 hours window for the given tenant.
     *
     * <p>GET /api/v1/analytics/tenant/hourly?tenantId={uuid}
     */
    @GetMapping("/hourly")
    public ResponseEntity<ApiResponse<List<HourlyCount>>> getHourlyBreakdown(
            @RequestParam(required = false) UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {

        UUID resolvedTenantId = resolvetenantId(tenantId, headerTenantId);
        requireTenantAccess(userRole, headerTenantId, resolvedTenantId);
        List<HourlyCount> breakdown = dashboardService.getHourlyBreakdown(resolvedTenantId);
        return ResponseEntity.ok(ApiResponse.ok(breakdown));
    }

    private UUID resolvetenantId(UUID param, String headerTenantId) {
        if (param != null) return param;
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return UUID.fromString(headerTenantId); }
            catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid X-Tenant-Id header");
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "tenantId required (query param or X-Tenant-Id header)");
    }

    // ── access helpers ────────────────────────────────────────────────────────

    /**
     * Allows GLOBAL_ADMIN for any tenant.
     * Allows ISP_ADMIN only when X-Tenant-Id matches the requested tenantId.
     */
    private void requireTenantAccess(String role, String headerTenantId, UUID tenantId) {
        if ("GLOBAL_ADMIN".equalsIgnoreCase(role)) {
            return;
        }
        if ("ISP_ADMIN".equalsIgnoreCase(role)) {
            if (headerTenantId == null || headerTenantId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "ISP_ADMIN must have X-Tenant-Id header");
            }
            try {
                UUID headerTenantUuid = UUID.fromString(headerTenantId);
                if (headerTenantUuid.equals(tenantId)) {
                    return;
                }
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid X-Tenant-Id");
            }
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "ISP_ADMIN can only access their own tenant");
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "GLOBAL_ADMIN or ISP_ADMIN role required");
    }
}
