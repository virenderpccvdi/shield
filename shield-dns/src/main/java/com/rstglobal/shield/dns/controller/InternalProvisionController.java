package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.dns.service.ProfileProvisionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/provision")
    public ResponseEntity<ApiResponse<Void>> provision(
            @RequestParam UUID tenantId,
            @RequestParam UUID profileId,
            @RequestParam(defaultValue = "STRICT") String filterLevel) {
        provisionService.provision(tenantId, profileId, filterLevel);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
