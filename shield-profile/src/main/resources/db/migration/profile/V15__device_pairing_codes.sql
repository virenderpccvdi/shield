-- V10: Device pairing codes for Windows/desktop agent
-- A parent generates a 6-digit code in the dashboard; the agent redeems it.

CREATE TABLE IF NOT EXISTS profile.device_pairing_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID        NOT NULL REFERENCES profile.child_profiles(id) ON DELETE CASCADE,
    code        VARCHAR(6)  NOT NULL,
    platform    VARCHAR(20) NOT NULL DEFAULT 'windows',
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index on unused codes (no NOW() — immutability constraint)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pairing_code_unused
    ON profile.device_pairing_codes (code)
    WHERE used = FALSE;

CREATE INDEX IF NOT EXISTS idx_pairing_codes_profile
    ON profile.device_pairing_codes (profile_id);
