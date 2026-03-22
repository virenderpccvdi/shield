package com.rstglobal.shield.tenant.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.entity.Tenant;
import com.rstglobal.shield.tenant.repository.TenantRepository;
import com.rstglobal.shield.tenant.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Internal admin endpoints called by shield-admin bulk operations.
 *
 * These routes are on /internal/** and are NOT exposed through the API Gateway
 * (gateway only forwards /api/v1/tenants/** to shield-tenant). They are
 * reachable only via service-to-service calls within the cluster.
 */
@Slf4j
@RestController
@RequestMapping("/internal/tenants")
@RequiredArgsConstructor
@Tag(name = "Internal Tenant Admin", description = "Internal endpoints for bulk admin operations")
public class InternalTenantAdminController {

    private final TenantRepository tenantRepository;
    private final TenantService tenantService;

    // ── Suspend ──────────────────────────────────────────────────────────────

    /**
     * POST /internal/tenants/{id}/suspend
     * Deactivates the tenant and records the suspension reason and timestamp.
     *
     * Body: { "reason": "..." }  (reason is optional)
     */
    @PostMapping("/{id}/suspend")
    @Transactional
    @Operation(summary = "Internal: suspend a tenant")
    public ResponseEntity<ApiResponse<Map<String, Object>>> suspendTenant(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body) {

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Tenant", id));

        if (!tenant.isActive()) {
            log.info("Tenant {} is already inactive — no-op suspend", id);
            return ResponseEntity.ok(ApiResponse.ok(
                    Map.of("tenantId", id.toString(), "status", "already_suspended"),
                    "Tenant already suspended"));
        }

        tenant.setActive(false);
        // deletedAt is used for soft-delete; we keep it null on suspend (reversible)
        tenantRepository.save(tenant);

        String reason = (body != null) ? body.getOrDefault("reason", "Administrative action") : "Administrative action";
        log.info("Suspended tenant {} — reason: {}", id, reason);

        Map<String, Object> result = new HashMap<>();
        result.put("tenantId", id.toString());
        result.put("status", "suspended");
        result.put("reason", reason);
        result.put("suspendedAt", Instant.now().toString());
        return ResponseEntity.ok(ApiResponse.ok(result, "Tenant suspended"));
    }

    // ── Activate ─────────────────────────────────────────────────────────────

    /**
     * POST /internal/tenants/{id}/activate
     * Re-enables a previously suspended tenant.
     */
    @PostMapping("/{id}/activate")
    @Transactional
    @Operation(summary = "Internal: re-activate a tenant")
    public ResponseEntity<ApiResponse<Map<String, Object>>> activateTenant(
            @PathVariable UUID id) {

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Tenant", id));

        if (tenant.isActive()) {
            log.info("Tenant {} is already active — no-op activate", id);
            return ResponseEntity.ok(ApiResponse.ok(
                    Map.of("tenantId", id.toString(), "status", "already_active"),
                    "Tenant already active"));
        }

        // Clear soft-delete if it was set (reactivation restores the tenant fully)
        tenant.setActive(true);
        tenant.setDeletedAt(null);
        tenantRepository.save(tenant);

        log.info("Activated tenant {}", id);
        Map<String, Object> result = new HashMap<>();
        result.put("tenantId", id.toString());
        result.put("status", "active");
        result.put("activatedAt", Instant.now().toString());
        return ResponseEntity.ok(ApiResponse.ok(result, "Tenant activated"));
    }

    // ── Feature check (read-only) ─────────────────────────────────────────────

    /**
     * GET /internal/tenants/{id}/features/{feature}
     * Returns {@code true} if the named feature is enabled for the tenant,
     * {@code false} if it is disabled or not present in the features map.
     * Called by FeatureGateService in downstream microservices.
     */
    @GetMapping("/{id}/features/{feature}")
    @Transactional(readOnly = true)
    @Operation(summary = "Internal: check a single feature flag for a tenant")
    public ResponseEntity<Boolean> checkFeature(
            @PathVariable UUID id,
            @PathVariable String feature) {

        Tenant tenant = tenantRepository.findById(id).orElse(null);
        if (tenant == null) {
            log.debug("checkFeature: tenant {} not found — returning false", id);
            return ResponseEntity.ok(false);
        }
        Map<String, Boolean> features = tenant.getFeatures();
        boolean enabled = features != null && Boolean.TRUE.equals(features.get(feature));
        log.debug("checkFeature: tenant={} feature={} enabled={}", id, feature, enabled);
        return ResponseEntity.ok(enabled);
    }

    // ── Feature flag ─────────────────────────────────────────────────────────

    /**
     * PUT /internal/tenants/{id}/features
     * Toggle a single named feature flag on the tenant.
     *
     * Body: { "feature": "ai_monitoring", "enabled": true }
     */
    @PutMapping("/{id}/features")
    @Transactional
    @Operation(summary = "Internal: set a feature flag on a tenant")
    public ResponseEntity<ApiResponse<Map<String, Object>>> setFeatureFlag(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {

        String feature = body.get("feature") instanceof String s ? s : null;
        if (feature == null || feature.isBlank()) {
            throw ShieldException.badRequest("'feature' is required");
        }

        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));

        // Delegate to the existing service method that handles feature toggle + save
        tenantService.toggleFeature(id, feature, enabled);

        log.info("Set feature {} = {} on tenant {}", feature, enabled, id);
        Map<String, Object> result = new HashMap<>();
        result.put("tenantId", id.toString());
        result.put("feature", feature);
        result.put("enabled", enabled);
        return ResponseEntity.ok(ApiResponse.ok(result,
                "Feature '" + feature + "' set to " + enabled));
    }
}
