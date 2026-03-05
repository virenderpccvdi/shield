package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class NamedPlaceResponse {

    private UUID id;
    private UUID profileId;
    private String name;
    private String placeType;
    private BigDecimal centerLat;
    private BigDecimal centerLng;
    private BigDecimal radiusMeters;
    private Boolean isActive;
}
