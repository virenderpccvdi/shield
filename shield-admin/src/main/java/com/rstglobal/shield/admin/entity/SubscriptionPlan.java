package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "subscription_plans", schema = "admin")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(nullable = false, length = 100)
    private String displayName;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String billingCycle = "MONTHLY";

    @Column(nullable = false)
    @Builder.Default
    private Integer maxCustomers = 100;

    @Column(nullable = false)
    @Builder.Default
    private Integer maxProfilesPerCustomer = 5;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Boolean> features;

    @Column(length = 500)
    private String description;

    /** Null = global ISP plan (managed by GLOBAL_ADMIN). Set = customer plan created by this ISP_ADMIN tenant. */
    @Column(name = "tenant_id")
    private UUID tenantId;

    /** ISP = plan ISPs subscribe to (Global Admin manages). CUSTOMER = plan customers subscribe to (ISP Admin manages). */
    @Column(name = "plan_type", nullable = false, length = 20)
    @Builder.Default
    private String planType = "CUSTOMER";

    @Column(nullable = false)
    @Builder.Default
    private Boolean isDefault = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "stripe_price_id")
    private String stripePriceId;

    @Column(name = "stripe_product_id")
    private String stripeProductId;

    @CreationTimestamp
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    private OffsetDateTime updatedAt;
}
