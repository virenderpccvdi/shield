-- V14: Add missing updated_at triggers and CHECK constraints.
-- Addresses HIGH-03 (triggers) and CRITICAL-05 (enum constraints) from DB audit.

-- ── updated_at trigger function (idempotent) ─────────────────────────────────
CREATE OR REPLACE FUNCTION profile.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ── Missing triggers for tables with updated_at column ───────────────────────

-- device_apps (column added in V8 but trigger missing)
DROP TRIGGER IF EXISTS trg_device_apps_updated_at ON profile.device_apps;
CREATE TRIGGER trg_device_apps_updated_at
    BEFORE UPDATE ON profile.device_apps
    FOR EACH ROW EXECUTE FUNCTION profile.set_updated_at();

-- family_members
ALTER TABLE profile.family_members
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DROP TRIGGER IF EXISTS trg_family_members_updated_at ON profile.family_members;
CREATE TRIGGER trg_family_members_updated_at
    BEFORE UPDATE ON profile.family_members
    FOR EACH ROW EXECUTE FUNCTION profile.set_updated_at();

-- family_invites
DROP TRIGGER IF EXISTS trg_family_invites_updated_at ON profile.family_invites;
CREATE TRIGGER trg_family_invites_updated_at
    BEFORE UPDATE ON profile.family_invites
    FOR EACH ROW EXECUTE FUNCTION profile.set_updated_at();

-- ── CHECK constraints on enum-like columns ───────────────────────────────────
ALTER TABLE profile.child_profiles
    DROP CONSTRAINT IF EXISTS chk_child_filter_level;
ALTER TABLE profile.child_profiles
    ADD CONSTRAINT chk_child_filter_level
    CHECK (filter_level IN ('STRICT', 'MODERATE', 'PERMISSIVE'));

ALTER TABLE profile.customers
    DROP CONSTRAINT IF EXISTS chk_customers_status;
ALTER TABLE profile.customers
    ADD CONSTRAINT chk_customers_status
    CHECK (subscription_status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TRIAL'));
