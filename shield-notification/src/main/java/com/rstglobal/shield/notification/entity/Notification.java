package com.rstglobal.shield.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persisted notification record.
 * Mobile apps poll /api/v1/notifications/my to fetch unread items.
 * WebSocket STOMP delivers in real-time for online users.
 */
@Entity
@Table(schema = "notification", name = "notifications",
        indexes = {
                @Index(name = "idx_notif_user", columnList = "user_id, status"),
                @Index(name = "idx_notif_customer", columnList = "customer_id, created_at")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    /** Recipient user (parent) */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "customer_id")
    private UUID customerId;

    /** Optional — which child this notification is about */
    @Column(name = "profile_id")
    private UUID profileId;

    /**
     * BLOCK_ALERT | SCHEDULE_START | SCHEDULE_END | OVERRIDE_APPLIED |
     * EXTENSION_REQUESTED | EXTENSION_APPROVED | EXTENSION_REJECTED |
     * BUDGET_WARNING | BUDGET_EXCEEDED | DEVICE_ONLINE | DEVICE_OFFLINE |
     * WEEKLY_REPORT | WELCOME | SYSTEM
     */
    @Column(name = "type", nullable = false, length = 50)
    private String type;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "body", nullable = false, length = 1000)
    private String body;

    /** Optional deep-link for mobile (e.g. shield://rules/profileId) */
    @Column(name = "action_url", length = 500)
    private String actionUrl;

    /** PENDING | DELIVERED | READ | DISMISSED */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    /** Whether email was also sent */
    @Column(name = "email_sent", nullable = false)
    @Builder.Default
    private Boolean emailSent = false;

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
