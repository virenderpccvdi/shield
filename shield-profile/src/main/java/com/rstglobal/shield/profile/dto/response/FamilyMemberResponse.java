package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class FamilyMemberResponse {
    private UUID    id;
    private UUID    familyId;
    private UUID    userId;
    private String  role;
    private UUID    invitedBy;
    private String  status;
    private Instant createdAt;
}
