package com.rstglobal.shield.auth.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class UserResponse {
    private UUID    id;
    private String  email;
    private String  name;
    private String  phone;
    private String  role;
    private UUID    tenantId;
    private boolean emailVerified;
    private boolean active;
    private boolean mfaEnabled;
    private Instant lastLoginAt;
    private Instant createdAt;
}
