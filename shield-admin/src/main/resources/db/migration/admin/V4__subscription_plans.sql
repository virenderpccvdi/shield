-- Subscription Plans table
CREATE TABLE IF NOT EXISTS admin.subscription_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50)    NOT NULL UNIQUE,
    display_name    VARCHAR(100)   NOT NULL,
    price           NUMERIC(10,2)  NOT NULL DEFAULT 0,
    billing_cycle   VARCHAR(20)    NOT NULL DEFAULT 'MONTHLY',
    max_customers   INT            NOT NULL DEFAULT 100,
    max_profiles_per_customer INT  NOT NULL DEFAULT 5,
    features        JSONB,
    description     VARCHAR(500),
    is_default      BOOLEAN        NOT NULL DEFAULT FALSE,
    active          BOOLEAN        NOT NULL DEFAULT TRUE,
    sort_order      INT            NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    DEFAULT now(),
    updated_at      TIMESTAMPTZ    DEFAULT now()
);

-- Seed default plans
INSERT INTO admin.subscription_plans (name, display_name, price, billing_cycle, max_customers, max_profiles_per_customer, features, description, is_default, sort_order)
VALUES
    ('STARTER', 'Starter', 29.99, 'MONTHLY', 100, 5,
     '{"dns_filtering": true, "ai_monitoring": false, "gps_tracking": false, "screen_time": true, "rewards": false, "instant_pause": true, "content_reporting": false, "multi_admin": false}'::jsonb,
     'Basic DNS filtering and screen time controls for small ISPs', TRUE, 1),
    ('GROWTH', 'Growth', 99.99, 'MONTHLY', 1000, 10,
     '{"dns_filtering": true, "ai_monitoring": true, "gps_tracking": true, "screen_time": true, "rewards": true, "instant_pause": true, "content_reporting": true, "multi_admin": false}'::jsonb,
     'Advanced features with AI monitoring and GPS tracking for growing ISPs', FALSE, 2),
    ('ENTERPRISE', 'Enterprise', 299.99, 'MONTHLY', 50000, 20,
     '{"dns_filtering": true, "ai_monitoring": true, "gps_tracking": true, "screen_time": true, "rewards": true, "instant_pause": true, "content_reporting": true, "multi_admin": true}'::jsonb,
     'Full platform access with unlimited features for large ISPs', FALSE, 3)
ON CONFLICT (name) DO NOTHING;

GRANT ALL ON admin.subscription_plans TO shield;
