package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Approval request submitted by the child app when a domain is blocked.
 * Parent approves or denies from an FCM notification or the parent app.
 */
@Entity
@Table(schema = "dns", name = "approval_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApprovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "customer_id")
    private UUID customerId;

    /** The domain being requested (for DOMAIN type requests). */
    @Column(name = "domain", length = 255)
    private String domain;

    /** The app package name being requested (for APP type requests). */
    @Column(name = "app_package", length = 255)
    private String appPackage;

    /** DOMAIN or APP */
    @Column(name = "request_type", nullable = false, length = 10)
    @Builder.Default
    private String requestType = "DOMAIN";

    /** PENDING / APPROVED / DENIED / EXPIRED */
    @Column(name = "status", nullable = false, length = 10)
    @Builder.Default
    private String status = "PENDING";

    /** ONE_HOUR / TODAY / PERMANENT — set when approved */
    @Column(name = "duration_type", length = 10)
    private String durationType;

    /** When the temporary allowlist entry expires (ONE_HOUR and TODAY only). */
    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** When the parent took action. */
    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    /** User ID of the parent who approved/denied. */
    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
