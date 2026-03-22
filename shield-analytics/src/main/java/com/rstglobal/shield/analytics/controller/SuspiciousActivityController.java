package com.rstglobal.shield.analytics.controller;

import com.rstglobal.shield.analytics.entity.SuspiciousActivityAlert;
import com.rstglobal.shield.analytics.service.SuspiciousActivityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

/**
 * CS-05: Suspicious Activity Alert API.
 * Accessed via API Gateway at /api/v1/analytics/alerts/...
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/analytics/alerts")
@RequiredArgsConstructor
public class SuspiciousActivityController {

    private final SuspiciousActivityService suspiciousActivityService;

    /**
     * GET /api/v1/analytics/alerts/{profileId}?pendingOnly=true
     * Returns alerts for a profile, sorted newest first (limit 50 applied in service).
     */
    @GetMapping("/{profileId}")
    public ResponseEntity<List<SuspiciousActivityAlert>> getAlerts(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "false") boolean pendingOnly,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(userRole);
        List<SuspiciousActivityAlert> alerts = suspiciousActivityService.getAlerts(profileId, pendingOnly);
        // Limit to 50 most recent
        if (alerts.size() > 50) {
            alerts = alerts.subList(0, 50);
        }
        return ResponseEntity.ok(alerts);
    }

    /**
     * POST /api/v1/analytics/alerts/{alertId}/acknowledge
     * Dismisses (acknowledges) a suspicious activity alert.
     */
    @PostMapping("/{alertId}/acknowledge")
    public ResponseEntity<Void> acknowledgeAlert(
            @PathVariable UUID alertId,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(userRole);
        suspiciousActivityService.acknowledge(alertId);
        return ResponseEntity.ok().build();
    }

    // ── Access validation ─────────────────────────────────────────────────────

    private void validateAccess(String userRole) {
        if (userRole == null) return; // gateway will have blocked un-authed requests
        if (!"CUSTOMER".equalsIgnoreCase(userRole)
            && !"ISP_ADMIN".equalsIgnoreCase(userRole)
            && !"GLOBAL_ADMIN".equalsIgnoreCase(userRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied.");
        }
    }
}
