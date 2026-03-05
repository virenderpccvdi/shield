package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.IspBranding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IspBrandingRepository extends JpaRepository<IspBranding, UUID> {

    Optional<IspBranding> findByTenantId(UUID tenantId);

    Optional<IspBranding> findByCustomDomain(String customDomain);
}
