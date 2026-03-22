-- V9: Add missing updated_at triggers for location schema.

CREATE OR REPLACE FUNCTION location.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- checkin_reminder_settings
DROP TRIGGER IF EXISTS trg_checkin_reminder_updated_at ON location.checkin_reminder_settings;
CREATE TRIGGER trg_checkin_reminder_updated_at
    BEFORE UPDATE ON location.checkin_reminder_settings
    FOR EACH ROW EXECUTE FUNCTION location.set_updated_at();

-- device_settings
DROP TRIGGER IF EXISTS trg_device_settings_updated_at ON location.device_settings;
CREATE TRIGGER trg_device_settings_updated_at
    BEFORE UPDATE ON location.device_settings
    FOR EACH ROW EXECUTE FUNCTION location.set_updated_at();

-- geofences (if trigger not already created in V3)
DROP TRIGGER IF EXISTS trg_geofences_updated_at ON location.geofences;
CREATE TRIGGER trg_geofences_updated_at
    BEFORE UPDATE ON location.geofences
    FOR EACH ROW EXECUTE FUNCTION location.set_updated_at();
