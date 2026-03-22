package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.AccessScheduleRequest;
import com.rstglobal.shield.dns.dto.response.AccessScheduleResponse;
import com.rstglobal.shield.dns.service.AccessScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * PO-06 — Advanced Parental Control Schedule endpoints.
 * <p>
 * Base path: {@code /api/v1/dns/access-schedules}
 * <p>
 * All endpoints require at minimum CUSTOMER role (parents).
 * ISP_ADMIN and GLOBAL_ADMIN are also allowed for support purposes.
 */
@RestController
@RequestMapping("/api/v1/dns/access-schedules")
@RequiredArgsConstructor
public class AccessScheduleController {

    private final AccessScheduleService accessScheduleService;

    /**
     * GET /api/v1/dns/access-schedules/{profileId}
     * <p>
     * Returns all access schedule rules for the given child profile
     * (both active and inactive).
     */
    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<List<AccessScheduleResponse>>> getSchedules(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(accessScheduleService.getSchedules(profileId)));
    }

    /**
     * POST /api/v1/dns/access-schedules/{profileId}
     * <p>
     * Creates a new access schedule rule for the given child profile.
     */
    @PostMapping("/{profileId}")
    public ResponseEntity<ApiResponse<AccessScheduleResponse>> createSchedule(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @Valid @RequestBody AccessScheduleRequest req) {
        requireCustomer(role);
        AccessScheduleResponse response = accessScheduleService.createSchedule(profileId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    /**
     * PUT /api/v1/dns/access-schedules/{profileId}/{scheduleId}
     * <p>
     * Updates an existing access schedule rule.
     */
    @PutMapping("/{profileId}/{scheduleId}")
    public ResponseEntity<ApiResponse<AccessScheduleResponse>> updateSchedule(
            @PathVariable UUID profileId,
            @PathVariable UUID scheduleId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
            @Valid @RequestBody AccessScheduleRequest req) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(accessScheduleService.updateSchedule(scheduleId, req)));
    }

    /**
     * DELETE /api/v1/dns/access-schedules/{profileId}/{scheduleId}
     * <p>
     * Deletes an access schedule rule.  Enforcement is re-evaluated immediately
     * so any lock applied by this rule is cleared if no other rules require it.
     */
    @DeleteMapping("/{profileId}/{scheduleId}")
    public ResponseEntity<ApiResponse<Void>> deleteSchedule(
            @PathVariable UUID profileId,
            @PathVariable UUID scheduleId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        requireCustomer(role);
        accessScheduleService.deleteSchedule(scheduleId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
