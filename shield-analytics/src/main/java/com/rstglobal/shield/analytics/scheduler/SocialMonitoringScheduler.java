package com.rstglobal.shield.analytics.scheduler;

import com.rstglobal.shield.analytics.repository.DnsQueryLogRepository;
import com.rstglobal.shield.analytics.service.SocialMonitoringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Runs every 30 minutes to scan active child profiles for social behaviour
 * patterns: late-night usage, social media spikes, gaming spikes, new categories.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SocialMonitoringScheduler {

    private final DnsQueryLogRepository dnsRepo;
    private final SocialMonitoringService socialMonitoringService;

    @Scheduled(fixedDelay = 30 * 60 * 1_000)   // every 30 minutes
    public void scanActiveProfiles() {
        Instant since = Instant.now().minus(30, ChronoUnit.MINUTES);

        var activeProfiles = dnsRepo.findActiveProfilesSince(since);
        if (activeProfiles.isEmpty()) {
            log.debug("Social monitor: no active profiles in last 30 min — skipping");
            return;
        }

        log.info("Social monitor: scanning {} active profile(s)", activeProfiles.size());

        int totalAlerts = 0;
        for (Object[] row : activeProfiles) {
            UUID profileId = row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString());
            UUID tenantId  = row[1] != null
                ? (row[1] instanceof UUID u ? u : UUID.fromString(row[1].toString()))
                : null;
            try {
                int generated = socialMonitoringService.scanProfile(profileId, tenantId);
                totalAlerts += generated;
            } catch (Exception e) {
                log.warn("Social monitor: failed for profile {} — {}", profileId, e.getMessage());
            }
        }

        if (totalAlerts > 0) {
            log.info("Social monitor: {} new alert(s) generated across {} profile(s)",
                totalAlerts, activeProfiles.size());
        }
    }
}
