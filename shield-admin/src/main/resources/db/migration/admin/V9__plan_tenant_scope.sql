-- V9: Add tenant_id to subscription_plans
-- Plans with tenant_id = NULL are Global/ISP plans (managed by GLOBAL_ADMIN)
-- Plans with tenant_id = <uuid> are Customer plans (managed by that ISP_ADMIN for their customers)

ALTER TABLE admin.subscription_plans
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Add plan_type to distinguish ISP plans vs Customer plans
ALTER TABLE admin.subscription_plans
    ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER';

-- Mark existing plans as ISP-level plans (they were created before this distinction)
UPDATE admin.subscription_plans SET plan_type = 'ISP' WHERE tenant_id IS NULL;

-- Index for fast tenant lookup
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant
    ON admin.subscription_plans(tenant_id);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_type
    ON admin.subscription_plans(plan_type);
