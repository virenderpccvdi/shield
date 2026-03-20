CREATE TABLE dns.tenant_dns_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL UNIQUE,
    enabled_categories  JSONB NOT NULL DEFAULT '{}',
    custom_blocklist    JSONB NOT NULL DEFAULT '[]',
    custom_allowlist    JSONB NOT NULL DEFAULT '[]',
    safesearch_enabled  BOOLEAN NOT NULL DEFAULT true,
    ads_blocked         BOOLEAN NOT NULL DEFAULT true,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_dns_settings_tenant ON dns.tenant_dns_settings(tenant_id);
