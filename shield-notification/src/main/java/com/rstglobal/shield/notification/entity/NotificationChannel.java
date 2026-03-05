package com.rstglobal.shield.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Global Admin configures delivery channel credentials per tenant.
 * SMTP, WhatsApp (Twilio / 360dialog), Telegram Bot.
 * tenant_id = null means platform-wide default (Global Admin).
 */
@Entity
@Table(schema = "notification", name = "notification_channels",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "channel_type"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NotificationChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** NULL = platform default used by all tenants */
    @Column(name = "tenant_id")
    private UUID tenantId;

    /** SMTP | WHATSAPP | TELEGRAM */
    @Column(name = "channel_type", nullable = false, length = 20)
    private String channelType;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = false;

    // ── SMTP fields ────────────────────────────────────────────────────────
    @Column(name = "smtp_host", length = 200)
    private String smtpHost;

    @Column(name = "smtp_port")
    private Integer smtpPort;

    @Column(name = "smtp_username", length = 200)
    private String smtpUsername;

    @Column(name = "smtp_password", length = 500)
    private String smtpPassword;

    @Column(name = "smtp_from_email", length = 200)
    private String smtpFromEmail;

    @Column(name = "smtp_from_name", length = 100)
    private String smtpFromName;

    @Column(name = "smtp_tls", nullable = false)
    @Builder.Default
    private Boolean smtpTls = true;

    // ── WhatsApp fields (Twilio / 360dialog) ─────────────────────────────
    @Column(name = "whatsapp_api_url", length = 500)
    private String whatsappApiUrl;

    @Column(name = "whatsapp_api_key", length = 500)
    private String whatsappApiKey;

    @Column(name = "whatsapp_from_number", length = 30)
    private String whatsappFromNumber;

    // ── Telegram fields ───────────────────────────────────────────────────
    @Column(name = "telegram_bot_token", length = 500)
    private String telegramBotToken;

    @Column(name = "telegram_bot_username", length = 100)
    private String telegramBotUsername;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
