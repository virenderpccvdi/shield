package com.rstglobal.shield.analytics.repository;

import com.rstglobal.shield.analytics.entity.DnsQueryLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface DnsQueryLogRepository extends JpaRepository<DnsQueryLog, UUID> {

    Page<DnsQueryLog> findByProfileIdAndQueriedAtBetween(
            UUID profileId, Instant from, Instant to, Pageable pageable);

    long countByProfileIdAndActionAndQueriedAtBetween(
            UUID profileId, String action, Instant from, Instant to);

    long countByProfileIdAndQueriedAtBetween(UUID profileId, Instant from, Instant to);

    Page<DnsQueryLog> findByProfileIdAndActionAndQueriedAtBetween(
            UUID profileId, String action, Instant from, Instant to, Pageable pageable);

    @Query(value = """
            SELECT domain, COUNT(*) AS query_count, action
            FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND action = :action
              AND queried_at BETWEEN :from AND :to
            GROUP BY domain, action
            ORDER BY query_count DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findTopDomainsByProfileIdAndAction(
            @Param("profileId") UUID profileId,
            @Param("action") String action,
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("limit") int limit);

    @Query(value = """
            SELECT DATE(queried_at) AS query_date,
                   COUNT(*) AS total,
                   SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked,
                   SUM(CASE WHEN action = 'ALLOWED' THEN 1 ELSE 0 END) AS allowed
            FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND queried_at >= :from
            GROUP BY DATE(queried_at)
            ORDER BY query_date ASC
            """, nativeQuery = true)
    List<Object[]> findDailyBreakdownByProfileId(
            @Param("profileId") UUID profileId,
            @Param("from") Instant from);

    @Query(value = """
            SELECT category, COUNT(*) AS query_count
            FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND queried_at BETWEEN :from AND :to
              AND category IS NOT NULL
            GROUP BY category
            ORDER BY query_count DESC
            """, nativeQuery = true)
    List<Object[]> findCategoryBreakdownByProfileId(
            @Param("profileId") UUID profileId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    // ── platform-wide (no profileId filter) ──────────────────────────────────

    long countByQueriedAtBetween(Instant from, Instant to);

    long countByActionAndQueriedAtBetween(String action, Instant from, Instant to);

    @Query(value = """
            SELECT DATE(queried_at) AS query_date,
                   COUNT(*) AS total,
                   SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked
            FROM analytics.dns_query_logs
            WHERE queried_at >= :from
            GROUP BY DATE(queried_at)
            ORDER BY query_date ASC
            """, nativeQuery = true)
    List<Object[]> findPlatformDailyBreakdown(@Param("from") Instant from);

    // ── tenant-scoped ──────────────────────────────────────────────────────

    long countByTenantIdAndQueriedAtBetween(UUID tenantId, Instant from, Instant to);

    long countByTenantIdAndActionAndQueriedAtBetween(UUID tenantId, String action, Instant from, Instant to);

    @Query(value = """
            SELECT DATE(queried_at) AS query_date,
                   COUNT(*) AS total,
                   SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId AND queried_at >= :from
            GROUP BY DATE(queried_at)
            ORDER BY query_date ASC
            """, nativeQuery = true)
    List<Object[]> findTenantDailyBreakdown(@Param("tenantId") UUID tenantId, @Param("from") Instant from);

    @Query(value = """
            SELECT category, COUNT(*) AS query_count
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND queried_at BETWEEN :from AND :to
              AND category IS NOT NULL
              AND action = 'BLOCKED'
            GROUP BY category
            ORDER BY query_count DESC
            LIMIT 10
            """, nativeQuery = true)
    List<Object[]> findTenantBlockedCategories(@Param("tenantId") UUID tenantId,
                                                @Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            SELECT category, COUNT(*) AS query_count
            FROM analytics.dns_query_logs
            WHERE queried_at BETWEEN :from AND :to
              AND category IS NOT NULL
              AND action = 'BLOCKED'
            GROUP BY category
            ORDER BY query_count DESC
            LIMIT 10
            """, nativeQuery = true)
    List<Object[]> findPlatformBlockedCategories(@Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            SELECT tenant_id, COUNT(*) AS query_count
            FROM analytics.dns_query_logs
            WHERE queried_at BETWEEN :from AND :to
            GROUP BY tenant_id
            ORDER BY query_count DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findTopTenantsByQueries(@Param("from") Instant from, @Param("to") Instant to,
                                            @Param("limit") int limit);

    // ── Social monitoring queries ─────────────────────────────────────────────

    /** Count queries in a window where the query hour (UTC) falls in 22:00–06:00. */
    @Query(value = """
            SELECT COUNT(*) FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND queried_at BETWEEN :from AND :to
              AND (EXTRACT(HOUR FROM queried_at AT TIME ZONE 'UTC') >= 22
                   OR EXTRACT(HOUR FROM queried_at AT TIME ZONE 'UTC') < 6)
            """, nativeQuery = true)
    long countLateNightQueries(@Param("profileId") UUID profileId,
                               @Param("from") Instant from, @Param("to") Instant to);

    /** Count queries matching any of the given category names. */
    @Query(value = """
            SELECT COUNT(*) FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND queried_at BETWEEN :from AND :to
              AND category = ANY(CAST(:categories AS VARCHAR[]))
            """, nativeQuery = true)
    long countQueriesByCategories(@Param("profileId") UUID profileId,
                                   @Param("from") Instant from, @Param("to") Instant to,
                                   @Param("categories") String[] categories);

    /** Categories first seen in the recent window that were NOT present in the baseline window. */
    @Query(value = """
            SELECT DISTINCT recent.category
            FROM (
                SELECT DISTINCT category FROM analytics.dns_query_logs
                WHERE profile_id = :profileId
                  AND queried_at BETWEEN :recentFrom AND :recentTo
                  AND category IS NOT NULL
            ) recent
            WHERE NOT EXISTS (
                SELECT 1 FROM analytics.dns_query_logs
                WHERE profile_id = :profileId
                  AND queried_at BETWEEN :baselineFrom AND :baselineTo
                  AND category = recent.category
            )
            """, nativeQuery = true)
    List<String> findNewCategories(@Param("profileId") UUID profileId,
                                    @Param("recentFrom") Instant recentFrom,
                                    @Param("recentTo") Instant recentTo,
                                    @Param("baselineFrom") Instant baselineFrom,
                                    @Param("baselineTo") Instant baselineTo);

    /** Distinct active profiles (with tenantId) since a given time. */
    @Query(value = """
            SELECT DISTINCT profile_id, tenant_id
            FROM analytics.dns_query_logs
            WHERE queried_at >= :since
              AND profile_id IS NOT NULL
            """, nativeQuery = true)
    List<Object[]> findActiveProfilesSince(@Param("since") Instant since);

    // ── Tenant top blocked domains ────────────────────────────────────────────

    @Query(value = """
            SELECT domain, category, COUNT(*) AS query_count
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND action = 'BLOCKED'
              AND queried_at BETWEEN :from AND :to
            GROUP BY domain, category
            ORDER BY query_count DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findTenantTopBlockedDomains(@Param("tenantId") UUID tenantId,
                                                @Param("from") Instant from,
                                                @Param("to") Instant to,
                                                @Param("limit") int limit);

    // ── Platform customers summary ────────────────────────────────────────────

    @Query(value = """
            SELECT
              COUNT(DISTINCT user_id) AS total_customers,
              COUNT(DISTINCT CASE WHEN last_query_time > :sevenDaysAgo THEN user_id END) AS active_customers
            FROM (
              SELECT profile_id AS user_id, MAX(queried_at) AS last_query_time
              FROM analytics.dns_query_logs
              WHERE tenant_id IS NOT NULL
              GROUP BY profile_id
            ) sub
            """, nativeQuery = true)
    List<Object[]> findCustomersSummary(@Param("sevenDaysAgo") Instant sevenDaysAgo);

    @Query(value = """
            SELECT COUNT(DISTINCT profile_id)
            FROM analytics.dns_query_logs
            WHERE queried_at >= :monthStart
              AND tenant_id IS NOT NULL
            """, nativeQuery = true)
    long countNewProfilesSince(@Param("monthStart") Instant monthStart);

    @Query(value = """
            SELECT COUNT(DISTINCT profile_id)
            FROM analytics.dns_query_logs
            WHERE profile_id IS NOT NULL
            """, nativeQuery = true)
    long countDistinctProfiles();

    // ── Hourly breakdown ──────────────────────────────────────────────────────

    @Query(value = """
            SELECT EXTRACT(HOUR FROM queried_at)::INT AS hour, COUNT(*) AS count
            FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND queried_at::date = CAST(:date AS date)
            GROUP BY 1
            ORDER BY 1
            """, nativeQuery = true)
    List<Object[]> findHourlyBreakdownByProfileId(@Param("profileId") UUID profileId,
                                                   @Param("date") String date);

    @Query(value = """
            SELECT EXTRACT(HOUR FROM queried_at)::INT AS hour, COUNT(*) AS count
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND queried_at::date = CAST(:date AS date)
            GROUP BY 1
            ORDER BY 1
            """, nativeQuery = true)
    List<Object[]> findTenantHourlyBreakdown(@Param("tenantId") UUID tenantId,
                                              @Param("date") String date);

    // ── IS-05: Export queries ─────────────────────────────────────────────────

    /**
     * Per-profile customer summary for a tenant:
     * profile_id, total_queries, blocked_queries, last_seen.
     * Used by ExportService.exportCustomerSummary().
     */
    @Query(value = """
            SELECT
                profile_id,
                COUNT(*) AS total_queries,
                SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_queries,
                MAX(queried_at) AS last_seen
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND profile_id IS NOT NULL
            GROUP BY profile_id
            ORDER BY total_queries DESC
            """, nativeQuery = true)
    List<Object[]> findCustomerSummaryByTenant(@Param("tenantId") UUID tenantId);

    /**
     * Returns top domains for a profile within a time window, regardless of action.
     * Used for enriched top-domains (all actions).
     */
    @Query(value = """
            SELECT domain, COUNT(*) AS query_count, action, category
            FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND queried_at BETWEEN :from AND :to
            GROUP BY domain, action, category
            ORDER BY query_count DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findTopDomainsByProfileId(
            @Param("profileId") UUID profileId,
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("limit") int limit);

    /**
     * Returns domain-level aggregates for app-usage report:
     * domain, total queries, blocked queries.
     * Fetches the top 500 distinct domains for later in-memory app grouping.
     */
    @Query(value = """
            SELECT
                domain,
                COUNT(*) AS total_count,
                SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_count
            FROM analytics.dns_query_logs
            WHERE profile_id = :profileId
              AND queried_at BETWEEN :from AND :to
            GROUP BY domain
            ORDER BY total_count DESC
            LIMIT 500
            """, nativeQuery = true)
    List<Object[]> findDomainAggregatesForProfile(
            @Param("profileId") UUID profileId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    // ── IS-06: Tenant Usage Dashboard queries ─────────────────────────────────

    /**
     * Hourly breakdown for a tenant over the last 24 hours.
     * Returns: hour (INT), total_queries (LONG), blocked_queries (LONG).
     * Rows only for hours that have data; caller fills gaps for all 24 hours.
     */
    @Query(value = """
            SELECT
                EXTRACT(HOUR FROM queried_at)::INT AS hour,
                COUNT(*) AS total_queries,
                SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_queries
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND queried_at >= :from
            GROUP BY 1
            ORDER BY 1
            """, nativeQuery = true)
    List<Object[]> findHourlyBreakdown(
            @Param("tenantId") UUID tenantId,
            @Param("from") Instant from);

    /**
     * Count of distinct profiles that issued at least one query after the given threshold.
     * Returns a single Long value.
     */
    @Query(value = """
            SELECT COUNT(DISTINCT profile_id)
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND queried_at >= :after
              AND profile_id IS NOT NULL
            """, nativeQuery = true)
    long findActiveProfileCount(
            @Param("tenantId") UUID tenantId,
            @Param("after") Instant after);

    /**
     * Total distinct profiles ever recorded for a tenant.
     */
    @Query(value = """
            SELECT COUNT(DISTINCT profile_id)
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND profile_id IS NOT NULL
            """, nativeQuery = true)
    long findTotalProfileCount(@Param("tenantId") UUID tenantId);

    /**
     * Per-profile activity summary for a tenant since todayStart.
     * Returns: profile_id (UUID string), queries_today (LONG), blocked_today (LONG), last_seen (Instant).
     * Sorted by queries_today DESC.
     */
    @Query(value = """
            SELECT
                profile_id,
                COUNT(*) AS queries_today,
                SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_today,
                MAX(queried_at) AS last_seen
            FROM analytics.dns_query_logs
            WHERE tenant_id = :tenantId
              AND queried_at >= :todayStart
              AND profile_id IS NOT NULL
            GROUP BY profile_id
            ORDER BY queries_today DESC
            """, nativeQuery = true)
    List<Object[]> findCustomerActivityByTenant(
            @Param("tenantId") UUID tenantId,
            @Param("todayStart") Instant todayStart);
}
