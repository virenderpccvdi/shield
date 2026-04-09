package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.DomainActionRequest;
import com.rstglobal.shield.dns.dto.request.UpdateCategoriesRequest;
import com.rstglobal.shield.dns.dto.request.UpdateListRequest;
import com.rstglobal.shield.dns.dto.response.DnsRulesResponse;
import com.rstglobal.shield.dns.dto.response.PlatformDefaultsResponse;
import com.rstglobal.shield.dns.entity.RulesAuditLog;
import com.rstglobal.shield.dns.repository.RulesAuditLogRepository;
import com.rstglobal.shield.dns.service.BedtimeLockService;
import com.rstglobal.shield.dns.service.DnsRulesService;
import com.rstglobal.shield.dns.service.HomeworkModeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dns")
@RequiredArgsConstructor
public class DnsRulesController {

    private final DnsRulesService rulesService;
    private final HomeworkModeService homeworkModeService;
    private final BedtimeLockService bedtimeLockService;
    private final RulesAuditLogRepository auditLogRepo;

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

    // ── Homework Mode ─────────────────────────────────────────────────────────

    /**
     * Start a homework mode session for a child profile.
     * Body: { "durationMinutes": 60 }  (1–480 minutes)
     */
    @PostMapping("/rules/{profileId}/homework/start")
    public ResponseEntity<ApiResponse<Map<String, Object>>> startHomework(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, Integer> body) {
        requireCustomer(role);
        int durationMinutes = body.getOrDefault("durationMinutes", 60);
        if (durationMinutes < 1 || durationMinutes > 480) {
            throw ShieldException.badRequest("Duration must be between 1 and 480 minutes");
        }
        homeworkModeService.activate(profileId, durationMinutes);
        return ResponseEntity.ok(ApiResponse.ok(
                homeworkModeService.getStatus(profileId),
                "Homework mode started for " + durationMinutes + " minutes"));
    }

    /**
     * Stop an active homework mode session early, restoring original rules.
     */
    @PostMapping("/rules/{profileId}/homework/stop")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stopHomework(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        homeworkModeService.deactivate(profileId);
        return ResponseEntity.ok(ApiResponse.ok(
                homeworkModeService.getStatus(profileId),
                "Homework mode stopped"));
    }

    /**
     * Get current homework mode status: active, endsAt, minutesRemaining.
     */
    @GetMapping("/rules/{profileId}/homework/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> homeworkStatus(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(homeworkModeService.getStatus(profileId)));
    }

    // ── PC-05: YouTube Safe Mode ──────────────────────────────────────────────

    /**
     * Enable or disable YouTube Restricted Mode for a child profile via DNS CNAME rewrite.
     * Body: { "enabled": true }
     */
    @PostMapping("/rules/{profileId}/youtube-safe-mode")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> setYoutubeSafeMode(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, Boolean> body) {
        requireCustomer(role);
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        DnsRulesResponse response = rulesService.setYoutubeSafeMode(profileId, enabled);
        return ResponseEntity.ok(ApiResponse.ok(response,
                "YouTube safe mode " + (enabled ? "enabled" : "disabled")));
    }

    // ── PC-06: Safe Search ────────────────────────────────────────────────────

    /**
     * Enable or disable DNS-level safe search enforcement for a child profile.
     * Redirects Google, Bing, and DuckDuckGo queries to their safe-search endpoints.
     * Body: { "enabled": true }
     */
    @PostMapping("/rules/{profileId}/safe-search")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> setSafeSearch(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, Boolean> body) {
        requireCustomer(role);
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        DnsRulesResponse response = rulesService.setSafeSearch(profileId, enabled);
        return ResponseEntity.ok(ApiResponse.ok(response,
                "Safe search " + (enabled ? "enabled" : "disabled")));
    }

    // ── Social Media Blocking ─────────────────────────────────────────────────

    /**
     * Block or unblock a specific social media platform at DNS level.
     * Supported platforms: facebook, instagram, tiktok
     * Body: { "platform": "facebook", "enabled": true }
     */
    @PostMapping("/rules/{profileId}/social-block")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> setSocialBlock(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);
        String platform = String.valueOf(body.getOrDefault("platform", ""));
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        DnsRulesResponse response = rulesService.setSocialBlock(profileId, platform, enabled);
        return ResponseEntity.ok(ApiResponse.ok(response,
                platform + " blocking " + (enabled ? "enabled" : "disabled")));
    }

    // ── Bedtime Lock (PC-01) ──────────────────────────────────────────────────

    /**
     * Configure bedtime lock for a child profile.
     * Body: { "enabled": true, "bedtimeStart": "21:00", "bedtimeEnd": "07:00" }
     */
    @PostMapping("/rules/{profileId}/bedtime/configure")
    public ResponseEntity<ApiResponse<Map<String, Object>>> configureBedtime(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        String start = (String) body.get("bedtimeStart");
        String end   = (String) body.get("bedtimeEnd");
        return ResponseEntity.ok(ApiResponse.ok(bedtimeLockService.configure(profileId, enabled, start, end)));
    }

    /**
     * Get current bedtime lock status for a child profile.
     * Returns: { enabled, bedtimeStart, bedtimeEnd, active }
     */
    @GetMapping("/rules/{profileId}/bedtime/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bedtimeStatus(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(bedtimeLockService.getStatus(profileId)));
    }

    /** Get DNS rules change history for a child profile (parent/admin access). */
    @GetMapping("/rules/{profileId}/audit-log")
    public ResponseEntity<ApiResponse<Page<RulesAuditLog>>> getAuditLog(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireCustomer(role);
        Page<RulesAuditLog> log = auditLogRepo.findByProfileIdOrderByCreatedAtDesc(
                profileId, PageRequest.of(page, Math.min(size, 200)));
        return ResponseEntity.ok(ApiResponse.ok(log));
    }

    /**
     * Quick DNS status for a profile: paused flag, filter level, homework/bedtime active.
     * Called by the Flutter app to show the DNS status badge on the DNS Rules screen.
     */
    @GetMapping("/{profileId}/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDnsStatus(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        DnsRulesResponse rules = rulesService.getRules(profileId, null);
        boolean paused = rules.getEnabledCategories() != null
                && Boolean.TRUE.equals(rules.getEnabledCategories().get("__paused__"));
        Map<String, Object> status = Map.of(
                "paused", paused,
                "filterLevel", rules.getFilterLevel() != null ? rules.getFilterLevel() : "MODERATE",
                "homeworkActive", homeworkModeService.getStatus(profileId).getOrDefault("active", false),
                "bedtimeActive", bedtimeLockService.getStatus(profileId).getOrDefault("active", false)
        );
        return ResponseEntity.ok(ApiResponse.ok(status, "DNS status retrieved"));
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
