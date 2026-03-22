package com.rstglobal.shield.location.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "location", name = "device_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false, unique = true)
    private UUID profileId;

    @Column(name = "battery_threshold", nullable = false)
    @Builder.Default
    private int batteryThreshold = 20;

    @Column(name = "last_battery_pct")
    private Integer lastBatteryPct;

    @Column(name = "last_alert_at")
    private OffsetDateTime lastAlertAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
