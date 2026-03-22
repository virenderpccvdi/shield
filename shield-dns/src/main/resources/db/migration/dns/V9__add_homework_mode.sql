-- PC-02: Homework Mode
-- Adds columns to dns_rules to support one-tap homework mode.
-- homework_mode_snapshot stores a JSON snapshot of custom_blocklist before activation,
-- allowing restoration of the original list when homework mode is deactivated.

ALTER TABLE dns.dns_rules
    ADD COLUMN IF NOT EXISTS homework_mode_active   BOOLEAN    NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS homework_mode_ends_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS homework_mode_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_dns_rules_homework
    ON dns.dns_rules(homework_mode_active, homework_mode_ends_at)
    WHERE homework_mode_active = TRUE;
