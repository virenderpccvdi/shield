package com.rstglobal.shield.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "notification", name = "isp_communications",
    indexes = @Index(name = "idx_isp_comm_tenant", columnList = "tenant_id, sent_at DESC"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IspCommunication {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 300)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    /** EMAIL, PUSH, or BOTH */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String channel = "EMAIL";

    @Column(name = "sent_by", nullable = false)
    private UUID sentBy;

    @Column(name = "sent_at", nullable = false)
    @CreationTimestamp
    private Instant sentAt;

    @Column(name = "recipient_count", nullable = false)
    @Builder.Default
    private int recipientCount = 0;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "SENT";
}
