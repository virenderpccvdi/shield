package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.BulkImportJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface BulkImportJobRepository extends JpaRepository<BulkImportJob, UUID> {

    Page<BulkImportJob> findByTenantId(UUID tenantId, Pageable pageable);
}
