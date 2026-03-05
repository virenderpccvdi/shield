-- Shield Profile — V3: Add updated_at to devices (missed in V1)
ALTER TABLE profile.devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON profile.devices
    FOR EACH ROW EXECUTE FUNCTION profile.set_updated_at();
