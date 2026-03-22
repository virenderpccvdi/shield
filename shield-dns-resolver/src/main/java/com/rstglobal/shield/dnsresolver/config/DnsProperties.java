package com.rstglobal.shield.dnsresolver.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "dns")
public class DnsProperties {
    private String upstreamDoh = "https://1.1.1.1/dns-query";
    private String upstreamFallback = "https://8.8.8.8/dns-query";
    private int rulesTtlSeconds = 300;
    private int queryTimeoutMs = 2000;
}
