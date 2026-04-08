package com.rstglobal.shield.profile.entity;

import com.rstglobal.shield.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(schema = "profile", name = "child_profiles",
        uniqueConstraints = @UniqueConstraint(columnNames = "dns_client_id"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ChildProfile extends BaseEntity {

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "age_group", nullable = false, length = 20)
    @Builder.Default
    private String ageGroup = "CHILD";

    @Column(name = "dns_client_id", nullable = false, unique = true, length = 100)
    private String dnsClientId;

    @Column(name = "filter_level", nullable = false, length = 20)
    @Builder.Default
    private String filterLevel = "STRICT";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "battery_alert_enabled", nullable = false)
    @Builder.Default
    private boolean batteryAlertEnabled = true;

    @Column(name = "battery_alert_threshold", nullable = false)
    @Builder.Default
    private int batteryAlertThreshold = 20;
}
