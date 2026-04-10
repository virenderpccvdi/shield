-- Add dns_client_id to dns_rules — used by shield-dns-resolver to identify which profile to apply rules for
ALTER TABLE dns.dns_rules ADD COLUMN IF NOT EXISTS dns_client_id VARCHAR(80);
