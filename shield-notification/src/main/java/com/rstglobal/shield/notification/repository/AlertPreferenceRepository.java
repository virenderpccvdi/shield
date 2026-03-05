package com.rstglobal.shield.notification.repository;

import com.rstglobal.shield.notification.entity.AlertPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AlertPreferenceRepository extends JpaRepository<AlertPreference, UUID> {
    Optional<AlertPreference> findByUserId(UUID userId);
}
