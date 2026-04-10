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
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "DNS Filtering", description = "Per-profile DNS filtering rules: categories, allowlist, blocklist, filter level, homework/bedtime modes and safe-search enforcement")
@Slf4j
@RestController
@RequestMapping("/api/v1/dns")
@RequiredArgsConstructor
public class DnsRulesController {

    private static final String PROFILE_SERVICE = "SHIELD-PROFILE";

    private final DnsRulesService rulesService;
    private final HomeworkModeService homeworkModeService;
    private final BedtimeLockService bedtimeLockService;
    private final RulesAuditLogRepository auditLogRepo;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient = RestClient.builder().build();

    @Operation(summary = "Get DNS rules for a profile", description = "Returns enabled categories, custom allowlist/blocklist, filter level, and feature flags for the given child profile.")
    @GetMapping("/rules/{profileId}")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> getRules(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getRules(profileId, parseUuid(tenantIdStr))));
    }

    @Operation(summary = "Update blocked content categories", description = "Replaces the set of enabled/blocked content categories for a child profile and syncs to AdGuard.")
    @PutMapping("/rules/{profileId}/categories")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateCategories(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody UpdateCategoriesRequest req) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateCategories(profileId, parseUuid(tenantIdStr), req)));
    }

    @Operation(summary = "Update custom allowlist", description = "Replaces the custom domain allowlist for a child profile (domains always permitted regardless of category blocks).")
    @PutMapping("/rules/{profileId}/allowlist")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateAllowlist(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody UpdateListRequest req) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateAllowlist(profileId, parseUuid(tenantIdStr), req)));
    }

    @Operation(summary = "Update custom blocklist", description = "Replaces the custom domain blocklist for a child profile (domains always blocked regardless of category settings).")
    @PutMapping("/rules/{profileId}/blocklist")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateBlocklist(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody UpdateListRequest req) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updateBlocklist(profileId, parseUuid(tenantIdStr), req)));
    }

    /** Combined endpoint: update both blocklist and allowlist in one call (used by mobile app). */
    @Operation(summary = "Update both custom allowlist and blocklist in one call")
    @PutMapping("/rules/{profileId}/custom-lists")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateCustomLists(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        @SuppressWarnings("unchecked")
        java.util.List<String> blocklist = (java.util.List<String>) body.get("customBlocklist");
        @SuppressWarnings("unchecked")
        java.util.List<String> allowlist = (java.util.List<String>) body.get("customAllowlist");
        return ResponseEntity.ok(ApiResponse.ok(
                rulesService.updateCustomLists(profileId, parseUuid(tenantIdStr), blocklist, allowlist)));
    }

    /** Apply a preset filter level (MILD, MODERATE, STRICT) — resets categories to defaults for that level. */
    @Operation(summary = "Apply a preset filter level (MILD, MODERATE, STRICT)", description = "Resets all content categories to the defaults for the chosen filter level.")
    @PutMapping("/rules/{profileId}/filter-level")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> updateFilterLevel(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestBody Map<String, String> body) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        String level = body.getOrDefault("filterLevel", "MODERATE").toUpperCase();
        return ResponseEntity.ok(ApiResponse.ok(
                rulesService.updateFilterLevel(profileId, parseUuid(tenantIdStr), level)));
    }

    @Operation(summary = "Allow or block a single domain", description = "Adds or removes a domain from the custom allowlist or blocklist for a child profile.")
    @PostMapping("/rules/{profileId}/domain/action")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> domainAction(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody DomainActionRequest req) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.domainAction(profileId, parseUuid(tenantIdStr), req)));
    }

    @Operation(summary = "Get content category names", description = "Returns a map of category ID to display name for all supported content categories.")
    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<Map<String, String>>> getCategories(
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getCategories()));
    }

    // ── Activity feed (DNS query log) ──────────────────────────────────────

    @Operation(summary = "Get recent DNS query activity", description = "Returns recent DNS queries for a child profile from the AdGuard query log.")
    @GetMapping("/rules/{profileId}/activity")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> getActivity(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestParam(defaultValue = "50") int limit) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        com.rstglobal.shield.dns.entity.DnsRules rules = rulesService.getRulesEntity(profileId, parseUuid(tenantIdStr));
        String clientId = rules != null ? rules.getDnsClientId() : null;
        java.util.List<Map<String, Object>> activity = rulesService.getActivity(clientId, limit);
        return ResponseEntity.ok(ApiResponse.ok(activity));
    }

    /** Force re-sync current DB rules to AdGuard for a profile (parent triggers after config change). */
    @Operation(summary = "Force sync rules to AdGuard", description = "Pushes the current DB rules for a child profile to AdGuard Home immediately.")
    @PostMapping("/rules/{profileId}/sync")
    public ResponseEntity<ApiResponse<com.rstglobal.shield.dns.dto.response.DnsRulesResponse>> forceSync(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.forceSync(profileId, parseUuid(tenantIdStr))));
    }

    // ── Pause / Resume filtering ─────────────────────────────────────────────

    @Operation(summary = "Pause DNS filtering for a profile", description = "Temporarily disables all DNS filtering for the child profile until resumed by a parent.")
    @PostMapping("/rules/{profileId}/pause")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> pauseFiltering(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        DnsRulesResponse response = rulesService.setFilteringPaused(profileId, parseUuid(tenantIdStr), true);
        return ResponseEntity.ok(ApiResponse.ok(response, "Filtering paused for profile"));
    }

    @Operation(summary = "Resume DNS filtering for a profile", description = "Re-enables DNS filtering after it was paused.")
    @PostMapping("/rules/{profileId}/resume")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> resumeFiltering(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        DnsRulesResponse response = rulesService.setFilteringPaused(profileId, parseUuid(tenantIdStr), false);
        return ResponseEntity.ok(ApiResponse.ok(response, "Filtering resumed for profile"));
    }

    // ── Platform defaults ─────────────────────────────────────────────────────

    /** ISP_ADMIN can read platform defaults (inherited rules); writes remain GLOBAL_ADMIN only. */
    @Operation(summary = "Get platform-wide default DNS rules")
    @GetMapping("/rules/platform")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> getPlatformDefaults(
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getPlatformDefaults()));
    }

    /** Propagate platform blocklist/allowlist to all existing child profiles. */
    @Operation(summary = "Propagate platform rules to all profiles (GLOBAL_ADMIN only)", description = "Copies platform-level blocklist and allowlist into every child profile's DNS rules.")
    @PostMapping("/rules/platform/propagate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> propagatePlatformRules(
            @RequestHeader("X-User-Role") String role) {
        requireGlobalAdmin(role);
        int count = rulesService.propagatePlatformRulesToAllProfiles();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("profilesUpdated", count)));
    }

    @Operation(summary = "Update platform-wide default categories (GLOBAL_ADMIN only)")
    @PutMapping("/rules/platform/categories")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> updatePlatformCategories(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateCategoriesRequest req) {
        requireGlobalAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updatePlatformCategories(req)));
    }

    @Operation(summary = "Update platform-wide default blocklist (GLOBAL_ADMIN only)")
    @PutMapping("/rules/platform/blocklist")
    public ResponseEntity<ApiResponse<PlatformDefaultsResponse>> updatePlatformBlocklist(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateListRequest req) {
        requireGlobalAdmin(role);
        return ResponseEntity.ok(ApiResponse.ok(rulesService.updatePlatformBlocklist(req)));
    }

    @Operation(summary = "Update platform-wide default allowlist (GLOBAL_ADMIN only)")
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
    @Operation(summary = "Start homework mode", description = "Activates homework mode for a set duration (1–480 min), applying a stricter content filter that permits only educational domains.")
    @PostMapping("/rules/{profileId}/homework/start")
    public ResponseEntity<ApiResponse<Map<String, Object>>> startHomework(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestBody Map<String, Integer> body) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
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
    @Operation(summary = "Stop homework mode early", description = "Ends an active homework mode session and restores the original DNS rules.")
    @PostMapping("/rules/{profileId}/homework/stop")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stopHomework(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        homeworkModeService.deactivate(profileId);
        return ResponseEntity.ok(ApiResponse.ok(
                homeworkModeService.getStatus(profileId),
                "Homework mode stopped"));
    }

    /**
     * Get current homework mode status: active, endsAt, minutesRemaining.
     */
    @Operation(summary = "Get homework mode status", description = "Returns whether homework mode is active, when it ends, and minutes remaining.")
    @GetMapping("/rules/{profileId}/homework/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> homeworkStatus(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(homeworkModeService.getStatus(profileId)));
    }

    // ── PC-05: YouTube Safe Mode ──────────────────────────────────────────────

    /**
     * Enable or disable YouTube Restricted Mode for a child profile via DNS CNAME rewrite.
     * Body: { "enabled": true }
     */
    @Operation(summary = "Enable or disable YouTube Restricted Mode via DNS CNAME rewrite")
    @PostMapping("/rules/{profileId}/youtube-safe-mode")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> setYoutubeSafeMode(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestBody Map<String, Boolean> body) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
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
    @Operation(summary = "Enable or disable DNS-level safe search", description = "Redirects Google, Bing, and DuckDuckGo DNS queries to their safe-search endpoints.")
    @PostMapping("/rules/{profileId}/safe-search")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> setSafeSearch(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestBody Map<String, Boolean> body) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
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
    @Operation(summary = "Block or unblock a social media platform at DNS level", description = "Supports facebook, instagram, and tiktok; adds or removes the platform's domains from the profile's blocklist.")
    @PostMapping("/rules/{profileId}/social-block")
    public ResponseEntity<ApiResponse<DnsRulesResponse>> setSocialBlock(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
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
    @Operation(summary = "Configure bedtime lock", description = "Enables or disables bedtime internet lock with start/end times (HH:mm); blocks all DNS queries during the bedtime window.")
    @PostMapping("/rules/{profileId}/bedtime/configure")
    public ResponseEntity<ApiResponse<Map<String, Object>>> configureBedtime(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestBody Map<String, Object> body) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        String start = (String) body.get("bedtimeStart");
        String end   = (String) body.get("bedtimeEnd");
        return ResponseEntity.ok(ApiResponse.ok(bedtimeLockService.configure(profileId, enabled, start, end)));
    }

    /**
     * Get current bedtime lock status for a child profile.
     * Returns: { enabled, bedtimeStart, bedtimeEnd, active }
     */
    @Operation(summary = "Get bedtime lock status", description = "Returns enabled flag, bedtime window, and whether the lock is currently active.")
    @GetMapping("/rules/{profileId}/bedtime/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bedtimeStatus(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        return ResponseEntity.ok(ApiResponse.ok(bedtimeLockService.getStatus(profileId)));
    }

    /** Get DNS rules change history for a child profile (parent/admin access). */
    @Operation(summary = "Get DNS rules change audit log", description = "Returns a paginated history of all DNS rule changes made for a child profile.")
    @GetMapping("/rules/{profileId}/audit-log")
    public ResponseEntity<ApiResponse<Page<RulesAuditLog>>> getAuditLog(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
        Page<RulesAuditLog> log = auditLogRepo.findByProfileIdOrderByCreatedAtDesc(
                profileId, PageRequest.of(page, Math.min(size, 200)));
        return ResponseEntity.ok(ApiResponse.ok(log));
    }

    /**
     * Quick DNS status for a profile: paused flag, filter level, homework/bedtime active.
     * Called by the Flutter app to show the DNS status badge on the DNS Rules screen.
     */
    @Operation(summary = "Quick DNS status for a profile", description = "Returns paused flag, filter level, and whether homework/bedtime modes are currently active.")
    @GetMapping("/{profileId}/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDnsStatus(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        requireCustomer(role);
        requireProfileOwnership(profileId, role, userId);
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

    /**
     * For CUSTOMER role: verifies that the given profileId belongs to the calling user.
     * Calls the profile service internal endpoint to resolve the owner's userId.
     * ISP_ADMIN and GLOBAL_ADMIN bypass this check (they manage by tenantId).
     *
     * Throws {@link ShieldException#forbidden} if the caller does not own this profile.
     */
    private void requireProfileOwnership(UUID profileId, String role, String callerUserIdStr) {
        if (!"CUSTOMER".equals(role)) {
            // ISP_ADMIN and GLOBAL_ADMIN are not subject to per-user profile isolation
            return;
        }
        if (callerUserIdStr == null || callerUserIdStr.isBlank()) {
            throw ShieldException.forbidden("Missing caller identity");
        }
        try {
            String profileBase = resolveServiceUrl(PROFILE_SERVICE);
            if (profileBase == null) {
                // Profile service unavailable — fail closed for security
                log.warn("Profile service unavailable — rejecting DNS rules access for profileId={}", profileId);
                throw ShieldException.forbidden("Cannot verify profile ownership");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> parentInfo = restClient.get()
                    .uri(profileBase + "/internal/profiles/" + profileId + "/parent")
                    .retrieve()
                    .body(Map.class);
            if (parentInfo == null) {
                throw ShieldException.forbidden("Profile not found");
            }
            String ownerUserId = (String) parentInfo.get("userId");
            if (!callerUserIdStr.equals(ownerUserId)) {
                log.warn("Ownership check failed: caller={} ownerOfProfile={} profileId={}",
                        callerUserIdStr, ownerUserId, profileId);
                throw ShieldException.forbidden("You do not own this child profile");
            }
        } catch (ShieldException se) {
            throw se;
        } catch (Exception e) {
            log.warn("Profile ownership check failed for profileId={}: {}", profileId, e.getMessage());
            throw ShieldException.forbidden("Cannot verify profile ownership");
        }
    }

    private String resolveServiceUrl(String serviceName) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka", serviceName);
            return null;
        }
        ServiceInstance instance = instances.get(0);
        return instance.getUri().toString();
    }

    private static UUID parseUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try { return UUID.fromString(s); } catch (IllegalArgumentException e) { return null; }
    }
}
