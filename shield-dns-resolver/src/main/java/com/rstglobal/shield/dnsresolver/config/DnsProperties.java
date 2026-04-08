package com.rstglobal.shield.dnsresolver.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "dns")
public class DnsProperties {
    /** Primary upstream DNS server IP (UDP port 53). Default: Cloudflare. */
    private String upstreamDns = "1.1.1.1";
    /** Fallback upstream DNS server IP (UDP port 53). Default: Google. */
    private String upstreamFallbackDns = "8.8.8.8";
    private int rulesTtlSeconds = 300;
    private int queryTimeoutMs = 2000;
}
