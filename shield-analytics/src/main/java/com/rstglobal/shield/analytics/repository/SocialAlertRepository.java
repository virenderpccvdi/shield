package com.rstglobal.shield.analytics.repository;

import com.rstglobal.shield.analytics.entity.SocialAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface SocialAlertRepository extends JpaRepository<SocialAlert, UUID> {

    List<SocialAlert> findByProfileIdOrderByDetectedAtDesc(UUID profileId);

    List<SocialAlert> findByProfileIdAndAcknowledgedFalseOrderByDetectedAtDesc(UUID profileId);

    List<SocialAlert> findByTenantIdAndAcknowledgedFalseOrderByDetectedAtDesc(UUID tenantId);

    /** Check if a similar alert was already raised in the last N hours (dedup). */
    @Query("SELECT COUNT(a) FROM SocialAlert a WHERE a.profileId = :profileId " +
           "AND a.alertType = :alertType AND a.detectedAt >= :since")
    long countRecentAlerts(@Param("profileId") UUID profileId,
                           @Param("alertType") String alertType,
                           @Param("since") Instant since);
}
