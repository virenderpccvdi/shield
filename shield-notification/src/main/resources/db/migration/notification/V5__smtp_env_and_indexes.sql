-- V5: Secure SMTP — remove plaintext password from platform channel + performance indexes

-- SEC-01: Clear plaintext SMTP password from the platform-default channel.
-- The password is now read from the SMTP_PASS environment variable via EmailService.
UPDATE notification.notification_channels
SET    smtp_password = NULL
WHERE  tenant_id IS NULL
  AND  channel_type = 'SMTP';

-- Index: speed up findEffective() which queries by (tenant_id, channel_type)
CREATE INDEX IF NOT EXISTS idx_notif_channels_tenant_type
    ON notification.notification_channels (tenant_id, channel_type);

-- Index: notification history queries by user, status, and time
CREATE INDEX IF NOT EXISTS idx_notifications_user_status_created
    ON notification.notifications (user_id, status, created_at DESC);
