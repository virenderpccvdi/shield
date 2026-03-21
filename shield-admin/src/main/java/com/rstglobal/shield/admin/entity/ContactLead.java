package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "contact_leads", schema = "admin",
       indexes = {
           @Index(name = "idx_leads_status", columnList = "status"),
           @Index(name = "idx_leads_created", columnList = "createdAt"),
       })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ContactLead {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(length = 30)
    private String phone;

    @Column(length = 255)
    private String company;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(length = 50)
    private String source;

    @Column(length = 20)
    private String status;  // NEW, CONTACTED, QUALIFIED, CLOSED

    @Column(columnDefinition = "TEXT")
    private String notes;

    private UUID assignedTo;

    @Column(length = 45)
    private String ipAddress;

    @Column(columnDefinition = "TEXT")
    private String userAgent;

    @Column(length = 20)
    private String pipelineStage;  // NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST

    @Column(precision = 12, scale = 2)
    private BigDecimal dealValue;

    private OffsetDateTime followUpAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> tags;

    @Column(length = 255)
    private String assignedToName;

    @Column(columnDefinition = "TEXT")
    private String lostReason;

    @Column(length = 100)
    private String country;

    @Column(length = 100)
    private String city;

    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    private OffsetDateTime updatedAt;
}
