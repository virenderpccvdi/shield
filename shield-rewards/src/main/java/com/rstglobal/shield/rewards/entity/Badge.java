package com.rstglobal.shield.rewards.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "badges", schema = "rewards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Badge {

    @Id
    @Column(name = "id", length = 50, nullable = false)
    private String id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", nullable = false, length = 255)
    private String description;

    @Column(name = "icon_emoji", nullable = false, length = 10)
    private String iconEmoji;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "threshold", nullable = false)
    private int threshold = 1;
}
