package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Data @Builder
public class PlatformDefaultsResponse {
    private Map<String, Boolean> enabledCategories;
    private List<String> customAllowlist;
    private List<String> customBlocklist;
    private Boolean safesearchEnabled;
    private Boolean youtubeRestricted;
    private Boolean adsBlocked;
    private OffsetDateTime updatedAt;
}
