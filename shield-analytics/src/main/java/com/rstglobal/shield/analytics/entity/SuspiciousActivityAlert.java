package com.rstglobal.shield.analytics.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * CS-05: Suspicious Activity Alert — persisted detection of anomalous DNS patterns.
 */
@Entity
@Table(schema = "analytics", name = "suspicious_activity_alerts")
@Getter
@Setter
@NoArgsConstructor
public class SuspiciousActivityAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    /** BURST_BLOCKED | SUSPICIOUS_CATEGORY */
    @Column(name = "alert_type", nullable = false, length = 50)
    private String alertType;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    /** LOW | MEDIUM | HIGH */
    @Column(name = "severity", nullable = false, length = 20)
    private String severity = "MEDIUM";

    @Column(name = "detected_at", nullable = false)
    private Instant detectedAt;

    @Column(name = "acknowledged", nullable = false)
    private boolean acknowledged = false;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @PrePersist
    protected void onCreate() {
        if (detectedAt == null) detectedAt = Instant.now();
    }
}
