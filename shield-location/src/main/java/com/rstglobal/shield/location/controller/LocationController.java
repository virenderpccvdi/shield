package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.CheckinRequest;
import com.rstglobal.shield.location.dto.response.LocationResponse;
import com.rstglobal.shield.location.entity.SpoofingAlert;
import com.rstglobal.shield.location.service.LocationService;
import com.rstglobal.shield.location.service.SpoofingDetectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Parent-facing location endpoints — JWT validated by API Gateway.
 * X-User-Id and X-User-Role headers injected by gateway.
 */
@RestController
@RequestMapping("/api/v1/location")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;
    private final SpoofingDetectionService spoofingDetectionService;

    @GetMapping("/{profileId}/latest")
    public ResponseEntity<ApiResponse<LocationResponse>> getLatestLocation(
            @PathVariable UUID profileId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        Optional<LocationResponse> response = locationService.getLatestLocation(profileId, tenantId);
        return response
                .map(r -> ResponseEntity.ok(ApiResponse.ok(r)))
                .orElse(ResponseEntity.ok(ApiResponse.ok(null, "No location data yet")));
    }

    @GetMapping("/{profileId}/history")
    public ResponseEntity<ApiResponse<Page<LocationResponse>>> getLocationHistory(
            @PathVariable UUID profileId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @PageableDefault(size = 100) Pageable pageable,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        OffsetDateTime effectiveFrom = from != null ? from : OffsetDateTime.now().minusDays(7);
        OffsetDateTime effectiveTo   = to   != null ? to   : OffsetDateTime.now();
        Page<LocationResponse> response = locationService.getLocationHistory(profileId, tenantId, effectiveFrom, effectiveTo, pageable);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * Child manual check-in — creates a location record with type=CHECKIN.
     */
    @PostMapping("/child/checkin")
    public ResponseEntity<ApiResponse<LocationResponse>> childCheckin(
            @Valid @RequestBody CheckinRequest req) {
        LocationResponse response = locationService.childCheckin(req);
        return ResponseEntity.ok(ApiResponse.ok(response, "Check-in recorded"));
    }

    /**
     * Returns current speed estimate from recent location points.
     * If only 1 point exists, speed = 0.
     */
    @GetMapping("/{profileId}/speed")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSpeed(
            @PathVariable UUID profileId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        Map<String, Object> speedData = locationService.estimateSpeed(profileId);
        return ResponseEntity.ok(ApiResponse.ok(speedData));
    }

    /**
     * Returns last 20 spoofing detection alerts for a child profile.
     * Alerts are generated automatically during each location upload.
     */
    @GetMapping("/{profileId}/spoofing-alerts")
    public ResponseEntity<ApiResponse<List<SpoofingAlert>>> getSpoofingAlerts(
            @PathVariable UUID profileId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        List<SpoofingAlert> alerts = spoofingDetectionService.getRecentAlerts(profileId);
        return ResponseEntity.ok(ApiResponse.ok(alerts));
    }
}
