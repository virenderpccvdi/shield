package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class CheckinRequest {

    @NotNull
    private UUID profileId;

    @NotNull
    private BigDecimal latitude;

    @NotNull
    private BigDecimal longitude;

    private BigDecimal accuracy;
    private BigDecimal altitude;
    private BigDecimal speed;
    private BigDecimal heading;
    private Boolean isMoving;
    private String message;
}
