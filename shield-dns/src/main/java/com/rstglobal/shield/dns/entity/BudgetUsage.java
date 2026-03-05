package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Daily time budget usage per profile.
 * One record per profile per day. Redis is primary; this is the persistent backup.
 */
@Entity
@Table(schema = "dns", name = "budget_usage",
        uniqueConstraints = @UniqueConstraint(columnNames = {"profile_id", "date"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BudgetUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "profile_id", nullable = false)
    private UUID profileId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    /** {youtube: 45, tiktok: 20, total: 90} — minutes used today */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "app_usage", columnDefinition = "jsonb")
    private Map<String, Integer> appUsage;
}
