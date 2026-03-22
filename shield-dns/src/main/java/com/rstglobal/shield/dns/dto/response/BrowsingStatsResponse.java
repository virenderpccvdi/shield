package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * PO-02: Aggregated browsing statistics for a child profile (today's figures).
 */
@Data
@Builder
public class BrowsingStatsResponse {

    /** Total DNS queries made today (allowed + blocked). */
    private long totalToday;

    /** Queries that were blocked today. */
    private long blockedToday;

    /** Queries that were allowed today. */
    private long allowedToday;

    /** Most-queried domains today (up to 10), descending by frequency. */
    private List<DomainCount> topDomains;

    /**
     * A single entry in the top-domains list.
     */
    @Data
    @Builder
    public static class DomainCount {
        private String domain;
        private long count;
    }
}
