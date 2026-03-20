package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.TenantDnsSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface TenantDnsSettingsRepository extends JpaRepository<TenantDnsSettings, UUID> {
    Optional<TenantDnsSettings> findByTenantId(UUID tenantId);
}
