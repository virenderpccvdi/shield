package com.rstglobal.shield.notification.repository;

import com.rstglobal.shield.notification.entity.NotificationChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface NotificationChannelRepository extends JpaRepository<NotificationChannel, UUID> {

    Optional<NotificationChannel> findByTenantIdAndChannelType(UUID tenantId, String channelType);

    /** Returns tenant-specific config or falls back to platform default (tenant_id IS NULL). */
    @Query("SELECT c FROM NotificationChannel c WHERE c.channelType = :channelType AND (c.tenantId = :tenantId OR c.tenantId IS NULL) ORDER BY CASE WHEN c.tenantId IS NOT NULL THEN 0 ELSE 1 END")
    Optional<NotificationChannel> findEffective(UUID tenantId, String channelType);

    Optional<NotificationChannel> findByTenantIdIsNullAndChannelType(String channelType);
}
