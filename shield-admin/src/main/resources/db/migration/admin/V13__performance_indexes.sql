-- V13: Performance indexes on admin schema + JSONB GIN indexes.
-- Addresses CRITICAL-03 (GIN), MEDIUM-08 (audit log resource indexing) from DB audit.

-- ── subscription_plans ──────────────────────────────────────────────────────
-- Feature toggle queries — currently full table scan on every feature check
CREATE INDEX IF NOT EXISTS idx_subscription_plans_features_gin
    ON admin.subscription_plans USING GIN (features);

-- ── audit_logs ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_gin
    ON admin.audit_logs USING GIN (details);

-- Resource-type + resource-id lookup (compliance reports)
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
    ON admin.audit_logs(resource_type, resource_id);

-- Tenant-scoped audit trail
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
    ON admin.audit_logs(tenant_id, created_at DESC);

-- ── invoices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
    ON admin.invoices(tenant_id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
    ON admin.invoices(customer_id);

-- Unpaid invoice queries (billing reminders)
CREATE INDEX IF NOT EXISTS idx_invoices_status_period_end
    ON admin.invoices(status, billing_period_end)
    WHERE status IN ('PENDING', 'OVERDUE');

-- ── isp_branding ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_isp_branding_tenant_id
    ON admin.isp_branding(tenant_id);

-- ── CRM tables ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contact_leads_status_created
    ON admin.contact_leads(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_created
    ON admin.crm_activities(lead_id, created_at DESC);
