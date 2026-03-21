-- Add telemetry fields to devices table
ALTER TABLE profile.devices
    ADD COLUMN IF NOT EXISTS battery_pct   INTEGER,
    ADD COLUMN IF NOT EXISTS speed_kmh     NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS app_version   VARCHAR(20);
