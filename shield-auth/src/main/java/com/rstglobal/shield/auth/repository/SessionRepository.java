package com.rstglobal.shield.auth.repository;

import com.rstglobal.shield.auth.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    List<Session> findByUserIdAndRevokedFalse(UUID userId);

    Optional<Session> findByIdAndUserIdAndRevokedFalse(UUID id, UUID userId);

    boolean existsByUserIdAndFingerprintHash(UUID userId, String fingerprintHash);

    @Modifying
    @Query("UPDATE Session s SET s.revoked = true, s.revokedAt = :now WHERE s.userId = :userId AND s.revoked = false")
    void revokeAllForUser(UUID userId, Instant now);
}
