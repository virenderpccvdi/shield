package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Master domain → category mapping.
 * 600+ priority entries seeded by V19, extensible by admin.
 * Stored in dns.domain_blocklist.
 */
@Entity
@Table(schema = "dns", name = "domain_blocklist")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DomainBlocklist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 253)
    private String domain;

    @Column(name = "category_id", nullable = false, length = 4)
    private String categoryId;

    @Column(name = "app_name", length = 128)
    private String appName;

    @Column(name = "is_cdn", nullable = false)
    private boolean cdn;

    @Column(name = "is_api", nullable = false)
    private boolean api;

    @Column(name = "is_wildcard", nullable = false)
    private boolean wildcard;

    @Column(nullable = false, precision = 4, scale = 3)
    private java.math.BigDecimal confidence;

    @Column(length = 64)
    private String source;

    @Column(name = "last_verified")
    private LocalDate lastVerified;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}
