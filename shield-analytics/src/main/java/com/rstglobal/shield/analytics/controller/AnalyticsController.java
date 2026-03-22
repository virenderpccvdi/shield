package com.rstglobal.shield.analytics.controller;

import com.rstglobal.shield.analytics.dto.response.AppUsageEntry;
import com.rstglobal.shield.analytics.dto.response.CategoryBreakdown;
import com.rstglobal.shield.analytics.dto.response.CustomersSummaryResponse;
import com.rstglobal.shield.analytics.dto.response.DailyUsagePoint;
import com.rstglobal.shield.analytics.dto.response.HourlyUsagePoint;
import com.rstglobal.shield.analytics.dto.response.TopAppEntry;
import com.rstglobal.shield.analytics.dto.response.TopDomainEntry;
import com.rstglobal.shield.analytics.dto.response.UsageStatsResponse;
import com.rstglobal.shield.analytics.entity.DnsQueryLog;
import com.rstglobal.shield.analytics.entity.SocialAlert;
import com.rstglobal.shield.analytics.service.AnalyticsService;
import com.rstglobal.shield.analytics.service.SocialMonitoringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Public analytics API — accessed via Gateway.
 * Gateway injects X-User-Id, X-User-Role, X-Tenant-Id headers after JWT validation.
 * Each endpoint validates that the requesting user has access to the requested profileId.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final SocialMonitoringService socialMonitoringService;

    /**
     * GET /api/v1/analytics/{profileId}/stats?period=today|week|month
     */
    @GetMapping("/{profileId}/stats")
    public ResponseEntity<UsageStatsResponse> getStats(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "today") String period,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);
        UsageStatsResponse stats = analyticsService.getUsageStats(profileId, period);
        return ResponseEntity.ok(stats);
    }

    /**
     * GET /api/v1/analytics/{profileId}/top-domains?action=BLOCKED&limit=10&period=week
     */
    @GetMapping("/{profileId}/top-domains")
    public ResponseEntity<List<TopDomainEntry>> getTopDomains(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "BLOCKED") String action,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "week") String period,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);
        if (!action.equals("BLOCKED") && !action.equals("ALLOWED")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "action must be BLOCKED or ALLOWED");
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        List<TopDomainEntry> domains = analyticsService.getTopDomains(profileId, action, safeLimit, period);
        return ResponseEntity.ok(domains);
    }

    /**
     * GET /api/v1/analytics/{profileId}/daily?days=30
     */
    @GetMapping("/{profileId}/daily")
    public ResponseEntity<List<DailyUsagePoint>> getDailyBreakdown(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "30") int days,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);
        int safeDays = Math.min(Math.max(days, 1), 365);
        List<DailyUsagePoint> breakdown = analyticsService.getDailyBreakdown(profileId, safeDays);
        return ResponseEntity.ok(breakdown);
    }

    /**
     * GET /api/v1/analytics/{profileId}/categories?period=week
     */
    @GetMapping("/{profileId}/categories")
    public ResponseEntity<List<CategoryBreakdown>> getCategoryBreakdown(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "week") String period,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);
        List<CategoryBreakdown> breakdown = analyticsService.getCategoryBreakdown(profileId, period);
        return ResponseEntity.ok(breakdown);
    }

    /**
     * GET /api/v1/analytics/{profileId}/history?page=0&size=20&action=BLOCKED|ALLOWED
     * Returns ALL browsing history when action is omitted; filtered when action=BLOCKED or ALLOWED.
     * Parent uses this to see every URL the child has visited.
     */
    @GetMapping("/{profileId}/history")
    public ResponseEntity<Page<DnsQueryLog>> getBrowsingHistory(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String action,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(page, safeSize, Sort.by("queriedAt").descending());
        Page<DnsQueryLog> history = analyticsService.getBrowsingHistory(profileId, action, pageable);
        return ResponseEntity.ok(history);
    }

    /**
     * GET /api/v1/analytics/platform/overview
     * Platform-wide stats (GLOBAL_ADMIN / ISP_ADMIN)
     */
    @GetMapping("/platform/overview")
    public ResponseEntity<UsageStatsResponse> getPlatformOverview(
            @RequestParam(defaultValue = "today") String period,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        // Platform overview requires admin role
        if (!"GLOBAL_ADMIN".equalsIgnoreCase(userRole) && !"ISP_ADMIN".equalsIgnoreCase(userRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
        }
        UsageStatsResponse stats = analyticsService.getPlatformOverview(period);
        return ResponseEntity.ok(stats);
    }

    /**
     * GET /api/v1/analytics/platform/daily?days=30
     * Platform-wide daily breakdown (GLOBAL_ADMIN / ISP_ADMIN)
     */
    @GetMapping("/platform/daily")
    public ResponseEntity<List<DailyUsagePoint>> getPlatformDaily(
            @RequestParam(defaultValue = "30") int days,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (!"GLOBAL_ADMIN".equalsIgnoreCase(userRole) && !"ISP_ADMIN".equalsIgnoreCase(userRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
        }
        int safeDays = Math.min(Math.max(days, 1), 365);
        List<DailyUsagePoint> breakdown = analyticsService.getPlatformDailyBreakdown(safeDays);
        return ResponseEntity.ok(breakdown);
    }

    /**
     * GET /api/v1/analytics/{profileId}/top-apps?period=week
     * Returns top apps by query count for known app domains (last 7 days if no period param).
     * Apps are aggregated across all related sub-domains (e.g. ytimg.com counts toward YouTube).
     */
    @GetMapping("/{profileId}/top-apps")
    public ResponseEntity<List<TopAppEntry>> getTopApps(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "week") String period,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);
        List<TopAppEntry> apps = analyticsService.getTopApps(profileId, period);
        return ResponseEntity.ok(apps);
    }

    /**
     * GET /api/v1/analytics/profiles/{profileId}/app-usage?period=day
     * Returns an app-level usage breakdown for a child profile (CS-06).
     * period: day | week | month
     */
    @GetMapping("/profiles/{profileId}/app-usage")
    public ResponseEntity<List<AppUsageEntry>> getAppUsageReport(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "week") String period,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);
        List<AppUsageEntry> report = analyticsService.getAppUsageReport(profileId, period);
        return ResponseEntity.ok(report);
    }

    // ── PDF Report ─────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/analytics/{profileId}/report/pdf
     * Returns an HTML page with print-friendly CSS suitable for PDF export.
     * Includes stats, top domains, category breakdown, and daily chart data.
     */
    @GetMapping(value = "/{profileId}/report/pdf", produces = "text/html")
    public ResponseEntity<String> getPdfReport(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "week") String period,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        validateAccess(profileId, userId, userRole);

        UsageStatsResponse stats = analyticsService.getUsageStats(profileId, period);
        List<TopDomainEntry> topBlocked = analyticsService.getTopDomains(profileId, "BLOCKED", 10, period);
        List<TopDomainEntry> topAllowed = analyticsService.getTopDomains(profileId, "ALLOWED", 10, period);
        List<CategoryBreakdown> categories = analyticsService.getCategoryBreakdown(profileId, period);
        List<DailyUsagePoint> daily = analyticsService.getDailyBreakdown(profileId, 30);

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><meta charset='UTF-8'>");
        html.append("<title>Shield DNS Report — ").append(profileId).append("</title>");
        html.append("<style>");
        html.append("@media print { body { margin: 0; } }");
        html.append("body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1a1a2e; }");
        html.append("h1 { color: #6C63FF; border-bottom: 2px solid #6C63FF; padding-bottom: 8px; }");
        html.append("h2 { color: #333; margin-top: 28px; }");
        html.append(".stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }");
        html.append(".stat-card { background: #f4f3ff; border-radius: 8px; padding: 16px; text-align: center; }");
        html.append(".stat-card .value { font-size: 24px; font-weight: 700; color: #6C63FF; }");
        html.append(".stat-card .label { font-size: 12px; color: #666; margin-top: 4px; }");
        html.append("table { width: 100%; border-collapse: collapse; margin: 12px 0; }");
        html.append("th, td { padding: 8px 12px; border-bottom: 1px solid #eee; text-align: left; }");
        html.append("th { background: #f8f8ff; font-weight: 600; }");
        html.append(".footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }");
        html.append("</style></head><body>");

        html.append("<h1>Shield DNS Filtering Report</h1>");
        html.append("<p><strong>Profile:</strong> ").append(profileId)
            .append(" &nbsp;|&nbsp; <strong>Period:</strong> ").append(period)
            .append(" &nbsp;|&nbsp; <strong>Generated:</strong> ").append(java.time.LocalDate.now()).append("</p>");

        // Stats cards
        html.append("<div class='stats-grid'>");
        html.append("<div class='stat-card'><div class='value'>").append(stats.getTotalQueries()).append("</div><div class='label'>Total Queries</div></div>");
        html.append("<div class='stat-card'><div class='value'>").append(stats.getBlockedQueries()).append("</div><div class='label'>Blocked</div></div>");
        html.append("<div class='stat-card'><div class='value'>").append(stats.getAllowedQueries()).append("</div><div class='label'>Allowed</div></div>");
        html.append("<div class='stat-card'><div class='value'>").append(String.format("%.1f%%", stats.getBlockRate())).append("</div><div class='label'>Block Rate</div></div>");
        html.append("</div>");

        // Top Blocked Domains
        html.append("<h2>Top Blocked Domains</h2>");
        if (topBlocked.isEmpty()) {
            html.append("<p>No blocked domains in this period.</p>");
        } else {
            html.append("<table><tr><th>#</th><th>Domain</th><th>Count</th></tr>");
            for (int i = 0; i < topBlocked.size(); i++) {
                TopDomainEntry e = topBlocked.get(i);
                html.append("<tr><td>").append(i + 1).append("</td><td>").append(e.getDomain())
                    .append("</td><td>").append(e.getCount()).append("</td></tr>");
            }
            html.append("</table>");
        }

        // Top Allowed Domains
        html.append("<h2>Top Allowed Domains</h2>");
        if (topAllowed.isEmpty()) {
            html.append("<p>No allowed domain data in this period.</p>");
        } else {
            html.append("<table><tr><th>#</th><th>Domain</th><th>Count</th></tr>");
            for (int i = 0; i < topAllowed.size(); i++) {
                TopDomainEntry e = topAllowed.get(i);
                html.append("<tr><td>").append(i + 1).append("</td><td>").append(e.getDomain())
                    .append("</td><td>").append(e.getCount()).append("</td></tr>");
            }
            html.append("</table>");
        }

        // Category Breakdown
        html.append("<h2>Category Breakdown</h2>");
        if (categories.isEmpty()) {
            html.append("<p>No category data in this period.</p>");
        } else {
            html.append("<table><tr><th>Category</th><th>Queries</th></tr>");
            for (CategoryBreakdown c : categories) {
                html.append("<tr><td>").append(c.getCategory()).append("</td><td>").append(c.getCount()).append("</td></tr>");
            }
            html.append("</table>");
        }

        // Daily Breakdown
        html.append("<h2>Daily Activity (Last 30 Days)</h2>");
        if (daily.isEmpty()) {
            html.append("<p>No daily data available.</p>");
        } else {
            html.append("<table><tr><th>Date</th><th>Total</th><th>Blocked</th></tr>");
            for (DailyUsagePoint d : daily) {
                html.append("<tr><td>").append(d.getDate()).append("</td><td>").append(d.getTotalQueries())
                    .append("</td><td>").append(d.getBlockedQueries()).append("</td></tr>");
            }
            html.append("</table>");
        }

        html.append("<div class='footer'>Generated by Shield Platform &mdash; shield.rstglobal.in</div>");
        html.append("</body></html>");

        return ResponseEntity.ok()
                .header("Content-Type", "text/html; charset=UTF-8")
                .body(html.toString());
    }

    // ── tenant-scoped (ISP admin) ─────────────────────────────────────────────

    /** GET /api/v1/analytics/tenant/{tenantId}/overview */
    @GetMapping("/tenant/{tenantId}/overview")
    public ResponseEntity<UsageStatsResponse> getTenantOverview(
            @PathVariable UUID tenantId,
            @RequestParam(defaultValue = "today") String period,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        requireAdminOrMatchingTenant(userRole, headerTenantId, tenantId);
        return ResponseEntity.ok(analyticsService.getTenantOverview(tenantId, period));
    }

    /** GET /api/v1/analytics/tenant/{tenantId}/daily */
    @GetMapping("/tenant/{tenantId}/daily")
    public ResponseEntity<List<DailyUsagePoint>> getTenantDaily(
            @PathVariable UUID tenantId,
            @RequestParam(defaultValue = "7") int days,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        requireAdminOrMatchingTenant(userRole, headerTenantId, tenantId);
        return ResponseEntity.ok(analyticsService.getTenantDailyBreakdown(tenantId, Math.min(days, 365)));
    }

    /** GET /api/v1/analytics/tenant/{tenantId}/categories */
    @GetMapping("/tenant/{tenantId}/categories")
    public ResponseEntity<List<CategoryBreakdown>> getTenantCategories(
            @PathVariable UUID tenantId,
            @RequestParam(defaultValue = "week") String period,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        requireAdminOrMatchingTenant(userRole, headerTenantId, tenantId);
        return ResponseEntity.ok(analyticsService.getTenantBlockedCategories(tenantId, period));
    }

    /** GET /api/v1/analytics/platform/categories */
    @GetMapping("/platform/categories")
    public ResponseEntity<List<CategoryBreakdown>> getPlatformCategories(
            @RequestParam(defaultValue = "week") String period,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        requireAdmin(userRole);
        return ResponseEntity.ok(analyticsService.getPlatformBlockedCategories(period));
    }

    /** GET /api/v1/analytics/platform/top-tenants */
    @GetMapping("/platform/top-tenants")
    public ResponseEntity<List<Object[]>> getTopTenants(
            @RequestParam(defaultValue = "week") String period,
            @RequestParam(defaultValue = "5") int limit,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        requireAdmin(userRole);
        return ResponseEntity.ok(analyticsService.getTopTenantsByQueries(period, Math.min(limit, 20)));
    }

    // ── Social monitoring alerts ──────────────────────────────────────────────

    /**
     * GET /api/v1/analytics/{profileId}/social-alerts?unreadOnly=true
     * Returns social behaviour alerts for a profile (late-night, spikes, new categories).
     */
    @GetMapping("/{profileId}/social-alerts")
    public ResponseEntity<List<SocialAlert>> getSocialAlerts(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        validateAccess(profileId, userId, userRole);
        return ResponseEntity.ok(socialMonitoringService.getAlertsForProfile(profileId, unreadOnly));
    }

    /**
     * POST /api/v1/analytics/social-alerts/{alertId}/acknowledge
     * Mark an alert as acknowledged/read.
     */
    @PostMapping("/social-alerts/{alertId}/acknowledge")
    public ResponseEntity<Void> acknowledgeAlert(
            @PathVariable UUID alertId,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing X-User-Id");
        }
        socialMonitoringService.acknowledgeAlert(alertId);
        return ResponseEntity.ok().build();
    }

    /**
     * GET /api/v1/analytics/tenant/{tenantId}/social-alerts
     * Returns unread social alerts for all profiles in a tenant (ISP admin view).
     */
    @GetMapping("/tenant/{tenantId}/social-alerts")
    public ResponseEntity<List<SocialAlert>> getTenantSocialAlerts(
            @PathVariable UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        requireAdminOrMatchingTenant(userRole, headerTenantId, tenantId);
        return ResponseEntity.ok(socialMonitoringService.getUnreadAlertsForTenant(tenantId));
    }

    /** GET /api/v1/analytics/tenant/{tenantId}/top-domains?period=week&limit=10 */
    @GetMapping("/tenant/{tenantId}/top-domains")
    public ResponseEntity<List<TopDomainEntry>> getTenantTopBlockedDomains(
            @PathVariable UUID tenantId,
            @RequestParam(defaultValue = "week") String period,
            @RequestParam(defaultValue = "10") int limit,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        requireAdminOrMatchingTenant(userRole, headerTenantId, tenantId);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        return ResponseEntity.ok(analyticsService.getTenantTopBlockedDomains(tenantId, period, safeLimit));
    }

    /** GET /api/v1/analytics/platform/customers-summary (GLOBAL_ADMIN only) */
    @GetMapping("/platform/customers-summary")
    public ResponseEntity<CustomersSummaryResponse> getCustomersSummary(
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (!"GLOBAL_ADMIN".equalsIgnoreCase(userRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "GLOBAL_ADMIN role required");
        }
        return ResponseEntity.ok(analyticsService.getCustomersSummary());
    }

    /** GET /api/v1/analytics/tenant/{tenantId}/hourly?date=YYYY-MM-DD */
    @GetMapping("/tenant/{tenantId}/hourly")
    public ResponseEntity<List<HourlyUsagePoint>> getTenantHourly(
            @PathVariable UUID tenantId,
            @RequestParam(required = false) String date,
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        requireAdminOrMatchingTenant(userRole, headerTenantId, tenantId);
        String targetDate = (date != null && !date.isBlank()) ? date
                : java.time.LocalDate.now().toString();
        return ResponseEntity.ok(analyticsService.getTenantHourlyBreakdown(tenantId, targetDate));
    }

    private void requireAdmin(String role) {
        if (!"GLOBAL_ADMIN".equalsIgnoreCase(role) && !"ISP_ADMIN".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
        }
    }

    private void requireAdminOrMatchingTenant(String role, String headerTenantId, UUID tenantId) {
        if ("GLOBAL_ADMIN".equalsIgnoreCase(role)) return;
        if ("ISP_ADMIN".equalsIgnoreCase(role) && headerTenantId != null && UUID.fromString(headerTenantId).equals(tenantId)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    // ── access validation ─────────────────────────────────────────────────────

    private void validateAccess(UUID profileId, String userId, String userRole) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing X-User-Id header");
        }
        // GLOBAL_ADMIN, ISP_ADMIN, CUSTOMER (parent) can access profiles
        if ("GLOBAL_ADMIN".equalsIgnoreCase(userRole) || "ISP_ADMIN".equalsIgnoreCase(userRole)
                || "CUSTOMER".equalsIgnoreCase(userRole)) {
            return;
        }
        // For other roles, require userId to match profileId
        try {
            UUID userUuid = UUID.fromString(userId);
            if (!userUuid.equals(profileId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Access denied to profileId " + profileId);
            }
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid X-User-Id");
        }
    }
}
