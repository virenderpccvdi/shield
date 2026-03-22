package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.ApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, UUID> {

    List<ApprovalRequest> findByProfileIdAndStatusOrderByCreatedAtDesc(UUID profileId, String status);

    List<ApprovalRequest> findByTenantIdAndStatusOrderByCreatedAtDesc(UUID tenantId, String status);

    List<ApprovalRequest> findByProfileIdOrderByCreatedAtDesc(UUID profileId);

    /** Used by expiry job to find approved entries whose time window has closed. */
    List<ApprovalRequest> findByStatusAndExpiresAtBefore(String status, OffsetDateTime now);
}
