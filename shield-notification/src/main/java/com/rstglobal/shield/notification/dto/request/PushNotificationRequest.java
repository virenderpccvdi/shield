package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;
import java.util.UUID;

/**
 * Request for internal push notification endpoint.
 * Used by other services (location, DNS, SOS) to trigger push to user devices.
 */
@Data
public class PushNotificationRequest {
    @NotNull private UUID userId;
    @NotBlank private String title;
    @NotBlank private String body;
    private Map<String, String> data;
    /** HIGH or NORMAL — defaults to NORMAL */
    private String priority;
    /** Optional topic to send to instead of userId */
    private String topic;
}
