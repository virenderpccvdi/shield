package com.rstglobal.shield.notification.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import com.rstglobal.shield.notification.entity.DeviceToken;
import com.rstglobal.shield.notification.repository.DeviceTokenRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Firebase Cloud Messaging service.
 * Sends push notifications to registered devices via FCM.
 * Gracefully degrades if Firebase is not configured (no-op).
 */
@Slf4j
@Service
public class FcmService {

    private final DeviceTokenRepository tokenRepo;
    private final boolean firebaseEnabled;

    public FcmService(DeviceTokenRepository tokenRepo) {
        this.tokenRepo = tokenRepo;
        this.firebaseEnabled = !FirebaseApp.getApps().isEmpty();
        if (!firebaseEnabled) {
            log.warn("Firebase is not initialized — FCM push notifications will be skipped");
        }
    }

    /**
     * Send push notification to a single device token.
     *
     * @return message ID if successful, null if skipped/failed
     */
    public String sendPushNotification(String fcmToken, String title, String body,
                                        Map<String, String> data) {
        if (!firebaseEnabled) {
            log.debug("FCM disabled — skipping push to token {}", maskToken(fcmToken));
            return null;
        }
        try {
            Message.Builder builder = Message.builder()
                    .setToken(fcmToken)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .setNotification(AndroidNotification.builder()
                                    .setSound("default")
                                    .setClickAction("FLUTTER_NOTIFICATION_CLICK")
                                    .build())
                            .build());

            if (data != null && !data.isEmpty()) {
                builder.putAllData(data);
            }

            String messageId = FirebaseMessaging.getInstance().send(builder.build());
            log.debug("FCM sent: messageId={} token={}", messageId, maskToken(fcmToken));
            return messageId;
        } catch (FirebaseMessagingException e) {
            handleFcmError(fcmToken, e);
            return null;
        }
    }

    /**
     * Send push notification to a topic (e.g. "tenant_{tenantId}").
     */
    public String sendToTopic(String topic, String title, String body,
                               Map<String, String> data) {
        if (!firebaseEnabled) {
            log.debug("FCM disabled — skipping topic push to {}", topic);
            return null;
        }
        try {
            Message.Builder builder = Message.builder()
                    .setTopic(topic)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build());

            if (data != null && !data.isEmpty()) {
                builder.putAllData(data);
            }

            String messageId = FirebaseMessaging.getInstance().send(builder.build());
            log.info("FCM topic push sent: topic={} messageId={}", topic, messageId);
            return messageId;
        } catch (FirebaseMessagingException e) {
            log.warn("FCM topic push failed: topic={} error={}", topic, e.getMessage());
            return null;
        }
    }

    /**
     * Send push notification to ALL registered devices for a given user.
     *
     * @return number of successful sends
     */
    public int sendToUser(UUID userId, String title, String body, Map<String, String> data) {
        if (!firebaseEnabled) {
            log.debug("FCM disabled — skipping push to userId={}", userId);
            return 0;
        }

        List<DeviceToken> tokens = tokenRepo.findByUserIdAndActiveTrue(userId);
        if (tokens.isEmpty()) {
            log.debug("No active FCM tokens for userId={}", userId);
            return 0;
        }

        int successCount = 0;
        for (DeviceToken dt : tokens) {
            String result = sendPushNotification(dt.getToken(), title, body, data);
            if (result != null) successCount++;
        }

        log.info("FCM push to userId={}: {}/{} devices succeeded", userId, successCount, tokens.size());
        return successCount;
    }

    /**
     * Send high-priority push (used for SOS, geofence breach, etc.).
     */
    public int sendHighPriority(UUID userId, String title, String body, Map<String, String> data) {
        if (!firebaseEnabled) return 0;

        List<DeviceToken> tokens = tokenRepo.findByUserIdAndActiveTrue(userId);
        if (tokens.isEmpty()) return 0;

        int successCount = 0;
        for (DeviceToken dt : tokens) {
            try {
                Message message = Message.builder()
                        .setToken(dt.getToken())
                        .setNotification(Notification.builder()
                                .setTitle(title)
                                .setBody(body)
                                .build())
                        .setAndroidConfig(AndroidConfig.builder()
                                .setPriority(AndroidConfig.Priority.HIGH)
                                .setNotification(AndroidNotification.builder()
                                        .setSound("default")
                                        .setChannelId("shield_urgent")
                                        .setClickAction("FLUTTER_NOTIFICATION_CLICK")
                                        .build())
                                .build())
                        .putAllData(data != null ? data : Map.of())
                        .putData("priority", "HIGH")
                        .build();

                FirebaseMessaging.getInstance().send(message);
                successCount++;
            } catch (FirebaseMessagingException e) {
                handleFcmError(dt.getToken(), e);
            }
        }
        return successCount;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void handleFcmError(String token, FirebaseMessagingException e) {
        MessagingErrorCode errorCode = e.getMessagingErrorCode();
        if (errorCode == MessagingErrorCode.UNREGISTERED ||
            errorCode == MessagingErrorCode.INVALID_ARGUMENT) {
            // Token is invalid or expired — deactivate it
            log.warn("FCM token invalid/expired, deactivating: token={} error={}",
                    maskToken(token), errorCode);
            tokenRepo.findAll().stream()
                    .filter(dt -> token.equals(dt.getToken()))
                    .forEach(dt -> {
                        dt.setActive(false);
                        tokenRepo.save(dt);
                    });
        } else {
            log.warn("FCM send failed: token={} error={} code={}",
                    maskToken(token), e.getMessage(), errorCode);
        }
    }

    private String maskToken(String token) {
        if (token == null || token.length() < 12) return "***";
        return token.substring(0, 6) + "..." + token.substring(token.length() - 6);
    }
}
