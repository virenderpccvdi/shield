package com.rstglobal.shield.dns.dto.request;

import lombok.Data;

import java.util.UUID;

/**
 * PO-02: Request body for the internal DNS history record endpoint.
 * Called by shield-dns-resolver after resolving each query
 * to persist a single query event.
 */
@Data
public class RecordBrowsingHistoryRequest {
    private UUID profileId;
    private UUID tenantId;
    private String domain;
    private Boolean wasBlocked;
    private String category;
    private String queryType;
    private String clientIp;
}
