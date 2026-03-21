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
 * Per-profile DNS filtering rules.
 * One record per child profile; created automatically when profile is created.
 */
@Entity
@Table(schema = "dns", name = "dns_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DnsRules {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false, unique = true)
    private UUID profileId;

    @Column(name = "dns_client_id")
    private String dnsClientId;

    /** Map of category key → enabled (true=allowed, false=blocked) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "enabled_categories", columnDefinition = "jsonb")
    private Map<String, Boolean> enabledCategories;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_allowlist", columnDefinition = "jsonb")
    private List<String> customAllowlist;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_blocklist", columnDefinition = "jsonb")
    private List<String> customBlocklist;

    @Column(name = "safesearch_enabled", nullable = false)
    @Builder.Default
    private Boolean safesearchEnabled = true;

    @Column(name = "youtube_restricted", nullable = false)
    @Builder.Default
    private Boolean youtubeRestricted = true;

    @Column(name = "ads_blocked", nullable = false)
    @Builder.Default
    private Boolean adsBlocked = true;

    /** Map of service key → daily limit in minutes (0 = no limit) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "time_budgets", columnDefinition = "jsonb")
    private Map<String, Integer> timeBudgets;

    /**
     * Simple total daily internet budget in minutes.
     * NULL means no limit. When set, BudgetTrackingService enforces a hard cutoff
     * once the child has been online for this many minutes today.
     * Tracked via Redis key: shield:budget:{profileId}:{date} (incremented every minute
     * when the profile shows DNS activity in the last 2 minutes).
     */
    @Column(name = "daily_budget_minutes")
    private Integer dailyBudgetMinutes;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
