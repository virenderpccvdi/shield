-- V8: Schema fixes identified in audit

-- Partial index to enforce GLOBAL_ADMIN users have no tenant_id
-- (application enforces this constraint; index aids auditing and queries)
CREATE INDEX IF NOT EXISTS idx_users_global_admin ON auth.users(id)
    WHERE role = 'GLOBAL_ADMIN' AND tenant_id IS NULL;

-- Partial index for soft-delete queries (email + role lookups on active, non-deleted users)
CREATE INDEX IF NOT EXISTS idx_users_not_deleted ON auth.users(email, role)
    WHERE deleted_at IS NULL AND is_active = TRUE;
