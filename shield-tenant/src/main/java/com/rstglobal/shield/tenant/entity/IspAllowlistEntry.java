package com.rstglobal.shield.tenant.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "tenant", name = "isp_allowlist")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IspAllowlistEntry {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(nullable = false) private String domain;
    private String reason;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
