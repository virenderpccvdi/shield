-- PC-03 Per-App Time Budgets
CREATE TABLE IF NOT EXISTS dns.app_time_budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    app_name        VARCHAR(100) NOT NULL,
    domain_pattern  VARCHAR(255) NOT NULL,
    daily_minutes   INT NOT NULL DEFAULT 60,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, domain_pattern)
);

CREATE TABLE IF NOT EXISTS dns.app_usage_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    app_name        VARCHAR(100) NOT NULL,
    domain_pattern  VARCHAR(255) NOT NULL,
    usage_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    used_minutes    INT NOT NULL DEFAULT 0,
    budget_depleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, domain_pattern, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_app_usage_profile_date
    ON dns.app_usage_log(profile_id, usage_date DESC);
