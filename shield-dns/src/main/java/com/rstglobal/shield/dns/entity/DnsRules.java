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

    /** Filter level: STRICT, MODERATE, or MINIMAL. Synced from profile.child_profiles. */
    @Column(name = "filter_level", nullable = false)
    @Builder.Default
    private String filterLevel = "MODERATE";

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

    // ── PC-05: YouTube Safe Mode (DNS CNAME rewrite) ─────────────────────────

    /**
     * When true, youtube.com / www.youtube.com / m.youtube.com are rewritten
     * via AdGuard DNS CNAME to restrict.youtube.com (YouTube Restricted Mode).
     * This is a DNS-level enforcement, stronger than the per-client safe-search flag.
     */
    @Column(name = "youtube_safe_mode", nullable = false)
    @Builder.Default
    private boolean youtubeSafeMode = false;

    // ── PC-06: Safe Search Enforcer (DNS CNAME rewrite) ──────────────────────

    /**
     * When true, major search engines are redirected to their safe-search endpoints
     * via AdGuard DNS CNAME rewrites:
     *   google.com / www.google.com → forcesafesearch.google.com
     *   www.bing.com → strict.bing.com
     *   duckduckgo.com → safe.duckduckgo.com
     */
    @Column(name = "safe_search", nullable = false)
    @Builder.Default
    private boolean safeSearch = false;

    // ── Bedtime Lock ──────────────────────────────────────────────────────────

    /** PC-01 — Whether the bedtime internet lock is configured for this profile. */
    @Column(name = "bedtime_enabled", nullable = false)
    @Builder.Default
    private boolean bedtimeEnabled = false;

    /** Time at which bedtime lock activates (e.g. 21:00). */
    @Column(name = "bedtime_start")
    private java.time.LocalTime bedtimeStart;

    /** Time at which bedtime lock deactivates (e.g. 07:00). */
    @Column(name = "bedtime_end")
    private java.time.LocalTime bedtimeEnd;

    // ── Homework Mode ─────────────────────────────────────────────────────────

    // ── Social Media Blocking ─────────────────────────────────────────────────

    /** Block facebook.com and all Meta domains at DNS level. */
    @Column(name = "facebook_blocked", nullable = false)
    @Builder.Default
    private boolean facebookBlocked = false;

    /** Block instagram.com at DNS level. */
    @Column(name = "instagram_blocked", nullable = false)
    @Builder.Default
    private boolean instagramBlocked = false;

    /** Block tiktok.com at DNS level. */
    @Column(name = "tiktok_blocked", nullable = false)
    @Builder.Default
    private boolean tiktokBlocked = false;

    /** Whether homework mode is currently active for this profile. */
    @Column(name = "homework_mode_active", nullable = false)
    @Builder.Default
    private Boolean homeworkModeActive = false;

    /** Timestamp when homework mode automatically expires. Null when inactive. */
    @Column(name = "homework_mode_ends_at")
    private OffsetDateTime homeworkModeEndsAt;

    /**
     * JSON snapshot of the custom_blocklist at the time homework mode was activated.
     * Stored as a raw JSON string so it can be restored on deactivation without
     * triggering JSONB column mapping issues.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "homework_mode_snapshot", columnDefinition = "jsonb")
    private String homeworkModeSnapshot;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
