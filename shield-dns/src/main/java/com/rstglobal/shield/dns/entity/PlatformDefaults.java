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

@Entity
@Table(schema = "dns", name = "platform_defaults")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PlatformDefaults {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

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

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
