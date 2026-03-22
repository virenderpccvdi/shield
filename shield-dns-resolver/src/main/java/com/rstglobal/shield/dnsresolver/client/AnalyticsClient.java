package com.rstglobal.shield.dnsresolver.client;

import com.rstglobal.shield.dnsresolver.model.DnsQueryLogEntry;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Feign client for logging DNS queries to the analytics service.
 * Replaces Kafka — analytics stores to PostgreSQL analytics.dns_query_logs.
 */
@FeignClient(name = "shield-analytics-direct", url = "http://localhost:8289", path = "/api/v1/analytics")
public interface AnalyticsClient {

    @PostMapping("/internal/dns-log")
    void logDnsQuery(@RequestBody DnsQueryLogEntry entry);
}
