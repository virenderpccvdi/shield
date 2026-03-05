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
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getRules(profileId)));
    }

    @PutMapping("/rules/{profileId}/categories")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateCategories(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateCategoriesRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateCategories(profileId, req)));
    }

    @PutMapping("/rules/{profileId}/allowlist")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateAllowlist(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateListRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateAllowlist(profileId, req)));
    }

    @PutMapping("/rules/{profileId}/blocklist")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateBlocklist(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateListRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateBlocklist(profileId, req)));
    }

    @PostMapping("/rules/{profileId}/domain/action")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> domainAction(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody DomainActionRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.domainAction(profileId, req)));
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
            @RequestParam(defaultValue = "20") int limit) {
        requireCustomer(role);
        // Returns mock/empty list — AdGuard is not deployed; real data would come from analytics service
        java.util.List<Map<String, Object>> activity = new java.util.ArrayList<>();
        // Placeholder: in production, query the analytics service for recent DNS queries
        return ResponseEntity.ok(ApiResponse.ok(activity, "DNS activity for profile (AdGuard not deployed — empty list)"));
    }

    // ── Pause / Resume filtering ─────────────────────────────────────────────

    @PostMapping("/rules/{profileId}/pause")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> pauseFiltering(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        DnsRulesResponse response = rulesService.setFilteringPaused(profileId, true);
        return ResponseEntity.ok(ApiResponse.ok(response, "Filtering paused for profile"));
    }

    @PostMapping("/rules/{profileId}/resume")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> resumeFiltering(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        DnsRulesResponse response = rulesService.setFilteringPaused(profileId, false);
        return ResponseEntity.ok(ApiResponse.ok(response, "Filtering resumed for profile"));
    }

    // ── Platform defaults (GLOBAL_ADMIN only) ────────────────────────────────

    @GetMapping("/rules/platform")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> getPlatformDefaults(
            @RequestHeader("X-User-Role") String role) {
        requireGlobalAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getPlatformDefaults()));
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
}
