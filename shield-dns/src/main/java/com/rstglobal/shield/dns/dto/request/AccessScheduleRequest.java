package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * PO-06 — Request body for creating or updating an access schedule rule.
 */
@Data
public class AccessScheduleRequest {

    /** Human-readable label, e.g. "School Week". */
    @NotBlank(message = "name is required")
    private String name;

    /** Whether this schedule rule is enabled. Defaults to true if omitted. */
    private Boolean isActive = true;

    /**
     * Bitmask of days this rule applies to.
     * bit 0 = Monday … bit 6 = Sunday.  31 = Mon-Fri.
     */
    @NotNull(message = "daysBitmask is required")
    private Integer daysBitmask;

    /** Start of the allowed window in "HH:mm" format (e.g. "07:00"). */
    @NotBlank(message = "allowStart is required")
    private String allowStart;

    /** End of the allowed window in "HH:mm" format (e.g. "21:00"). */
    @NotBlank(message = "allowEnd is required")
    private String allowEnd;

    /**
     * When true, DNS is blocked outside the allow_start..allow_end window
     * on the matching days.
     */
    private Boolean blockOutside = true;
}
