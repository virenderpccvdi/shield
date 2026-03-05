package com.rstglobal.shield.notification.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class NotificationResponse {
    private UUID id;
    private String type;
    private String title;
    private String body;
    private String actionUrl;
    private UUID profileId;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime readAt;
}
