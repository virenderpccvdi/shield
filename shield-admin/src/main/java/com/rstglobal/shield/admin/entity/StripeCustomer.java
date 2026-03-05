package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "stripe_customers", schema = "admin")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StripeCustomer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID userId;

    private UUID tenantId;

    @Column(nullable = false, unique = true)
    private String stripeCustomerId;

    @Column(nullable = false)
    private String email;

    @CreationTimestamp
    private OffsetDateTime createdAt;
}
