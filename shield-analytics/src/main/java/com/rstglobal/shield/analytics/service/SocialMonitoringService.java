package com.rstglobal.shield.analytics.service;

import com.rstglobal.shield.analytics.entity.SocialAlert;
import com.rstglobal.shield.analytics.repository.DnsQueryLogRepository;
import com.rstglobal.shield.analytics.repository.SocialAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Detects social behaviour patterns from DNS query logs and stores alerts.
 *
 * Signals detected:
 *  - LATE_NIGHT   — queries between 22:00–06:00 UTC above threshold
 *  - SOCIAL_SPIKE — social media queries > 60% of total in last hour
 *  - GAMING_SPIKE — gaming queries exceeding hourly threshold
 *  - NEW_CATEGORY — category not seen in previous 7 days appears today
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SocialMonitoringService {

    private static final String[] SOCIAL_CATEGORIES = {
        "SOCIAL_MEDIA", "SOCIAL_NETWORKS", "SOCIAL"
    };
    private static final String[] GAMING_CATEGORIES = {
        "GAMING", "ONLINE_GAMING", "GAMES"
    };

    /** Suppress duplicate alert of same type per profile for this many hours. */
    private static final int DEDUP_HOURS = 4;

    private final DnsQueryLogRepository dnsRepo;
    private final SocialAlertRepository alertRepo;

    // ── Public API ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SocialAlert> getAlertsForProfile(UUID profileId, boolean unreadOnly) {
        return unreadOnly
            ? alertRepo.findByProfileIdAndAcknowledgedFalseOrderByDetectedAtDesc(profileId)
            : alertRepo.findByProfileIdOrderByDetectedAtDesc(profileId);
    }

    @Transactional(readOnly = true)
    public List<SocialAlert> getUnreadAlertsForTenant(UUID tenantId) {
        return alertRepo.findByTenantIdAndAcknowledgedFalseOrderByDetectedAtDesc(tenantId);
    }

    @Transactional
    public void acknowledgeAlert(UUID alertId) {
        alertRepo.findById(alertId).ifPresent(alert -> {
            alert.setAcknowledged(true);
            alert.setAcknowledgedAt(Instant.now());
            alertRepo.save(alert);
        });
    }

    // ── Scanning (called by scheduler) ────────────────────────────────────────

    /**
     * Run all social monitoring checks for the given profile.
     * Returns number of new alerts generated.
     */
    @Transactional
    public int scanProfile(UUID profileId, UUID tenantId) {
        int generated = 0;
        generated += checkLateNight(profileId, tenantId);
        generated += checkSocialSpike(profileId, tenantId);
        generated += checkGamingSpike(profileId, tenantId);
        generated += checkNewCategories(profileId, tenantId);
        return generated;
    }

    // ── Private detectors ─────────────────────────────────────────────────────

    private int checkLateNight(UUID profileId, UUID tenantId) {
        Instant to   = Instant.now();
        Instant from = to.minus(30, ChronoUnit.MINUTES);

        long lateCount = dnsRepo.countLateNightQueries(profileId, from, to);
        if (lateCount < 10) return 0;

        String type = "LATE_NIGHT";
        if (isDuplicate(profileId, type)) return 0;

        String severity = lateCount > 50 ? "HIGH" : lateCount > 25 ? "MEDIUM" : "LOW";
        String desc = String.format(
            "Late-night internet activity detected: %d DNS queries between 10 PM – 6 AM in the last 30 minutes. " +
            "This may indicate the child is online past their bedtime.", lateCount);

        return saveAlert(profileId, tenantId, type, severity, desc,
            Map.of("lateNightQueryCount", lateCount, "windowMinutes", 30));
    }

    private int checkSocialSpike(UUID profileId, UUID tenantId) {
        Instant to   = Instant.now();
        Instant from = to.minus(1, ChronoUnit.HOURS);

        long total  = dnsRepo.countByProfileIdAndQueriedAtBetween(profileId, from, to);
        if (total < 20) return 0;

        long social = dnsRepo.countQueriesByCategories(profileId, from, to, SOCIAL_CATEGORIES);
        double pct  = (double) social / total * 100.0;
        if (pct < 60.0) return 0;

        String type = "SOCIAL_SPIKE";
        if (isDuplicate(profileId, type)) return 0;

        String severity = pct > 85 ? "HIGH" : "MEDIUM";
        String desc = String.format(
            "Social media usage spike: %d%% of DNS queries in the last hour are social media related (%d of %d total). " +
            "Consider reviewing time limits for social media categories.", Math.round(pct), social, total);

        return saveAlert(profileId, tenantId, type, severity, desc,
            Map.of("socialQueryCount", social, "totalQueries", total, "socialPercent", Math.round(pct)));
    }

    private int checkGamingSpike(UUID profileId, UUID tenantId) {
        Instant to   = Instant.now();
        Instant from = to.minus(30, ChronoUnit.MINUTES);

        long gaming = dnsRepo.countQueriesByCategories(profileId, from, to, GAMING_CATEGORIES);
        if (gaming < 50) return 0;

        String type = "GAMING_SPIKE";
        if (isDuplicate(profileId, type)) return 0;

        String severity = gaming > 150 ? "HIGH" : gaming > 100 ? "MEDIUM" : "LOW";
        String desc = String.format(
            "High gaming activity: %d gaming-related DNS queries in the last 30 minutes. " +
            "This may indicate prolonged or continuous gaming sessions.", gaming);

        return saveAlert(profileId, tenantId, type, severity, desc,
            Map.of("gamingQueryCount", gaming, "windowMinutes", 30));
    }

    private int checkNewCategories(UUID profileId, UUID tenantId) {
        Instant now          = Instant.now();
        Instant recentFrom   = now.minus(24, ChronoUnit.HOURS);
        Instant baselineFrom = now.minus(8,  ChronoUnit.DAYS);
        Instant baselineTo   = recentFrom;

        List<String> newCats = dnsRepo.findNewCategories(
            profileId, recentFrom, now, baselineFrom, baselineTo);

        if (newCats.isEmpty()) return 0;

        // Filter out low-risk categories; only alert on risky ones
        List<String> risky = newCats.stream()
            .filter(c -> c != null && isRiskyNewCategory(c))
            .toList();
        if (risky.isEmpty()) return 0;

        String type = "NEW_CATEGORY";
        if (isDuplicate(profileId, type)) return 0;

        String severity = risky.stream().anyMatch(this::isHighRiskCategory) ? "HIGH" : "MEDIUM";
        String cats     = String.join(", ", risky);
        String desc     = String.format(
            "New content categories detected for the first time in 7 days: %s. " +
            "These categories were not present in previous usage history.", cats);

        return saveAlert(profileId, tenantId, type, severity, desc,
            Map.of("newCategories", risky));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean isDuplicate(UUID profileId, String alertType) {
        Instant since = Instant.now().minus(DEDUP_HOURS, ChronoUnit.HOURS);
        return alertRepo.countRecentAlerts(profileId, alertType, since) > 0;
    }

    private int saveAlert(UUID profileId, UUID tenantId, String type,
                          String severity, String description,
                          Map<String, Object> metadata) {
        SocialAlert alert = new SocialAlert();
        alert.setProfileId(profileId);
        alert.setTenantId(tenantId);
        alert.setAlertType(type);
        alert.setSeverity(severity);
        alert.setDescription(description);
        alert.setMetadata(metadata);
        alert.setDetectedAt(Instant.now());
        alertRepo.save(alert);
        log.info("Social alert [{}] {} for profile {}", severity, type, profileId);
        return 1;
    }

    private boolean isRiskyNewCategory(String category) {
        if (category == null) return false;
        String c = category.toUpperCase();
        return c.contains("ADULT") || c.contains("PORN") || c.contains("GAMBLING")
            || c.contains("DRUGS") || c.contains("VIOLENCE") || c.contains("WEAPON")
            || c.contains("DATING") || c.contains("SOCIAL") || c.contains("GAMING")
            || c.contains("DARK_WEB") || c.contains("PIRACY") || c.contains("HACK");
    }

    private boolean isHighRiskCategory(String category) {
        if (category == null) return false;
        String c = category.toUpperCase();
        return c.contains("ADULT") || c.contains("PORN") || c.contains("GAMBLING")
            || c.contains("DRUGS") || c.contains("DARK_WEB");
    }
}
