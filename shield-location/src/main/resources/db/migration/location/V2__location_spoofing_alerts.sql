-- V2: Location spoofing detection alerts table
-- accuracy column already exists in V1 (DECIMAL(8,2)) — no ALTER needed

CREATE TABLE IF NOT EXISTS location.spoofing_alerts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL,
    signal_type  VARCHAR(50) NOT NULL,
    description  TEXT,
    latitude     DOUBLE PRECISION,
    longitude    DOUBLE PRECISION,
    detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spoofing_profile_time
    ON location.spoofing_alerts (profile_id, detected_at DESC);

GRANT ALL ON location.spoofing_alerts TO shield;
