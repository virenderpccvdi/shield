package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ScheduleOverrideRequest;
import com.rstglobal.shield.dns.dto.request.UpdateScheduleRequest;
import com.rstglobal.shield.dns.dto.response.ScheduleResponse;
import com.rstglobal.shield.dns.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dns/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<ScheduleResponse>> getSchedule(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.getSchedule(profileId, parseUuid(tenantId))));
    }

    @PutMapping("/{profileId}")
    public ResponseEntity<ApiResponse<ScheduleResponse>> updateSchedule(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @Valid @RequestBody UpdateScheduleRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.updateSchedule(profileId, req, parseUuid(tenantId))));
    }

    @PostMapping("/{profileId}/preset")
    public ResponseEntity<ApiResponse<ScheduleResponse>> applyPreset(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @RequestParam String preset) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.applyPreset(profileId, preset, parseUuid(tenantId))));
    }

    @PostMapping("/{profileId}/override")
    public ResponseEntity<ApiResponse<ScheduleResponse>> applyOverride(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @Valid @RequestBody ScheduleOverrideRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.applyOverride(profileId, req, parseUuid(tenantId))));
    }

    @DeleteMapping("/{profileId}/override")
    public ResponseEntity<ApiResponse<ScheduleResponse>> cancelOverride(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.cancelOverride(profileId, parseUuid(tenantId))));
    }

    private UUID parseUuid(String val) {
        try { return val != null && !val.isBlank() ? UUID.fromString(val) : null; } catch (Exception e) { return null; }
    }

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
