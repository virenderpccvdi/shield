-- V17: Trial period support
-- Adds trial columns to profile.customers so BillingService can manage
-- time-limited free trials before a paid subscription begins.

ALTER TABLE profile.customers
    ADD COLUMN IF NOT EXISTS trial_ends_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_trial        BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_customers_trial_active
    ON profile.customers(is_trial, trial_ends_at)
    WHERE is_trial = TRUE;
