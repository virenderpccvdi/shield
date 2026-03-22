-- FC-06 Emergency Contacts
CREATE TABLE IF NOT EXISTS profile.emergency_contacts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL REFERENCES profile.child_profiles(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(30),
    email        VARCHAR(255),
    relationship VARCHAR(50),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ec_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ec_profile ON profile.emergency_contacts(profile_id);
