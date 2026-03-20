-- Add name and email to customers table so ISP admin can see customer identity
ALTER TABLE profile.customers
    ADD COLUMN IF NOT EXISTS name  VARCHAR(150),
    ADD COLUMN IF NOT EXISTS email VARCHAR(254);

CREATE INDEX IF NOT EXISTS idx_customers_email ON profile.customers(email);
