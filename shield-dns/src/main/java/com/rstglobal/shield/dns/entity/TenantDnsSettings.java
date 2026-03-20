package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(schema = "dns", name = "tenant_dns_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TenantDnsSettings {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, unique = true)
    private UUID tenantId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "enabled_categories", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Boolean> enabledCategories = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_allowlist", columnDefinition = "jsonb")
    @Builder.Default
    private List<String> customAllowlist = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_blocklist", columnDefinition = "jsonb")
    @Builder.Default
    private List<String> customBlocklist = new ArrayList<>();

    @Column(name = "safesearch_enabled", nullable = false)
    @Builder.Default
    private Boolean safesearchEnabled = true;

    @Column(name = "ads_blocked", nullable = false)
    @Builder.Default
    private Boolean adsBlocked = true;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
