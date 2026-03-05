package com.rstglobal.shield.analytics.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "analytics", name = "dns_query_logs")
@Getter
@Setter
@NoArgsConstructor
public class DnsQueryLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "domain", nullable = false, length = 255)
    private String domain;

    @Column(name = "action", nullable = false, length = 20)
    private String action;

    @Column(name = "category", length = 100)
    private String category;

    @Column(name = "client_ip", length = 45)
    private String clientIp;

    @Column(name = "queried_at", nullable = false)
    private Instant queriedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (queriedAt == null) {
            queriedAt = Instant.now();
        }
    }
}
