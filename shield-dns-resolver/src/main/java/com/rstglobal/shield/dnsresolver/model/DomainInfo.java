package com.rstglobal.shield.dnsresolver.model;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DomainInfo {
    String originalDomain;
    String rootDomain;
    String appName;
    String category;
    boolean cdn;
    boolean tracking;
}
