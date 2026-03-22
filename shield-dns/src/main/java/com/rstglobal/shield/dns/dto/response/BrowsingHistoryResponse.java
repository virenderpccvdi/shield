package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PO-02: Single browsing history entry returned to the parent dashboard / app.
 */
@Data
@Builder
public class BrowsingHistoryResponse {
    private Long id;
    private UUID profileId;
    private UUID tenantId;
    private String domain;
    private Boolean wasBlocked;
    private String category;
    private String queryType;
    private String clientIp;
    private OffsetDateTime queriedAt;
}
