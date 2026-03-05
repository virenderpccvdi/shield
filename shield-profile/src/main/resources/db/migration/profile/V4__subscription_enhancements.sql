-- Subscription history and Stripe integration

CREATE TABLE profile.subscription_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id             UUID NOT NULL REFERENCES profile.customers(id) ON DELETE CASCADE,
    plan_from               VARCHAR(50),
    plan_to                 VARCHAR(50) NOT NULL,
    changed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason                  VARCHAR(255),
    stripe_subscription_id  VARCHAR(255)
);

CREATE INDEX idx_sub_hist_customer ON profile.subscription_history(customer_id);

-- Add Stripe fields to customers
ALTER TABLE profile.customers
    ADD COLUMN IF NOT EXISTS stripe_customer_id      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_subscription_id  VARCHAR(255);
