package com.rstglobal.shield.notification.repository;

import com.rstglobal.shield.notification.entity.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {
    List<DeviceToken> findByUserIdAndActiveTrue(UUID userId);
    Optional<DeviceToken> findByUserIdAndToken(UUID userId, String token);
}
