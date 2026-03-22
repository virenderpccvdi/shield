package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.CheckinReminderRequest;
import com.rstglobal.shield.location.dto.response.CheckinReminderResponse;
import com.rstglobal.shield.location.service.CheckinReminderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * CS-09: Check-in Reminder — notify parents when a child hasn't reported location
 * within the configured interval.
 */
@RestController
@RequestMapping("/api/v1/location/checkin-reminder")
@RequiredArgsConstructor
public class CheckinReminderController {

    private final CheckinReminderService checkinReminderService;

    /**
     * Retrieve check-in reminder settings for a child profile.
     * Returns 404 if no settings have been configured yet (defaults apply).
     */
    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<CheckinReminderResponse>> getSettings(
            @PathVariable UUID profileId) {
        return checkinReminderService.getSettings(profileId)
                .map(settings -> ResponseEntity.ok(ApiResponse.ok(settings)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create or update check-in reminder settings for a child profile.
     * Performs an upsert — safe to call even when no settings exist yet.
     */
    @PutMapping("/{profileId}")
    public ResponseEntity<ApiResponse<CheckinReminderResponse>> upsertSettings(
            @PathVariable UUID profileId,
            @RequestBody CheckinReminderRequest req) {
        CheckinReminderResponse result = checkinReminderService.upsertSettings(profileId, req);
        return ResponseEntity.ok(ApiResponse.ok(result, "Check-in reminder settings saved"));
    }
}
