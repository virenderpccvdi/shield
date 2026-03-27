-- V9: DIRECT tenant for self-registered users (no ISP affiliation)
-- Used by AuthService when tenantId is null on /auth/register
-- Plan: STARTER — no premium features, acts as a free-tier cap
INSERT INTO tenant.tenants (id, slug, name, plan, contact_email, max_customers, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'direct',
    'DIRECT',
    'STARTER',
    'platform@shield.rstglobal.in',
    100000,
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;
