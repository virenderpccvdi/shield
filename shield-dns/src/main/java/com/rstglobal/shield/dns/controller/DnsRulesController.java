package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.DomainActionRequest;
import com.rstglobal.shield.dns.dto.request.UpdateCategoriesRequest;
import com.rstglobal.shield.dns.dto.request.UpdateListRequest;
import com.rstglobal.shield.dns.dto.response.DnsRulesResponse;
import com.rstglobal.shield.dns.dto.response.PlatformDefaultsResponse;
import com.rstglobal.shield.dns.service.DnsRulesService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dns")
@RequiredArgsConstructor
public class DnsRulesController {

    private final DnsRulesService rulesService;

    @GetMapping("/rules/{profileId}")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> getRules(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getRules(profileId, parseUuid(tenantIdStr))));
    }

    @PutMapping("/rules/{profileId}/categories")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateCategories(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody UpdateCategoriesRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateCategories(profileId, parseUuid(tenantIdStr), req)));
    }

    @PutMapping("/rules/{profileId}/allowlist")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateAllowlist(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody UpdateListRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateAllowlist(profileId, parseUuid(tenantIdStr), req)));
    }

    @PutMapping("/rules/{profileId}/blocklist")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateBlocklist(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody UpdateListRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateBlocklist(profileId, parseUuid(tenantIdStr), req)));
    }

    /** Combined endpoint: update both blocklist and allowlist in one call (used by mobile app). */
    @PutMapping("/rules/{profileId}/custom-lists")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateCustomLists(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);
        @SuppressWarnings("unchecked")
        java.util.List<String> blocklist = (java.util.List<String>) body.get("customBlocklist");
        @SuppressWarnings("unchecked")
        java.util.List<String> allowlist = (java.util.List<String>) body.get("customAllowlist");
        return ResponseEntity.ok(ApiResponse.ok(
                rulesService.updateCustomLists(profileId, parseUuid(tenantIdStr), blocklist, allowlist)));
    }

    /** Apply a preset filter level (MILD, MODERATE, STRICT) — resets categories to defaults for that level. */
    @PutMapping("/rules/{profileId}/filter-level")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateFilterLevel(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestBody Map<String, String> body) {
        requireCustomer(role);
        String level = body.getOrDefault("filterLevel", "MODERATE").toUpperCase();
        return ResponseEntity.ok(ApiResponse.ok(
                rulesService.updateFilterLevel(profileId, parseUuid(tenantIdStr), level)));
    }

    @PostMapping("/rules/{profileId}/domain/action")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> domainAction(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody DomainActionRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.domainAction(profileId, parseUuid(tenantIdStr), req)));
    }

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<Map<String, String>>> getCategories(
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getCategories()));
    }

    // ── Activity feed (DNS query log) ──────────────────────────────────────

    @GetMapping("/rules/{profileId}/activity")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> getActivity(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestParam(defaultValue = "50") int limit) {
        requireCustomer(role);
        com.rstglobal.shield.dns.entity.DnsRules rules = rulesService.getRulesEntity(profileId, parseUuid(tenantIdStr));
        String clientId = rules != null ? rules.getDnsClientId() : null;
        java.util.List<Map<String, Object>> activity = rulesService.getActivity(clientId, limit);
        return ResponseEntity.ok(ApiResponse.ok(activity));
    }

    /** Force re-sync current DB rules to AdGuard for a profile (parent triggers after config change). */
    @PostMapping("/rules/{profileId}/sync")
    public ResponseEntity<ApiResponse<com.rstglobal.shield.dns.dto.response.DnsRulesResponse>> forceSync(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.forceSync(profileId, parseUuid(tenantIdStr))));
    }

    // ── Pause / Resume filtering ─────────────────────────────────────────────

    @PostMapping("/rules/{profileId}/pause")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> pauseFiltering(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        DnsRulesResponse response = rulesService.setFilteringPaused(profileId, parseUuid(tenantIdStr), true);
        return ResponseEntity.ok(ApiResponse.ok(response, "Filtering paused for profile"));
    }

    @PostMapping("/rules/{profileId}/resume")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> resumeFiltering(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        DnsRulesResponse response = rulesService.setFilteringPaused(profileId, parseUuid(tenantIdStr), false);
        return ResponseEntity.ok(ApiResponse.ok(response, "Filtering resumed for profile"));
    }

    // ── Platform defaults ─────────────────────────────────────────────────────

    /** ISP_ADMIN can read platform defaults (inherited rules); writes remain GLOBAL_ADMIN only. */
    @GetMapping("/rules/platform")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> getPlatformDefaults(
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getPlatformDefaults()));
    }

    /** Propagate platform blocklist/allowlist to all existing child profiles. */
    @PostMapping("/rules/platform/propagate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> propagatePlatformRules(
            @RequestHeader("X-User-Role") String role) {
        requireGlobalAdmin(role);
        int count = rulesService.propagatePlatformRulesToAllProfiles();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("profilesUpdated", count)));
    }

    @PutMapping("/rules/platform/categories")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> updatePlatformCategories(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateCategoriesRequest req) {
        requireGlobalAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updatePlatformCategories(req)));
    }

    @PutMapping("/rules/platform/blocklist")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> updatePlatformBlocklist(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateListRequest req) {
        requireGlobalAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updatePlatformBlocklist(req)));
    }

    @PutMapping("/rules/platform/allowlist")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> updatePlatformAllowlist(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateListRequest req) {
        requireGlobalAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updatePlatformAllowlist(req)));
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Global admin role required");
        }
    }

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }

    private static UUID parseUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try { return UUID.fromString(s); } catch (IllegalArgumentException e) { return null; }
    }
}
