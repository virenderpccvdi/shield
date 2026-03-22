package com.rstglobal.shield.dnsresolver.model;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class DnsQueryLogEntry {
    String profileId;
    String dnsClientId;
    String domain;
    String rootDomain;
    String appName;
    String category;
    String queryType;
    boolean blocked;
    String blockReason;
    long latencyMs;
    Instant timestamp;
}
