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
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            // 1. Persistent notification (WebSocket + FCM + email)
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "SOS_ALERT");
            payload.put("title", "🚨 SOS Alert - Child Needs Help!");
            payload.put("body", "Your child has triggered an emergency SOS alert. " +
                    (event.getMessage() != null && !event.getMessage().isBlank()
                            ? "Message: " + event.getMessage()
                            : "Tap to view their location."));
            payload.put("profileId", event.getProfileId().toString());
            payload.put("userId", event.getProfileId().toString()); // notification service routes via profileId
            payload.put("actionUrl", "https://shield.rstglobal.in/app/map");
            payload.put("tenantId", "00000000-0000-0000-0000-000000000000");

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            // 2. Also push via WS so live dashboard sees it instantly
            Map<String, Object> wsBroadcast = new HashMap<>();
            wsBroadcast.put("type", "SOS_ALERT");
            wsBroadcast.put("profileId", event.getProfileId().toString());
            wsBroadcast.put("latitude", event.getLatitude());
            wsBroadcast.put("longitude", event.getLongitude());
            wsBroadcast.put("message", event.getMessage());
            wsBroadcast.put("triggeredAt", event.getTriggeredAt() != null
                    ? event.getTriggeredAt().toString() : OffsetDateTime.now().toString());

            restClient.post()
                    .uri(baseUrl + "/internal/location-update")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(wsBroadcast)
                    .retrieve()
                    .toBodilessEntity();

            log.info("SOS notification sent for profile={}", event.getProfileId());
        } catch (Exception e) {
            log.warn("Failed to send SOS notification: {}", e.getMessage());
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
    public List<SosEventResponse> getActiveSosEvents(UUID profileId) {
        return sosEventRepository.findByProfileIdAndStatusOrderByTriggeredAtDesc(profileId, "ACTIVE")
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SosEventResponse> getAllSosEvents(UUID profileId) {
        return sosEventRepository.findByProfileIdOrderByTriggeredAtDesc(profileId)
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
