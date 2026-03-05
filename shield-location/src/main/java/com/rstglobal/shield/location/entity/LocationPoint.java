package com.rstglobal.shield.location.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "location", name = "location_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "latitude", nullable = false, precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(name = "longitude", nullable = false, precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "accuracy", precision = 8, scale = 2)
    private BigDecimal accuracy;

    @Column(name = "altitude", precision = 10, scale = 2)
    private BigDecimal altitude;

    @Column(name = "speed", precision = 8, scale = 2)
    private BigDecimal speed;

    @Column(name = "heading", precision = 6, scale = 2)
    private BigDecimal heading;

    @Column(name = "battery_pct")
    private Integer batteryPct;

    @Column(name = "is_moving")
    @Builder.Default
    private Boolean isMoving = false;

    @Column(name = "recorded_at", nullable = false)
    private OffsetDateTime recordedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
