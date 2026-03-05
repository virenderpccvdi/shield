package com.rstglobal.shield.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Push notification device token.
 * Currently stores tokens for future FCM/APNs integration.
 * Platform: ANDROID | IOS | WEB
 */
@Entity
@Table(schema = "notification", name = "device_tokens",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "token"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeviceToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    /** ANDROID | IOS | WEB */
    @Column(name = "platform", nullable = false, length = 20)
    private String platform;

    /** FCM token, APNs token, or Web Push subscription JSON */
    @Column(name = "token", nullable = false, length = 1000)
    private String token;

    @Column(name = "device_name", length = 100)
    private String deviceName;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "last_used_at")
    private OffsetDateTime lastUsedAt;
}
