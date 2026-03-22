package com.rstglobal.shield.analytics.repository;

import com.rstglobal.shield.analytics.entity.SuspiciousActivityAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface SuspiciousActivityAlertRepository extends JpaRepository<SuspiciousActivityAlert, UUID> {

    List<SuspiciousActivityAlert> findByProfileIdOrderByDetectedAtDesc(UUID profileId);

    List<SuspiciousActivityAlert> findByProfileIdAndAcknowledgedFalseOrderByDetectedAtDesc(UUID profileId);

    /** Dedup check: count alerts of the same type for the profile in the last N minutes. */
    @Query("SELECT COUNT(a) FROM SuspiciousActivityAlert a " +
           "WHERE a.profileId = :profileId AND a.alertType = :alertType AND a.detectedAt >= :since")
    long countRecentAlerts(@Param("profileId") UUID profileId,
                           @Param("alertType") String alertType,
                           @Param("since") Instant since);
}
