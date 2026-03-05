package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Time extension request submitted by the child app.
 * Parent approves/rejects in the parent app.
 */
@Entity
@Table(schema = "dns", name = "extension_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExtensionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "app_name", length = 100)
    private String appName;

    @Column(name = "requested_mins", nullable = false)
    private Integer requestedMins;

    @Column(name = "message")
    private String message;

    /** PENDING | APPROVED | REJECTED */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "responded_at")
    private OffsetDateTime respondedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
