package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "website_visitors", schema = "admin",
       indexes = {
           @Index(name = "idx_visitors_visited", columnList = "visitedAt"),
           @Index(name = "idx_visitors_country", columnList = "country"),
       })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WebsiteVisitor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(length = 64)
    private String sessionId;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 100)
    private String country;

    @Column(length = 100)
    private String region;

    @Column(length = 100)
    private String city;

    private Double latitude;
    private Double longitude;

    @Column(length = 500)
    private String pagePath;

    @Column(length = 500)
    private String referrer;

    @Column(columnDefinition = "TEXT")
    private String userAgent;

    private Boolean isMobile;

    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime visitedAt;
}
