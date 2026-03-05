package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.SosRequest;
import com.rstglobal.shield.location.dto.response.SosEventResponse;
import com.rstglobal.shield.location.service.SosService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/location")
@RequiredArgsConstructor
public class SosController {

    private final SosService sosService;

    @GetMapping("/{profileId}/sos")
    public ResponseEntity<ApiResponse<List<SosEventResponse>>> getActiveSos(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "false") boolean all) {
        List<SosEventResponse> response = all
                ? sosService.getAllSosEvents(profileId)
                : sosService.getActiveSosEvents(profileId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * Child app panic button — creates an SOS/panic event.
     */
    @PostMapping("/child/panic")
    public ResponseEntity<ApiResponse<SosEventResponse>> childPanic(
            @Valid @RequestBody SosRequest req) {
        SosEventResponse response = sosService.triggerSos(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(response, "PANIC alert triggered"));
    }

    @PostMapping("/sos/{id}/acknowledge")
    public ResponseEntity<ApiResponse<SosEventResponse>> acknowledge(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        SosEventResponse response = sosService.acknowledgeSos(id, userId);
        return ResponseEntity.ok(ApiResponse.ok(response, "SOS acknowledged"));
    }

    @PostMapping("/sos/{id}/resolve")
    public ResponseEntity<ApiResponse<SosEventResponse>> resolve(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        SosEventResponse response = sosService.resolveSos(id, userId);
        return ResponseEntity.ok(ApiResponse.ok(response, "SOS resolved"));
    }
}
