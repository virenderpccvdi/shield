-- Shield AI — persistent state tables
-- Run once at startup via db/init.py

CREATE SCHEMA IF NOT EXISTS ai;

-- AI-generated alerts (replaces in-memory _alerts dict)
CREATE TABLE IF NOT EXISTS ai.ai_alerts (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    TEXT        NOT NULL,
    tenant_id     TEXT,
    alert_type    TEXT        NOT NULL,   -- ANOMALY | RISK_THRESHOLD | MENTAL_HEALTH
    severity      TEXT        NOT NULL,   -- LOW | MEDIUM | HIGH
    score         FLOAT       NOT NULL,
    description   TEXT        NOT NULL,
    detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback_given BOOLEAN    NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_profile ON ai.ai_alerts (profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_detected ON ai.ai_alerts (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_score ON ai.ai_alerts (score DESC);

-- Alert feedback (replaces in-memory _alert_feedback dict)
CREATE TABLE IF NOT EXISTS ai.ai_alert_feedback (
    alert_id     UUID        PRIMARY KEY REFERENCES ai.ai_alerts(id) ON DELETE CASCADE,
    accurate     BOOLEAN     NOT NULL,
    comment      TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-profile monitored keywords (replaces in-memory _keyword_store dict)
CREATE TABLE IF NOT EXISTS ai.ai_keywords (
    profile_id TEXT        PRIMARY KEY,
    keywords   TEXT[]      NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
