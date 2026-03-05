package com.rstglobal.shield.analytics.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class LogIngestRequest {

    private UUID tenantId;

    @NotNull(message = "profileId is required")
    private UUID profileId;

    private UUID deviceId;

    @NotBlank(message = "domain is required")
    private String domain;

    @NotBlank(message = "action is required")
    @Pattern(regexp = "BLOCKED|ALLOWED", message = "action must be BLOCKED or ALLOWED")
    private String action;

    private String category;

    private String clientIp;

    private Instant queriedAt;
}
