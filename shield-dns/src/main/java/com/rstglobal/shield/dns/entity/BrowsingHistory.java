package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PO-02: Safe Browsing History
 * One record per DNS query event, written by the internal record endpoint
 * (called from shield-dns-resolver after resolving each query).
 * Parents read this table via BrowsingHistoryController.
 */
@Entity
@Table(schema = "dns", name = "browsing_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BrowsingHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Child profile that made the DNS query. */
    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    /** Tenant the profile belongs to (for ISP-level queries). */
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    /** The domain that was queried, e.g. "youtube.com". */
    @Column(name = "domain", nullable = false, length = 255)
    private String domain;

    /** True when the DNS filter blocked this query. */
    @Column(name = "was_blocked", nullable = false)
    @Builder.Default
    private Boolean wasBlocked = false;

    /** Content category detected for this domain (may be null). */
    @Column(name = "category", length = 64)
    private String category;

    /** DNS record type, e.g. "A", "AAAA", "CNAME". */
    @Column(name = "query_type", length = 10)
    @Builder.Default
    private String queryType = "A";

    /** IP address of the querying client (device). May be null. */
    @Column(name = "client_ip", length = 45)
    private String clientIp;

    /** When the query was made. */
    @Column(name = "queried_at", nullable = false)
    @Builder.Default
    private OffsetDateTime queriedAt = OffsetDateTime.now();
}
