package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.LocationPoint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LocationPointRepository extends JpaRepository<LocationPoint, UUID> {

    Optional<LocationPoint> findFirstByProfileIdOrderByRecordedAtDesc(UUID profileId);

    Page<LocationPoint> findByProfileIdAndRecordedAtBetweenOrderByRecordedAtDesc(
            UUID profileId,
            OffsetDateTime from,
            OffsetDateTime to,
            Pageable pageable
    );
}
