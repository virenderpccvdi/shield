package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "invoices", schema = "admin")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID tenantId;
    private UUID customerId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String userEmail;

    private UUID planId;

    @Column(nullable = false, length = 50)
    private String planName;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "INR";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    private String stripeInvoiceId;
    private String stripePaymentIntentId;
    private String stripeCheckoutSessionId;
    private String stripeSubscriptionId;

    @Column(columnDefinition = "text")
    private String pdfUrl;

    private OffsetDateTime billingPeriodStart;
    private OffsetDateTime billingPeriodEnd;

    @CreationTimestamp
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    private OffsetDateTime updatedAt;
}
