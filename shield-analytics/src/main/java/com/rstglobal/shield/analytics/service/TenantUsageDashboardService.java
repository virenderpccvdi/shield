package com.rstglobal.shield.analytics.service;

import com.rstglobal.shield.analytics.dto.response.CategoryCount;
import com.rstglobal.shield.analytics.dto.response.CustomerActivityItem;
import com.rstglobal.shield.analytics.dto.response.HourlyCount;
import com.rstglobal.shield.analytics.dto.response.TenantOverviewResponse;
import com.rstglobal.shield.analytics.repository.DnsQueryLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * IS-06: ISP Tenant Usage Dashboard service.
 * Provides real-time usage statistics for all customers under an ISP tenant.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantUsageDashboardService {

    private final DnsQueryLogRepository dnsQueryLogRepository;

    // ── Overview ──────────────────────────────────────────────────────────────

    /**
     * Returns an aggregated overview of activity for all profiles in the given tenant today.
     *
     * @param tenantId ISP tenant UUID
     * @return TenantOverviewResponse with counts, top domains/categories, and bandwidth estimate
     */
    @Transactional(readOnly = true)
    public TenantOverviewResponse getTenantOverview(UUID tenantId) {
        Instant now = Instant.now();
        Instant todayStart = now.truncatedTo(ChronoUnit.DAYS);
        Instant last24h = now.minus(24, ChronoUnit.HOURS);

        // Active profiles: distinct profiles with a query in the last 24 hours
        long activeProfiles = dnsQueryLogRepository.findActiveProfileCount(tenantId, last24h);

        // Total profiles ever recorded for this tenant
        long totalProfiles = dnsQueryLogRepository.findTotalProfileCount(tenantId);

        // Total and blocked queries for today
        long totalQueriesToday = dnsQueryLogRepository
                .countByTenantIdAndQueriedAtBetween(tenantId, todayStart, now);
        long blockedQueriesToday = dnsQueryLogRepository
                .countByTenantIdAndActionAndQueriedAtBetween(tenantId, "BLOCKED", todayStart, now);

        // Top 10 blocked domains today
        List<String> topBlockedDomains = new ArrayList<>();
        try {
            List<Object[]> domainRows = dnsQueryLogRepository
                    .findTenantTopBlockedDomains(tenantId, todayStart, now, 10);
            for (Object[] row : domainRows) {
                if (row[0] != null) {
                    topBlockedDomains.add((String) row[0]);
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch top blocked domains for tenant {}: {}", tenantId, e.getMessage());
        }

        // Top 5 blocked categories today
        List<CategoryCount> topCategories = new ArrayList<>();
        try {
            List<Object[]> catRows = dnsQueryLogRepository
                    .findTenantBlockedCategories(tenantId, todayStart, now);
            int limit = Math.min(catRows.size(), 5);
            for (int i = 0; i < limit; i++) {
                Object[] row = catRows.get(i);
                if (row[0] != null) {
                    String category = (String) row[0];
                    long count = ((Number) row[1]).longValue();
                    topCategories.add(new CategoryCount(category, count));
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch top categories for tenant {}: {}", tenantId, e.getMessage());
        }

        // Bandwidth saved estimate: blocked queries * 0.05 MB
        double bandwidthSavedMb = blockedQueriesToday * 0.05;

        return new TenantOverviewResponse(
                activeProfiles,
                totalProfiles,
                totalQueriesToday,
                blockedQueriesToday,
                topBlockedDomains,
                topCategories,
                0L, // activeAlerts — reserved for SOS/geofence integration
                bandwidthSavedMb
        );
    }

    // ── Customer Activity ─────────────────────────────────────────────────────

    /**
     * Returns per-profile activity for all profiles in the tenant that had queries today.
     * Status is derived from time since last query:
     * <ul>
     *   <li>active  — last query < 5 minutes ago</li>
     *   <li>idle    — last query < 1 hour ago</li>
     *   <li>offline — last query >= 1 hour ago</li>
     * </ul>
     * Sorted by queriesToday descending.
     *
     * @param tenantId ISP tenant UUID
     * @return list of CustomerActivityItem, empty list if no activity today
     */
    @Transactional(readOnly = true)
    public List<CustomerActivityItem> getCustomerActivity(UUID tenantId) {
        Instant todayStart = Instant.now().truncatedTo(ChronoUnit.DAYS);

        List<Object[]> rows;
        try {
            rows = dnsQueryLogRepository.findCustomerActivityByTenant(tenantId, todayStart);
        } catch (Exception e) {
            log.warn("Could not fetch customer activity for tenant {}: {}", tenantId, e.getMessage());
            return List.of();
        }

        Instant now = Instant.now();
        List<CustomerActivityItem> result = new ArrayList<>(rows.size());

        for (Object[] row : rows) {
            UUID profileId = toUuid(row[0]);
            if (profileId == null) continue;

            long queriesToday = ((Number) row[1]).longValue();
            long blockedToday = ((Number) row[2]).longValue();
            Instant lastSeen = toInstant(row[3]);

            String status = deriveStatus(lastSeen, now);

            // Profile name placeholder — profile service owns the name;
            // the dashboard can enrich this client-side using /api/v1/profiles/{id}
            String profileName = "Profile " + profileId.toString().substring(0, 8);

            result.add(new CustomerActivityItem(profileId, profileName, queriesToday, blockedToday, lastSeen, status));
        }

        return result;
    }

    // ── Hourly Breakdown ──────────────────────────────────────────────────────

    /**
     * Returns a 24-element list (one entry per hour 0–23) with total and blocked
     * query counts for the given tenant over the last 24 hours.
     * Hours with no data are returned with zero counts.
     *
     * @param tenantId ISP tenant UUID
     * @return list of 24 HourlyCount records ordered by hour ascending
     */
    @Transactional(readOnly = true)
    public List<HourlyCount> getHourlyBreakdown(UUID tenantId) {
        Instant from = Instant.now().minus(24, ChronoUnit.HOURS);

        // Build hour → row map
        Map<Integer, long[]> hourMap = new HashMap<>();
        try {
            List<Object[]> rows = dnsQueryLogRepository.findHourlyBreakdown(tenantId, from);
            for (Object[] row : rows) {
                int hour = ((Number) row[0]).intValue();
                long total = ((Number) row[1]).longValue();
                long blocked = ((Number) row[2]).longValue();
                hourMap.put(hour, new long[]{total, blocked});
            }
        } catch (Exception e) {
            log.warn("Could not fetch hourly breakdown for tenant {}: {}", tenantId, e.getMessage());
        }

        // Fill all 24 hours
        List<HourlyCount> result = new ArrayList<>(24);
        for (int h = 0; h < 24; h++) {
            long[] counts = hourMap.getOrDefault(h, new long[]{0L, 0L});
            result.add(new HourlyCount(h, counts[0], counts[1]));
        }
        return result;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String deriveStatus(Instant lastSeen, Instant now) {
        if (lastSeen == null) return "offline";
        long minutesAgo = ChronoUnit.MINUTES.between(lastSeen, now);
        if (minutesAgo < 5) return "active";
        if (minutesAgo < 60) return "idle";
        return "offline";
    }

    private UUID toUuid(Object value) {
        if (value == null) return null;
        if (value instanceof UUID u) return u;
        try {
            return UUID.fromString(value.toString());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Instant toInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant i) return i;
        if (value instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (value instanceof java.util.Date d) return d.toInstant();
        return null;
    }
}
