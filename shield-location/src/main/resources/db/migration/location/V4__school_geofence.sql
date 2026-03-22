-- CS-07 School Arrival/Departure Auto-Detection
-- Marks a geofence as a school zone and stores optional school hours
ALTER TABLE location.geofences
    ADD COLUMN IF NOT EXISTS is_school    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS school_start TIME,
    ADD COLUMN IF NOT EXISTS school_end   TIME;

COMMENT ON COLUMN location.geofences.is_school    IS 'True when this geofence represents the child''s school';
COMMENT ON COLUMN location.geofences.school_start IS 'Start of school hours (e.g. 08:00) — used to classify early departures as alerts';
COMMENT ON COLUMN location.geofences.school_end   IS 'End of school hours (e.g. 15:00) — exits after this time are normal';
