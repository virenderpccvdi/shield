package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.LocationShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LocationShareRepository extends JpaRepository<LocationShare, UUID> {

    Optional<LocationShare> findByShareTokenAndIsActiveTrue(String token);

    List<LocationShare> findByProfileIdAndIsActiveTrueOrderByCreatedAtDesc(UUID profileId);

    List<LocationShare> findByCreatedByOrderByCreatedAtDesc(UUID createdBy);

    @Modifying
    @Query("UPDATE LocationShare s SET s.isActive = false WHERE s.expiresAt < :now AND s.isActive = true")
    int deactivateExpired(OffsetDateTime now);
}
