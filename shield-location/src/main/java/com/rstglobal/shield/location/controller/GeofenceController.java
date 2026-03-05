package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.GeofenceRequest;
import com.rstglobal.shield.location.dto.response.GeofenceResponse;
import com.rstglobal.shield.location.service.GeofenceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/location/{profileId}/geofences")
@RequiredArgsConstructor
public class GeofenceController {

    private final GeofenceService geofenceService;

    @PostMapping
    public ResponseEntity<ApiResponse<GeofenceResponse>> create(
            @PathVariable UUID profileId,
            @Valid @RequestBody GeofenceRequest req,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        GeofenceResponse response = geofenceService.createGeofence(req, profileId, tenantId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response, "Geofence created"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<GeofenceResponse>>> list(
            @PathVariable UUID profileId) {
        List<GeofenceResponse> response = geofenceService.listGeofences(profileId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<GeofenceResponse>> update(
            @PathVariable UUID profileId,
            @PathVariable UUID id,
            @Valid @RequestBody GeofenceRequest req) {
        GeofenceResponse response = geofenceService.updateGeofence(id, req);
        return ResponseEntity.ok(ApiResponse.ok(response, "Geofence updated"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID profileId,
            @PathVariable UUID id) {
        geofenceService.deleteGeofence(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Geofence deleted"));
    }
}
