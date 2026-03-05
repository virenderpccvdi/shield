package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class LocationUploadRequest {

    @NotNull
    private UUID profileId;

    private UUID deviceId;

    @NotNull
    private BigDecimal latitude;

    @NotNull
    private BigDecimal longitude;

    private BigDecimal accuracy;

    private BigDecimal altitude;

    private BigDecimal speed;

    private BigDecimal heading;

    private Integer batteryPct;

    private Boolean isMoving;

    @NotNull
    private OffsetDateTime recordedAt;
}
