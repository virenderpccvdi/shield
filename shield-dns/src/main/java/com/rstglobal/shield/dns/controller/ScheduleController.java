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
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.getSchedule(profileId)));
    }

    @PutMapping("/{profileId}")
    public ResponseEntity<ApiResponse<ScheduleResponse>> updateSchedule(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody UpdateScheduleRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.updateSchedule(profileId, req)));
    }

    @PostMapping("/{profileId}/preset")
    public ResponseEntity<ApiResponse<ScheduleResponse>> applyPreset(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestParam String preset) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.applyPreset(profileId, preset)));
    }

    @PostMapping("/{profileId}/override")
    public ResponseEntity<ApiResponse<ScheduleResponse>> applyOverride(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody ScheduleOverrideRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.applyOverride(profileId, req)));
    }

    @DeleteMapping("/{profileId}/override")
    public ResponseEntity<ApiResponse<ScheduleResponse>> cancelOverride(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.cancelOverride(profileId)));
    }

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
