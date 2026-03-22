package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BatteryThresholdRequest {

    @NotNull
    @Min(5)
    @Max(50)
    private Integer threshold;
}
