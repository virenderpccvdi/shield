package com.rstglobal.shield.admin.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin endpoints for sending push notifications to all child devices.
 * Calls shield-notification internal /push endpoint via Eureka discovery.
 */
@RestController
@RequestMapping("/api/v1/admin/notify")
@Slf4j
public class AdminNotifyController {

    private static final String SERVICE_ID = "SHIELD-NOTIFICATION";

    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public AdminNotifyController(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    /**
     * POST /api/v1/admin/notify/app-update
     * Sends an FCM push notification to topic "shield-child-devices" announcing a new APK.
     */
    @PostMapping("/app-update")
    public ResponseEntity<Map<String, Object>> sendAppUpdateNotification(
            @RequestParam(defaultValue = "1.0.22") String version) {

        String baseUrl = resolveNotificationServiceUrl();
        if (baseUrl == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", "shield-notification service not found in Eureka");
            return ResponseEntity.status(503).body(err);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("topic", "shield-child-devices");
        payload.put("title", "Shield App Update Available");
        payload.put("body", "A new version of Shield (v" + version + ") is ready. Tap to update for better protection and new features.");

        Map<String, String> data = new HashMap<>();
        data.put("type", "APP_UPDATE");
        data.put("version", version);
        data.put("url", "https://shield.rstglobal.in/static/shield-app.apk");
        payload.put("data", data);

        try {
            Map<?, ?> response = restClient.post()
                    .uri(baseUrl + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("version", version);
            result.put("topic", "shield-child-devices");
            result.put("notificationResponse", response);
            log.info("App update notification sent for version {}", version);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Failed to send app update notification: {}", e.getMessage(), e);
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", e.getMessage());
            return ResponseEntity.status(500).body(err);
        }
    }

    /**
     * POST /api/v1/admin/notify/custom
     * Send a custom FCM topic push notification.
     */
    @PostMapping("/custom")
    public ResponseEntity<Map<String, Object>> sendCustomNotification(
            @RequestBody Map<String, Object> req) {

        String baseUrl = resolveNotificationServiceUrl();
        if (baseUrl == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", "shield-notification service not found in Eureka");
            return ResponseEntity.status(503).body(err);
        }

        try {
            Map<?, ?> response = restClient.post()
                    .uri(baseUrl + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(req)
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("notificationResponse", response);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Failed to send custom notification: {}", e.getMessage(), e);
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", e.getMessage());
            return ResponseEntity.status(500).body(err);
        }
    }

    private String resolveNotificationServiceUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(SERVICE_ID);
        if (instances == null || instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka", SERVICE_ID);
            return null;
        }
        return instances.get(0).getUri().toString();
    }
}
