-- V7: Performance indexes on auth schema.
-- Addresses MEDIUM-07 (soft-delete index), CRITICAL-05 (role CHECK) from DB audit.

-- ── Partial index for soft-delete filter ────────────────────────────────────
-- All live queries filter WHERE deleted_at IS NULL.
-- This index makes those scans index-only, avoiding full table scans.
CREATE INDEX IF NOT EXISTS idx_users_active
    ON auth.users(email, role, tenant_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_tenant_role
    ON auth.users(tenant_id, role)
    WHERE deleted_at IS NULL;

-- ── Role CHECK constraint ────────────────────────────────────────────────────
-- Prevents invalid role values from being inserted via bugs or direct DB access.
ALTER TABLE auth.users
    DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE auth.users
    ADD CONSTRAINT chk_users_role
    CHECK (role IN ('GLOBAL_ADMIN', 'ISP_ADMIN', 'CUSTOMER', 'PARENT', 'CHILD'));
