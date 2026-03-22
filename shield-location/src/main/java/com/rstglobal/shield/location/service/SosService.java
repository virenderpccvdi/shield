package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.request.SosRequest;
import com.rstglobal.shield.location.dto.response.SosEventResponse;
import com.rstglobal.shield.location.entity.SosEvent;
import com.rstglobal.shield.location.repository.SosEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
public class SosService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";
    private static final String PROFILE_SERVICE = "SHIELD-PROFILE";

    private final SosEventRepository sosEventRepository;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public SosService(SosEventRepository sosEventRepository, DiscoveryClient discoveryClient) {
        this.sosEventRepository = sosEventRepository;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    @Transactional
    public SosEventResponse triggerSos(SosRequest req) {
        SosEvent event = SosEvent.builder()
                .profileId(req.getProfileId())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .message(req.getMessage())
                .status("ACTIVE")
                .build();

        event = sosEventRepository.save(event);
        log.warn("SOS TRIGGERED: profile={} lat={} lng={} message='{}'",
                req.getProfileId(), req.getLatitude(), req.getLongitude(), req.getMessage());

        sendSosNotification(event);
        return toResponse(event);
    }

    @Async
    public void sendSosNotification(SosEvent event) {
        try {
            String notifBaseUrl = resolveNotificationUrl();
            if (notifBaseUrl == null) {
                log.error("SOS notification FAILED — notification service not found in Eureka for profile={}", event.getProfileId());
                return;
            }

            // Resolve the parent's real userId and tenantId from the profile service
            Map<String, Object> parentInfo = resolveParentInfo(event.getProfileId());
            String parentUserId = (String) parentInfo.get("userId");   // null if unresolved
            String tenantId     = (String) parentInfo.getOrDefault("tenantId", null);
            String childName    = (String) parentInfo.getOrDefault("childName", "Your child");

            String bodyText = childName + " has triggered an emergency SOS alert. " +
                    (event.getMessage() != null && !event.getMessage().isBlank()
                            ? "Message: " + event.getMessage()
                            : "Tap to view their location.");

            // 1. Persistent notification + FCM via notification service (only when parent userId is known)
            if (parentUserId != null) {
                Map<String, Object> payload = new java.util.LinkedHashMap<>();
                payload.put("type",      "SOS_ALERT");
                payload.put("title",     "🚨 SOS Alert - Child Needs Help!");
                payload.put("body",      bodyText);
                payload.put("profileId", event.getProfileId().toString());
                payload.put("userId",    parentUserId);
                payload.put("actionUrl", "https://shield.rstglobal.in/app/map");
                if (tenantId != null) payload.put("tenantId", tenantId);

                try {
                    restClient.post()
                            .uri(notifBaseUrl + "/internal/notifications/send")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(payload)
                            .retrieve()
                            .toBodilessEntity();
                } catch (Exception ex) {
                    log.warn("SOS persistent notification failed (non-fatal): {}", ex.getMessage());
                }

                // 2. High-priority direct FCM push — wakes parent device immediately
                Map<String, Object> pushPayload = new java.util.LinkedHashMap<>();
                pushPayload.put("userId",   parentUserId);
                pushPayload.put("title",    "🚨 SOS Alert — " + childName + " needs help!");
                pushPayload.put("body",     bodyText);
                pushPayload.put("priority", "HIGH");
                pushPayload.put("data",     Map.of(
                        "type",      "SOS_ALERT",
                        "profileId", event.getProfileId().toString()
                ));

                try {
                    restClient.post()
                            .uri(notifBaseUrl + "/internal/notifications/push")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(pushPayload)
                            .retrieve()
                            .toBodilessEntity();
                    log.info("SOS FCM push sent for profile={} → parent={}", event.getProfileId(), parentUserId);
                } catch (Exception ex) {
                    log.warn("SOS FCM push failed (non-fatal): {}", ex.getMessage());
                }
            } else {
                log.error("SOS FCM skipped — could not resolve parent userId for profile={}. Parent will only see alert via dashboard WebSocket.", event.getProfileId());
            }

            // 3. WebSocket broadcast — reaches live dashboard even without FCM
            //    Sends to /topic/alerts/{tenantId} and /topic/sync/{userId} (if known)
            Map<String, Object> alertEvent = new java.util.LinkedHashMap<>();
            alertEvent.put("type",        "SOS_ALERT");
            alertEvent.put("severity",    "CRITICAL");
            alertEvent.put("profileId",   event.getProfileId().toString());
            alertEvent.put("profileName", childName);
            alertEvent.put("message",     bodyText);
            alertEvent.put("latitude",    event.getLatitude());
            alertEvent.put("longitude",   event.getLongitude());
            alertEvent.put("timestamp",   (event.getTriggeredAt() != null
                    ? event.getTriggeredAt() : OffsetDateTime.now()).toString());

            try {
                String broadcastUri = notifBaseUrl + "/internal/notifications/broadcast";
                if (tenantId != null) broadcastUri += "?tenantId=" + tenantId;
                if (parentUserId != null) broadcastUri += (tenantId != null ? "&" : "?") + "userId=" + parentUserId;

                restClient.post()
                        .uri(broadcastUri)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(alertEvent)
                        .retrieve()
                        .toBodilessEntity();
            } catch (Exception ex) {
                log.warn("SOS WebSocket broadcast failed (non-fatal): {}", ex.getMessage());
            }

            // 4. Emergency contact broadcast (SMS/email via notification service)
            broadcastToEmergencyContacts(event, childName);

            log.info("SOS notification pipeline complete for profile={} parentResolved={}", event.getProfileId(), parentUserId != null);
        } catch (Exception e) {
            log.error("SOS notification pipeline error for profile={}: {}", event.getProfileId(), e.getMessage(), e);
        }
    }

    /**
     * Fetches emergency contacts for the child profile and sends email alerts
     * via shield-notification's internal emergency endpoint.
     * Failures are non-fatal — each contact is attempted independently.
     */
    @SuppressWarnings("unchecked")
    private void broadcastToEmergencyContacts(SosEvent event, String childName) {
        try {
            List<ServiceInstance> profileInstances = discoveryClient.getInstances(PROFILE_SERVICE);
            if (profileInstances.isEmpty()) {
                log.warn("Emergency contact broadcast skipped — {} not found in Eureka for profile={}",
                        PROFILE_SERVICE, event.getProfileId());
                return;
            }
            String profileBase = profileInstances.get(0).getUri().toString();

            List<Map<String, Object>> contacts;
            try {
                contacts = restClient.get()
                        .uri(profileBase + "/internal/profiles/" + event.getProfileId() + "/emergency-contacts")
                        .retrieve()
                        .body(java.util.List.class);
            } catch (Exception e) {
                log.warn("Failed to fetch emergency contacts for profile={}: {}", event.getProfileId(), e.getMessage());
                return;
            }

            if (contacts == null || contacts.isEmpty()) {
                log.debug("No emergency contacts for profile={}", event.getProfileId());
                return;
            }

            String notifBaseUrl = resolveNotificationUrl();
            if (notifBaseUrl == null) return;

            String bodyText = childName + " has triggered an emergency SOS alert! " +
                    "Please check on them immediately." +
                    (event.getMessage() != null && !event.getMessage().isBlank()
                            ? " Message: " + event.getMessage() : "");

            for (Map<String, Object> contact : contacts) {
                try {
                    Map<String, Object> payload = new java.util.LinkedHashMap<>();
                    payload.put("type",           "EMERGENCY_CONTACT_ALERT");
                    payload.put("title",          "SOS Alert: " + childName + " needs help!");
                    payload.put("body",           bodyText);
                    payload.put("recipientName",  contact.get("name"));
                    payload.put("recipientEmail", contact.get("email"));
                    payload.put("recipientPhone", contact.get("phone"));
                    payload.put("channel",        "EMAIL_AND_SMS");

                    restClient.post()
                            .uri(notifBaseUrl + "/internal/notifications/emergency")
                            .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                            .body(payload)
                            .retrieve()
                            .toBodilessEntity();

                    log.info("Emergency contact notified: name={} email={} phone={}",
                            contact.get("name"), contact.get("email"), contact.get("phone"));
                } catch (Exception e) {
                    log.warn("Failed to notify emergency contact {}: {}", contact.get("name"), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Emergency contact broadcast failed for profile={}: {}", event.getProfileId(), e.getMessage());
        }
    }

    /**
     * Calls shield-profile internal endpoint to resolve the parent's userId and tenantId
     * for a given child profileId. Falls back gracefully if the profile service is unavailable.
     */
    /**
     * Resolves the parent userId and tenantId for a child profileId.
     * Returns a map with "userId" (parent's real UUID), "tenantId", and "childName".
     * Returns map WITHOUT "userId" key if parent cannot be determined — callers must null-check.
     * NEVER returns profileId as userId — that would send FCM to the wrong token.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveParentInfo(UUID profileId) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances(PROFILE_SERVICE);
            if (instances.isEmpty()) {
                log.error("SOS parent resolution FAILED — {} has no instances in Eureka for profile={}",
                        PROFILE_SERVICE, profileId);
                return new HashMap<>();  // empty — no userId key, signals caller to skip FCM
            }
            String profileBaseUrl = instances.get(0).getUri().toString();
            Map<String, Object> result = restClient.get()
                    .uri(profileBaseUrl + "/internal/profiles/" + profileId + "/parent")
                    .retrieve()
                    .body(Map.class);
            if (result == null || !result.containsKey("userId")) {
                log.error("SOS parent resolution FAILED — profile service returned no userId for profile={}", profileId);
                return new HashMap<>();
            }
            log.info("SOS parent resolved for profileId={}: parentUserId={} tenantId={}",
                    profileId, result.get("userId"), result.get("tenantId"));
            return result;
        } catch (Exception e) {
            log.error("SOS parent resolution FAILED for profile={}: {}", profileId, e.getMessage());
            return new HashMap<>();
        }
    }

    @Transactional
    public SosEventResponse acknowledgeSos(UUID sosId, UUID userId) {
        SosEvent event = sosEventRepository.findById(sosId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SOS event not found: " + sosId));

        if (!"ACTIVE".equals(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SOS event is not in ACTIVE state");
        }

        event.setStatus("ACKNOWLEDGED");
        event.setAcknowledgedAt(OffsetDateTime.now());
        event = sosEventRepository.save(event);
        log.info("SOS {} acknowledged by user {}", sosId, userId);
        return toResponse(event);
    }

    @Transactional
    public SosEventResponse resolveSos(UUID sosId, UUID userId) {
        SosEvent event = sosEventRepository.findById(sosId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SOS event not found: " + sosId));

        if ("RESOLVED".equals(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SOS event is already RESOLVED");
        }

        event.setStatus("RESOLVED");
        event.setResolvedAt(OffsetDateTime.now());
        event = sosEventRepository.save(event);
        log.info("SOS {} resolved by user {}", sosId, userId);
        return toResponse(event);
    }

    @Transactional(readOnly = true)
    public List<SosEventResponse> getAllActiveSosPlatform() {
        return sosEventRepository.findTop50ByStatusOrderByTriggeredAtDesc("ACTIVE")
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SosEventResponse> getAllSosPlatform() {
        return sosEventRepository.findTop50ByOrderByTriggeredAtDesc()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SosEventResponse> getActiveSosEvents(UUID profileId) {
        return sosEventRepository.findTop50ByProfileIdAndStatusOrderByTriggeredAtDesc(profileId, "ACTIVE")
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SosEventResponse> getAllSosEvents(UUID profileId) {
        return sosEventRepository.findTop50ByProfileIdOrderByTriggeredAtDesc(profileId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka — skipping SOS notification", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private SosEventResponse toResponse(SosEvent e) {
        return SosEventResponse.builder()
                .id(e.getId())
                .profileId(e.getProfileId())
                .latitude(e.getLatitude())
                .longitude(e.getLongitude())
                .message(e.getMessage())
                .status(e.getStatus())
                .triggeredAt(e.getTriggeredAt())
                .build();
    }
}
