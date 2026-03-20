package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.DeviceApp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceAppRepository extends JpaRepository<DeviceApp, UUID> {
    List<DeviceApp> findByProfileId(UUID profileId);
    Optional<DeviceApp> findByProfileIdAndPackageName(UUID profileId, String packageName);
    List<DeviceApp> findByProfileIdAndBlockedTrue(UUID profileId);
}
