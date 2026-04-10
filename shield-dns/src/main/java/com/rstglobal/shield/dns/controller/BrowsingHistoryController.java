package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.response.BrowsingHistoryResponse;
import com.rstglobal.shield.dns.dto.response.BrowsingStatsResponse;
import com.rstglobal.shield.dns.service.BrowsingHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
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
 *   GET    /api/v1/dns/profiles/{profileId}/usage/today  (A3: screen time minutes today)
 * </pre>
 */
@Tag(name = "Browsing History", description = "Child profile DNS query history, daily statistics and screen-time estimates")
@RestController
@RequiredArgsConstructor
public class BrowsingHistoryController {

    private final BrowsingHistoryService historyService;

    // ── History endpoints (base path: /api/v1/dns/history) ───────────────────

    /**
     * Retrieve paginated browsing history for a child profile.
     */
    @Operation(summary = "Get paginated browsing history for a child profile", description = "Supports filtering by blockedOnly flag and period (TODAY, WEEK, MONTH).")
    @GetMapping("/api/v1/dns/history/{profileId}")
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
     */
    @Operation(summary = "Get today's browsing statistics for a child profile", description = "Returns totalToday, blockedToday, allowedToday, and top 10 domains queried today.")
    @GetMapping("/api/v1/dns/history/{profileId}/stats")
    public ResponseEntity<ApiResponse<BrowsingStatsResponse>> getStats(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {

        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(historyService.getStats(profileId)));
    }

    /**
     * Delete all browsing history for a child profile.
     */
    @Operation(summary = "Delete all browsing history for a child profile")
    @DeleteMapping("/api/v1/dns/history/{profileId}")
    public ResponseEntity<ApiResponse<Void>> deleteHistory(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {

        requireCustomer(role);
        historyService.deleteHistory(profileId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Browsing history cleared for profile " + profileId));
    }

    // ── A3: Screen time / usage today ────────────────────────────────────────

    /**
     * GET /api/v1/dns/profiles/{profileId}/usage/today
     * Returns today's DNS query count, block count, and estimated screen time in minutes.
     * Screen time estimate: each DNS query ≈ 30 seconds of active browsing.
     */
    @Operation(summary = "Get estimated screen time for today", description = "Returns DNS query count, block count, and estimated screen time in minutes (each query ≈ 30 seconds of active browsing).")
    @GetMapping("/api/v1/dns/profiles/{profileId}/usage/today")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUsageToday(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role) {

        requireCustomer(role);

        BrowsingStatsResponse stats = historyService.getStats(profileId);
        long queries = stats.getTotalToday();
        long blocks  = stats.getBlockedToday();

        // Rough screen time estimate: each DNS query ≈ 30 seconds = 0.5 minutes
        long screenTimeMinutes = (queries * 30L) / 60L;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("profileId",          profileId);
        body.put("screenTimeMinutes",  screenTimeMinutes);
        body.put("queriesCount",       queries);
        body.put("blocksCount",        blocks);
        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    // ── Role guard ────────────────────────────────────────────────────────────

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
