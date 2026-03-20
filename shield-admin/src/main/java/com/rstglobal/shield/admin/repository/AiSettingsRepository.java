package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.AiSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AiSettingsRepository extends JpaRepository<AiSettings, UUID> {

    /** Returns the most-recently-updated AI settings row. */
    Optional<AiSettings> findTopByOrderByUpdatedAtDesc();
}
