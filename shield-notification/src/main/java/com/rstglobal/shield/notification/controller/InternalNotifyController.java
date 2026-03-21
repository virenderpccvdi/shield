package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.notification.dto.request.PushNotificationRequest;
import com.rstglobal.shield.notification.dto.request.SendNotificationRequest;
import com.rstglobal.shield.notification.dto.response.NotificationResponse;
import com.rstglobal.shield.notification.service.FcmService;
import com.rstglobal.shield.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Internal endpoints — called by shield-dns, shield-location, shield-profile, etc.
 * Not exposed through the API gateway.
 */
@RestController
@RequestMapping("/internal/notifications")
@RequiredArgsConstructor
public class InternalNotifyController {

    private final NotificationService notifService;
    private final FcmService fcmService;
    private final SimpMessagingTemplate ws;

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
                "userId", req.getUserId().toString()
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
}
