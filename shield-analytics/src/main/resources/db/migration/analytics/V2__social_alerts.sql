-- Social monitoring alerts table
CREATE TABLE analytics.social_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    tenant_id       UUID,
    alert_type      VARCHAR(50)  NOT NULL,  -- LATE_NIGHT | SOCIAL_SPIKE | GAMING_SPIKE | NEW_CATEGORY
    severity        VARCHAR(20)  NOT NULL,  -- LOW | MEDIUM | HIGH
    description     TEXT         NOT NULL,
    metadata        JSONB,
    acknowledged    BOOLEAN      NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    detected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_alerts_profile ON analytics.social_alerts (profile_id, detected_at DESC);
CREATE INDEX idx_social_alerts_tenant  ON analytics.social_alerts (tenant_id,  detected_at DESC);
CREATE INDEX idx_social_alerts_unread  ON analytics.social_alerts (profile_id, acknowledged)
    WHERE acknowledged = FALSE;

GRANT ALL ON analytics.social_alerts TO shield;
