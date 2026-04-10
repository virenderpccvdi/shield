package com.rstglobal.shield.analytics.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * AN2: Nightly job that pre-computes per-tenant and per-profile analytics summaries
 * into analytics.daily_summaries.  Runs at 1 AM daily.
 *
 * Uses a single upsert per tenant (tenant-wide) and per profile (profile-level)
 * to avoid full table scans at query time.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DailySummaryJob {

    private final JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 0 1 * * *")  // 1 AM daily
    @Transactional
    public void computeDailySummaries() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("DailySummaryJob: computing summaries for {}", yesterday);

        try {
            List<UUID> tenantIds = fetchActiveTenantIds(yesterday);
            log.info("DailySummaryJob: {} tenants to process", tenantIds.size());

            int tenantRows = 0;
            int profileRows = 0;

            for (UUID tenantId : tenantIds) {
                tenantRows += upsertTenantSummary(tenantId, yesterday);
                profileRows += upsertProfileSummaries(tenantId, yesterday);
            }

            log.info("DailySummaryJob complete for {}: {} tenant rows, {} profile rows",
                    yesterday, tenantRows, profileRows);
        } catch (Exception e) {
            log.error("DailySummaryJob failed for {}: {}", yesterday, e.getMessage(), e);
        }
    }

    /**
     * Returns distinct tenant IDs that had DNS query activity on the given date.
     */
    private List<UUID> fetchActiveTenantIds(LocalDate date) {
        return jdbcTemplate.queryForList(
                """
                SELECT DISTINCT tenant_id
                FROM analytics.dns_query_logs
                WHERE queried_at::date = ?
                  AND tenant_id IS NOT NULL
                """,
                UUID.class, date);
    }

    /**
     * Upserts a tenant-wide summary row (profile_id IS NULL) for the given date.
     * Returns number of rows affected.
     */
    private int upsertTenantSummary(UUID tenantId, LocalDate date) {
        return jdbcTemplate.update(
                """
                INSERT INTO analytics.daily_summaries
                    (tenant_id, profile_id, summary_date,
                     total_queries, total_blocks, unique_domains, top_category, computed_at)
                SELECT
                    ?::uuid AS tenant_id,
                    NULL    AS profile_id,
                    ?       AS summary_date,
                    COUNT(*)                                                         AS total_queries,
                    SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END)             AS total_blocks,
                    COUNT(DISTINCT domain)                                           AS unique_domains,
                    (SELECT category FROM analytics.dns_query_logs sub
                     WHERE sub.tenant_id = ?::uuid AND sub.queried_at::date = ?
                       AND sub.action = 'BLOCKED' AND sub.category IS NOT NULL
                     GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1)              AS top_category,
                    NOW()
                FROM analytics.dns_query_logs
                WHERE tenant_id = ?::uuid AND queried_at::date = ?
                ON CONFLICT (tenant_id, profile_id, summary_date)
                    DO UPDATE SET
                        total_queries  = EXCLUDED.total_queries,
                        total_blocks   = EXCLUDED.total_blocks,
                        unique_domains = EXCLUDED.unique_domains,
                        top_category   = EXCLUDED.top_category,
                        computed_at    = NOW()
                """,
                tenantId.toString(), date, tenantId.toString(), date, tenantId.toString(), date);
    }

    /**
     * Upserts per-profile summary rows for a tenant on the given date.
     * Returns total rows affected.
     */
    private int upsertProfileSummaries(UUID tenantId, LocalDate date) {
        return jdbcTemplate.update(
                """
                INSERT INTO analytics.daily_summaries
                    (tenant_id, profile_id, summary_date,
                     total_queries, total_blocks, unique_domains, computed_at)
                SELECT
                    tenant_id,
                    profile_id,
                    ?       AS summary_date,
                    COUNT(*)                                              AS total_queries,
                    SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS total_blocks,
                    COUNT(DISTINCT domain)                                AS unique_domains,
                    NOW()
                FROM analytics.dns_query_logs
                WHERE tenant_id = ?::uuid
                  AND queried_at::date = ?
                  AND profile_id IS NOT NULL
                GROUP BY tenant_id, profile_id
                ON CONFLICT (tenant_id, profile_id, summary_date)
                    DO UPDATE SET
                        total_queries  = EXCLUDED.total_queries,
                        total_blocks   = EXCLUDED.total_blocks,
                        unique_domains = EXCLUDED.unique_domains,
                        computed_at    = NOW()
                """,
                date, tenantId.toString(), date);
    }
}
