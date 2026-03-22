-- PC-01 Bedtime Lock — separate from schedule presets
-- Adds bedtime configuration columns to dns_rules
ALTER TABLE dns.dns_rules
  ADD COLUMN IF NOT EXISTS bedtime_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bedtime_start     TIME,
  ADD COLUMN IF NOT EXISTS bedtime_end       TIME;
