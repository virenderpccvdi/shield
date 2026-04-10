package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.dns.service.DnsRulesService;
import com.rstglobal.shield.dns.service.ProfileProvisionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Internal endpoint — called by shield-profile when a child profile is created.
 * Reachable only via internal service calls (not exposed through gateway).
 */
@RestController
@RequestMapping("/internal/dns")
@RequiredArgsConstructor
public class InternalProvisionController {

    private final ProfileProvisionService provisionService;
    private final DnsRulesService rulesService;

    @PostMapping("/provision")
    public ResponseEntity<ApiResponse<Void>> provision(
            @RequestParam(required = false) String tenantId,
            @RequestParam UUID profileId,
            @RequestParam(defaultValue = "STRICT") String filterLevel,
            @RequestParam(required = false) String clientId,
            @RequestParam(required = false) String profileName) {
        UUID tid = (tenantId != null && !tenantId.isBlank()) ? UUID.fromString(tenantId) : null;
        provisionService.provision(tid, profileId, filterLevel, clientId, profileName);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    /**
     * Broadcast rules for ALL profiles to shield-dns-resolver.
     * Use to repair profiles that were provisioned before a rules bug fix.
     */
    @PostMapping("/sync-all")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> syncAll() {
        int synced = rulesService.syncAllProfiles();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("synced", synced)));
    }

    /**
     * Lookup profileId by dnsClientId. Called by shield-dns-resolver via Feign.
     */
    @GetMapping("/client/{dnsClientId}/profile")
    public ResponseEntity<ApiResponse<Map<String, String>>> getProfileByClientId(
            @PathVariable String dnsClientId) {
        return rulesService.findByDnsClientId(dnsClientId)
            .map(rules -> ResponseEntity.ok(ApiResponse.ok(Map.of(
                "profileId", rules.getProfileId().toString(),
                "tenantId", rules.getTenantId() != null ? rules.getTenantId().toString() : ""
            ))))
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get full DNS rules for a profile. Called by shield-dns-resolver to load rules into Redis.
     */
    @GetMapping("/rules/{profileId}")
    public ResponseEntity<ApiResponse<Object>> getRulesForResolver(@PathVariable UUID profileId) {
        return ResponseEntity.ok(ApiResponse.ok(rulesService.getRulesForProfile(profileId)));
    }

    /**
     * Apply a new filter level to an existing profile's DNS rules.
     * Called by shield-profile when a parent changes the child's filter level.
     */
    @PostMapping("/filter-level/{profileId}")
    public ResponseEntity<ApiResponse<Void>> applyFilterLevel(
            @PathVariable UUID profileId,
            @RequestParam String level,
            @RequestParam(required = false) String tenantId) {
        UUID tid = (tenantId != null && !tenantId.isBlank()) ? UUID.fromString(tenantId) : null;
        rulesService.updateFilterLevel(profileId, tid, level);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
