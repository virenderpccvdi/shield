package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class ApprovalRequestResponse {
    private UUID id;
    private UUID tenantId;
    private UUID profileId;
    private UUID customerId;
    private String domain;
    private String appPackage;
    private String requestType;
    private String status;
    private String durationType;
    private OffsetDateTime expiresAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime resolvedAt;
    private UUID resolvedBy;
}
