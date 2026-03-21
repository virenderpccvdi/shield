-- Add soft-delete support to child_profiles
ALTER TABLE profile.child_profiles
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_child_profiles_active ON profile.child_profiles(customer_id, active);
