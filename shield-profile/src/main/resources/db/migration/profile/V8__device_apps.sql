-- Installed apps on child devices (reported by the Shield app)
CREATE TABLE profile.device_apps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES profile.child_profiles(id) ON DELETE CASCADE,
    package_name    VARCHAR(200) NOT NULL,
    app_name        VARCHAR(200),
    version_name    VARCHAR(50),
    is_system_app   BOOLEAN NOT NULL DEFAULT FALSE,
    is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
    time_limit_minutes INTEGER,
    usage_today_minutes INTEGER NOT NULL DEFAULT 0,
    last_reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, package_name)
);
CREATE INDEX idx_device_apps_profile ON profile.device_apps(profile_id);

-- Uninstall protection PIN per customer (parent sets this)
ALTER TABLE profile.customers ADD COLUMN IF NOT EXISTS uninstall_pin VARCHAR(6);
