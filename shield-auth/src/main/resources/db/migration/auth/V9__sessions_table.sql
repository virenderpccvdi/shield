CREATE TABLE IF NOT EXISTS auth.sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name      VARCHAR(200),
    device_type      VARCHAR(50),          -- MOBILE | DESKTOP | TABLET
    ip_address       VARCHAR(45),
    user_agent       TEXT,
    fingerprint_hash VARCHAR(64),
    last_active      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked          BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at       TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user        ON auth.sessions(user_id) WHERE NOT revoked;
CREATE INDEX idx_sessions_fingerprint ON auth.sessions(user_id, fingerprint_hash) WHERE NOT revoked;
