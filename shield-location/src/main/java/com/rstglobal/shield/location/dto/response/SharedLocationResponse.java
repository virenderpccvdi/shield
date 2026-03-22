package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class SharedLocationResponse {

    private UUID profileId;

    /** Child's display name, sourced from shield-profile (falls back to "Child") */
    private String name;

    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal accuracy;
    private OffsetDateTime recordedAt;

    /** The share label provided when the link was created */
    private String shareLabel;

    private OffsetDateTime expiresAt;
}
