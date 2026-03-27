package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.RulesAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface RulesAuditLogRepository extends JpaRepository<RulesAuditLog, UUID> {
    Page<RulesAuditLog> findByProfileIdOrderByCreatedAtDesc(UUID profileId, Pageable pageable);
    Page<RulesAuditLog> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);
}
