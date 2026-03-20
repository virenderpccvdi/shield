package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class DeviceAppResponse {
    private UUID id;
    private UUID profileId;
    private String packageName;
    private String appName;
    private String versionName;
    private boolean systemApp;
    private boolean blocked;
    private Integer timeLimitMinutes;
    private int usageTodayMinutes;
    private Instant lastReportedAt;
}
