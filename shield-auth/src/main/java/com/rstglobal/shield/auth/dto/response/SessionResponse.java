package com.rstglobal.shield.auth.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class SessionResponse {

    private UUID   id;
    private String deviceName;
    private String deviceType;
    private String ipAddress;
    private Instant lastActive;
    private Instant createdAt;
}
