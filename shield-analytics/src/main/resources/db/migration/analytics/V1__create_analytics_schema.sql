CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.dns_query_logs (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    profile_id  UUID NOT NULL,
    device_id   UUID,
    domain      VARCHAR(255) NOT NULL,
    action      VARCHAR(20) NOT NULL CHECK (action IN ('BLOCKED','ALLOWED')),
    category    VARCHAR(100),
    client_ip   VARCHAR(45),
    queried_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, queried_at)
) PARTITION BY RANGE (queried_at);

CREATE TABLE analytics.dns_query_logs_2026_q1 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE analytics.dns_query_logs_2026_q2 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE analytics.dns_query_logs_2026_q3 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE analytics.dns_query_logs_2026_q4 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
CREATE TABLE analytics.dns_query_logs_2027_q1 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');

CREATE INDEX idx_dns_logs_profile_time ON analytics.dns_query_logs (profile_id, queried_at DESC);
CREATE INDEX idx_dns_logs_tenant_time ON analytics.dns_query_logs (tenant_id, queried_at DESC);
CREATE INDEX idx_dns_logs_action ON analytics.dns_query_logs (action, queried_at DESC);
CREATE INDEX idx_dns_logs_domain ON analytics.dns_query_logs (domain, queried_at DESC);

CREATE TABLE analytics.usage_summaries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    profile_id  UUID NOT NULL,
    summary_date DATE NOT NULL,
    total_queries    BIGINT DEFAULT 0,
    blocked_queries  BIGINT DEFAULT 0,
    allowed_queries  BIGINT DEFAULT 0,
    top_blocked_json JSONB,
    top_allowed_json JSONB,
    category_breakdown_json JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, summary_date)
);

CREATE INDEX idx_usage_profile_date ON analytics.usage_summaries (profile_id, summary_date DESC);

GRANT ALL ON SCHEMA analytics TO shield;
GRANT ALL ON ALL TABLES IN SCHEMA analytics TO shield;
GRANT ALL ON ALL SEQUENCES IN SCHEMA analytics TO shield;
