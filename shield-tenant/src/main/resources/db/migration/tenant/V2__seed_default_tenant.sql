-- Shield Tenant — V2: Seed RST Global (default) tenant

INSERT INTO tenant.tenants (
    id, slug, name, contact_email, plan,
    max_customers, max_profiles_per_customer,
    features, is_active
) VALUES (
    gen_random_uuid(),
    'rst-global',
    'RST Global',
    'admin@rstglobal.in',
    'ENTERPRISE',
    999999,
    10,
    '{
        "dns_filtering": true,
        "ai_monitoring": true,
        "gps_tracking": true,
        "screen_time": true,
        "rewards": true,
        "instant_pause": true,
        "content_reporting": true,
        "multi_admin": true
    }',
    TRUE
)
ON CONFLICT (slug) DO NOTHING;
