package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.WebsiteVisitor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface WebsiteVisitorRepository extends JpaRepository<WebsiteVisitor, UUID> {

    long countByVisitedAtAfter(OffsetDateTime since);

    @Query("SELECT v.country, COUNT(v) as cnt FROM WebsiteVisitor v WHERE v.country IS NOT NULL GROUP BY v.country ORDER BY cnt DESC")
    List<Object[]> countByCountry();

    @Query("SELECT COUNT(DISTINCT v.sessionId) FROM WebsiteVisitor v WHERE v.visitedAt >= :since")
    long countDistinctSessionsSince(OffsetDateTime since);
}
