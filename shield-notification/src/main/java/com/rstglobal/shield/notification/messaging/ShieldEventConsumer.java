package com.rstglobal.shield.notification.messaging;

import com.rstglobal.shield.notification.config.RabbitMQConfig;
import com.rstglobal.shield.notification.dto.request.SendNotificationRequest;
import com.rstglobal.shield.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Consumes Shield platform events from RabbitMQ and converts them
 * into persisted notifications dispatched via all channels
 * (WebSocket, FCM, email, etc.).
 *
 * Expected message format (JSON):
 * {
 *   "eventType"  : "GEOFENCE_BREACH" | "SOS_ALERT" | "BUDGET_EXHAUSTED" | "AI_ANOMALY",
 *   "profileId"  : "<uuid>",
 *   "userId"     : "<uuid>",
 *   "tenantId"   : "<uuid>",
 *   "toEmail"    : "<optional email>",
 *   "data"       : { ... event-specific fields ... }
 * }
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "rabbitmq.enabled", havingValue = "true", matchIfMissing = false)
@RequiredArgsConstructor
public class ShieldEventConsumer {

    private final NotificationService notificationService;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    public void onShieldEvent(Map<String, Object> message) {
        try {
            String eventType = (String) message.get("eventType");
            if (eventType == null || eventType.isBlank()) {
                log.warn("Received Shield event with no eventType — discarding: {}", message);
                return;
            }

            log.debug("Received Shield event: type={} userId={}", eventType, message.get("userId"));

            switch (eventType) {
                case "GEOFENCE_BREACH"  -> handleGeofenceBreach(message);
                case "SOS_ALERT"        -> handleSosAlert(message);
                case "BUDGET_EXHAUSTED" -> handleBudgetExhausted(message);
                case "AI_ANOMALY"       -> handleAiAnomaly(message);
                default -> log.debug("Unhandled Shield event type '{}' — ignoring", eventType);
            }
        } catch (Exception e) {
            log.error("Failed to process Shield event: {} — error: {}", message, e.getMessage(), e);
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────

    private void handleGeofenceBreach(Map<String, Object> msg) {
        @SuppressWarnings("unchecked")
        Map<String, Object> data = msg.containsKey("data")
                ? (Map<String, Object>) msg.get("data") : Map.of();

        String breachType    = (String) data.getOrDefault("breachType", "ENTER");
        String geofenceName  = (String) data.getOrDefault("geofenceName", "a zone");
        String direction     = "ENTER".equalsIgnoreCase(breachType) ? "entered" : "left";

        SendNotificationRequest req = buildRequest(msg,
                "GEOFENCE_BREACH",
                "Geofence Alert: " + geofenceName,
                "Your child has " + direction + " the zone \"" + geofenceName + "\".",
                "https://shield.rstglobal.in/app/location");

        if (req != null) {
            notificationService.send(req);
            log.info("Geofence breach notification sent via RabbitMQ: geofence='{}' type={}",
                    geofenceName, breachType);
        }
    }

    private void handleSosAlert(Map<String, Object> msg) {
        @SuppressWarnings("unchecked")
        Map<String, Object> data = msg.containsKey("data")
                ? (Map<String, Object>) msg.get("data") : Map.of();

        String childName = (String) data.getOrDefault("childName", "Your child");

        SendNotificationRequest req = buildRequest(msg,
                "SOS_ALERT",
                "SOS Alert!",
                childName + " has triggered an SOS panic alert. Tap to see their location.",
                "https://shield.rstglobal.in/app/location");

        if (req != null) {
            notificationService.send(req);
            log.info("SOS alert notification sent via RabbitMQ for userId={}", msg.get("userId"));
        }
    }

    private void handleBudgetExhausted(Map<String, Object> msg) {
        @SuppressWarnings("unchecked")
        Map<String, Object> data = msg.containsKey("data")
                ? (Map<String, Object>) msg.get("data") : Map.of();

        String childName = (String) data.getOrDefault("childName", "Your child");
        String category  = (String) data.getOrDefault("category", "screen time");

        SendNotificationRequest req = buildRequest(msg,
                "BUDGET_EXCEEDED",
                "Screen Time Budget Exhausted",
                childName + " has used up their " + category + " budget for today.",
                "https://shield.rstglobal.in/app/time-limits");

        if (req != null) {
            notificationService.send(req);
            log.info("Budget exhausted notification sent via RabbitMQ for userId={}", msg.get("userId"));
        }
    }

    private void handleAiAnomaly(Map<String, Object> msg) {
        @SuppressWarnings("unchecked")
        Map<String, Object> data = msg.containsKey("data")
                ? (Map<String, Object>) msg.get("data") : Map.of();

        String anomalyType = (String) data.getOrDefault("anomalyType", "unusual activity");
        String childName   = (String) data.getOrDefault("childName", "Your child");

        SendNotificationRequest req = buildRequest(msg,
                "AI_ANOMALY",
                "Shield AI Alert",
                childName + " has shown " + anomalyType + " detected by Shield AI.",
                "https://shield.rstglobal.in/app/ai-insights");

        if (req != null) {
            notificationService.send(req);
            log.info("AI anomaly notification sent via RabbitMQ for userId={}", msg.get("userId"));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Build a {@link SendNotificationRequest} from a raw event map.
     * Returns null if userId or tenantId cannot be parsed (logs a warning).
     */
    private SendNotificationRequest buildRequest(Map<String, Object> msg,
                                                  String type,
                                                  String title,
                                                  String body,
                                                  String actionUrl) {
        try {
            UUID userId   = parseUuid(msg.get("userId"));
            UUID tenantId = parseUuid(msg.get("tenantId"));
            if (userId == null || tenantId == null) {
                log.warn("Shield event missing userId or tenantId — skipping: {}", msg);
                return null;
            }

            SendNotificationRequest req = new SendNotificationRequest();
            req.setUserId(userId);
            req.setTenantId(tenantId);
            req.setProfileId(parseUuid(msg.get("profileId")));
            req.setType(type);
            req.setTitle(title);
            req.setBody(body);
            req.setActionUrl(actionUrl);
            req.setToEmail((String) msg.get("toEmail"));
            return req;
        } catch (Exception e) {
            log.error("Failed to build notification request from event: {}", e.getMessage());
            return null;
        }
    }

    private UUID parseUuid(Object value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value.toString());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
