-- ISP-level domain blocklist: each tenant (ISP) maintains its own blocked domains
CREATE TABLE IF NOT EXISTS tenant.isp_blocklist (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    domain     VARCHAR(255) NOT NULL,
    reason     VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_isp_blocklist_tenant_domain UNIQUE (tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_isp_blocklist_tenant_id  ON tenant.isp_blocklist (tenant_id);
CREATE INDEX IF NOT EXISTS idx_isp_blocklist_domain     ON tenant.isp_blocklist (domain);
CREATE INDEX IF NOT EXISTS idx_isp_blocklist_created_at ON tenant.isp_blocklist (created_at DESC);
