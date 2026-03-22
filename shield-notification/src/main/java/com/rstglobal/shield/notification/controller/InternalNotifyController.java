package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.notification.dto.request.DigestTriggerRequest;
import com.rstglobal.shield.notification.dto.request.PushNotificationRequest;
import com.rstglobal.shield.notification.dto.request.SendNotificationRequest;
import com.rstglobal.shield.notification.dto.response.NotificationResponse;
import com.rstglobal.shield.notification.service.EmailService;
import com.rstglobal.shield.notification.service.FcmService;
import com.rstglobal.shield.notification.service.NotificationService;
import com.rstglobal.shield.notification.service.ReportCardService;
import com.rstglobal.shield.notification.service.WeeklyDigestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Internal endpoints — called by shield-dns, shield-location, shield-profile, etc.
 * Not exposed through the API gateway.
 */
@Slf4j
@RestController
@RequestMapping("/internal/notifications")
@RequiredArgsConstructor
public class InternalNotifyController {

    private final NotificationService notifService;
    private final FcmService fcmService;
    private final SimpMessagingTemplate ws;
    private final EmailService emailService;
    private final WeeklyDigestService weeklyDigestService;
    private final ReportCardService reportCardService;

    /**
     * Send a full notification (persisted to DB + dispatched via all channels including FCM).
     */
    @PostMapping("/send")
    public ResponseEntity<ApiResponse<NotificationResponse>> send(
            @Valid @RequestBody SendNotificationRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.ok(notifService.send(req)));
    }

    /**
     * Send a push-only notification to a user's devices via FCM.
     * Used for real-time alerts: geofence breach, SOS panic, DNS block alerts.
     * Does NOT persist to DB — use /send for persistent notifications.
     */
    @PostMapping("/push")
    public ResponseEntity<ApiResponse<Map<String, Object>>> sendPush(
            @Valid @RequestBody PushNotificationRequest req) {

        int sent;
        if (req.getTopic() != null && !req.getTopic().isBlank()) {
            String msgId = fcmService.sendToTopic(req.getTopic(), req.getTitle(),
                    req.getBody(), req.getData());
            sent = msgId != null ? 1 : 0;
        } else if ("HIGH".equalsIgnoreCase(req.getPriority())) {
            sent = fcmService.sendHighPriority(req.getUserId(), req.getTitle(),
                    req.getBody(), req.getData());
        } else {
            sent = fcmService.sendToUser(req.getUserId(), req.getTitle(),
                    req.getBody(), req.getData());
        }

        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "devicesSent", sent,
                "target", req.getTopic() != null ? req.getTopic() : (req.getUserId() != null ? req.getUserId().toString() : "unknown")
        )));
    }

    /**
     * Broadcast a real-time location update to WebSocket clients listening on
     * /topic/location/{profileId}. Called by shield-location after every location save.
     */
    @PostMapping("/location-update")
    public ResponseEntity<Void> broadcastLocation(@RequestBody Map<String, Object> payload) {
        String profileId = (String) payload.get("profileId");
        if (profileId != null && !profileId.isBlank()) {
            ws.convertAndSend("/topic/location/" + profileId, (Object) payload);
        }
        return ResponseEntity.ok().build();
    }

    /**
     * Broadcast an alert event to the tenant-wide alert topic AND a user-specific sync topic.
     * Used by SOS, geofence breach, spoofing detection — anything that must reach the parent
     * dashboard in real time even when no FCM token is available.
     *
     * Broadcasts to:
     *   /topic/alerts/{tenantId}          — dashboard alert feed
     *   /topic/sync/{userId}              — user-specific sync (if userId provided)
     */
    @PostMapping("/broadcast")
    public ResponseEntity<Void> broadcast(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String userId,
            @RequestBody Map<String, Object> payload) {
        if (tenantId != null && !tenantId.isBlank()) {
            ws.convertAndSend("/topic/alerts/" + tenantId, (Object) payload);
        }
        if (userId != null && !userId.isBlank()) {
            ws.convertAndSend("/topic/sync/" + userId, (Object) payload);
        }
        return ResponseEntity.ok().build();
    }

    /**
     * Send an emergency alert email to an external recipient (no app required).
     * Called by shield-location SosService when broadcasting to emergency contacts.
     * Phone/SMS is a no-op unless a TwilioSmsService integration is configured.
     */
    @PostMapping("/emergency")
    public ResponseEntity<Void> sendEmergency(@RequestBody Map<String, Object> payload) {
        String recipientEmail = (String) payload.get("recipientEmail");
        String recipientName  = (String) payload.get("recipientName");
        String title          = (String) payload.get("title");
        String body           = (String) payload.get("body");

        if (recipientEmail != null && !recipientEmail.isBlank()) {
            emailService.sendEmergencyAlert(recipientEmail, recipientName, title, body);
        } else {
            log.debug("Emergency endpoint: no recipientEmail — skipping email");
        }
        // SMS via Twilio is a future extension; phone field accepted but not dispatched here
        return ResponseEntity.ok().build();
    }

    /**
     * Manually trigger a weekly digest for a single user — useful for testing and
     * admin-initiated resends without waiting for the Monday 8 AM scheduler.
     *
     * <p>Request body:
     * <pre>{ "userId": "...", "email": "...", "parentName": "..." }</pre>
     *
     * <p>The digest runs asynchronously via {@link WeeklyDigestService#sendDigestForUser}.
     */
    @PostMapping("/digest/trigger")
    public ResponseEntity<ApiResponse<Map<String, Object>>> triggerDigest(
            @Valid @RequestBody DigestTriggerRequest req) {

        log.info("Manual digest trigger requested for userId={} email={}", req.userId(), req.email());

        LocalDate weekEnd   = LocalDate.now().minusDays(1);
        LocalDate weekStart = weekEnd.minusDays(6);

        Map<String, Object> userMap = Map.of(
                "id",         req.userId(),
                "email",      req.email(),
                "firstName",  req.parentName()
        );

        // Fire-and-forget — runs on @Async executor
        weeklyDigestService.sendDigestForUser(userMap, weekStart, weekEnd);

        return ResponseEntity.accepted().body(ApiResponse.ok(Map.of(
                "status",    "queued",
                "userId",    req.userId(),
                "email",     req.email(),
                "weekStart", weekStart.toString(),
                "weekEnd",   weekEnd.toString()
        )));
    }

    /**
     * Manually trigger a monthly report card for a single user — useful for testing
     * and admin-initiated resends without waiting for the 1st-of-month scheduler.
     *
     * <p>Request body:
     * <pre>{ "userId": "...", "email": "...", "parentName": "..." }</pre>
     */
    @PostMapping("/report-card/trigger")
    public ResponseEntity<Void> triggerReportCard(@RequestBody Map<String, Object> payload) {
        String userId     = (String) payload.get("userId");
        String email      = (String) payload.get("email");
        String parentName = (String) payload.getOrDefault("parentName", "Parent");
        reportCardService.sendReportCardForUser(userId, email, parentName);
        return ResponseEntity.accepted().build();
    }
}
