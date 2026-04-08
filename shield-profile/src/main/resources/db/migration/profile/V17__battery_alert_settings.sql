-- Battery alert settings stored directly on the child profile
ALTER TABLE profile.child_profiles
    ADD COLUMN IF NOT EXISTS battery_alert_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS battery_alert_threshold INT     NOT NULL DEFAULT 20;
