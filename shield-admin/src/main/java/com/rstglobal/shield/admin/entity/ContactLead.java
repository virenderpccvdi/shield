package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
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

    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    private OffsetDateTime updatedAt;
}
