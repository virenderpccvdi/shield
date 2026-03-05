package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class FcmTokenRequest {
    @NotNull private UUID userId;
    @NotNull private UUID tenantId;
    private String deviceId;
    @NotBlank private String fcmToken;
    /** ANDROID | IOS | WEB */
    @NotBlank private String platform;
    private String deviceName;
}
