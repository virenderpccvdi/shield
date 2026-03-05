package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class SosRequest {

    @NotNull
    private UUID profileId;

    private BigDecimal latitude;

    private BigDecimal longitude;

    private String message;
}
