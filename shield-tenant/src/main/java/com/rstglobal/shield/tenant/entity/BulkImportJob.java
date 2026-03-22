package com.rstglobal.shield.tenant.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tracks the state of a CSV bulk-import job submitted by an ISP admin.
 * Not extending BaseEntity because the schema differs (no tenantId column from BaseEntity,
 * tenant_id is an explicit non-nullable column, and updated_at is manual).
 */
@Entity
@Table(
    schema = "tenant",
    name = "bulk_import_jobs",
    indexes = {
        @Index(name = "idx_bulk_import_tenant", columnList = "tenant_id, created_at")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BulkImportJob {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(length = 255)
    private String filename;

    @Column(name = "total_rows", nullable = false)
    @Builder.Default
    private int totalRows = 0;

    @Column(name = "success_rows", nullable = false)
    @Builder.Default
    private int successRows = 0;

    @Column(name = "failed_rows", nullable = false)
    @Builder.Default
    private int failedRows = 0;

    /** PENDING | PROCESSING | DONE | FAILED */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    /** List of per-row error messages stored as JSON array. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "error_details", columnDefinition = "jsonb")
    private List<String> errorDetails;

    @Column(name = "created_at", updatable = false, nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
