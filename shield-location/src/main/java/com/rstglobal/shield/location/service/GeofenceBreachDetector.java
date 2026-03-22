package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.config.RabbitMQConfig;
import com.rstglobal.shield.location.entity.Geofence;
import com.rstglobal.shield.location.entity.GeofenceEvent;
import com.rstglobal.shield.location.entity.LocationPoint;
import com.rstglobal.shield.location.repository.GeofenceEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashMap;
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
    private final JdbcTemplate jdbcTemplate;
    private final RestClient restClient;
    private final RabbitTemplate rabbitTemplate;

    public GeofenceBreachDetector(GeofenceService geofenceService,
                                  GeofenceEventRepository geofenceEventRepository,
                                  StringRedisTemplate redisTemplate,
                                  DiscoveryClient discoveryClient,
                                  JdbcTemplate jdbcTemplate,
                                  RabbitTemplate rabbitTemplate) {
        this.geofenceService = geofenceService;
        this.geofenceEventRepository = geofenceEventRepository;
        this.redisTemplate = redisTemplate;
        this.discoveryClient = discoveryClient;
        this.jdbcTemplate = jdbcTemplate;
        this.restClient = RestClient.builder().build();
        this.rabbitTemplate = rabbitTemplate;
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
     * Resolve the parent (customer) userId from a child profileId.
     * Cross-schema query: profile.child_profiles → profile.customers → user_id.
     * Returns null if the child profile or parent account is not found.
     */
    private UUID resolveParentUserId(UUID profileId) {
        try {
            String sql = """
                    SELECT c.user_id
                    FROM profile.child_profiles cp
                    JOIN profile.customers c ON c.id = cp.customer_id
                    WHERE cp.id = ?
                    """;
            return jdbcTemplate.queryForObject(sql, UUID.class, profileId);
        } catch (Exception e) {
            log.warn("Could not resolve parent userId for profileId={}: {}", profileId, e.getMessage());
            return null;
        }
    }

    /**
     * Fire-and-forget notification to shield-notification via internal endpoint.
     * Runs async so it never blocks the location upload response.
     * Marks the breach event as notified after a successful send.
     */
    @Async
    public void sendBreachNotification(LocationPoint point, Geofence geofence,
                                       String eventType, UUID eventId) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            // Resolve the parent's auth userId — FCM tokens are keyed by userId
            UUID parentUserId = resolveParentUserId(point.getProfileId());
            if (parentUserId == null) {
                log.warn("Skipping breach notification — could not resolve parent userId for profileId={}",
                        point.getProfileId());
                return;
            }

            // CS-07: school-zone aware title/body
            String title;
            String body;
            String notificationType = "GEOFENCE_BREACH";

            if (Boolean.TRUE.equals(geofence.getIsSchool())) {
                // School zone — use dedicated school arrival/departure messaging
                if ("ENTER".equals(eventType)) {
                    String timeStr = LocalTime.now(ZoneId.systemDefault()).toString().substring(0, 5);
                    title = "School Arrival";
                    body  = "Your child arrived at " + geofence.getName() + " at " + timeStr + ".";
                    notificationType = "SCHOOL_ARRIVAL";
                } else {
                    // EXIT — check whether we are within school hours
                    LocalTime now = LocalTime.now(ZoneId.systemDefault());
                    boolean duringSchoolHours = isDuringSchoolHours(geofence, now);
                    String timeStr = now.toString().substring(0, 5);
                    if (duringSchoolHours) {
                        title = "School Departure Alert";
                        body  = "\u26a0\ufe0f Your child left " + geofence.getName()
                                + " during school hours at " + timeStr + ".";
                        notificationType = "SCHOOL_EARLY_EXIT";
                    } else {
                        title = "Left School";
                        body  = "Your child has left " + geofence.getName() + " at " + timeStr + ".";
                        notificationType = "SCHOOL_DEPARTURE";
                    }
                }
            } else {
                String direction = "ENTER".equals(eventType) ? "entered" : "left";
                title = "Geofence Alert: " + geofence.getName();
                body  = "Your child has " + direction + " the zone \"" + geofence.getName() + "\".";
            }

            UUID tenantId = point.getTenantId() != null
                    ? point.getTenantId()
                    : geofence.getTenantId();
            if (tenantId == null) {
                tenantId = UUID.fromString("00000000-0000-0000-0000-000000000000");
            }

            Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", notificationType);
            payload.put("title", title);
            payload.put("body", body);
            payload.put("profileId", point.getProfileId().toString());
            payload.put("userId", parentUserId.toString());
            payload.put("tenantId", tenantId.toString());
            payload.put("actionUrl", "https://shield.rstglobal.in/app/location");

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            // Also publish to RabbitMQ event bus for fan-out consumers
            publishBreachEvent(point, geofence, eventType, parentUserId, tenantId);

            // Mark the geofence event as notified
            geofenceEventRepository.findById(eventId).ifPresent(ev -> {
                ev.setNotified(true);
                geofenceEventRepository.save(ev);
            });

            log.info("Breach notification sent: event={} geofence='{}' parentUserId={}",
                    eventId, geofence.getName(), parentUserId);
        } catch (Exception e) {
            log.warn("Failed to send breach notification for geofence '{}': {}",
                    geofence.getName(), e.getMessage());
        }
    }

    /**
     * Publish a geofence breach event to the shield.events RabbitMQ exchange.
     * This enables any service bound to the exchange to react to breach events
     * independently of the direct REST call to shield-notification.
     */
    private void publishBreachEvent(LocationPoint point, Geofence geofence,
                                    String eventType, UUID parentUserId, UUID tenantId) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("breachType", eventType);
            data.put("geofenceName", geofence.getName());
            data.put("latitude", point.getLatitude());
            data.put("longitude", point.getLongitude());
            data.put("timestamp", Instant.now().toString());

            Map<String, Object> event = new HashMap<>();
            event.put("eventType", "GEOFENCE_BREACH");
            event.put("profileId", point.getProfileId().toString());
            event.put("userId", parentUserId.toString());
            event.put("tenantId", tenantId.toString());
            event.put("data", data);

            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.ROUTING_KEY_GEOFENCE_BREACH,
                    event);

            log.debug("Published geofence breach event to RabbitMQ: geofence='{}' type={}",
                    geofence.getName(), eventType);
        } catch (Exception e) {
            log.warn("Failed to publish breach event to RabbitMQ (non-fatal): {}", e.getMessage());
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

    /**
     * CS-07: Returns true when {@code now} falls within the school's configured hours.
     * If either schoolStart or schoolEnd is null, defaults to 08:00–15:00.
     */
    private boolean isDuringSchoolHours(Geofence geofence, LocalTime now) {
        LocalTime start = geofence.getSchoolStart() != null ? geofence.getSchoolStart() : LocalTime.of(8, 0);
        LocalTime end   = geofence.getSchoolEnd()   != null ? geofence.getSchoolEnd()   : LocalTime.of(15, 0);
        return !now.isBefore(start) && now.isBefore(end);
    }
}
