package com.rstglobal.shield.location.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "checkin_reminder_settings", schema = "location")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckinReminderSettings {

    @Id
    private UUID id;

    @Column(name = "profile_id", nullable = false, unique = true)
    private UUID profileId;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "reminder_interval_min", nullable = false)
    private Integer reminderIntervalMin;

    @Column(name = "quiet_start")
    private LocalTime quietStart;

    @Column(name = "quiet_end")
    private LocalTime quietEnd;

    @Column(name = "last_reminder_sent")
    private OffsetDateTime lastReminderSent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (enabled == null) enabled = Boolean.TRUE;
        if (reminderIntervalMin == null) reminderIntervalMin = 60;
        if (createdAt == null) createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
