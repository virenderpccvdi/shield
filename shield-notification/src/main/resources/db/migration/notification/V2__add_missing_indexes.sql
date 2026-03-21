-- V2: Add missing indexes for notification service tables
-- Note: idx_notif_user (user_id, status), idx_notif_customer, idx_device_tokens_user already exist from V1

-- Index for notification_channels tenant + type lookup (no index existed on this table)
CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant_type
  ON notification.notification_channels(tenant_id, channel_type);

-- Index for notifications by user + read status (inbox queries using read_at IS NULL for unread)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
  ON notification.notifications(user_id, read_at, created_at DESC);

-- Index for notifications by tenant + created (admin/tenant-wide queries)
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created
  ON notification.notifications(tenant_id, created_at DESC);
