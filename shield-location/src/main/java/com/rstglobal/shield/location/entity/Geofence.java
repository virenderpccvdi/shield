package com.rstglobal.shield.location.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "location", name = "geofences")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Geofence {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "center_lat", nullable = false, precision = 10, scale = 8)
    private BigDecimal centerLat;

    @Column(name = "center_lng", nullable = false, precision = 11, scale = 8)
    private BigDecimal centerLng;

    @Column(name = "radius_meters", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal radiusMeters = BigDecimal.valueOf(100);

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "alert_on_enter")
    @Builder.Default
    private Boolean alertOnEnter = true;

    @Column(name = "alert_on_exit")
    @Builder.Default
    private Boolean alertOnExit = true;

    /** CS-07: marks this geofence as the child's school zone */
    @Column(name = "is_school")
    @Builder.Default
    private Boolean isSchool = false;

    /** CS-07: start of school hours — exits before this time during school hours trigger an alert */
    @Column(name = "school_start")
    private LocalTime schoolStart;

    /** CS-07: end of school hours — exits after this time are treated as normal departures */
    @Column(name = "school_end")
    private LocalTime schoolEnd;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
