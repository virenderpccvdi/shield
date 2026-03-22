package com.rstglobal.shield.location.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * CS-01 Live Video Check-in service.
 *
 * Orchestrates the signaling flow for one-way WebRTC video (child camera → parent browser):
 *   1. Parent calls requestCheckin() → FCM push to child + WS signal to parent dashboard.
 *   2. Child accepts → Flutter app sends WebRTC OFFER via relaySignal() → forwarded to parent.
 *   3. Parent dashboard sends ANSWER via relaySignal() → forwarded to child.
 *   4. Both sides exchange ICE_CANDIDATE signals via relaySignal().
 *   5. Either party calls endSession() to tear down.
 *
 * Sessions are held in memory (ConcurrentHashMap) — no DB write needed for MVP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VideoCheckinService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";
    private static final String PROFILE_SERVICE      = "SHIELD-PROFILE";

    private final DiscoveryClient discoveryClient;
    private final RestClient restClient = RestClient.builder().build();

    /** Active sessions keyed by sessionId */
    private final Map<String, Map<String, Object>> activeSessions = new ConcurrentHashMap<>();

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Parent initiates a video check-in.
     * Sends FCM push to the child device and a WS SESSION_CREATED event to the parent dashboard.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> requestCheckin(UUID parentUserId, UUID profileId) {
        String sessionId = UUID.randomUUID().toString();

        Map<String, Object> session = new LinkedHashMap<>();
        session.put("sessionId",    sessionId);
        session.put("profileId",    profileId.toString());
        session.put("parentUserId", parentUserId.toString());
        session.put("status",       "PENDING");
        session.put("createdAt",    OffsetDateTime.now().toString());
        activeSessions.put(sessionId, session);

        String notifBase = resolveNotificationUrl();
        if (notifBase == null) {
            log.warn("VideoCheckin: notification service unavailable — FCM/WS skipped for session={}", sessionId);
            return session;
        }

        // Resolve child userId so we can send a user-targeted WebSocket signal later
        String childUserId = resolveChildUserId(profileId);

        // 1. FCM push → child device (topic-based — profile topic registered by Flutter FCM service)
        Map<String, Object> push = new LinkedHashMap<>();
        push.put("topic",    "profile-" + profileId);
        push.put("title",    "Video Check-in Request");
        push.put("body",     "Your parent wants to see you — tap Accept to start");
        push.put("priority", "HIGH");
        push.put("data", Map.of(
                "type",       "VIDEO_CHECKIN_REQUEST",
                "sessionId",  sessionId,
                "profileId",  profileId.toString(),
                "parentUserId", parentUserId.toString()
        ));
        try {
            restClient.post()
                    .uri(notifBase + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(push)
                    .retrieve().toBodilessEntity();
            log.info("VideoCheckin: FCM push sent to profile-{} for session={}", profileId, sessionId);
        } catch (Exception e) {
            log.warn("VideoCheckin: FCM push failed (non-fatal): {}", e.getMessage());
        }

        // Also push directly to child userId if we resolved it
        if (childUserId != null) {
            Map<String, Object> childPush = new LinkedHashMap<>(push);
            childPush.put("userId", childUserId);
            childPush.remove("topic");
            try {
                restClient.post()
                        .uri(notifBase + "/internal/notifications/push")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(childPush)
                        .retrieve().toBodilessEntity();
            } catch (Exception e) {
                log.debug("VideoCheckin: direct child FCM push failed (non-fatal): {}", e.getMessage());
            }
        }

        // 2. WS signal to parent dashboard so the UI knows the session was created
        Map<String, Object> wsPayload = new LinkedHashMap<>(session);
        wsPayload.put("event", "SESSION_CREATED");
        try {
            restClient.post()
                    .uri(notifBase + "/internal/notifications/broadcast?userId=" + parentUserId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(wsPayload)
                    .retrieve().toBodilessEntity();
            log.info("VideoCheckin: WS SESSION_CREATED sent to parent={} session={}", parentUserId, sessionId);
        } catch (Exception e) {
            log.warn("VideoCheckin: WS signal to parent failed (non-fatal): {}", e.getMessage());
        }

        return session;
    }

    /**
     * Relay a WebRTC signaling message (OFFER / ANSWER / ICE_CANDIDATE / DECLINED / ENDED)
     * from one participant to the other via the notification service WebSocket.
     * Payload must contain: sessionId, targetUserId, type.
     */
    public void relaySignal(Map<String, Object> payload) {
        String sessionId   = (String) payload.get("sessionId");
        String targetUserId = (String) payload.get("targetUserId");

        if (targetUserId == null || targetUserId.isBlank()) {
            log.warn("VideoCheckin: relaySignal called without targetUserId — payload={}", payload);
            return;
        }

        String notifBase = resolveNotificationUrl();
        if (notifBase == null) {
            log.warn("VideoCheckin: notification service unavailable — signal relay skipped session={}", sessionId);
            return;
        }

        // Update in-memory session status for ACCEPTED/DECLINED/ENDED signals
        String sigType = (String) payload.getOrDefault("type", "");
        if (sessionId != null && activeSessions.containsKey(sessionId)) {
            if ("ACCEPTED".equals(sigType)) {
                activeSessions.get(sessionId).put("status", "ACTIVE");
            } else if ("DECLINED".equals(sigType) || "ENDED".equals(sigType)) {
                activeSessions.remove(sessionId);
            }
        }

        try {
            restClient.post()
                    .uri(notifBase + "/internal/notifications/broadcast?userId=" + targetUserId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve().toBodilessEntity();
            log.debug("VideoCheckin: signal relayed session={} type={} target={}", sessionId, sigType, targetUserId);
        } catch (Exception e) {
            log.warn("VideoCheckin: signal relay failed session={}: {}", sessionId, e.getMessage());
        }
    }

    /**
     * Tear down an active session — broadcasts ENDED signal to both parties.
     */
    public void endSession(String sessionId) {
        Map<String, Object> session = activeSessions.remove(sessionId);
        if (session == null) {
            log.debug("VideoCheckin: endSession called for unknown/already-ended session={}", sessionId);
            return;
        }

        String notifBase = resolveNotificationUrl();
        if (notifBase == null) return;

        Map<String, Object> endedPayload = new LinkedHashMap<>();
        endedPayload.put("type",      "ENDED");
        endedPayload.put("sessionId", sessionId);
        endedPayload.put("event",     "SESSION_ENDED");

        // Notify both parent and child
        for (String key : List.of("parentUserId", "childUserId")) {
            String uid = (String) session.get(key);
            if (uid == null) continue;
            try {
                restClient.post()
                        .uri(notifBase + "/internal/notifications/broadcast?userId=" + uid)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(endedPayload)
                        .retrieve().toBodilessEntity();
            } catch (Exception e) {
                log.debug("VideoCheckin: ENDED signal to {} failed: {}", uid, e.getMessage());
            }
        }

        log.info("VideoCheckin: session ended sessionId={}", sessionId);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) return null;
        return instances.get(0).getUri().toString();
    }

    @SuppressWarnings("unchecked")
    private String resolveChildUserId(UUID profileId) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances(PROFILE_SERVICE);
            if (instances.isEmpty()) return null;
            String base = instances.get(0).getUri().toString();
            // Reuse the same /parent endpoint that SosService uses — it returns the parent's userId.
            // For the child's userId we call the profile endpoint directly.
            Map<String, Object> result = restClient.get()
                    .uri(base + "/internal/profiles/" + profileId + "/child-user")
                    .retrieve()
                    .body(Map.class);
            if (result != null && result.containsKey("userId")) {
                return (String) result.get("userId");
            }
        } catch (Exception e) {
            log.debug("VideoCheckin: could not resolve child userId for profile={}: {}", profileId, e.getMessage());
        }
        return null;
    }
}
