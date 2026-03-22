package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "dns", name = "app_time_budgets",
       uniqueConstraints = @UniqueConstraint(columnNames = {"profile_id", "domain_pattern"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppTimeBudget {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "app_name", nullable = false, length = 100)
    private String appName;

    @Column(name = "domain_pattern", nullable = false, length = 255)
    private String domainPattern;

    @Column(name = "daily_minutes", nullable = false)
    @Builder.Default
    private int dailyMinutes = 60;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
