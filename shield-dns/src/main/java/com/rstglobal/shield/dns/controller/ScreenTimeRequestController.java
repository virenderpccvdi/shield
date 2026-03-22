package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ScreenTimeRequestDto;
import com.rstglobal.shield.dns.dto.response.ScreenTimeRequestResponse;
import com.rstglobal.shield.dns.service.ScreenTimeRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * FC-02: Screen Time Request endpoints.
 *
 * Child-side:
 *   POST /api/v1/dns/screen-time/{profileId}/request
 *
 * Parent-side:
 *   POST /api/v1/dns/screen-time/{requestId}/approve
 *   POST /api/v1/dns/screen-time/{requestId}/deny
 *   GET  /api/v1/dns/screen-time/{profileId}/pending
 *   GET  /api/v1/dns/screen-time/{profileId}/all
 */
@RestController
@RequestMapping("/api/v1/dns/screen-time")
@RequiredArgsConstructor
public class ScreenTimeRequestController {

    private final ScreenTimeRequestService service;

    /**
     * Child app submits a screen-time extension request.
     * X-Profile-Id and X-Customer-Id are injected by the gateway from the JWT.
     */
    @PostMapping("/{profileId}/request")
    public ResponseEntity<ApiResponse<ScreenTimeRequestResponse>> request(
            @PathVariable UUID profileId,
            @RequestHeader(value = "X-Customer-Id", required = false) String customerId,
            @Valid @RequestBody ScreenTimeRequestDto req) {

        UUID custId = customerId != null && !customerId.isBlank()
                ? UUID.fromString(customerId)
                : null;

        ScreenTimeRequestResponse resp = service.requestTime(profileId, custId,
                req.getMinutes(), req.getReason());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(resp));
    }

    /**
     * Parent approves a pending request.
     */
    @PostMapping("/{requestId}/approve")
    public ResponseEntity<ApiResponse<ScreenTimeRequestResponse>> approve(
            @PathVariable UUID requestId,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Role") String role) {
        requireParent(role);
        return ResponseEntity.ok(ApiResponse.ok(service.approve(requestId, UUID.fromString(userId))));
    }

    /**
     * Parent denies a pending request.
     */
    @PostMapping("/{requestId}/deny")
    public ResponseEntity<ApiResponse<ScreenTimeRequestResponse>> deny(
            @PathVariable UUID requestId,
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-User-Role") String role) {
        requireParent(role);
        return ResponseEntity.ok(ApiResponse.ok(service.deny(requestId, UUID.fromString(userId))));
    }

    /**
     * Parent views pending requests for a given child profile.
     */
    @GetMapping("/{profileId}/pending")
    public ResponseEntity<ApiResponse<List<ScreenTimeRequestResponse>>> getPending(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireParent(role);
        return ResponseEntity.ok(ApiResponse.ok(service.getPending(profileId)));
    }

    /**
     * Parent views all requests (last 20) for a given child profile.
     */
    @GetMapping("/{profileId}/all")
    public ResponseEntity<ApiResponse<List<ScreenTimeRequestResponse>>> getAll(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireParent(role);
        return ResponseEntity.ok(ApiResponse.ok(service.getAll(profileId)));
    }

    private void requireParent(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Parent role required");
        }
    }
}
