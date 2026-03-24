package com.rstglobal.shield.dns.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Master content category definition.
 * 30 categories from the complete internet filtering system.
 * Stored in dns.filter_categories, seeded by V19 migration.
 */
@Entity
@Table(schema = "dns", name = "filter_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FilterCategory {

    @Id
    @Column(name = "id", length = 4)
    private String id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "risk_level", nullable = false, length = 10)
    private String riskLevel;

    @Column(name = "blocked_starter", nullable = false)
    private boolean blockedStarter;

    @Column(name = "blocked_growth", nullable = false)
    private boolean blockedGrowth;

    @Column(name = "blocked_enterprise", nullable = false)
    private boolean blockedEnterprise;

    @Column(name = "always_block", nullable = false)
    private boolean alwaysBlock;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "icon_name", length = 64)
    private String iconName;

    @Column(name = "category_key", length = 64, unique = true)
    private String categoryKey;
}
