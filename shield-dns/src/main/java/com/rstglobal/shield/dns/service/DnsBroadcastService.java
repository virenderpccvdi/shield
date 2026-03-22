package com.rstglobal.shield.dns.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Broadcasts real-time DNS rule change events to the notification service,
 * which forwards them via WebSocket STOMP to connected dashboard clients.
 * Called async after every DNS rules save.
 */
@Slf4j
@Service
public class DnsBroadcastService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public DnsBroadcastService(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    @Async
    public void broadcastRulesChanged(UUID profileId, UUID tenantId) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "DNS_RULES_CHANGED");
            payload.put("profileId", profileId != null ? profileId.toString() : "");

            String tenantParam = tenantId != null ? "?tenantId=" + tenantId : "";
            restClient.post()
                    .uri(baseUrl + "/internal/notifications/broadcast" + tenantParam)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.debug("DNS rules change broadcast sent for profile={} tenant={}", profileId, tenantId);
        } catch (Exception e) {
            log.debug("DNS broadcast failed (notification service may be offline): {}", e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.debug("No instances of {} found — skipping DNS broadcast", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }
}
