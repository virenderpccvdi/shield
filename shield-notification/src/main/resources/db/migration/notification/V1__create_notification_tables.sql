-- Shield Notification — V1: Create notification schema tables

CREATE SCHEMA IF NOT EXISTS notification;

-- Persisted notification records
CREATE TABLE notification.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    customer_id UUID,
    profile_id  UUID,
    type        VARCHAR(50)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        VARCHAR(1000) NOT NULL,
    action_url  VARCHAR(500),
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    email_sent  BOOLEAN      NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user     ON notification.notifications(user_id, status);
CREATE INDEX idx_notif_customer ON notification.notifications(customer_id, created_at DESC);

-- Device push tokens (FCM / APNs — ready for future use)
CREATE TABLE notification.device_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    platform     VARCHAR(20)  NOT NULL,
    token        VARCHAR(1000) NOT NULL,
    device_name  VARCHAR(100),
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, token)
);
CREATE INDEX idx_device_tokens_user ON notification.device_tokens(user_id, active);

-- Per-user alert preferences
CREATE TABLE notification.alert_preferences (
    user_id               UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL,
    push_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_start_hour      INTEGER DEFAULT 22,
    quiet_end_hour        INTEGER DEFAULT 7,
    block_alerts          BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_alerts       BOOLEAN NOT NULL DEFAULT TRUE,
    budget_alerts         BOOLEAN NOT NULL DEFAULT TRUE,
    extension_alerts      BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_number       VARCHAR(20),
    telegram_chat_id      VARCHAR(50),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global/tenant notification channel configuration (SMTP, WhatsApp, Telegram)
CREATE TABLE notification.notification_channels (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID,                         -- NULL = platform default
    channel_type          VARCHAR(20) NOT NULL,         -- SMTP | WHATSAPP | TELEGRAM
    enabled               BOOLEAN NOT NULL DEFAULT FALSE,
    -- SMTP
    smtp_host             VARCHAR(200),
    smtp_port             INTEGER DEFAULT 587,
    smtp_username         VARCHAR(200),
    smtp_password         VARCHAR(500),
    smtp_from_email       VARCHAR(200),
    smtp_from_name        VARCHAR(100),
    smtp_tls              BOOLEAN DEFAULT TRUE,
    -- WhatsApp
    whatsapp_api_url      VARCHAR(500),
    whatsapp_api_key      VARCHAR(500),
    whatsapp_from_number  VARCHAR(30),
    -- Telegram
    telegram_bot_token    VARCHAR(500),
    telegram_bot_username VARCHAR(100),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, channel_type)
);
