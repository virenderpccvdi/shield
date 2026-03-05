package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.entity.Geofence;
import com.rstglobal.shield.location.entity.GeofenceEvent;
import com.rstglobal.shield.location.entity.LocationPoint;
import com.rstglobal.shield.location.repository.GeofenceEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Detects geofence breaches (ENTER / EXIT) using Redis to track last-known state.
 * <p>
 * Called by {@link LocationService#uploadLocation} whenever a new location point is saved.
 * On breach, persists a {@link GeofenceEvent} and fires a push notification
 * to shield-notification via its internal endpoint.
 */
@Slf4j
@Service
public class GeofenceBreachDetector {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";
    private static final String REDIS_KEY_PREFIX = "shield:geofence:";

    private final GeofenceService geofenceService;
    private final GeofenceEventRepository geofenceEventRepository;
    private final StringRedisTemplate redisTemplate;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public GeofenceBreachDetector(GeofenceService geofenceService,
                                  GeofenceEventRepository geofenceEventRepository,
                                  StringRedisTemplate redisTemplate,
                                  DiscoveryClient discoveryClient) {
        this.geofenceService = geofenceService;
        this.geofenceEventRepository = geofenceEventRepository;
        this.redisTemplate = redisTemplate;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    /**
     * Check all active geofences for the given location point.
     * Compares current inside/outside state with the Redis-cached previous state
     * to detect ENTER and EXIT transitions.
     */
    @Transactional
    public void detect(LocationPoint point) {
        List<Geofence> activeGeofences = geofenceService.getActiveGeofences(point.getProfileId());
        if (activeGeofences.isEmpty()) {
            return;
        }

        double pointLat = point.getLatitude().doubleValue();
        double pointLng = point.getLongitude().doubleValue();

        for (Geofence geofence : activeGeofences) {
            double distance = geofenceService.calculateDistanceMeters(
                    pointLat, pointLng,
                    geofence.getCenterLat().doubleValue(),
                    geofence.getCenterLng().doubleValue()
            );

            double radius = geofence.getRadiusMeters().doubleValue();
            boolean insideNow = distance <= radius;

            // Retrieve cached state from Redis
            String redisKey = redisKey(point.getProfileId(), geofence.getId());
            String previousState = redisTemplate.opsForValue().get(redisKey);
            boolean wasInside = "true".equals(previousState);
            boolean isFirstReading = (previousState == null);

            // Persist state in Redis
            redisTemplate.opsForValue().set(redisKey, String.valueOf(insideNow));

            // Detect transitions
            if (isFirstReading) {
                // First reading — set baseline, no event
                log.debug("Geofence baseline set: profile={} geofence='{}' inside={} distance={}m",
                        point.getProfileId(), geofence.getName(), insideNow, String.format("%.1f", distance));
                continue;
            }

            if (!wasInside && insideNow && Boolean.TRUE.equals(geofence.getAlertOnEnter())) {
                // ENTER transition
                GeofenceEvent event = saveEvent(point, geofence, "ENTER");
                log.info("Geofence ENTER: profile={} geofence='{}' distance={}m",
                        point.getProfileId(), geofence.getName(), String.format("%.1f", distance));
                sendBreachNotification(point, geofence, "ENTER", event.getId());
            } else if (wasInside && !insideNow && Boolean.TRUE.equals(geofence.getAlertOnExit())) {
                // EXIT transition
                GeofenceEvent event = saveEvent(point, geofence, "EXIT");
                log.info("Geofence EXIT: profile={} geofence='{}' distance={}m",
                        point.getProfileId(), geofence.getName(), String.format("%.1f", distance));
                sendBreachNotification(point, geofence, "EXIT", event.getId());
            }
        }
    }

    private GeofenceEvent saveEvent(LocationPoint point, Geofence geofence, String eventType) {
        GeofenceEvent event = GeofenceEvent.builder()
                .tenantId(point.getTenantId())
                .profileId(point.getProfileId())
                .geofenceId(geofence.getId())
                .eventType(eventType)
                .latitude(point.getLatitude())
                .longitude(point.getLongitude())
                .build();
        return geofenceEventRepository.save(event);
    }

    /**
     * Fire-and-forget notification to shield-notification via internal endpoint.
     * Runs async so it never blocks the location upload response.
     */
    @Async
    public void sendBreachNotification(LocationPoint point, Geofence geofence,
                                       String eventType, UUID eventId) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            String direction = "ENTER".equals(eventType) ? "entered" : "left";
            String title = "Geofence Alert: " + geofence.getName();
            String body = "Your child has " + direction + " the zone \"" + geofence.getName() + "\".";

            Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", "GEOFENCE_BREACH");
            payload.put("title", title);
            payload.put("body", body);
            payload.put("profileId", point.getProfileId().toString());
            payload.put("actionUrl", "https://shield.rstglobal.in/app/location");
            // userId is the parent — we don't have it here, so profileId doubles as target
            payload.put("userId", point.getProfileId().toString());
            if (point.getTenantId() != null) {
                payload.put("tenantId", point.getTenantId().toString());
            } else {
                // Use a zero UUID as fallback for platform-level notification
                payload.put("tenantId", "00000000-0000-0000-0000-000000000000");
            }

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Breach notification sent for event={} geofence='{}'", eventId, geofence.getName());
        } catch (Exception e) {
            log.warn("Failed to send breach notification for geofence '{}': {}",
                    geofence.getName(), e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka — skipping breach notification", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private String redisKey(UUID profileId, UUID geofenceId) {
        return REDIS_KEY_PREFIX + profileId + ":" + geofenceId + ":inside";
    }
}
