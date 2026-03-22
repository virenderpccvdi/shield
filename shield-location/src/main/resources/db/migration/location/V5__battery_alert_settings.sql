-- CS-04: Battery Alert — device settings table for per-profile battery threshold
CREATE TABLE IF NOT EXISTS location.device_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID NOT NULL UNIQUE,
    battery_threshold   INT NOT NULL DEFAULT 20,
    last_battery_pct    INT,
    last_alert_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_settings_profile ON location.device_settings (profile_id);

GRANT ALL ON location.device_settings TO shield;
