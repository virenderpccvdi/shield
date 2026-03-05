package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SubscriptionEmailRequest {
    @NotBlank private String email;
    @NotBlank private String name;
    @NotBlank private String planName;
    private List<String> features;
    private Integer maxProfiles;
    private String dashboardUrl;
    /** Optional — used to resolve SMTP config; null falls back to platform default. */
    private UUID tenantId;
}
