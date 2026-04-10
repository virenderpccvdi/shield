package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ScheduleOverrideRequest;
import com.rstglobal.shield.dns.dto.request.UpdateScheduleRequest;
import com.rstglobal.shield.dns.dto.response.ScheduleResponse;
import com.rstglobal.shield.dns.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "DNS Schedule", description = "Per-profile internet access schedules: day/time grids, presets (SCHOOL, BEDTIME, STRICT, WEEKEND), and temporary overrides")
@RestController
@RequestMapping("/api/v1/dns/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @Operation(summary = "Get access schedule for a profile", description = "Returns the full day/hour grid, active preset, and any running override for a child profile.")
    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<ScheduleResponse>> getSchedule(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.getSchedule(profileId, parseUuid(tenantId))));
    }

    @Operation(summary = "Update access schedule for a profile", description = "Saves a custom day/hour internet access grid for a child profile.")
    @PutMapping("/{profileId}")
    public ResponseEntity<ApiResponse<ScheduleResponse>> updateSchedule(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @Valid @RequestBody UpdateScheduleRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.updateSchedule(profileId, req, parseUuid(tenantId))));
    }

    @Operation(summary = "Apply a schedule preset (SCHOOL, BEDTIME, STRICT, WEEKEND)", description = "Replaces the current schedule grid with the selected named preset.")
    @PostMapping("/{profileId}/preset")
    public ResponseEntity<ApiResponse<ScheduleResponse>> applyPreset(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @RequestParam String preset) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.applyPreset(profileId, preset, parseUuid(tenantId))));
    }

    @Operation(summary = "Apply a temporary schedule override", description = "Grants or restricts internet access for a short period, overriding the normal schedule until the override expires or is cancelled.")
    @PostMapping("/{profileId}/override")
    public ResponseEntity<ApiResponse<ScheduleResponse>> applyOverride(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @Valid @RequestBody ScheduleOverrideRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.applyOverride(profileId, req, parseUuid(tenantId))));
    }

    /** Lightweight status: returns currentMode, overrideActive, overrideEndsAt without the full grid. */
    @Operation(summary = "Get schedule status summary", description = "Returns currentMode, overrideActive, overrideEndsAt, and activePreset without the full day/hour grid.")
    @GetMapping("/{profileId}/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        requireCustomer(role);
        ScheduleResponse s = scheduleService.getSchedule(profileId, parseUuid(tenantId));
        String mode = (Boolean.TRUE.equals(s.getOverrideActive()) && s.getOverrideType() != null)
                ? s.getOverrideType()
                : (s.getActivePreset() != null ? s.getActivePreset() : "NORMAL");
        Map<String, Object> status = new HashMap<>();
        status.put("currentMode", mode);
        status.put("overrideActive", s.getOverrideActive());
        status.put("overrideType", s.getOverrideType());
        status.put("overrideEndsAt", s.getOverrideEndsAt());
        status.put("activePreset", s.getActivePreset());
        return ResponseEntity.ok(ApiResponse.ok(status));
    }

    @Operation(summary = "Cancel active schedule override", description = "Removes any running temporary override and reverts to the normal access schedule.")
    @DeleteMapping("/{profileId}/override")
    public ResponseEntity<ApiResponse<ScheduleResponse>> cancelOverride(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.cancelOverride(profileId, parseUuid(tenantId))));
    }

    /**
     * GET /api/v1/dns/schedules/presets
     * DNS12 — List all available schedule presets (DB-backed, Redis-cached).
     */
    @Operation(summary = "List available schedule presets", description = "Returns all named schedule presets available for selection (DB-backed, Redis-cached).")
    @GetMapping("/presets")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listPresets(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.listPresets()));
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
