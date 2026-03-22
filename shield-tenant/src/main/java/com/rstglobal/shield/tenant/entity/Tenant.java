package com.rstglobal.shield.tenant.entity;

import com.rstglobal.shield.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * An ISP or reseller that has licensed Shield.
 * Each tenant has its own branding, feature flags, and quotas.
 */
@Entity
@Table(
    schema = "tenant",
    name = "tenants",
    indexes = {
        @Index(name = "idx_tenants_slug",   columnList = "slug",   unique = true),
        @Index(name = "idx_tenants_active", columnList = "is_active")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Tenant extends BaseEntity {

    /** Human-readable slug used in subdomains / API keys. e.g. "rst-isp" */
    @Column(nullable = false, unique = true, length = 63)
    private String slug;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 254)
    private String contactEmail;

    @Column(length = 20)
    private String contactPhone;

    /** Optional custom logo URL */
    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "primary_color", length = 9)
    @Builder.Default
    private String primaryColor = "#1565C0";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TenantPlan plan = TenantPlan.STARTER;

    @Column(name = "max_customers")
    @Builder.Default
    private int maxCustomers = 100;

    @Column(name = "max_profiles_per_customer")
    @Builder.Default
    private int maxProfilesPerCustomer = 5;

    /** JSON feature flags — e.g. {"ai_monitoring": true, "gps_tracking": false} */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "features", columnDefinition = "jsonb")
    private Map<String, Boolean> features;

    @Column(name = "is_active")
    @Builder.Default
    private boolean active = true;

    @Column(name = "trial_ends_at")
    private Instant trialEndsAt;

    @Column(name = "subscription_ends_at")
    private Instant subscriptionEndsAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // ── White-label branding fields ──────────────────────────────────────────

    /** ISP brand name shown in customer-facing UI (e.g. "Acme Broadband"). */
    @Column(name = "brand_name", length = 200)
    private String brandName;

    /** ISP brand primary color (hex) for customer-facing UI. */
    @Column(name = "brand_color", length = 20)
    @Builder.Default
    private String brandColor = "#00897B";

    /** ISP brand logo URL for customer-facing UI. */
    @Column(name = "brand_logo_url", length = 500)
    private String brandLogoUrl;

    /** ISP customer support email shown to end-users. */
    @Column(name = "support_email", length = 255)
    private String supportEmail;

    /** ISP customer support phone shown to end-users. */
    @Column(name = "support_phone", length = 50)
    private String supportPhone;
}
