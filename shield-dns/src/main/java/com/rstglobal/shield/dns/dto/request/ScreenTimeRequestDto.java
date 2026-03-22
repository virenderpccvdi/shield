package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ScreenTimeRequestDto {

    @NotNull
    @Min(5)
    @Max(240)
    private Integer minutes;

    /** Optional reason from the child. */
    private String reason;
}
