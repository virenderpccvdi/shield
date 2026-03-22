package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.request.BrandingRequest;
import com.rstglobal.shield.admin.dto.response.BrandingResponse;
import com.rstglobal.shield.admin.service.BrandingService;
import com.rstglobal.shield.common.exception.ShieldException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/branding")
@RequiredArgsConstructor
public class BrandingController {

    private final BrandingService brandingService;

    /**
     * GET /api/v1/admin/branding
     * Returns branding config for the calling tenant (X-Tenant-Id header injected by gateway).
     */
    @GetMapping
    public ResponseEntity<BrandingResponse> getBranding(
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String callerRole) {
        UUID effectiveTenantId = resolveTenantId(tenantId, callerRole);
        return ResponseEntity.ok(brandingService.getBranding(effectiveTenantId));
    }

    /**
     * PUT /api/v1/admin/branding
     * Create or update branding config for the calling tenant.
     */
    @PutMapping
    public ResponseEntity<BrandingResponse> upsertBranding(
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String callerRole,
            @RequestBody BrandingRequest request) {
        UUID effectiveTenantId = resolveTenantId(tenantId, callerRole);
        return ResponseEntity.ok(brandingService.upsertBranding(request, effectiveTenantId));
    }

    /**
     * GET /api/v1/admin/branding/public/{tenantSlug}
     * Public endpoint for white-label app configuration lookup by custom domain.
     */
    @GetMapping("/public/{tenantSlug}")
    public ResponseEntity<BrandingResponse> getPublicBranding(
            @PathVariable String tenantSlug) {
        return ResponseEntity.ok(brandingService.getPublicBranding(tenantSlug));
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * GLOBAL_ADMIN has no tenantId — for them branding operations are not applicable
     * unless they pass a specific tenantId. ISP_ADMIN and CUSTOMER must have tenantId.
     */
    private UUID resolveTenantId(UUID tenantId, String callerRole) {
        if (tenantId != null) return tenantId;
        if ("GLOBAL_ADMIN".equals(callerRole)) {
            throw ShieldException.badRequest("GLOBAL_ADMIN must supply a tenantId query param to manage branding");
        }
        throw ShieldException.badRequest("X-Tenant-Id header is required");
    }
}
