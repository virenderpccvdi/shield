package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.response.ScreenTimeRequestResponse;
import com.rstglobal.shield.dns.entity.ScreenTimeRequest;
import com.rstglobal.shield.dns.repository.ScreenTimeRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * FC-02: Screen Time Request business logic.
 *
 * <p>Children request extra screen time via {@link #requestTime}.
 * The parent approves or denies via {@link #approve} / {@link #deny}.
 * Stale PENDING requests are auto-expired every 60 seconds.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScreenTimeRequestService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";
    private static final String PROFILE_SERVICE      = "SHIELD-PROFILE";

    private final ScreenTimeRequestRepository repo;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient = RestClient.builder().build();

    // ── Submit request ────────────────────────────────────────────────────────

    /**
     * Called by the child app to request extra screen time.
     *
     * @param profileId  child's profile ID (from X-Profile-Id header)
     * @param customerId parent's customer ID (from X-Customer-Id header, may be null)
     * @param minutes    extra minutes requested (5–240)
     * @param reason     optional free-text reason
     */
    @Transactional
    public ScreenTimeRequestResponse requestTime(UUID profileId, UUID customerId,
                                                  int minutes, String reason) {
        ScreenTimeRequest entity = ScreenTimeRequest.builder()
                .profileId(profileId)
                .customerId(customerId)
                .minutes(minutes)
                .reason(reason)
                .build();
        ScreenTimeRequest saved = repo.save(entity);
        log.info("Screen-time request created: id={} profileId={} minutes={}", saved.getId(), profileId, minutes);

        // Resolve parent info and notify (fire-and-forget)
        notifyParent(saved);

        return toResponse(saved);
    }

    // ── Approve ───────────────────────────────────────────────────────────────

    /**
     * Parent approves a pending screen-time request.
     * Sets expiresAt = now + requested minutes so the child knows exactly when
     * the extra grant ends.
     */
    @Transactional
    public ScreenTimeRequestResponse approve(UUID requestId, UUID approverId) {
        ScreenTimeRequest entity = findPending(requestId);
        entity.setStatus("APPROVED");
        entity.setDecidedAt(OffsetDateTime.now());
        entity.setDecidedBy(approverId);
        entity.setExpiresAt(OffsetDateTime.now().plusMinutes(entity.getMinutes()));
        repo.save(entity);

        log.info("Screen-time request approved: id={} approverId={} minutes={}", requestId, approverId, entity.getMinutes());
        notifyChild(entity, true);

        return toResponse(entity);
    }

    // ── Deny ──────────────────────────────────────────────────────────────────

    /** Parent denies a pending screen-time request. */
    @Transactional
    public ScreenTimeRequestResponse deny(UUID requestId, UUID approverId) {
        ScreenTimeRequest entity = findPending(requestId);
        entity.setStatus("DENIED");
        entity.setDecidedAt(OffsetDateTime.now());
        entity.setDecidedBy(approverId);
        repo.save(entity);

        log.info("Screen-time request denied: id={} approverId={}", requestId, approverId);
        notifyChild(entity, false);

        return toResponse(entity);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ScreenTimeRequestResponse> getPending(UUID profileId) {
        return repo.findByProfileIdAndStatusOrderByRequestedAtDesc(profileId, "PENDING")
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ScreenTimeRequestResponse> getAll(UUID profileId) {
        return repo.findTop20ByProfileIdOrderByRequestedAtDesc(profileId)
                .stream().map(this::toResponse).toList();
    }

    // ── Auto-expiry ───────────────────────────────────────────────────────────

    /** Expire PENDING requests older than 2 hours (runs every 60 s). */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireOld() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(2);
        List<ScreenTimeRequest> stale = repo.findByStatusAndRequestedAtBefore("PENDING", cutoff);
        if (stale.isEmpty()) return;
        for (ScreenTimeRequest r : stale) {
            r.setStatus("EXPIRED");
        }
        repo.saveAll(stale);
        log.info("Expired {} stale screen-time requests", stale.size());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private ScreenTimeRequest findPending(UUID requestId) {
        ScreenTimeRequest entity = repo.findById(requestId)
                .orElseThrow(() -> ShieldException.notFound("screen-time-request", requestId.toString()));
        if (!"PENDING".equals(entity.getStatus())) {
            throw ShieldException.conflict("Request already " + entity.getStatus());
        }
        return entity;
    }

    /**
     * Resolve parent info from SHIELD-PROFILE internal endpoint and send
     * FCM push + WebSocket event to the parent.
     */
    private void notifyParent(ScreenTimeRequest req) {
        try {
            String notifBase = resolveServiceUrl(NOTIFICATION_SERVICE);
            if (notifBase == null) return;

            // Resolve child name and parent userId from SHIELD-PROFILE
            String childName  = "Your child";
            UUID   parentUserId = req.getCustomerId();

            try {
                String profileBase = resolveServiceUrl(PROFILE_SERVICE);
                if (profileBase != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> parentInfo = restClient.get()
                            .uri(profileBase + "/internal/profiles/" + req.getProfileId() + "/parent")
                            .retrieve()
                            .body(Map.class);
                    if (parentInfo != null) {
                        if (parentInfo.get("name") instanceof String n && !n.isBlank()) {
                            // parentInfo.name is the child profile name, userId is the parent
                            childName = n;
                        }
                        if (parentInfo.get("userId") instanceof String uid) {
                            parentUserId = UUID.fromString(uid);
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("Could not resolve parent info for profileId={}: {}", req.getProfileId(), e.getMessage());
            }

            String reason = (req.getReason() != null && !req.getReason().isBlank())
                    ? " Reason: " + req.getReason()
                    : "";

            Map<String, String> data = new LinkedHashMap<>();
            data.put("type",      "SCREEN_TIME_REQUEST");
            data.put("requestId", req.getId().toString());
            data.put("profileId", req.getProfileId().toString());
            data.put("minutes",   req.getMinutes().toString());

            Map<String, Object> pushPayload = new LinkedHashMap<>();
            pushPayload.put("userId",   parentUserId != null ? parentUserId.toString() : null);
            pushPayload.put("title",    "\u23F1 Screen Time Request");
            pushPayload.put("body",     childName + " wants " + req.getMinutes() + " more minutes of screen time." + reason);
            pushPayload.put("priority", "HIGH");
            pushPayload.put("data",     data);

            restClient.post()
                    .uri(notifBase + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(pushPayload)
                    .retrieve()
                    .toBodilessEntity();

            // WebSocket broadcast so the dashboard updates in real time
            if (parentUserId != null) {
                Map<String, Object> wsPayload = new LinkedHashMap<>();
                wsPayload.put("type",      "SCREEN_TIME_REQUEST");
                wsPayload.put("requestId", req.getId().toString());
                wsPayload.put("profileId", req.getProfileId().toString());
                wsPayload.put("minutes",   req.getMinutes());
                wsPayload.put("reason",    req.getReason());

                restClient.post()
                        .uri(notifBase + "/internal/notifications/broadcast?userId=" + parentUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(wsPayload)
                        .retrieve()
                        .toBodilessEntity();
            }

            log.debug("Parent notified of screen-time request id={}", req.getId());
        } catch (Exception e) {
            log.warn("Failed to notify parent for screen-time request {}: {}", req.getId(), e.getMessage());
        }
    }

    /**
     * Send FCM push to the child's profile topic so the child app receives
     * an instant feedback notification.
     */
    private void notifyChild(ScreenTimeRequest req, boolean approved) {
        try {
            String notifBase = resolveServiceUrl(NOTIFICATION_SERVICE);
            if (notifBase == null) return;

            String title = approved ? "\u2705 Request Approved" : "\u274C Request Denied";
            String body  = approved
                    ? "Your parent approved " + req.getMinutes() + " extra minutes of screen time."
                    : "Your screen time request was not approved.";

            Map<String, String> data = new LinkedHashMap<>();
            data.put("type",      approved ? "SCREEN_TIME_APPROVED" : "SCREEN_TIME_DENIED");
            data.put("requestId", req.getId().toString());
            data.put("profileId", req.getProfileId().toString());
            data.put("minutes",   req.getMinutes().toString());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("topic", "profile-" + req.getProfileId());
            payload.put("title", title);
            payload.put("body",  body);
            payload.put("data",  data);

            restClient.post()
                    .uri(notifBase + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.debug("Child notified of screen-time decision id={} approved={}", req.getId(), approved);
        } catch (Exception e) {
            log.warn("Failed to notify child for screen-time request {}: {}", req.getId(), e.getMessage());
        }
    }

    private String resolveServiceUrl(String serviceName) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        if (instances.isEmpty()) {
            log.warn("No instances of {} in Eureka — skipping notification", serviceName);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private ScreenTimeRequestResponse toResponse(ScreenTimeRequest e) {
        return ScreenTimeRequestResponse.builder()
                .id(e.getId())
                .profileId(e.getProfileId())
                .customerId(e.getCustomerId())
                .minutes(e.getMinutes())
                .reason(e.getReason())
                .status(e.getStatus())
                .requestedAt(e.getRequestedAt())
                .decidedAt(e.getDecidedAt())
                .decidedBy(e.getDecidedBy())
                .expiresAt(e.getExpiresAt())
                .build();
    }
}
