package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/**
 * Real-time screen time budget status for a child profile.
 * Used by the Flutter parent app to show accurate remaining time
 * and by enforcement logic to determine internet cutoff state.
 */
@Data
@Builder
public class BudgetStatusResponse {

    private UUID profileId;

    /** Whether the daily total budget has been exhausted (internet is cut off). */
    private boolean exhausted;

    /** Minutes of internet used today (against the total budget). */
    private int usedMinutes;

    /** Configured total daily budget in minutes (0 = no limit configured). */
    private int totalMinutes;

    /** Minutes remaining before cutoff (0 when exhausted, -1 when no limit set). */
    private int remainingMinutes;
}
