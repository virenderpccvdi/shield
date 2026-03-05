package com.rstglobal.shield.auth.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Lightweight client to publish audit events to the shield-admin service.
 * All calls are @Async so they never block the main request.
 */
@Slf4j
@Component
public class AuditClient {

    private final RestTemplate restTemplate;
    private final String adminBaseUrl;

    public AuditClient(@Value("${shield.admin.url:http://localhost:8290}") String adminBaseUrl) {
        this.restTemplate = new RestTemplate();
        this.adminBaseUrl = adminBaseUrl;
    }

    @Async
    public void log(String action, String resourceType, String resourceId,
                    UUID userId, String userName, String ipAddress,
                    Map<String, Object> details) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("action", action);
            event.put("resourceType", resourceType);
            event.put("resourceId", resourceId);
            event.put("userId", userId);
            event.put("userName", userName);
            event.put("ipAddress", ipAddress);
            event.put("details", details != null ? details : Map.of());
            restTemplate.postForEntity(adminBaseUrl + "/internal/audit", event, Void.class);
        } catch (Exception e) {
            log.warn("Failed to publish audit event: {} - {}", action, e.getMessage());
        }
    }
}
