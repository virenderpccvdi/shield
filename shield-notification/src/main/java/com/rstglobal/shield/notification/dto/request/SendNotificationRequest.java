package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SendNotificationRequest {
    @NotNull private UUID tenantId;
    @NotNull private UUID userId;
    private UUID customerId;
    private UUID profileId;
    @NotBlank private String type;
    @NotBlank private String title;
    @NotBlank private String body;
    private String actionUrl;
    /** Email address to also deliver via email channel (optional). */
    private String toEmail;
}
