-- Allow platform customers (no ISP tenant) to use DNS services
ALTER TABLE dns.dns_rules  ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE dns.schedules  ALTER COLUMN tenant_id DROP NOT NULL;
