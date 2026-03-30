package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.DevicePairingCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface DevicePairingCodeRepository extends JpaRepository<DevicePairingCode, UUID> {

    @Query("SELECT c FROM DevicePairingCode c WHERE c.code = :code AND c.used = false AND c.expiresAt > :now")
    Optional<DevicePairingCode> findActiveCode(String code, Instant now);

    @Modifying
    @Query("DELETE FROM DevicePairingCode c WHERE c.expiresAt < :now OR c.used = true")
    int deleteExpiredAndUsed(Instant now);
}
