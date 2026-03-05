package com.rstglobal.shield.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Per-user alert delivery preferences.
 * Controls which channels (push, email, WhatsApp, Telegram) and quiet hours.
 */
@Entity
@Table(schema = "notification", name = "alert_preferences")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AlertPreference {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    // ── Channel toggles ────────────────────────────────────────────────────
    @Column(name = "push_enabled", nullable = false)
    @Builder.Default
    private Boolean pushEnabled = true;

    @Column(name = "email_enabled", nullable = false)
    @Builder.Default
    private Boolean emailEnabled = true;

    @Column(name = "whatsapp_enabled", nullable = false)
    @Builder.Default
    private Boolean whatsappEnabled = false;

    @Column(name = "telegram_enabled", nullable = false)
    @Builder.Default
    private Boolean telegramEnabled = false;

    // ── Quiet hours (no alerts during sleep) ─────────────────────────────
    @Column(name = "quiet_hours_enabled", nullable = false)
    @Builder.Default
    private Boolean quietHoursEnabled = false;

    /** 0–23 hour (inclusive start) */
    @Column(name = "quiet_start_hour")
    @Builder.Default
    private Integer quietStartHour = 22;

    /** 0–23 hour (exclusive end) */
    @Column(name = "quiet_end_hour")
    @Builder.Default
    private Integer quietEndHour = 7;

    // ── Alert type toggles ─────────────────────────────────────────────────
    @Column(name = "block_alerts", nullable = false)
    @Builder.Default
    private Boolean blockAlerts = true;

    @Column(name = "schedule_alerts", nullable = false)
    @Builder.Default
    private Boolean scheduleAlerts = true;

    @Column(name = "budget_alerts", nullable = false)
    @Builder.Default
    private Boolean budgetAlerts = true;

    @Column(name = "extension_alerts", nullable = false)
    @Builder.Default
    private Boolean extensionAlerts = true;

    @Column(name = "weekly_report_enabled", nullable = false)
    @Builder.Default
    private Boolean weeklyReportEnabled = true;

    // ── External channel contacts ──────────────────────────────────────────
    @Column(name = "whatsapp_number", length = 20)
    private String whatsappNumber;

    @Column(name = "telegram_chat_id", length = 50)
    private String telegramChatId;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
