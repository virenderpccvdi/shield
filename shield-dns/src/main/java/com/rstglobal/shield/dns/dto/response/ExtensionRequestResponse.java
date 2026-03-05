package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class ExtensionRequestResponse {
    private UUID id;
    private UUID profileId;
    private String appName;
    private int requestedMins;
    private String message;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime respondedAt;
}
