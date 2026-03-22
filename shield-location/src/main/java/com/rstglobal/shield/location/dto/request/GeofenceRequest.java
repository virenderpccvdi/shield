package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalTime;

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

    /** CS-07: mark this geofence as a school zone */
    private Boolean isSchool;

    /** CS-07: start of school hours, e.g. "08:00" */
    private LocalTime schoolStart;

    /** CS-07: end of school hours, e.g. "15:00" */
    private LocalTime schoolEnd;
}
