package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.response.BrowsingHistoryResponse;
import com.rstglobal.shield.dns.dto.response.BrowsingStatsResponse;
import com.rstglobal.shield.dns.service.BrowsingHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * PO-02: Safe Browsing History — parent-facing REST endpoints.
 *
 * <p>All endpoints require CUSTOMER (or higher) role injected by the gateway
 * via the {@code X-User-Role} header.
 *
 * <p>Endpoints:
 * <pre>
 *   GET    /api/v1/dns/history/{profileId}?page=0&amp;size=50&amp;blockedOnly=false&amp;period=TODAY
 *   GET    /api/v1/dns/history/{profileId}/stats
 *   DELETE /api/v1/dns/history/{profileId}
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/dns/history")
@RequiredArgsConstructor
public class BrowsingHistoryController {

    private final BrowsingHistoryService historyService;

    /**
     * Retrieve paginated browsing history for a child profile.
     *
     * @param profileId  child profile UUID (path variable)
     * @param page       zero-based page index (default 0)
     * @param size       page size, capped at 200 internally (default 50)
     * @param blockedOnly when present, filter to only blocked (true) or allowed (false) entries
     * @param period     optional window: TODAY | WEEK | MONTH (omit for all time)
     * @param role       injected by gateway
     */
    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<Page<BrowsingHistoryResponse>>> getHistory(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "0")  int     page,
            @RequestParam(defaultValue = "50") int     size,
            @RequestParam(required = false)    Boolean blockedOnly,
            @RequestParam(required = false)    String  period,
            @RequestHeader("X-User-Role") String role) {

        requireCustomer(role);
        Page<BrowsingHistoryResponse> result =
                historyService.getHistory(profileId, page, size, blockedOnly, period);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * Retrieve today's summary statistics for a child profile.
     * Returns: totalToday, blockedToday, allowedToday, topDomains (up to 10).
     *
     * @param profileId child profile UUID
     * @param role      injected by gateway
     */
    @GetMapping("/{profileId}/stats")
    public ResponseEntity<ApiResponse<BrowsingStatsResponse>> getStats(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {

        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(historyService.getStats(profileId)));
    }

    /**
     * Delete all browsing history for a child profile.
     * Only the owning CUSTOMER (or an admin) may clear history.
     *
     * @param profileId child profile UUID
     * @param role      injected by gateway
     */
    @DeleteMapping("/{profileId}")
    public ResponseEntity<ApiResponse<Void>> deleteHistory(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {

        requireCustomer(role);
        historyService.deleteHistory(profileId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Browsing history cleared for profile " + profileId));
    }

    // ── Role guard ────────────────────────────────────────────────────────────

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
