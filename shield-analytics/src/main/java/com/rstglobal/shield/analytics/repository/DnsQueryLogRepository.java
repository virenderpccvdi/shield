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
}
