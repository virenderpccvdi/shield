package com.rstglobal.shield.profile.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "profile", name = "device_apps")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeviceApp {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "package_name", nullable = false, length = 200)
    private String packageName;

    @Column(name = "app_name", length = 200)
    private String appName;

    @Column(name = "version_name", length = 50)
    private String versionName;

    @Column(name = "is_system_app")
    @Builder.Default
    private boolean systemApp = false;

    @Column(name = "is_blocked")
    @Builder.Default
    private boolean blocked = false;

    @Column(name = "time_limit_minutes")
    private Integer timeLimitMinutes;

    @Column(name = "usage_today_minutes")
    @Builder.Default
    private int usageTodayMinutes = 0;

    @Column(name = "last_reported_at")
    private Instant lastReportedAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (lastReportedAt == null) lastReportedAt = Instant.now();
    }
}
