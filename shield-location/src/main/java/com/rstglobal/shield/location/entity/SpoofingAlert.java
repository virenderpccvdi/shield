package com.rstglobal.shield.location.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "location", name = "spoofing_alerts",
       indexes = {
           @Index(name = "idx_spoofing_profile_time", columnList = "profile_id, detected_at")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpoofingAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "signal_type", nullable = false, length = 50)
    private String signalType;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @CreationTimestamp
    @Column(name = "detected_at", nullable = false, updatable = false)
    private OffsetDateTime detectedAt;
}
