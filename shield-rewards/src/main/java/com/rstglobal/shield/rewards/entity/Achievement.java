package com.rstglobal.shield.rewards.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "achievements", schema = "rewards",
        uniqueConstraints = @UniqueConstraint(columnNames = {"profile_id", "badge_type"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Achievement {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "badge_type", nullable = false, length = 50)
    private String badgeType;

    @Column(name = "badge_name", nullable = false, length = 100)
    private String badgeName;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "earned_at", nullable = false)
    private OffsetDateTime earnedAt = OffsetDateTime.now();
}
