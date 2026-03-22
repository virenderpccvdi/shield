package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.BrowsingHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface BrowsingHistoryRepository extends JpaRepository<BrowsingHistory, Long> {

    Page<BrowsingHistory> findByProfileIdOrderByQueriedAtDesc(UUID profileId, Pageable pageable);

    Page<BrowsingHistory> findByProfileIdAndWasBlockedOrderByQueriedAtDesc(
            UUID profileId, Boolean wasBlocked, Pageable pageable);

    Page<BrowsingHistory> findByProfileIdAndQueriedAtAfterOrderByQueriedAtDesc(
            UUID profileId, OffsetDateTime after, Pageable pageable);

    Page<BrowsingHistory> findByProfileIdAndWasBlockedAndQueriedAtAfterOrderByQueriedAtDesc(
            UUID profileId, Boolean wasBlocked, OffsetDateTime after, Pageable pageable);

    Page<BrowsingHistory> findByTenantIdOrderByQueriedAtDesc(UUID tenantId, Pageable pageable);

    long countByProfileIdAndWasBlockedAndQueriedAtAfter(
            UUID profileId, boolean wasBlocked, OffsetDateTime after);

    long countByProfileIdAndQueriedAtAfter(UUID profileId, OffsetDateTime after);

    void deleteByProfileId(UUID profileId);

    /** Top domains queried by a profile in a given time window, sorted by frequency. */
    @Query("""
            SELECT b.domain, COUNT(b) AS cnt
            FROM BrowsingHistory b
            WHERE b.profileId = :profileId
              AND b.queriedAt > :after
            GROUP BY b.domain
            ORDER BY cnt DESC
            """)
    List<Object[]> findTopDomains(@Param("profileId") UUID profileId,
                                  @Param("after") OffsetDateTime after,
                                  Pageable pageable);
}
