package com.rstglobal.shield.analytics.scheduler;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hourly scheduler: finds active profiles from the last 24 hours of DNS logs
 * and calls the AI service to run anomaly detection for each profile.
 * <p>
 * The AI service URL is configurable via the 'shield.ai.service-url' property
 * (defaults to the direct port 8291 on localhost).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiBatchScheduler {

    private final EntityManager entityManager;

    @Value("${shield.ai.service-url:http://localhost:8291}")
    private String aiServiceUrl;

    private final RestClient restClient = RestClient.builder().build();

    /**
     * Runs every hour (3600 seconds after last completion).
     * Fetches distinct profileIds active in the last 24 hours and
     * sends each to the AI service for anomaly analysis.
     */
    @Scheduled(fixedDelay = 3_600_000)
    public void runHourlyAiBatch() {
        log.info("AI batch scheduler started — finding active profiles from last 24h");

        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        Instant now   = Instant.now();

        List<UUID> activeProfiles = getActiveProfileIds(since, now);
        if (activeProfiles.isEmpty()) {
            log.info("AI batch: no active profiles found in last 24h — skipping");
            return;
        }

        log.info("AI batch: found {} active profile(s) — submitting to AI service", activeProfiles.size());

        int success = 0;
        int failed  = 0;
        for (UUID profileId : activeProfiles) {
            try {
                callAiService(profileId, since, now);
                success++;
            } catch (Exception e) {
                log.warn("AI batch: failed for profile {} — {}", profileId, e.getMessage());
                failed++;
            }
        }
        log.info("AI batch complete — success={}, failed={}, total={}", success, failed, activeProfiles.size());
    }

    /** Fetches distinct profileIds that have DNS query logs since {@code since}. */
    private List<UUID> getActiveProfileIds(Instant since, Instant until) {
        try {
            @SuppressWarnings("unchecked")
            List<Object> rawIds = (List<Object>) entityManager
                    .createNativeQuery(
                        "SELECT DISTINCT profile_id FROM analytics.dns_query_logs " +
                        "WHERE queried_at >= :since AND queried_at <= :until " +
                        "AND profile_id IS NOT NULL")
                    .setParameter("since", since)
                    .setParameter("until", until)
                    .getResultList();

            return rawIds.stream()
                    .filter(id -> id != null)
                    .map(id -> id instanceof UUID u ? u : UUID.fromString(id.toString()))
                    .toList();
        } catch (Exception e) {
            log.warn("AI batch: failed to fetch active profiles — {}", e.getMessage());
            return List.of();
        }
    }

    /** Sends a batch analysis request to the AI service for the given profile. */
    private void callAiService(UUID profileId, Instant periodStart, Instant periodEnd) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("profileId", profileId.toString());
        payload.put("periodStart", periodStart.toString());
        payload.put("periodEnd",   periodEnd.toString());

        Map<?, ?> result = restClient.post()
                .uri(aiServiceUrl + "/ai/analyze/batch")
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(Map.class);

        if (result != null) {
            log.debug("AI batch result for profile {}: isAnomaly={}, score={}, severity={}",
                    profileId,
                    result.get("is_anomaly"),
                    result.get("score"),
                    result.get("severity"));
        }
    }
}
