-- V20: DNS rules change audit log
-- Tracks every time a parent modifies DNS rules, schedule, or time limits for a child profile.

CREATE TABLE IF NOT EXISTS dns.rules_audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID        NOT NULL,
    tenant_id   UUID,
    actor_id    UUID,                           -- userId of whoever made the change (NULL = system)
    action      VARCHAR(64) NOT NULL,           -- CATEGORIES_CHANGED, FILTER_LEVEL_CHANGED, BLOCKLIST_CHANGED,
                                                -- ALLOWLIST_CHANGED, SCHEDULE_CHANGED, BUDGETS_CHANGED,
                                                -- PAUSE, RESUME, HOMEWORK_START, BEDTIME_SET
    detail      TEXT,                           -- human-readable summary of the change
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rules_audit_profile ON dns.rules_audit_log (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rules_audit_tenant  ON dns.rules_audit_log (tenant_id,  created_at DESC);
