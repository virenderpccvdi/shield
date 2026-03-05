package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class GeofenceResponse {

    private UUID id;
    private UUID profileId;
    private String name;
    private String description;
    private BigDecimal centerLat;
    private BigDecimal centerLng;
    private BigDecimal radiusMeters;
    private Boolean isActive;
    private Boolean alertOnEnter;
    private Boolean alertOnExit;
}
