package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "admin", name = "isp_branding")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IspBranding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, unique = true)
    private UUID tenantId;

    @Column(name = "app_name", nullable = false)
    @Builder.Default
    private String appName = "Shield";

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "primary_color")
    @Builder.Default
    private String primaryColor = "#1565C0";

    @Column(name = "secondary_color")
    @Builder.Default
    private String secondaryColor = "#42A5F5";

    @Column(name = "support_email")
    private String supportEmail;

    @Column(name = "support_phone")
    private String supportPhone;

    @Column(name = "website_url")
    private String websiteUrl;

    @Column(name = "app_bundle_id")
    private String appBundleId;

    @Column(name = "play_store_url")
    private String playStoreUrl;

    @Column(name = "custom_domain")
    private String customDomain;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
