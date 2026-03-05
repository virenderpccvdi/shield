package com.rstglobal.shield.analytics.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(schema = "analytics", name = "usage_summaries")
@Getter
@Setter
@NoArgsConstructor
public class UsageSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "summary_date", nullable = false)
    private LocalDate summaryDate;

    @Column(name = "total_queries")
    private Long totalQueries = 0L;

    @Column(name = "blocked_queries")
    private Long blockedQueries = 0L;

    @Column(name = "allowed_queries")
    private Long allowedQueries = 0L;

    @Column(name = "top_blocked_json", columnDefinition = "jsonb")
    private String topBlockedJson;

    @Column(name = "top_allowed_json", columnDefinition = "jsonb")
    private String topAllowedJson;

    @Column(name = "category_breakdown_json", columnDefinition = "jsonb")
    private String categoryBreakdownJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
