package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data @Builder
public class ChildProfileResponse {
    private UUID id;
    private UUID customerId;
    private UUID tenantId;
    private String name;
    private String avatarUrl;
    private LocalDate dateOfBirth;
    private String ageGroup;
    private String filterLevel;
    private String dnsClientId;
    private String dohUrl;
    private String notes;
    private Instant createdAt;
    private Instant updatedAt;
    // Device status — populated from profile.devices table
    private boolean online;
    private Instant lastSeenAt;
    private int deviceCount;
}
