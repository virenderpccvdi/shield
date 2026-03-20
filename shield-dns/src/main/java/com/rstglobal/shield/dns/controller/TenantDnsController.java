package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.entity.TenantDnsSettings;
import com.rstglobal.shield.dns.repository.TenantDnsSettingsRepository;
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

    private void requireIspOrAdmin(String role) {
        if (!"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("ISP_ADMIN or GLOBAL_ADMIN role required");
        }
    }
}
