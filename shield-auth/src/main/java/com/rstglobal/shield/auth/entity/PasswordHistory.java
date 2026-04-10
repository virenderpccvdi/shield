package com.rstglobal.shield.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Stores a user's previous password hashes so we can prevent reuse
 * of the last N passwords (AU10 — password history policy).
 */
@Entity
@Table(
    schema = "auth",
    name   = "password_history",
    indexes = {
        @Index(name = "idx_password_history_user", columnList = "user_id, created_at DESC")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PasswordHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    public PasswordHistory(UUID userId, String passwordHash) {
        this.userId       = userId;
        this.passwordHash = passwordHash;
    }
}
