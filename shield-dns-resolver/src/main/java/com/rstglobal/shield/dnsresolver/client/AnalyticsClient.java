package com.rstglobal.shield.dnsresolver.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

/**
 * Feign client for logging DNS queries to the analytics service.
 * Calls POST /internal/analytics/log on shield-analytics (port 8289).
 * Payload must match LogIngestRequest: profileId, domain, action (BLOCKED|ALLOWED),
 * category, queriedAt.
 */
@FeignClient(name = "shield-analytics-direct", url = "http://localhost:8289")
public interface AnalyticsClient {

    @PostMapping("/internal/analytics/log")
    void logDnsQuery(@RequestBody Map<String, Object> entry);
}
