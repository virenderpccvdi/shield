-- V18__filter_categories.sql
-- Master category definitions for complete internet content filtering

CREATE TABLE IF NOT EXISTS dns.filter_categories (
    id                  VARCHAR(4)   PRIMARY KEY,
    name                VARCHAR(80)  NOT NULL,
    description         TEXT,
    risk_level          VARCHAR(10)  NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
    blocked_starter     BOOLEAN      NOT NULL DEFAULT FALSE,
    blocked_growth      BOOLEAN      NOT NULL DEFAULT FALSE,
    blocked_enterprise  BOOLEAN      NOT NULL DEFAULT FALSE,
    always_block        BOOLEAN      NOT NULL DEFAULT FALSE,
    display_order       INT          NOT NULL DEFAULT 0,
    icon_name           VARCHAR(64),
    category_key        VARCHAR(64)  UNIQUE  -- maps to existing ContentCategories keys
);

-- Domain → category mapping (master blocklist)
CREATE TABLE IF NOT EXISTS dns.domain_blocklist (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    domain          VARCHAR(253) NOT NULL,
    category_id     VARCHAR(4)   NOT NULL REFERENCES dns.filter_categories(id) ON DELETE CASCADE,
    app_name        VARCHAR(128),
    is_cdn          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_api          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_wildcard     BOOLEAN      NOT NULL DEFAULT FALSE,
    confidence      NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    source          VARCHAR(64)  NOT NULL DEFAULT 'manual',
    last_verified   DATE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_blocklist_domain
    ON dns.domain_blocklist (LOWER(domain));

CREATE INDEX IF NOT EXISTS idx_domain_blocklist_category
    ON dns.domain_blocklist (category_id);

CREATE INDEX IF NOT EXISTS idx_domain_blocklist_app
    ON dns.domain_blocklist (app_name);

-- Alter analytics.dns_query_logs to capture category + blocked_by reason
ALTER TABLE analytics.dns_query_logs
    ADD COLUMN IF NOT EXISTS category_id    VARCHAR(4),
    ADD COLUMN IF NOT EXISTS category_name  VARCHAR(80),
    ADD COLUMN IF NOT EXISTS blocked_by     VARCHAR(30);
-- blocked_by values: 'category', 'custom_block', 'tenant_block', 'schedule', 'budget', 'bedtime'

COMMENT ON TABLE dns.filter_categories IS 'Master content category definitions for DNS filtering — 53 categories';
COMMENT ON TABLE dns.domain_blocklist   IS 'Domain → category mapping database — 5000+ entries for complete internet filtering';
