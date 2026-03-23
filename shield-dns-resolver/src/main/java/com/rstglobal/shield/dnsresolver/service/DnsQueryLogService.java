package com.rstglobal.shield.dnsresolver.service;

import com.rstglobal.shield.dnsresolver.client.AnalyticsClient;
import com.rstglobal.shield.dnsresolver.model.DnsQueryLogEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Asynchronously logs DNS queries to the analytics service via REST.
 * Uses @Async so logging never blocks DNS resolution.
 *
 * Maps DnsQueryLogEntry → LogIngestRequest fields expected by shield-analytics:
 *   profileId, domain, action (BLOCKED|ALLOWED), category, queriedAt
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DnsQueryLogService {

    private final AnalyticsClient analyticsClient;

    @Async
    public void logQuery(DnsQueryLogEntry entry) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("profileId", entry.getProfileId());
            payload.put("domain", entry.getDomain());
            payload.put("action", entry.isBlocked() ? "BLOCKED" : "ALLOWED");
            payload.put("category", entry.getCategory());
            if (entry.getTimestamp() != null) {
                payload.put("queriedAt", entry.getTimestamp().toString());
            }
            analyticsClient.logDnsQuery(payload);
        } catch (Exception e) {
            // Log locally but never block DNS resolution
            log.warn("Failed to log DNS query to analytics: {} — domain={} blocked={}",
                e.getMessage(), entry.getDomain(), entry.isBlocked());
            if (log.isDebugEnabled()) {
                log.debug("DNS query log entry (local fallback): profileId={} domain={} category={} blocked={} reason={} latencyMs={}",
                    entry.getProfileId(), entry.getDomain(), entry.getCategory(),
                    entry.isBlocked(), entry.getBlockReason(), entry.getLatencyMs());
            }
        }
    }
}
