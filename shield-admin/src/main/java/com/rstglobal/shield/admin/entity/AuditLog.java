package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "audit_logs", schema = "admin",
       indexes = {
           @Index(name = "idx_audit_user", columnList = "userId"),
           @Index(name = "idx_audit_action", columnList = "action"),
           @Index(name = "idx_audit_created", columnList = "createdAt"),
       })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;

    @Column(length = 200)
    private String userName;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(length = 50)
    private String resourceType;

    @Column(length = 200)
    private String resourceId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> details;

    @Column(length = 45)
    private String ipAddress;

    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime createdAt;
}
