CREATE TABLE tenant.isp_allowlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    domain      VARCHAR(255) NOT NULL,
    reason      VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, domain)
);
CREATE INDEX idx_isp_allowlist_tenant ON tenant.isp_allowlist(tenant_id);
