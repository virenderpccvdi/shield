-- V13: Performance indexes — fix N+1 query paths and missing FK indexes.
-- Addresses CRITICAL-01, CRITICAL-02, MEDIUM-01, MEDIUM-06, MEDIUM-07 from DB audit.

-- ── child_profiles ──────────────────────────────────────────────────────────
-- Composite index used by BudgetTracking scheduler and listByCustomer (active filter)
CREATE INDEX IF NOT EXISTS idx_child_profiles_customer_active
    ON profile.child_profiles(customer_id, active);

-- Tenant-scoped queries (ISP admin reports, admin dashboard)
CREATE INDEX IF NOT EXISTS idx_child_profiles_tenant_active
    ON profile.child_profiles(tenant_id, active);

-- Soft-delete: filter active-only records efficiently
CREATE INDEX IF NOT EXISTS idx_child_profiles_active_partial
    ON profile.child_profiles(id, tenant_id)
    WHERE active = TRUE;

-- ── customers ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_user_id
    ON profile.customers(user_id);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id
    ON profile.customers(tenant_id);

-- Subscription status filtering (billing queries)
CREATE INDEX IF NOT EXISTS idx_customers_tenant_status
    ON profile.customers(tenant_id, subscription_status);

-- ── devices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_devices_tenant
    ON profile.devices(tenant_id);

CREATE INDEX IF NOT EXISTS idx_devices_profile_id
    ON profile.devices(profile_id);

-- Online device queries (dashboard stats)
CREATE INDEX IF NOT EXISTS idx_devices_tenant_online
    ON profile.devices(tenant_id, is_online)
    WHERE is_online = TRUE;

-- ── device_apps ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_device_apps_profile_id
    ON profile.device_apps(profile_id);

-- ── family tables ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_family_members_family_id
    ON profile.family_members(family_id);

CREATE INDEX IF NOT EXISTS idx_family_members_user_id
    ON profile.family_members(user_id);

CREATE INDEX IF NOT EXISTS idx_family_invites_family_id
    ON profile.family_invites(family_id);

-- Token lookup (invite accept flow — must be fast)
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_invites_token
    ON profile.family_invites(token)
    WHERE token IS NOT NULL;
