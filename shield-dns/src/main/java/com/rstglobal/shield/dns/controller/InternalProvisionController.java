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
     * Force-sync ALL profiles to AdGuard. Use after deploying the sync bug fix
     * to repair existing profiles that were provisioned with empty blocked_services.
     */
    @PostMapping("/sync-all")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> syncAll() {
        int synced = rulesService.syncAllProfiles();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("synced", synced)));
    }
}
