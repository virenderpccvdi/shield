package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * FC-02: Screen Time Request
 * A child submits this when they want more screen time.
 * The parent approves or denies from the dashboard or parent app.
 */
@Entity
@Table(schema = "dns", name = "screen_time_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScreenTimeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** The child's profile. */
    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    /** The parent customer (used to route FCM notifications). */
    @Column(name = "customer_id")
    private UUID customerId;

    /** Number of extra minutes requested. */
    @Column(name = "minutes", nullable = false)
    private Integer minutes;

    /** Optional reason provided by the child. */
    @Column(name = "reason")
    private String reason;

    /** PENDING | APPROVED | DENIED | EXPIRED */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @CreationTimestamp
    @Column(name = "requested_at", nullable = false, updatable = false)
    private OffsetDateTime requestedAt;

    /** When the parent made a decision. */
    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    /** User ID of the parent who decided. */
    @Column(name = "decided_by")
    private UUID decidedBy;

    /** When an APPROVED grant expires (requestedAt + minutes). */
    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;
}
