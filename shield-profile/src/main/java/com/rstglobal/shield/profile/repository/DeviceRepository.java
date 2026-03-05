package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.Device;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DeviceRepository extends JpaRepository<Device, UUID> {
    List<Device> findByProfileId(UUID profileId);
    List<Device> findByTenantId(UUID tenantId);
    Page<Device> findAll(Pageable pageable);
    Page<Device> findByTenantId(UUID tenantId, Pageable pageable);
    long countByOnlineTrue();
    long countByTenantIdAndOnlineTrue(UUID tenantId);
}
