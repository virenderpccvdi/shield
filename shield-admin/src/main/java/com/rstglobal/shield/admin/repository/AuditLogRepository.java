package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {
    Page<AuditLog> findByAction(String action, Pageable pageable);
    Page<AuditLog> findByUserId(UUID userId, Pageable pageable);
}
