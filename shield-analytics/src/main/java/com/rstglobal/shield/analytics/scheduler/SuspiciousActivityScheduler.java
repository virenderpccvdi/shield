package com.rstglobal.shield.analytics.scheduler;

import com.rstglobal.shield.analytics.repository.DnsQueryLogRepository;
import com.rstglobal.shield.analytics.service.SuspiciousActivityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * CS-05: Runs every 5 minutes — scans active child profiles for suspicious DNS patterns.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SuspiciousActivityScheduler {

    private final DnsQueryLogRepository dnsRepo;
    private final SuspiciousActivityService suspiciousActivityService;

    @Scheduled(fixedDelay = 300_000)   // every 5 minutes
    public void scanActiveProfiles() {
        // Look back 5 minutes for active profiles
        Instant since = Instant.now().minus(5, ChronoUnit.MINUTES);

        var activeProfiles = dnsRepo.findActiveProfilesSince(since);
        if (activeProfiles.isEmpty()) {
            log.debug("Suspicious activity scanner: no active profiles in last 5 min — skipping");
            return;
        }

        log.debug("Suspicious activity scanner: checking {} profile(s)", activeProfiles.size());

        int totalAlerts = 0;
        for (Object[] row : activeProfiles) {
            UUID profileId = row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString());
            try {
                int generated = suspiciousActivityService.detectAnomalies(profileId, null);
                totalAlerts += generated;
            } catch (Exception e) {
                log.warn("Suspicious activity scan failed for profile {} — {}", profileId, e.getMessage());
            }
        }

        if (totalAlerts > 0) {
            log.info("Suspicious activity scanner: {} new alert(s) generated", totalAlerts);
        }
    }
}
