-- Billing tables for Stripe payment integration

-- Invoices
CREATE TABLE admin.invoices (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID,
    customer_id                 UUID,
    user_id                     UUID NOT NULL,
    user_email                  VARCHAR(255) NOT NULL,
    plan_id                     UUID REFERENCES admin.subscription_plans(id),
    plan_name                   VARCHAR(50) NOT NULL,
    amount                      NUMERIC(10,2) NOT NULL,
    currency                    VARCHAR(3) NOT NULL DEFAULT 'INR',
    status                      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    stripe_invoice_id           VARCHAR(255),
    stripe_payment_intent_id    VARCHAR(255),
    stripe_checkout_session_id  VARCHAR(255),
    stripe_subscription_id      VARCHAR(255),
    pdf_url                     TEXT,
    billing_period_start        TIMESTAMPTZ,
    billing_period_end          TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_tenant    ON admin.invoices(tenant_id);
CREATE INDEX idx_invoices_user      ON admin.invoices(user_id);
CREATE INDEX idx_invoices_status    ON admin.invoices(status);
CREATE INDEX idx_invoices_stripe    ON admin.invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_session   ON admin.invoices(stripe_checkout_session_id);

-- Payment transactions
CREATE TABLE admin.payment_transactions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id                  UUID NOT NULL REFERENCES admin.invoices(id) ON DELETE CASCADE,
    stripe_charge_id            VARCHAR(255),
    stripe_payment_intent_id    VARCHAR(255),
    amount                      NUMERIC(10,2) NOT NULL,
    currency                    VARCHAR(3) NOT NULL DEFAULT 'INR',
    status                      VARCHAR(20) NOT NULL,
    failure_reason              TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_txn_invoice ON admin.payment_transactions(invoice_id);

-- Stripe customer mapping
CREATE TABLE admin.stripe_customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE,
    tenant_id           UUID,
    stripe_customer_id  VARCHAR(255) NOT NULL UNIQUE,
    email               VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_cust_user ON admin.stripe_customers(user_id);

-- Add Stripe fields to subscription plans
ALTER TABLE admin.subscription_plans
    ADD COLUMN IF NOT EXISTS stripe_price_id    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_product_id  VARCHAR(255);

-- Updated_at trigger for invoices
CREATE OR REPLACE FUNCTION admin.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON admin.invoices
    FOR EACH ROW EXECUTE FUNCTION admin.set_updated_at();
