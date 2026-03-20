package com.rstglobal.shield.tenant.repository;

import com.rstglobal.shield.tenant.entity.IspAllowlistEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface IspAllowlistRepository extends JpaRepository<IspAllowlistEntry, UUID> {
    Page<IspAllowlistEntry> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);
    boolean existsByTenantIdAndDomain(UUID tenantId, String domain);
}
