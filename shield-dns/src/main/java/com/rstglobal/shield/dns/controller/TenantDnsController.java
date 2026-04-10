package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.entity.TenantDnsSettings;
import com.rstglobal.shield.dns.repository.TenantDnsSettingsRepository;
import com.rstglobal.shield.dns.service.DnsRulesService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dns/rules/tenant")
@RequiredArgsConstructor
public class TenantDnsController {

    private final TenantDnsSettingsRepository tenantDnsRepo;
    private final DnsRulesService dnsRulesService;

    record UpdateCategoriesRequest(Map<String, Boolean> categories) {}
    record UpdateListRequest(List<String> domains) {}
    record SettingsResponse(
        UUID tenantId, Map<String, Boolean> enabledCategories,
        List<String> customBlocklist, List<String> customAllowlist,
        boolean safesearchEnabled, boolean adsBlocked) {}

    @GetMapping
    public ApiResponse<SettingsResponse> get(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        requireIspOrAdmin(role);
        TenantDnsSettings s = getOrCreate(tenantId);
        return ApiResponse.ok(toResponse(s));
    }

    @PutMapping("/categories")
    public ApiResponse<SettingsResponse> updateCategories(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestBody UpdateCategoriesRequest req) {
        requireIspOrAdmin(role);
        TenantDnsSettings s = getOrCreate(tenantId);
        s.getEnabledCategories().putAll(req.categories());
        return ApiResponse.ok(toResponse(tenantDnsRepo.save(s)));
    }

    @PutMapping("/blocklist")
    public ApiResponse<SettingsResponse> updateBlocklist(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestBody UpdateListRequest req) {
        requireIspOrAdmin(role);
        TenantDnsSettings s = getOrCreate(tenantId);
        s.setCustomBlocklist(req.domains());
        return ApiResponse.ok(toResponse(tenantDnsRepo.save(s)));
    }

    @PutMapping("/allowlist")
    public ApiResponse<SettingsResponse> updateAllowlist(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestBody UpdateListRequest req) {
        requireIspOrAdmin(role);
        TenantDnsSettings s = getOrCreate(tenantId);
        s.setCustomAllowlist(req.domains());
        return ApiResponse.ok(toResponse(tenantDnsRepo.save(s)));
    }

    private TenantDnsSettings getOrCreate(UUID tenantId) {
        return tenantDnsRepo.findByTenantId(tenantId)
                .orElseGet(() -> tenantDnsRepo.save(
                        TenantDnsSettings.builder().tenantId(tenantId).build()));
    }

    private SettingsResponse toResponse(TenantDnsSettings s) {
        return new SettingsResponse(s.getTenantId(), s.getEnabledCategories(),
                s.getCustomBlocklist(), s.getCustomAllowlist(),
                s.getSafesearchEnabled(), s.getAdsBlocked());
    }

    // ── ISP-level category force-block (DNS13) ─────────────────────────────────

    /**
     * GET /api/v1/dns/rules/tenant/isp-overrides
     * Returns all ISP-level category overrides for this tenant.
     */
    @GetMapping("/isp-overrides")
    public ApiResponse<Map<String, Boolean>> getIspOverrides(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        requireIspOrAdmin(role);
        return ApiResponse.ok(dnsRulesService.getIspCategoryOverrides(tenantId));
    }

    /**
     * PUT /api/v1/dns/rules/tenant/isp-overrides/{category}
     * Set or update an ISP-level category override.
     * Body: { "blocked": true }
     * When blocked=true, customers under this ISP cannot enable the category.
     */
    @PutMapping("/isp-overrides/{category}")
    public ApiResponse<String> setIspOverride(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @PathVariable String category,
            @RequestBody Map<String, Boolean> body) {
        requireIspOrAdmin(role);
        boolean blocked = Boolean.TRUE.equals(body.get("blocked"));
        dnsRulesService.setIspCategoryOverride(tenantId, category, blocked);
        return ApiResponse.ok("ISP override set: " + category + " blocked=" + blocked);
    }

    /**
     * DELETE /api/v1/dns/rules/tenant/isp-overrides/{category}
     * Remove an ISP-level category override, restoring customer control.
     */
    @DeleteMapping("/isp-overrides/{category}")
    public ApiResponse<String> removeIspOverride(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @PathVariable String category) {
        requireIspOrAdmin(role);
        dnsRulesService.removeIspCategoryOverride(tenantId, category);
        return ApiResponse.ok("ISP override removed for category: " + category);
    }

    private void requireIspOrAdmin(String role) {
        if (!"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("ISP_ADMIN or GLOBAL_ADMIN role required");
        }
    }
}
