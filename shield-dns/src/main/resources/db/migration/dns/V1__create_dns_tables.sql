-- Shield DNS — V1: Create dns schema tables

CREATE SCHEMA IF NOT EXISTS dns;

-- Per-profile DNS filtering rules
CREATE TABLE dns.dns_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    profile_id          UUID UNIQUE NOT NULL,
    enabled_categories  JSONB NOT NULL DEFAULT '{}',
    custom_allowlist    JSONB NOT NULL DEFAULT '[]',
    custom_blocklist    JSONB NOT NULL DEFAULT '[]',
    safesearch_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    youtube_restricted  BOOLEAN NOT NULL DEFAULT TRUE,
    ads_blocked         BOOLEAN NOT NULL DEFAULT TRUE,
    time_budgets        JSONB NOT NULL DEFAULT '{}',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dns_rules_profile ON dns.dns_rules(profile_id);

-- Weekly schedule grid (24h × 7-day)
CREATE TABLE dns.schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    profile_id      UUID UNIQUE NOT NULL,
    grid            JSONB NOT NULL DEFAULT '{}',
    active_preset   VARCHAR(50),
    override_active BOOLEAN NOT NULL DEFAULT FALSE,
    override_type   VARCHAR(30),
    override_ends_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_schedules_profile ON dns.schedules(profile_id);

-- Daily time budget usage
CREATE TABLE dns.budget_usage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID NOT NULL,
    date        DATE NOT NULL,
    app_usage   JSONB NOT NULL DEFAULT '{}',
    UNIQUE(profile_id, date)
);
CREATE INDEX idx_budget_usage_profile_date ON dns.budget_usage(profile_id, date);

-- Time extension requests from child app
CREATE TABLE dns.extension_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    customer_id     UUID NOT NULL,
    app_name        VARCHAR(100),
    requested_mins  INTEGER NOT NULL,
    message         TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_extension_requests_customer ON dns.extension_requests(customer_id, status);
CREATE INDEX idx_extension_requests_profile  ON dns.extension_requests(profile_id);
