-- CS-05: Suspicious Activity Alerts table
CREATE TABLE IF NOT EXISTS analytics.suspicious_activity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,        -- BURST_BLOCKED, SUSPICIOUS_CATEGORY
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_saa_profile
    ON analytics.suspicious_activity_alerts(profile_id, acknowledged, detected_at DESC);
