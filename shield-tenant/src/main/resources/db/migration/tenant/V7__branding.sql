-- Shield Tenant — V7: Dedicated white-label branding columns
ALTER TABLE tenant.tenants ADD COLUMN IF NOT EXISTS brand_name      VARCHAR(200);
ALTER TABLE tenant.tenants ADD COLUMN IF NOT EXISTS brand_color     VARCHAR(20) DEFAULT '#00897B';
ALTER TABLE tenant.tenants ADD COLUMN IF NOT EXISTS brand_logo_url  VARCHAR(500);
ALTER TABLE tenant.tenants ADD COLUMN IF NOT EXISTS support_email   VARCHAR(255);
ALTER TABLE tenant.tenants ADD COLUMN IF NOT EXISTS support_phone   VARCHAR(50);
