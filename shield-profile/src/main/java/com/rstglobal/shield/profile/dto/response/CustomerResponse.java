package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class CustomerResponse {
    private UUID id;
    private UUID tenantId;
    private UUID userId;
    private String name;
    private String email;
    private String subscriptionPlan;
    private String subscriptionStatus;
    private Instant subscriptionExpiresAt;
    private int maxProfiles;
    private int profileCount;
    private Instant createdAt;
    private Instant updatedAt;
}
