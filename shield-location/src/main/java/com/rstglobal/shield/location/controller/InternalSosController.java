package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.SosRequest;
import com.rstglobal.shield.location.dto.response.SosEventResponse;
import com.rstglobal.shield.location.service.SosService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Internal endpoint — called by child device app when panic button is triggered.
 * No authentication required; accessible only via internal network / gateway.
 */
@RestController
@RequestMapping("/internal/location")
@RequiredArgsConstructor
public class InternalSosController {

    private final SosService sosService;

    @PostMapping("/sos")
    public ResponseEntity<ApiResponse<SosEventResponse>> triggerSos(
            @Valid @RequestBody SosRequest req) {
        SosEventResponse response = sosService.triggerSos(req);
        return ResponseEntity.ok(ApiResponse.ok(response, "SOS alert triggered"));
    }
}
