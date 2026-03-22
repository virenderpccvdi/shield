package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.DeviceSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceSettingsRepository extends JpaRepository<DeviceSettings, UUID> {
    Optional<DeviceSettings> findByProfileId(UUID profileId);
}
