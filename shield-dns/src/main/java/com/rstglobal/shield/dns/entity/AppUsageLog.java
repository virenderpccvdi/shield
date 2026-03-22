package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "dns", name = "app_usage_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppUsageLog {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "app_name", nullable = false, length = 100)
    private String appName;

    @Column(name = "domain_pattern", nullable = false, length = 255)
    private String domainPattern;

    @Column(name = "usage_date", nullable = false)
    @Builder.Default
    private LocalDate usageDate = LocalDate.now();

    @Column(name = "used_minutes", nullable = false)
    @Builder.Default
    private int usedMinutes = 0;

    @Column(name = "budget_depleted", nullable = false)
    @Builder.Default
    private boolean budgetDepleted = false;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
