-- V10: Add per-platform social media blocking flags to dns_rules
ALTER TABLE dns.dns_rules
    ADD COLUMN IF NOT EXISTS facebook_blocked  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS instagram_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tiktok_blocked    BOOLEAN NOT NULL DEFAULT FALSE;
