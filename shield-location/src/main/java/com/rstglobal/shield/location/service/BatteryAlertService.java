package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.response.BatterySettingsResponse;
import com.rstglobal.shield.location.entity.DeviceSettings;
import com.rstglobal.shield.location.repository.DeviceSettingsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class BatteryAlertService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";
    private static final String PROFILE_SERVICE = "SHIELD-PROFILE";
    private static final int ALERT_COOLDOWN_MINUTES = 30;

    private final DeviceSettingsRepository settingsRepo;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public BatteryAlertService(DeviceSettingsRepository settingsRepo, DiscoveryClient discoveryClient) {
        this.settingsRepo = settingsRepo;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    @Transactional
    public BatterySettingsResponse reportBattery(UUID profileId, int batteryPercent) {
        DeviceSettings settings = settingsRepo.findByProfileId(profileId)
                .orElseGet(() -> {
                    DeviceSettings s = new DeviceSettings();
                    s.setProfileId(profileId);
                    s.setBatteryThreshold(20);
                    return s;
                });

        settings.setLastBatteryPct(batteryPercent);
        settings = settingsRepo.save(settings);

        if (batteryPercent <= settings.getBatteryThreshold()) {
            boolean shouldAlert = settings.getLastAlertAt() == null ||
                    settings.getLastAlertAt().isBefore(OffsetDateTime.now().minusMinutes(ALERT_COOLDOWN_MINUTES));

            if (shouldAlert) {
                settings.setLastAlertAt(OffsetDateTime.now());
                settingsRepo.save(settings);
                sendBatteryAlert(profileId, batteryPercent);
            } else {
                log.debug("Battery alert suppressed for profile={} — cooldown active (last alert: {})",
                        profileId, settings.getLastAlertAt());
            }
        }

        return toResponse(settings);
    }

    @Transactional(readOnly = true)
    public BatterySettingsResponse getSettings(UUID profileId) {
        DeviceSettings settings = settingsRepo.findByProfileId(profileId)
                .orElseGet(() -> {
                    DeviceSettings s = new DeviceSettings();
                    s.setProfileId(profileId);
                    s.setBatteryThreshold(20);
                    return s;
                });
        return toResponse(settings);
    }

    @Transactional
    public BatterySettingsResponse updateThreshold(UUID profileId, int threshold) {
        DeviceSettings settings = settingsRepo.findByProfileId(profileId)
                .orElseGet(() -> {
                    DeviceSettings s = new DeviceSettings();
                    s.setProfileId(profileId);
                    return s;
                });
        settings.setBatteryThreshold(threshold);
        settings = settingsRepo.save(settings);
        log.info("Battery threshold updated for profile={} → {}%", profileId, threshold);
        return toResponse(settings);
    }

    @Async
    @SuppressWarnings("unchecked")
    public void sendBatteryAlert(UUID profileId, int batteryPercent) {
        try {
            Map<String, Object> parentInfo = resolveParentInfo(profileId);
            String parentUserId = (String) parentInfo.get("userId");
            String childName = (String) parentInfo.getOrDefault("childName", "Your child");

            if (parentUserId == null) {
                log.error("Battery alert FCM skipped — could not resolve parent userId for profile={}", profileId);
                return;
            }

            String notifBaseUrl = resolveNotificationUrl();
            if (notifBaseUrl == null) {
                log.error("Battery alert FAILED — notification service not found in Eureka for profile={}", profileId);
                return;
            }

            String title = "\uD83D\uDD0B Low Battery \u2014 " + childName;
            String body = childName + "'s battery is at " + batteryPercent + "%. Make sure they charge their device.";

            Map<String, Object> pushPayload = new java.util.LinkedHashMap<>();
            pushPayload.put("userId", parentUserId);
            pushPayload.put("title", title);
            pushPayload.put("body", body);
            pushPayload.put("priority", "HIGH");
            pushPayload.put("data", Map.of(
                    "type", "BATTERY_ALERT",
                    "profileId", profileId.toString(),
                    "batteryPercent", String.valueOf(batteryPercent)
            ));

            try {
                restClient.post()
                        .uri(notifBaseUrl + "/internal/notifications/push")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(pushPayload)
                        .retrieve()
                        .toBodilessEntity();
                log.info("Battery alert FCM sent for profile={} → parent={} battery={}%",
                        profileId, parentUserId, batteryPercent);
            } catch (Exception ex) {
                log.warn("Battery alert FCM push failed (non-fatal): {}", ex.getMessage());
            }

        } catch (Exception e) {
            log.error("Battery alert pipeline error for profile={}: {}", profileId, e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveParentInfo(UUID profileId) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances(PROFILE_SERVICE);
            if (instances.isEmpty()) {
                log.error("Battery alert parent resolution FAILED — {} has no instances in Eureka for profile={}",
                        PROFILE_SERVICE, profileId);
                return new HashMap<>();
            }
            String profileBaseUrl = instances.get(0).getUri().toString();
            Map<String, Object> result = restClient.get()
                    .uri(profileBaseUrl + "/internal/profiles/" + profileId + "/parent")
                    .retrieve()
                    .body(Map.class);
            if (result == null || !result.containsKey("userId")) {
                log.error("Battery alert parent resolution FAILED — profile service returned no userId for profile={}", profileId);
                return new HashMap<>();
            }
            return result;
        } catch (Exception e) {
            log.error("Battery alert parent resolution FAILED for profile={}: {}", profileId, e.getMessage());
            return new HashMap<>();
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private BatterySettingsResponse toResponse(DeviceSettings s) {
        return BatterySettingsResponse.builder()
                .profileId(s.getProfileId())
                .batteryThreshold(s.getBatteryThreshold())
                .lastBatteryPct(s.getLastBatteryPct())
                .lastAlertAt(s.getLastAlertAt())
                .build();
    }
}
