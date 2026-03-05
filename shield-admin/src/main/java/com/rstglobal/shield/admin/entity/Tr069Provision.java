package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(schema = "admin", name = "tr069_provisions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tr069Provision {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "device_serial", nullable = false)
    private String deviceSerial;

    @Column(name = "device_model")
    private String deviceModel;

    @Column(name = "mac_address")
    private String macAddress;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "dns_primary")
    private String dnsPrimary;

    @Column(name = "dns_secondary")
    private String dnsSecondary;

    @Column(name = "provision_status")
    @Builder.Default
    private String provisionStatus = "PENDING";

    @Column(name = "provisioned_at")
    private OffsetDateTime provisionedAt;

    @Column(name = "last_seen_at")
    private OffsetDateTime lastSeenAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_data", columnDefinition = "jsonb")
    private Map<String, Object> rawData;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
