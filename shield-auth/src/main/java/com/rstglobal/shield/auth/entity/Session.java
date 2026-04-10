package com.rstglobal.shield.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Represents a login session (one row per login event).
 * Used for: session listing, targeted revocation, new-device detection.
 */
@Entity
@Table(
    schema = "auth",
    name   = "sessions",
    indexes = {
        @Index(name = "idx_sessions_user",        columnList = "user_id"),
        @Index(name = "idx_sessions_fingerprint", columnList = "user_id, fingerprint_hash")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "device_name", length = 200)
    private String deviceName;

    /** MOBILE | DESKTOP | TABLET */
    @Column(name = "device_type", length = 50)
    private String deviceType;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    /** SHA-256(userAgent + ":" + ipAddress) — used for new-device detection. */
    @Column(name = "fingerprint_hash", length = 64)
    private String fingerprintHash;

    @Column(name = "last_active", nullable = false)
    private Instant lastActive = Instant.now();

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "revoked", nullable = false)
    private boolean revoked = false;

    @Column(name = "revoked_at")
    private Instant revokedAt;
}
