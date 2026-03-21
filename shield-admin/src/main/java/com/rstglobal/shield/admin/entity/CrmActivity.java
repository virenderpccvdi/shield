package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "crm_activities", schema = "admin",
       indexes = @Index(name = "idx_activities_lead", columnList = "leadId"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CrmActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID leadId;

    @Column(nullable = false, length = 20)
    private String type;  // NOTE, CALL, EMAIL, MEETING, TASK

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String outcome;

    private UUID performedBy;

    @Column(length = 255)
    private String performedByName;

    private OffsetDateTime performedAt;

    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime createdAt;
}
