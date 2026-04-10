-- Dunning retry fields on profile.customers (tracks failed payment retry state)
-- These are added to the cross-schema customer record, not the admin schema,
-- because subscription state lives in profile.customers.
ALTER TABLE profile.customers
    ADD COLUMN IF NOT EXISTS dunning_count       INTEGER   NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_retry_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
