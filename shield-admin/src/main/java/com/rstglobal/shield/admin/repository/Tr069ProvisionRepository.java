package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.Tr069Provision;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface Tr069ProvisionRepository extends JpaRepository<Tr069Provision, UUID> {

    Optional<Tr069Provision> findByTenantIdAndDeviceSerial(UUID tenantId, String deviceSerial);

    Page<Tr069Provision> findByTenantId(UUID tenantId, Pageable pageable);
}
