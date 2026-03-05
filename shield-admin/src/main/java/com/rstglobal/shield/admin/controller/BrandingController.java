package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.request.BrandingRequest;
import com.rstglobal.shield.admin.dto.response.BrandingResponse;
import com.rstglobal.shield.admin.service.BrandingService;
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
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(brandingService.getBranding(tenantId));
    }

    /**
     * PUT /api/v1/admin/branding
     * Create or update branding config for the calling tenant.
     */
    @PutMapping
    public ResponseEntity<BrandingResponse> upsertBranding(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestBody BrandingRequest request) {
        return ResponseEntity.ok(brandingService.upsertBranding(request, tenantId));
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
}
