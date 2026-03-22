package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.ScreenTimeRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface ScreenTimeRequestRepository extends JpaRepository<ScreenTimeRequest, UUID> {

    List<ScreenTimeRequest> findByProfileIdAndStatusOrderByRequestedAtDesc(UUID profileId, String status);

    List<ScreenTimeRequest> findTop20ByProfileIdOrderByRequestedAtDesc(UUID profileId);

    List<ScreenTimeRequest> findByStatusAndRequestedAtBefore(String status, OffsetDateTime before);
}
