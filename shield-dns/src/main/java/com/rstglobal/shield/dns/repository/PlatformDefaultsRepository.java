package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.PlatformDefaults;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlatformDefaultsRepository extends JpaRepository<PlatformDefaults, UUID> {

    /**
     * Returns the singleton platform defaults row without loading the full table.
     * Replaces findAll().stream().findFirst() throughout the codebase.
     */
    Optional<PlatformDefaults> findFirstByOrderByUpdatedAtDesc();
}
