package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "global_blocklist", schema = "admin",
        indexes = {
            @Index(name = "idx_global_blocklist_domain",    columnList = "domain",       unique = true),
            @Index(name = "idx_global_blocklist_emergency", columnList = "is_emergency"),
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GlobalBlocklistEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String domain;

    @Column(length = 500)
    private String reason;

    @Column(name = "is_emergency", nullable = false)
    @Builder.Default
    private boolean emergency = false;

    @Column(name = "added_by")
    private UUID addedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
