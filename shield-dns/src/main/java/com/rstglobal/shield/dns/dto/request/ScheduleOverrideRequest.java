package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ScheduleOverrideRequest {
    /** PAUSE | HOMEWORK | FOCUS | BEDTIME_NOW */
    @NotBlank
    private String overrideType;

    /** How many minutes the override lasts (0 = until manually cancelled). */
    @Positive
    private int durationMinutes;
}
