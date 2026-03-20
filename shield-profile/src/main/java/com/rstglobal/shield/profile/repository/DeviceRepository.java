package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.Device;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceRepository extends JpaRepository<Device, UUID> {
    List<Device> findByProfileId(UUID profileId);
    List<Device> findByProfileIdIn(Collection<UUID> profileIds);
    Optional<Device> findByProfileIdAndDeviceType(UUID profileId, String deviceType);
    List<Device> findByTenantId(UUID tenantId);
    List<Device> findByOnlineTrue();
    Page<Device> findAll(Pageable pageable);
    Page<Device> findByTenantId(UUID tenantId, Pageable pageable);
    long countByOnlineTrue();
    long countByTenantIdAndOnlineTrue(UUID tenantId);
}
