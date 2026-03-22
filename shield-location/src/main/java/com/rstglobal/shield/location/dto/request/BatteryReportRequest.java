package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BatteryReportRequest {

    @NotNull
    @Min(0)
    @Max(100)
    private Integer batteryPercent;
}
