-- V4: Performance indexes on notification schema.
-- Addresses CRITICAL-02 (tenant), MEDIUM-08 (resource indexing) from DB audit.

-- ── notifications ───────────────────────────────────────────────────────────
-- Profile-scoped notifications (lookup by child profile)
CREATE INDEX IF NOT EXISTS idx_notifications_profile_id
    ON notification.notifications(profile_id)
    WHERE profile_id IS NOT NULL;

-- Unread count query — single index for countUnreadByUserId()
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notification.notifications(user_id, status)
    WHERE status IN ('PENDING', 'DELIVERED');

-- Tenant-scoped admin queries
CREATE INDEX IF NOT EXISTS idx_notifications_tenant
    ON notification.notifications(tenant_id);

-- ── alert_preferences ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alert_preferences_tenant
    ON notification.alert_preferences(tenant_id);

-- ── device_tokens ───────────────────────────────────────────────────────────
-- FCM token lookup for push notifications (platform filter)
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_platform
    ON notification.device_tokens(user_id, platform);

-- ── check constraint on notification status ─────────────────────────────────
-- Guards against bad status values inserted via bugs or direct DB access.
ALTER TABLE notification.notifications
    DROP CONSTRAINT IF EXISTS chk_notif_status;
ALTER TABLE notification.notifications
    ADD CONSTRAINT chk_notif_status
    CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ'));
