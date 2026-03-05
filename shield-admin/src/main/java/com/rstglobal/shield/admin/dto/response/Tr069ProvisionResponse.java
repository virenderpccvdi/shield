package com.rstglobal.shield.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class Tr069ProvisionResponse {

    private UUID id;
    private String deviceSerial;
    private String deviceModel;
    private String macAddress;
    private String ipAddress;
    private String dnsPrimary;
    private String dnsSecondary;
    private String provisionStatus;
    private OffsetDateTime provisionedAt;
    private OffsetDateTime lastSeenAt;
}
