package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class LocationResponse {

    private UUID id;
    private UUID profileId;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal accuracy;
    private BigDecimal speed;
    private BigDecimal heading;
    private Integer batteryPct;
    private Boolean isMoving;
    private OffsetDateTime recordedAt;
}
