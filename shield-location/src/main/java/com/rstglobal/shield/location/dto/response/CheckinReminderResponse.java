package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class CheckinReminderResponse {

    private UUID id;
    private UUID profileId;
    private Boolean enabled;
    private Integer reminderIntervalMin;
    private String quietStart;
    private String quietEnd;
    private OffsetDateTime lastReminderSent;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
