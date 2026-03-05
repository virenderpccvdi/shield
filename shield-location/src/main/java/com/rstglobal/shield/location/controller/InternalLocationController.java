package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.LocationUploadRequest;
import com.rstglobal.shield.location.dto.response.LocationResponse;
import com.rstglobal.shield.location.service.LocationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Internal endpoint — called by child device app to upload GPS coordinates.
 * No authentication required; accessible only via internal network / gateway.
 */
@RestController
@RequestMapping("/internal/location")
@RequiredArgsConstructor
public class InternalLocationController {

    private final LocationService locationService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<LocationResponse>> upload(
            @Valid @RequestBody LocationUploadRequest req) {
        LocationResponse response = locationService.uploadLocation(req, null, "DEVICE");
        return ResponseEntity.ok(ApiResponse.ok(response, "Location uploaded successfully"));
    }
}
