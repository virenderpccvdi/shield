package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * App usage entry for a child's profile over a given period.
 * Used by the App Usage Reports feature (CS-06).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AppUsageEntry {

    /** Human-readable app/domain name (e.g. "YouTube", "instagram.com"). */
    private String appName;

    /** Canonical root domain (e.g. "youtube.com"). Null for the "Other" bucket. */
    private String rootDomain;

    /** Total DNS query count within the requested period. */
    private long queryCount;

    /** Queries that were blocked (action = BLOCKED). */
    private long blockedCount;

    /** Number of unique sub-domains observed for this app. */
    private long uniqueDomains;

    /**
     * Approximate time-on-app in seconds (queryCount × 30s).
     * Formatted string e.g. "2h 15m" is computed on the frontend.
     */
    private long estimatedSeconds;

    /** Whether this is the "Other" catch-all bucket for unrecognised domains. */
    private boolean other;
}
