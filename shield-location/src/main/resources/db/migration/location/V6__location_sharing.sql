CREATE TABLE IF NOT EXISTS location.location_shares (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL,
    created_by   UUID NOT NULL,   -- parent userId
    share_token  VARCHAR(64) NOT NULL UNIQUE,
    label        VARCHAR(100),    -- e.g. "Grandma's share"
    expires_at   TIMESTAMPTZ NOT NULL,
    max_views    INTEGER,         -- null = unlimited
    view_count   INTEGER NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ls_token   ON location.location_shares(share_token);
CREATE INDEX idx_ls_profile ON location.location_shares(profile_id);
