package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class LocationShareResponse {

    private UUID id;
    private UUID profileId;
    private UUID createdBy;
    private String shareToken;
    private String label;
    private OffsetDateTime expiresAt;
    private Integer maxViews;
    private Integer viewCount;
    private Boolean isActive;
    private OffsetDateTime createdAt;

    /** Full shareable URL, e.g. https://shield.rstglobal.in/share/{token} */
    private String shareUrl;
}
