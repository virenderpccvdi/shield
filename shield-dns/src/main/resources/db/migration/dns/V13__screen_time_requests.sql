-- FC-02: Screen Time Request
-- Child can request additional screen time; parent approves or denies.

CREATE TABLE IF NOT EXISTS dns.screen_time_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL,
    customer_id  UUID,
    minutes      INT  NOT NULL,
    reason       TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at   TIMESTAMPTZ,
    decided_by   UUID,
    expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_str_profile_status
    ON dns.screen_time_requests (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_str_requested_at
    ON dns.screen_time_requests (requested_at);
