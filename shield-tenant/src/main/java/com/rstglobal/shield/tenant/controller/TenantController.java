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
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
@RequestMapping({"/api/v1/tenants", "/api/v1/tenant/tenants"})
@RequiredArgsConstructor
@Tag(name = "Tenants", description = "ISP tenant management (GLOBAL_ADMIN only)")
public class TenantController {

    private final TenantService tenantService;
    private final TenantRepository tenantRepository;
    private final EntityManager entityManager;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new ISP tenant")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Tenant created"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Slug or domain already in use"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
    public ApiResponse<TenantResponse> create(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody CreateTenantRequest req) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.create(req));
    }

    @GetMapping
    @Operation(summary = "List all tenants (paginated)", description = "Supports optional text search via ?q= parameter.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Tenant list returned"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
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
            @RequestHeader(value = "X-Tenant-Id", required = false) String callerTenantIdStr,
            @PathVariable UUID id) {
        requireGlobalAdminOrSelf(role, parseUuid(callerTenantIdStr), id);
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
    @Operation(summary = "Update tenant details", description = "Automatically re-applies plan feature defaults when the plan field changes.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Tenant updated"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN or ISP_ADMIN (own tenant) required"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Tenant not found")
    })
    public ApiResponse<TenantResponse> update(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String callerTenantIdStr,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTenantRequest req) {
        requireGlobalAdminOrSelf(role, parseUuid(callerTenantIdStr), id);
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
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "204", description = "Tenant deleted"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Tenant not found")
    })
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
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        UUID tenantId = parseUuid(tenantIdStr);
        if (tenantId == null) throw ShieldException.badRequest("X-Tenant-Id header is required");
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
            @RequestHeader(value = "X-Tenant-Id", required = false) String callerTenantIdStr,
            @PathVariable UUID id) {
        requireGlobalAdminOrSelf(role, parseUuid(callerTenantIdStr), id);

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Tenant", id));

        long customerCount = safeCount(
                "SELECT count(*) FROM profile.customers WHERE tenant_id = ?", id);
        long profileCount = safeCount(
                "SELECT count(*) FROM profile.child_profiles cp " +
                "JOIN profile.customers c ON c.id = cp.customer_id " +
                "WHERE c.tenant_id = ?", id);
        long deviceCount = safeCount(
                "SELECT count(*) FROM profile.devices WHERE tenant_id = ?", id);

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

        Integer maxCustomers = body.get("maxCustomers");
        Integer maxProfilesPerCustomer = body.get("maxProfilesPerCustomer");

        if (maxCustomers != null && (maxCustomers <= 0 || maxCustomers >= 1_000_000)) {
            throw ShieldException.badRequest("maxCustomers must be between 1 and 999999");
        }
        if (maxProfilesPerCustomer != null && (maxProfilesPerCustomer <= 0 || maxProfilesPerCustomer >= 1_000_000)) {
            throw ShieldException.badRequest("maxProfilesPerCustomer must be between 1 and 999999");
        }

        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Tenant", id));

        if (maxCustomers != null) {
            tenant.setMaxCustomers(maxCustomers);
        }
        if (maxProfilesPerCustomer != null) {
            tenant.setMaxProfilesPerCustomer(maxProfilesPerCustomer);
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

    private long safeCount(String sql, Object... params) {
        try {
            var query = entityManager.createNativeQuery(sql);
            for (int i = 0; i < params.length; i++) {
                query.setParameter(i + 1, params[i]);
            }
            Object result = query.getSingleResult();
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
            @RequestHeader(value = "X-Tenant-Id",  required = false) String callerTenantIdStr,
            @PathVariable UUID tenantId) {
        requireGlobalAdminOrSelf(role, parseUuid(callerTenantIdStr), tenantId);
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
            @RequestHeader(value = "X-Tenant-Id",  required = false) String callerTenantIdStr,
            @PathVariable UUID tenantId,
            @Valid @RequestBody UpdateBrandingRequest req) {
        requireGlobalAdminOrSelf(role, parseUuid(callerTenantIdStr), tenantId);
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
        if ("ISP_ADMIN".equals(role) && callerTenantId != null && callerTenantId.equals(targetTenantId)) return;
        throw ShieldException.forbidden("GLOBAL_ADMIN or ISP_ADMIN (own tenant) role required");
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }

    /** Safely parse a UUID from a header value — returns null if blank or malformed. */
    private static UUID parseUuid(String value) {
        if (value == null || value.isBlank()) return null;
        try { return UUID.fromString(value); }
        catch (IllegalArgumentException e) { return null; }
    }
}
