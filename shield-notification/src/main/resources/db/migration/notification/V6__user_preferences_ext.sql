-- N3: Extend alert_preferences with additional notification type toggles
-- Adds geofence, anomaly, SOS, and bedtime alert columns for fine-grained control.

ALTER TABLE notification.alert_preferences
    ADD COLUMN IF NOT EXISTS geofence_alerts  BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS anomaly_alerts   BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS sos_alerts       BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS bedtime_alerts   BOOLEAN NOT NULL DEFAULT TRUE;
