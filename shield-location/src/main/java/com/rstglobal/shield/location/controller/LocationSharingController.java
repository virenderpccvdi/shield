package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.CreateShareRequest;
import com.rstglobal.shield.location.dto.response.LocationShareResponse;
import com.rstglobal.shield.location.dto.response.SharedLocationResponse;
import com.rstglobal.shield.location.service.LocationSharingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Manages time-limited shareable location links for child profiles.
 *
 * Authenticated endpoints (JWT via Gateway):
 *   POST   /api/v1/location/shares              — create a share
 *   GET    /api/v1/location/shares/{profileId}  — list active shares for a profile
 *   DELETE /api/v1/location/shares/{shareId}    — revoke a share
 *
 * Public endpoint (no auth required):
 *   GET    /public/location/share/{token}       — view shared location (open to anyone with the link)
 */
@RestController
@RequiredArgsConstructor
public class LocationSharingController {

    private final LocationSharingService locationSharingService;

    // ──────────────────────────────────────────────────────────────────────────
    // Authenticated endpoints — reached via /api/v1/location/shares prefix
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Create a new shareable location link.
     * The X-User-Id header is injected by the API Gateway after JWT validation.
     */
    @PostMapping("/api/v1/location/shares")
    public ResponseEntity<ApiResponse<LocationShareResponse>> createShare(
            @Valid @RequestBody CreateShareRequest req,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {

        LocationShareResponse response = locationSharingService.createShare(userId, req);
        return ResponseEntity.ok(ApiResponse.ok(response, "Share link created"));
    }

    /**
     * List all active shares for a specific child profile.
     */
    @GetMapping("/api/v1/location/shares/{profileId}")
    public ResponseEntity<ApiResponse<List<LocationShareResponse>>> listShares(
            @PathVariable UUID profileId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {

        List<LocationShareResponse> shares = locationSharingService.listShares(profileId);
        return ResponseEntity.ok(ApiResponse.ok(shares));
    }

    /**
     * Revoke a share link. Only the creator may revoke it.
     */
    @DeleteMapping("/api/v1/location/shares/{shareId}")
    public ResponseEntity<ApiResponse<Void>> revokeShare(
            @PathVariable UUID shareId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {

        locationSharingService.revokeShare(shareId, userId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Share link revoked"));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public endpoint — no authentication required
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Retrieve a child's latest location using a shareable token.
     * No Shield account needed — accessible by anyone with the link.
     * View count is incremented on each call; the link becomes inactive
     * once expired or the view limit is reached.
     */
    @GetMapping("/public/location/share/{token}")
    public ResponseEntity<ApiResponse<SharedLocationResponse>> getSharedLocation(
            @PathVariable String token) {

        SharedLocationResponse response = locationSharingService.getSharedLocation(token);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
