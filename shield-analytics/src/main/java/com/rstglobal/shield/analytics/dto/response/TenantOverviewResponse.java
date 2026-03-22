package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TenantOverviewResponse {

    /** Profiles that issued at least one query in the last 24 hours. */
    private long activeProfiles;

    /** Total profiles registered under this tenant (distinct profile_ids ever seen). */
    private long totalProfiles;

    /** Total DNS queries for today (UTC midnight → now). */
    private long totalQueriesToday;

    /** Blocked queries for today. */
    private long blockedQueriesToday;

    /** Top 10 blocked domains today, ordered by block count descending. */
    private List<String> topBlockedDomains;

    /** Top 5 blocked categories today, ordered by count descending. */
    private List<CategoryCount> topCategories;

    /**
     * Count of unresolved SOS / geofence-breach alerts.
     * Defaults to 0 — populated from other services in future iterations.
     */
    private long activeAlerts;

    /**
     * Estimated data saved by blocking (blockedQueriesToday * 0.05 MB).
     */
    private double bandwidthSavedMb;
}
