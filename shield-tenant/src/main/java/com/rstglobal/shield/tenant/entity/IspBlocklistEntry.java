package com.rstglobal.shield.tenant.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "isp_blocklist", schema = "tenant",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_isp_blocklist_tenant_domain",
                columnNames = {"tenant_id", "domain"}
        ),
        indexes = {
            @Index(name = "idx_isp_blocklist_tenant_id",  columnList = "tenant_id"),
            @Index(name = "idx_isp_blocklist_domain",     columnList = "domain"),
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IspBlocklistEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 255)
    private String domain;

    @Column(length = 500)
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
