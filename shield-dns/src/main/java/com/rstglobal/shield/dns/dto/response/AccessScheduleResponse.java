package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PO-06 — Response DTO for a single access schedule rule.
 */
@Data
@Builder
public class AccessScheduleResponse {

    private UUID id;
    private UUID profileId;
    private String name;
    private boolean isActive;

    /**
     * Bitmask of days this rule applies to.
     * bit 0 = Monday … bit 6 = Sunday.
     */
    private int daysBitmask;

    /** Start of allowed window as "HH:mm" string. */
    private String allowStart;

    /** End of allowed window as "HH:mm" string. */
    private String allowEnd;

    /** Whether DNS is blocked outside the allowed window. */
    private boolean blockOutside;

    /** Whether the access window is currently active right now. */
    private boolean currentlyAllowed;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
