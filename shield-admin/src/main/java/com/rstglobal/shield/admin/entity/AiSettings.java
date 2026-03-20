package com.rstglobal.shield.admin.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_settings", schema = "admin")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AiSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** AI provider identifier: DEEPSEEK | ANTHROPIC | OPENAI */
    @Column(nullable = false, length = 50)
    @Builder.Default
    private String provider = "DEEPSEEK";

    /** Primary model name (e.g. deepseek-chat, claude-haiku-4-5-20251001) */
    @Column(nullable = false, length = 100)
    @Builder.Default
    private String modelName = "deepseek-chat";

    /** Optional lighter/faster model for quick operations */
    @Column(length = 100)
    private String fastModelName;

    /** API key stored as-is; mask when returning to clients */
    @Column(length = 500)
    private String apiKeyEncrypted;

    /** Optional URL override (leave null to use provider default) */
    @Column(length = 500)
    private String apiBaseUrl;

    @Column
    @Builder.Default
    private Integer maxTokens = 2000;

    @Column
    @Builder.Default
    private Double temperature = 0.7;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column
    private LocalDateTime updatedAt;

    @Column(length = 200)
    private String updatedBy;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }
}
