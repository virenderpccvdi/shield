package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class DeviceResponse {
    private UUID id;
    private UUID profileId;
    private UUID tenantId;
    private String name;
    private String deviceType;
    private String macAddress;
    private boolean online;
    private Instant lastSeenAt;
    private String dnsMethod;
    private Instant createdAt;
}
