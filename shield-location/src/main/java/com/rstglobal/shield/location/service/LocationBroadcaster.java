package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.entity.LocationPoint;
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

/**
 * Broadcasts real-time location updates to connected dashboard clients via
 * shield-notification's WebSocket STOMP broker.
 * Called async after every location point save so it never blocks the upload response.
 */
@Slf4j
@Service
public class LocationBroadcaster {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public LocationBroadcaster(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    @Async
    public void broadcast(LocationPoint point) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            Map<String, Object> payload = new HashMap<>();
            payload.put("profileId", point.getProfileId().toString());
            payload.put("latitude", point.getLatitude());
            payload.put("longitude", point.getLongitude());
            if (point.getAccuracy() != null)   payload.put("accuracy", point.getAccuracy());
            if (point.getSpeed() != null)      payload.put("speed", point.getSpeed());
            if (point.getHeading() != null)    payload.put("heading", point.getHeading());
            if (point.getBatteryPct() != null) payload.put("batteryPct", point.getBatteryPct());
            payload.put("isMoving", Boolean.TRUE.equals(point.getIsMoving()));
            if (point.getId() != null)         payload.put("id", point.getId().toString());
            if (point.getRecordedAt() != null) payload.put("recordedAt", point.getRecordedAt().toString());

            restClient.post()
                    .uri(baseUrl + "/internal/location-update")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.debug("Location broadcast sent for profile={}", point.getProfileId());
        } catch (Exception e) {
            log.debug("Location broadcast failed (notification service may be offline): {}", e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.debug("No instances of {} found — skipping broadcast", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }
}
