-- Add simple per-profile daily internet budget (total minutes per day)
-- A NULL value means no limit is configured.
-- When non-null, BudgetTrackingService enforces a hard cutoff when usage >= dailyBudgetMinutes.
ALTER TABLE dns.dns_rules ADD COLUMN IF NOT EXISTS daily_budget_minutes INTEGER;
