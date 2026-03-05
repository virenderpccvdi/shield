package com.rstglobal.shield.location.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class SosEventResponse {

    private UUID id;
    private UUID profileId;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String message;
    private String status;
    private OffsetDateTime triggeredAt;
}
