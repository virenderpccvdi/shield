package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class DnsRulesResponse {
    private UUID profileId;
    private String dnsClientId;
    private String dohUrl;
    private Map<String, Boolean> enabledCategories;
    private List<String> customAllowlist;
    private List<String> customBlocklist;
    private Boolean safesearchEnabled;
    private Boolean youtubeRestricted;
    private Boolean adsBlocked;
    private Map<String, Integer> timeBudgets;
}
