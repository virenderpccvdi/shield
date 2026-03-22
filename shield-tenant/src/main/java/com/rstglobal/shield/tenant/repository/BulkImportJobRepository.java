package com.rstglobal.shield.tenant.repository;

import com.rstglobal.shield.tenant.entity.BulkImportJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BulkImportJobRepository extends JpaRepository<BulkImportJob, UUID> {

    Page<BulkImportJob> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);

    Optional<BulkImportJob> findByIdAndTenantId(UUID id, UUID tenantId);
}
