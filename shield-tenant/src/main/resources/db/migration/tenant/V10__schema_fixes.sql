-- V10: Schema fixes identified in audit

-- Add CHECK constraint for plan type
ALTER TABLE tenant.tenants
    ADD CONSTRAINT chk_tenant_plan
    CHECK (plan IN ('STARTER', 'GROWTH', 'ENTERPRISE', 'TRIAL'));

-- Add index on isp_allowlist.domain for faster case-insensitive lookups
CREATE INDEX IF NOT EXISTS idx_isp_allowlist_domain ON tenant.isp_allowlist(LOWER(domain));
