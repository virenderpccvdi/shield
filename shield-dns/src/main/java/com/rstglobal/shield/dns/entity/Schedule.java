package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Weekly schedule grid for a child profile.
 * Grid: map of day → 24-element int array (0=allowed, 1=blocked).
 */
@Entity
@Table(schema = "dns", name = "schedules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false, unique = true)
    private UUID profileId;

    /** {monday: [0,0,...1,1,...], tuesday: [...], ...} — 24 ints per day */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "grid", columnDefinition = "jsonb")
    private Map<String, List<Integer>> grid;

    @Column(name = "active_preset", length = 50)
    private String activePreset;

    @Column(name = "override_active", nullable = false)
    @Builder.Default
    private Boolean overrideActive = false;

    /** PAUSE | HOMEWORK | FOCUS | BEDTIME_NOW */
    @Column(name = "override_type", length = 30)
    private String overrideType;

    @Column(name = "override_ends_at")
    private OffsetDateTime overrideEndsAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
