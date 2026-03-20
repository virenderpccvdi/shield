-- Allow tenant_id to be NULL in dns_rules so GLOBAL_ADMIN can manage
-- child profile DNS without a tenant context
ALTER TABLE dns.dns_rules ALTER COLUMN tenant_id DROP NOT NULL;
