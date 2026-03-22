package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CustomerActivityItem {

    private UUID profileId;
    private String profileName;
    private long queriesToday;
    private long blockedToday;
    private Instant lastSeen;

    /**
     * "active"  — last query < 5 minutes ago
     * "idle"    — last query < 1 hour ago
     * "offline" — last query >= 1 hour ago (or never queried)
     */
    private String status;
}
