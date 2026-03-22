package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PO-06 — Advanced Parental Control Schedule.
 * <p>
 * Each record defines a named access window for a child profile:
 * which days of the week (via bitmask) and between which times access is
 * permitted.  When {@code blockOutside} is true the scheduler inserts a
 * {@code __access_locked__} sentinel into {@code dns_rules.enabled_categories}
 * outside the window, cutting off all DNS resolution for the child.
 * <p>
 * Day bitmask: bit 0 = Monday, bit 1 = Tuesday, …, bit 6 = Sunday.
 * Default value 31 (0b0011111) = Mon–Fri.
 */
@Entity
@Table(schema = "dns", name = "access_schedules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccessSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    /** Human-readable label, e.g. "School Week" or "Weekend". */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** Whether this schedule rule is currently active. */
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    /**
     * Bitmask of days this rule applies to.
     * bit 0 = Monday, bit 1 = Tuesday, …, bit 6 = Sunday.
     * 31 (0b0011111) = Mon-Fri.
     */
    @Column(name = "days_bitmask", nullable = false)
    @Builder.Default
    private int daysBitmask = 31;

    /** Start of the allowed access window (inclusive). */
    @Column(name = "allow_start", nullable = false)
    @Builder.Default
    private LocalTime allowStart = LocalTime.of(7, 0);

    /** End of the allowed access window (exclusive). */
    @Column(name = "allow_end", nullable = false)
    @Builder.Default
    private LocalTime allowEnd = LocalTime.of(21, 0);

    /**
     * When true, DNS is blocked outside the allow_start..allow_end window
     * on the matching days.
     */
    @Column(name = "block_outside", nullable = false)
    @Builder.Default
    private boolean blockOutside = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
