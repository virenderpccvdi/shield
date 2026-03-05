package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class GeofenceRequest {

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private BigDecimal centerLat;

    @NotNull
    private BigDecimal centerLng;

    private BigDecimal radiusMeters;

    private Boolean alertOnEnter;

    private Boolean alertOnExit;
}
