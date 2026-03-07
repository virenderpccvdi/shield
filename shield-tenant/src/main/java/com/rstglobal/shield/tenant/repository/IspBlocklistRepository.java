package com.rstglobal.shield.tenant.repository;

import com.rstglobal.shield.tenant.entity.IspBlocklistEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IspBlocklistRepository extends JpaRepository<IspBlocklistEntry, UUID> {

    Page<IspBlocklistEntry> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);

    boolean existsByTenantIdAndDomain(UUID tenantId, String domain);

    Optional<IspBlocklistEntry> findByTenantIdAndDomain(UUID tenantId, String domain);
}
