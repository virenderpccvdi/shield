-- Add dns_client_id to dns_rules for AdGuard sync
ALTER TABLE dns.dns_rules ADD COLUMN IF NOT EXISTS dns_client_id VARCHAR(80);
