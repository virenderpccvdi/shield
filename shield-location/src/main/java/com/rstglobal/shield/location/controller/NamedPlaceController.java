package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.NamedPlaceRequest;
import com.rstglobal.shield.location.dto.response.NamedPlaceResponse;
import com.rstglobal.shield.location.service.NamedPlaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/location/{profileId}/places")
@RequiredArgsConstructor
public class NamedPlaceController {

    private final NamedPlaceService namedPlaceService;

    @PostMapping
    public ResponseEntity<ApiResponse<NamedPlaceResponse>> create(
            @PathVariable UUID profileId,
            @Valid @RequestBody NamedPlaceRequest req,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        NamedPlaceResponse response = namedPlaceService.createNamedPlace(req, profileId, tenantId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response, "Named place created"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NamedPlaceResponse>>> list(
            @PathVariable UUID profileId) {
        List<NamedPlaceResponse> response = namedPlaceService.listNamedPlaces(profileId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<NamedPlaceResponse>> update(
            @PathVariable UUID profileId,
            @PathVariable UUID id,
            @Valid @RequestBody NamedPlaceRequest req) {
        NamedPlaceResponse response = namedPlaceService.updateNamedPlace(id, req);
        return ResponseEntity.ok(ApiResponse.ok(response, "Named place updated"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID profileId,
            @PathVariable UUID id) {
        namedPlaceService.deleteNamedPlace(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Named place deleted"));
    }
}
