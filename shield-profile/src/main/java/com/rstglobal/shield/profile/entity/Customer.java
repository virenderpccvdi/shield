package com.rstglobal.shield.profile.entity;

import com.rstglobal.shield.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "profile", name = "customers")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Customer extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "name", length = 150)
    private String name;

    @Column(name = "email", length = 254)
    private String email;

    @Column(name = "subscription_plan", nullable = false, length = 50)
    private String subscriptionPlan;

    @Column(name = "subscription_status", nullable = false, length = 30)
    private String subscriptionStatus;

    @Column(name = "subscription_expires_at")
    private Instant subscriptionExpiresAt;

    @Column(name = "max_profiles", nullable = false)
    private int maxProfiles;

    @Column(name = "stripe_customer_id")
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id")
    private String stripeSubscriptionId;
}
