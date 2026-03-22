package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class ScreenTimeRequestResponse {
    private UUID id;
    private UUID profileId;
    private UUID customerId;
    private Integer minutes;
    private String reason;
    private String status;
    private OffsetDateTime requestedAt;
    private OffsetDateTime decidedAt;
    private UUID decidedBy;
    private OffsetDateTime expiresAt;
}
