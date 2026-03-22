package com.rstglobal.shield.analytics.service;

import com.rstglobal.shield.analytics.entity.SuspiciousActivityAlert;
import com.rstglobal.shield.analytics.repository.DnsQueryLogRepository;
import com.rstglobal.shield.analytics.repository.SuspiciousActivityAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * CS-05: Suspicious Activity Detection Service.
 * Detects BURST_BLOCKED and SUSPICIOUS_CATEGORY patterns in DNS logs
 * and creates alerts + push notifications to the parent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SuspiciousActivityService {

    private static final int BURST_BLOCKED_THRESHOLD = 20;         // blocked queries in 5 min
    private static final int DEDUP_MINUTES = 30;                   // suppress duplicate alert window
    private static final String[] HIGH_RISK_CATEGORIES = {
        "ADULT", "ADULT_CONTENT", "PORNOGRAPHY", "MALWARE",
        "PHISHING", "GAMBLING", "DRUGS", "WEAPONS"
    };

    private final DnsQueryLogRepository dnsRepo;
    private final SuspiciousActivityAlertRepository alertRepo;

    @Value("${shield.notification.service-url:http://localhost:8286}")
    private String notificationServiceUrl;

    private final RestClient restClient = RestClient.builder().build();

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Run anomaly detection for the given profile.
     * Returns the number of new alerts created.
     */
    @Transactional
    public int detectAnomalies(UUID profileId, String childName) {
        int created = 0;
        created += checkBurstBlocked(profileId, childName);
        created += checkSuspiciousCategory(profileId, childName);
        return created;
    }

    /**
     * List alerts for a profile; optionally only pending (unacknowledged) ones.
     */
    @Transactional(readOnly = true)
    public List<SuspiciousActivityAlert> getAlerts(UUID profileId, boolean pendingOnly) {
        if (pendingOnly) {
            return alertRepo.findByProfileIdAndAcknowledgedFalseOrderByDetectedAtDesc(profileId);
        }
        return alertRepo.findByProfileIdOrderByDetectedAtDesc(profileId);
    }

    /**
     * Acknowledge (dismiss) an alert by its ID.
     */
    @Transactional
    public void acknowledge(UUID alertId) {
        alertRepo.findById(alertId).ifPresent(a -> {
            a.setAcknowledged(true);
            a.setAcknowledgedAt(Instant.now());
            alertRepo.save(a);
        });
    }

    // ── Detectors ─────────────────────────────────────────────────────────────

    /**
     * BURST_BLOCKED: more than 20 blocked queries in the last 5 minutes.
     */
    private int checkBurstBlocked(UUID profileId, String childName) {
        Instant to   = Instant.now();
        Instant from = to.minus(5, ChronoUnit.MINUTES);

        long blocked = dnsRepo.countByProfileIdAndActionAndQueriedAtBetween(profileId, "BLOCKED", from, to);
        if (blocked <= BURST_BLOCKED_THRESHOLD) return 0;

        String type = "BURST_BLOCKED";
        if (isDuplicate(profileId, type)) return 0;

        String severity = blocked > 50 ? "HIGH" : "HIGH";  // always HIGH for burst
        String description = String.format(
            "%d blocked DNS queries in the last 5 minutes — possible attempt to access restricted content repeatedly.",
            blocked);

        return saveAlertAndNotify(profileId, type, severity, description, childName);
    }

    /**
     * SUSPICIOUS_CATEGORY: any queries to high-risk categories in the last 5 minutes.
     */
    private int checkSuspiciousCategory(UUID profileId, String childName) {
        Instant to   = Instant.now();
        Instant from = to.minus(5, ChronoUnit.MINUTES);

        long risky = dnsRepo.countQueriesByCategories(profileId, from, to, HIGH_RISK_CATEGORIES);
        if (risky == 0) return 0;

        String type = "SUSPICIOUS_CATEGORY";
        if (isDuplicate(profileId, type)) return 0;

        String description = String.format(
            "%d DNS quer%s to high-risk categories (adult content, malware, or gambling) detected in the last 5 minutes.",
            risky, risky == 1 ? "y" : "ies");

        return saveAlertAndNotify(profileId, type, "MEDIUM", description, childName);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean isDuplicate(UUID profileId, String alertType) {
        Instant since = Instant.now().minus(DEDUP_MINUTES, ChronoUnit.MINUTES);
        return alertRepo.countRecentAlerts(profileId, alertType, since) > 0;
    }

    private int saveAlertAndNotify(UUID profileId, String type, String severity,
                                   String description, String childName) {
        SuspiciousActivityAlert alert = new SuspiciousActivityAlert();
        alert.setProfileId(profileId);
        alert.setAlertType(type);
        alert.setSeverity(severity);
        alert.setDescription(description);
        alert.setDetectedAt(Instant.now());
        alertRepo.save(alert);
        log.info("Suspicious activity alert [{}] {} for profile {}", severity, type, profileId);

        // Send FCM push to parent (best-effort; use profile topic)
        try {
            String topic = "profile_" + profileId;
            String title = "Suspicious Activity \u2014 " + (childName != null ? childName : "Your Child");
            Map<String, Object> pushReq = Map.of(
                "topic", topic,
                "title", title,
                "body", description,
                "priority", "HIGH",
                "data", Map.of("type", "SUSPICIOUS_ACTIVITY", "profileId", profileId.toString(), "alertType", type)
            );
            restClient.post()
                .uri(notificationServiceUrl + "/internal/notifications/push")
                .contentType(MediaType.APPLICATION_JSON)
                .body(pushReq)
                .retrieve()
                .toBodilessEntity();
        } catch (Exception ex) {
            log.warn("Failed to send push notification for suspicious activity alert: {}", ex.getMessage());
        }

        return 1;
    }
}
