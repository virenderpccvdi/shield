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

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
