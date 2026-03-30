package com.rstglobal.shield.profile.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "device_pairing_codes", schema = "profile")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DevicePairingCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID profileId;

    @Column(nullable = false, length = 6)
    private String code;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String platform = "windows";

    @Column(nullable = false)
    @Builder.Default
    private boolean used = false;

    @Column(nullable = false)
    private Instant expiresAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
