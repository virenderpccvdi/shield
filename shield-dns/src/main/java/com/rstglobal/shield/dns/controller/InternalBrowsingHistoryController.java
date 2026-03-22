package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.dns.dto.request.RecordBrowsingHistoryRequest;
import com.rstglobal.shield.dns.service.BrowsingHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * PO-02: Internal endpoint for recording DNS query events.
 *
 * <p>Not exposed through the API gateway.  Called by:
 * <ul>
 *   <li>The AdGuard webhook handler (when AdGuard is enabled)</li>
 *   <li>The DNS filter engine within shield-dns itself</li>
 * </ul>
 *
 * <p>Endpoint:
 * <pre>
 *   POST /internal/dns/history/record
 * </pre>
 */
@Slf4j
@RestController
@RequestMapping("/internal/dns/history")
@RequiredArgsConstructor
public class InternalBrowsingHistoryController {

    private final BrowsingHistoryService historyService;

    /**
     * Record a single DNS query event.
     *
     * <p>Request body fields:
     * <ul>
     *   <li>{@code profileId}  — child profile UUID (required)</li>
     *   <li>{@code tenantId}   — tenant UUID (required)</li>
     *   <li>{@code domain}     — queried domain, e.g. "youtube.com" (required)</li>
     *   <li>{@code wasBlocked} — whether the query was blocked (required)</li>
     *   <li>{@code category}   — content category, e.g. "VIDEO_STREAMING" (optional)</li>
     *   <li>{@code queryType}  — DNS record type, e.g. "A" (optional, defaults to "A")</li>
     *   <li>{@code clientIp}   — source device IP (optional)</li>
     * </ul>
     */
    @PostMapping("/record")
    public ResponseEntity<ApiResponse<Void>> record(
            @RequestBody RecordBrowsingHistoryRequest req) {

        if (req.getProfileId() == null || req.getTenantId() == null || req.getDomain() == null) {
            log.warn("Ignoring incomplete browsing-history record request: {}", req);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_REQUEST", "profileId, tenantId and domain are required"));
        }

        historyService.recordQuery(
                req.getProfileId(),
                req.getTenantId(),
                req.getDomain(),
                Boolean.TRUE.equals(req.getWasBlocked()),
                req.getCategory(),
                req.getQueryType(),
                req.getClientIp()
        );

        return ResponseEntity.ok(ApiResponse.ok(null, "Recorded"));
    }
}
