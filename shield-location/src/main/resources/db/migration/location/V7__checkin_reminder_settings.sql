CREATE TABLE IF NOT EXISTS location.checkin_reminder_settings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id            UUID NOT NULL UNIQUE,
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_interval_min INTEGER NOT NULL DEFAULT 60,
    quiet_start           TIME,
    quiet_end             TIME,
    last_reminder_sent    TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
