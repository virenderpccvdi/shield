package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.notification.entity.AlertPreference;
import com.rstglobal.shield.notification.entity.Notification;
import com.rstglobal.shield.notification.repository.AlertPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.Map;
import java.util.Optional;

/**
 * Dispatches a notification across all configured channels:
 * 1. WebSocket STOMP (real-time, if user is online in dashboard)
 * 2. FCM Push (Firebase Cloud Messaging to mobile devices)
 * 3. Email
 * 4. WhatsApp
 * 5. Telegram
 *
 * Respects quiet hours and per-type preference toggles.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationDispatcher {

    private final SimpMessagingTemplate ws;
    private final EmailService emailService;
    private final WhatsAppService whatsappService;
    private final TelegramService telegramService;
    private final FcmService fcmService;
    private final AlertPreferenceRepository prefRepo;

    /**
     * @param notification  The saved Notification entity
     * @param toEmail       User's email address
     */
    public void dispatch(Notification notification, String toEmail) {
        Optional<AlertPreference> prefOpt = prefRepo.findByUserId(notification.getUserId());
        AlertPreference pref = prefOpt.orElse(defaultPreference());

        // Check quiet hours
        if (isQuietTime(pref)) {
            log.debug("Quiet hours active — suppressing notification userId={}", notification.getUserId());
            // Still deliver via WebSocket (silent in-app)
            pushWebSocket(notification);
            return;
        }

        // Check type-based toggle
        if (!isTypeEnabled(pref, notification.getType())) {
            log.debug("Alert type {} disabled for userId={}", notification.getType(), notification.getUserId());
            return;
        }

        // 1. WebSocket (always attempt — no failure risk)
        pushWebSocket(notification);

        // 2. FCM Push (if user has push_enabled and registered device tokens)
        if (Boolean.TRUE.equals(pref.getPushEnabled())) {
            try {
                Map<String, String> data = Map.of(
                        "type", notification.getType(),
                        "notificationId", notification.getId().toString(),
                        "actionUrl", notification.getActionUrl() != null ? notification.getActionUrl() : ""
                );
                fcmService.sendToUser(notification.getUserId(),
                        notification.getTitle(), notification.getBody(), data);
            } catch (Exception e) {
                log.debug("FCM push failed for userId={}: {}", notification.getUserId(), e.getMessage());
            }
        }

        // 4. Email
        if (Boolean.TRUE.equals(pref.getEmailEnabled()) && toEmail != null) {
            String emailBody = buildEmailBody(notification);
            emailService.sendPlainEmail(
                    notification.getTenantId(), toEmail,
                    notification.getTitle(), emailBody);
        }

        // 5. WhatsApp
        if (Boolean.TRUE.equals(pref.getWhatsappEnabled())) {
            String msg = notification.getTitle() + "\n\n" + notification.getBody();
            whatsappService.send(notification.getTenantId(), pref.getWhatsappNumber(), msg);
        }

        // 6. Telegram
        if (Boolean.TRUE.equals(pref.getTelegramEnabled())) {
            String msg = "<b>" + notification.getTitle() + "</b>\n" + notification.getBody();
            telegramService.send(notification.getTenantId(), pref.getTelegramChatId(), msg);
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private void pushWebSocket(Notification n) {
        try {
            String destination = "/topic/notifications/" + n.getUserId();
            Map<String, Object> payload = Map.of(
                    "id", n.getId().toString(),
                    "type", n.getType(),
                    "title", n.getTitle(),
                    "body", n.getBody(),
                    "createdAt", n.getCreatedAt() != null ? n.getCreatedAt().toString() : ""
            );
            ws.convertAndSend(destination, (Object) payload);
        } catch (Exception e) {
            log.debug("WebSocket push failed (user likely offline): {}", e.getMessage());
        }
    }

    private boolean isQuietTime(AlertPreference pref) {
        if (!Boolean.TRUE.equals(pref.getQuietHoursEnabled())) return false;
        int hour = LocalTime.now().getHour();
        int start = pref.getQuietStartHour() != null ? pref.getQuietStartHour() : 22;
        int end = pref.getQuietEndHour() != null ? pref.getQuietEndHour() : 7;
        if (start > end) return hour >= start || hour < end;
        return hour >= start && hour < end;
    }

    private boolean isTypeEnabled(AlertPreference pref, String type) {
        return switch (type) {
            case "BLOCK_ALERT"   -> Boolean.TRUE.equals(pref.getBlockAlerts());
            case "SCHEDULE_START", "SCHEDULE_END", "OVERRIDE_APPLIED" ->
                    Boolean.TRUE.equals(pref.getScheduleAlerts());
            case "BUDGET_WARNING", "BUDGET_EXCEEDED" ->
                    Boolean.TRUE.equals(pref.getBudgetAlerts());
            case "EXTENSION_REQUESTED", "EXTENSION_APPROVED", "EXTENSION_REJECTED" ->
                    Boolean.TRUE.equals(pref.getExtensionAlerts());
            case "WEEKLY_REPORT" -> Boolean.TRUE.equals(pref.getWeeklyReportEnabled());
            default -> true;
        };
    }

    private String buildEmailBody(Notification n) {
        return n.getBody()
                + (n.getActionUrl() != null ? "\n\nOpen Shield: " + n.getActionUrl() : "")
                + "\n\n---\nShield Family Protection";
    }

    private AlertPreference defaultPreference() {
        return AlertPreference.builder()
                .pushEnabled(true).emailEnabled(true)
                .whatsappEnabled(false).telegramEnabled(false)
                .quietHoursEnabled(false)
                .blockAlerts(true).scheduleAlerts(true)
                .budgetAlerts(true).extensionAlerts(true)
                .weeklyReportEnabled(true)
                .build();
    }
}
