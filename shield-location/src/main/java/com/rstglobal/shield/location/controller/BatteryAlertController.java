package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.dto.request.BatteryReportRequest;
import com.rstglobal.shield.location.dto.request.BatteryThresholdRequest;
import com.rstglobal.shield.location.dto.response.BatterySettingsResponse;
import com.rstglobal.shield.location.service.BatteryAlertService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/location/battery")
@RequiredArgsConstructor
public class BatteryAlertController {

    private final BatteryAlertService batteryAlertService;

    /**
     * CS-04: Child app reports current battery level.
     * Triggers parent notification if battery is below threshold and cooldown elapsed.
     */
    @PostMapping("/{profileId}/report")
    public ResponseEntity<ApiResponse<BatterySettingsResponse>> reportBattery(
            @PathVariable UUID profileId,
            @Valid @RequestBody BatteryReportRequest req) {
        BatterySettingsResponse result = batteryAlertService.reportBattery(profileId, req.getBatteryPercent());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * CS-04: Parent retrieves battery alert settings for a child profile.
     */
    @GetMapping("/{profileId}/settings")
    public ResponseEntity<ApiResponse<BatterySettingsResponse>> getSettings(
            @PathVariable UUID profileId) {
        return ResponseEntity.ok(ApiResponse.ok(batteryAlertService.getSettings(profileId)));
    }

    /**
     * CS-04: Parent updates the battery alert threshold.
     */
    @PutMapping("/{profileId}/threshold")
    public ResponseEntity<ApiResponse<BatterySettingsResponse>> updateThreshold(
            @PathVariable UUID profileId,
            @Valid @RequestBody BatteryThresholdRequest req) {
        BatterySettingsResponse result = batteryAlertService.updateThreshold(profileId, req.getThreshold());
        return ResponseEntity.ok(ApiResponse.ok(result, "Threshold updated"));
    }
}
