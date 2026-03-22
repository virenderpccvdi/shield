package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class BatterySettingsResponse {
    private UUID profileId;
    private int batteryThreshold;
    private Integer lastBatteryPct;
    private OffsetDateTime lastAlertAt;
}
