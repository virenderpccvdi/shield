package com.rstglobal.shield.auth.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data @Builder
public class AuthResponse {
    private String  accessToken;
    private String  refreshToken;
    private String  tokenType;
    private long    expiresIn;   // seconds
    private UUID    userId;
    private String  email;
    private String  name;
    private String  role;
    private UUID    tenantId;

    // MFA fields — only set when MFA is required
    private Boolean mfaRequired;
    private String  mfaToken;
    private Boolean mfaEnabled;
}
