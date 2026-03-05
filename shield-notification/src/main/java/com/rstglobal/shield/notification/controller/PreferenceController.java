package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.notification.dto.request.UpdatePreferenceRequest;
import com.rstglobal.shield.notification.entity.AlertPreference;
import com.rstglobal.shield.notification.repository.AlertPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications/preferences")
@RequiredArgsConstructor
public class PreferenceController {

    private final AlertPreferenceRepository prefRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<AlertPreference>> getPreferences(
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-Tenant-Id") String tenantId) {
        AlertPreference pref = prefRepo.findByUserId(UUID.fromString(userId))
                .orElse(defaultPref(UUID.fromString(userId), UUID.fromString(tenantId)));
        return ResponseEntity.ok(ApiResponse.ok(pref));
    }

    @PutMapping
    @Transactional
    public ResponseEntity<ApiResponse<AlertPreference>> updatePreferences(
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody UpdatePreferenceRequest req) {

        AlertPreference pref = prefRepo.findByUserId(UUID.fromString(userId))
                .orElse(defaultPref(UUID.fromString(userId), UUID.fromString(tenantId)));

        if (req.getPushEnabled()          != null) pref.setPushEnabled(req.getPushEnabled());
        if (req.getEmailEnabled()         != null) pref.setEmailEnabled(req.getEmailEnabled());
        if (req.getWhatsappEnabled()      != null) pref.setWhatsappEnabled(req.getWhatsappEnabled());
        if (req.getTelegramEnabled()      != null) pref.setTelegramEnabled(req.getTelegramEnabled());
        if (req.getQuietHoursEnabled()    != null) pref.setQuietHoursEnabled(req.getQuietHoursEnabled());
        if (req.getQuietStartHour()       != null) pref.setQuietStartHour(req.getQuietStartHour());
        if (req.getQuietEndHour()         != null) pref.setQuietEndHour(req.getQuietEndHour());
        if (req.getBlockAlerts()          != null) pref.setBlockAlerts(req.getBlockAlerts());
        if (req.getScheduleAlerts()       != null) pref.setScheduleAlerts(req.getScheduleAlerts());
        if (req.getBudgetAlerts()         != null) pref.setBudgetAlerts(req.getBudgetAlerts());
        if (req.getExtensionAlerts()      != null) pref.setExtensionAlerts(req.getExtensionAlerts());
        if (req.getWeeklyReportEnabled()  != null) pref.setWeeklyReportEnabled(req.getWeeklyReportEnabled());
        if (req.getWhatsappNumber()       != null) pref.setWhatsappNumber(req.getWhatsappNumber());
        if (req.getTelegramChatId()       != null) pref.setTelegramChatId(req.getTelegramChatId());

        return ResponseEntity.ok(ApiResponse.ok(prefRepo.save(pref)));
    }

    private AlertPreference defaultPref(UUID userId, UUID tenantId) {
        return AlertPreference.builder().userId(userId).tenantId(tenantId).build();
    }
}
