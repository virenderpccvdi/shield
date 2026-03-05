package com.rstglobal.shield.auth.repository;

import com.rstglobal.shield.auth.entity.User;
import com.rstglobal.shield.auth.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, UUID id);

    long countByTenantIdAndRole(UUID tenantId, UserRole role);

    @Modifying
    @Query("UPDATE User u SET u.failedLoginAttempts = 0, u.lockedUntil = null, u.lastLoginAt = :now WHERE u.id = :id")
    void resetLoginState(UUID id, Instant now);

    @Modifying
    @Query("UPDATE User u SET u.failedLoginAttempts = u.failedLoginAttempts + 1, u.lockedUntil = :lockUntil WHERE u.id = :id")
    void incrementFailedAttempts(UUID id, Instant lockUntil);
}
