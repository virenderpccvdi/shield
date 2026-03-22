package com.rstglobal.shield.tenant.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.dto.request.CreateTenantRequest;
import com.rstglobal.shield.tenant.dto.request.UpdateBrandingRequest;
import com.rstglobal.shield.tenant.dto.request.UpdateTenantRequest;
import com.rstglobal.shield.tenant.dto.response.BrandingResponse;
import com.rstglobal.shield.tenant.dto.response.TenantResponse;
import com.rstglobal.shield.tenant.entity.Tenant;
import com.rstglobal.shield.tenant.repository.TenantRepository;
import com.rstglobal.shield.tenant.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@Tag(name = "Tenants", description = "ISP tenant management (GLOBAL_ADMIN only)")
public class TenantController {

    private final TenantService tenantService;
    private final TenantRepository tenantRepository;
    private final EntityManager entityManager;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new ISP tenant")
    public ApiResponse<TenantResponse> create(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody CreateTenantRequest req) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.create(req));
    }

    @GetMapping
    @Operation(summary = "List all tenants (paginated)")
    public ApiResponse<PagedResponse<TenantResponse>> list(
            @RequestHeader("X-User-Role") String role,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        requireGlobalAdmin(role);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.ok(tenantService.list(q, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get tenant by ID")
    public ApiResponse<TenantResponse> getById(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.getById(id));
    }

    @GetMapping("/slug/{slug}")
    @Operation(summary = "Get tenant by slug")
    public ApiResponse<TenantResponse> getBySlug(
            @RequestHeader("X-User-Role") String role,
            @PathVariable String slug) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.getBySlug(slug));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update tenant details")
    public ApiResponse<TenantResponse> update(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTenantRequest req) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.update(id, req));
    }

    @PatchMapping("/{id}/features/{feature}")
    @Operation(summary = "Enable or disable a feature flag")
    public ApiResponse<TenantResponse> toggleFeature(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @PathVariable String feature,
            @RequestBody Map<String, Boolean> body) {
        requireGlobalAdmin(role);
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        return ApiResponse.ok(tenantService.toggleFeature(id, feature, enabled));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Soft-delete a tenant")
    public void delete(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        tenantService.delete(id);
    }

    /** ISP Admin: get own tenant details */
    @GetMapping("/me")
    @Operation(summary = "ISP Admin: get own tenant details")
    public ApiResponse<TenantResponse> getMyTenant(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ApiResponse.ok(tenantService.getById(tenantId));
    }

    // ── Quota endpoints ───────────────────────────────────────────────────────

    /**
     * GET /api/v1/tenants/{id}/quotas
     * Returns tenant quota limits and current usage.
     * Accessible by GLOBAL_ADMIN, or by ISP_ADMIN for their own tenant.
     */
    @GetMapping("/{id}/quotas")
    @Transactional(readOnly = true)
    @Operation(summary = "Get tenant quota limits and current usage")
    public ApiResponse<Map<String, Object>> getQuotas(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID callerTenantId,
            @PathVariable UUID id) {
        requireGlobalAdminOrSelf(role, callerTenantId, id);

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Tenant", id));

        long customerCount = safeCount(
                "SELECT count(*) FROM profile.customers WHERE tenant_id = '" + id + "'");
        long profileCount = safeCount(
                "SELECT count(*) FROM profile.child_profiles cp " +
                "JOIN profile.customers c ON c.id = cp.customer_id " +
                "WHERE c.tenant_id = '" + id + "'");
        long deviceCount = safeCount(
                "SELECT count(*) FROM profile.devices WHERE tenant_id = '" + id + "'");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenantId", id);
        result.put("tenantSlug", tenant.getSlug());
        result.put("plan", tenant.getPlan());
        result.put("limits", Map.of(
                "maxCustomers", tenant.getMaxCustomers(),
                "maxProfilesPerCustomer", tenant.getMaxProfilesPerCustomer()
        ));
        result.put("usage", Map.of(
                "customers", customerCount,
                "childProfiles", profileCount,
                "devices", deviceCount
        ));
        result.put("utilization", Map.of(
                "customersPercent", tenant.getMaxCustomers() > 0
                        ? Math.round((double) customerCount / tenant.getMaxCustomers() * 100) : 0
        ));
        return ApiResponse.ok(result);
    }

    /**
     * PUT /api/v1/tenants/{id}/quotas
     * Update tenant quota limits — GLOBAL_ADMIN only.
     */
    @PutMapping("/{id}/quotas")
    @Transactional
    @Operation(summary = "Update tenant quota limits (GLOBAL_ADMIN only)")
    public ApiResponse<Map<String, Object>> updateQuotas(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @PathVariable UUID id,
            @RequestBody Map<String, Integer> body) {
        requireGlobalAdmin(role);

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Tenant", id));

        if (body.containsKey("maxCustomers") && body.get("maxCustomers") != null) {
            tenant.setMaxCustomers(body.get("maxCustomers"));
        }
        if (body.containsKey("maxProfilesPerCustomer") && body.get("maxProfilesPerCustomer") != null) {
            tenant.setMaxProfilesPerCustomer(body.get("maxProfilesPerCustomer"));
        }
        tenantRepository.save(tenant);
        log.info("Updated quotas for tenant {}: maxCustomers={}, maxProfilesPerCustomer={}",
                id, tenant.getMaxCustomers(), tenant.getMaxProfilesPerCustomer());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenantId", id);
        result.put("maxCustomers", tenant.getMaxCustomers());
        result.put("maxProfilesPerCustomer", tenant.getMaxProfilesPerCustomer());
        return ApiResponse.ok(result);
    }

    private long safeCount(String sql) {
        try {
            Object result = entityManager.createNativeQuery(sql).getSingleResult();
            return ((Number) result).longValue();
        } catch (Exception e) {
            log.warn("Quota count query failed: {}", e.getMessage());
            return 0;
        }
    }

    // ── Branding endpoints ────────────────────────────────────────────────────

    /**
     * GET /api/v1/tenants/{tenantId}/branding
     * Accessible by GLOBAL_ADMIN or ISP_ADMIN (own tenant).
     */
    @GetMapping("/{tenantId}/branding")
    @Operation(summary = "Get tenant white-label branding settings")
    public ApiResponse<BrandingResponse> getBranding(
            @RequestHeader(value = "X-User-Role",  required = false) String role,
            @RequestHeader(value = "X-Tenant-Id",  required = false) UUID callerTenantId,
            @PathVariable UUID tenantId) {
        requireGlobalAdminOrSelf(role, callerTenantId, tenantId);
        return ApiResponse.ok(tenantService.getBranding(tenantId));
    }

    /**
     * PUT /api/v1/tenants/{tenantId}/branding
     * ISP_ADMIN can update their own tenant's branding.
     */
    @PutMapping("/{tenantId}/branding")
    @Operation(summary = "Update tenant white-label branding settings")
    public ApiResponse<BrandingResponse> updateBranding(
            @RequestHeader(value = "X-User-Role",  required = false) String role,
            @RequestHeader(value = "X-Tenant-Id",  required = false) UUID callerTenantId,
            @PathVariable UUID tenantId,
            @Valid @RequestBody UpdateBrandingRequest req) {
        requireGlobalAdminOrSelf(role, callerTenantId, tenantId);
        return ApiResponse.ok(tenantService.updateBranding(tenantId, req));
    }

    /**
     * GET /internal/tenants/{tenantId}/branding
     * Internal endpoint — no auth headers required.
     * Called by shield-notification and other services.
     */
    @GetMapping("/internal/{tenantId}/branding")
    @Operation(summary = "Internal: get branding (no auth required)")
    public ApiResponse<BrandingResponse> getBrandingInternal(@PathVariable UUID tenantId) {
        return ApiResponse.ok(tenantService.getBranding(tenantId));
    }

    @PostMapping("/{id}/sync-features")
    @Operation(summary = "Force re-apply plan defaults to tenant features (GLOBAL_ADMIN only)")
    public ApiResponse<TenantResponse> syncPlanFeatures(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.syncPlanFeatures(id));
    }

    private void requireGlobalAdminOrSelf(String role, UUID callerTenantId, UUID targetTenantId) {
        if ("GLOBAL_ADMIN".equals(role)) return;
        if ("ISP_ADMIN".equals(role) && targetTenantId.equals(callerTenantId)) return;
        throw ShieldException.forbidden("GLOBAL_ADMIN or ISP_ADMIN (own tenant) role required");
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }
}
