package com.rstglobal.shield.profile.entity;

import com.rstglobal.shield.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "profile", name = "devices")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Device extends BaseEntity {

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "device_type", length = 50)
    private String deviceType;

    @Column(name = "mac_address", length = 50)
    private String macAddress;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "is_online", nullable = false)
    @Builder.Default
    private boolean online = false;

    @Column(name = "dns_method", length = 20)
    @Builder.Default
    private String dnsMethod = "DOH";

    @Column(name = "battery_pct")
    private Integer batteryPct;

    @Column(name = "speed_kmh", precision = 6, scale = 1)
    private BigDecimal speedKmh;

    @Column(name = "app_version", length = 20)
    private String appVersion;
}
