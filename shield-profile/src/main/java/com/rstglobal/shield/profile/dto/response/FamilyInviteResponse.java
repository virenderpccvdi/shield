package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class FamilyInviteResponse {
    private UUID    id;
    private UUID    familyId;
    private String  email;
    private String  role;
    private String  status;
    private Instant expiresAt;
    private Instant createdAt;
}
