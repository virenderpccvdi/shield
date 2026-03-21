package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ScheduleOverrideRequest {
    /** PAUSE | HOMEWORK | FOCUS | BEDTIME_NOW */
    @NotBlank
    private String overrideType;

    /** How many minutes the override lasts (0 = until manually cancelled). */
    @Min(0)
    private int durationMinutes;
}
