-- V12: Add missing composite indexes for admin service
-- Note: idx_audit_user, idx_audit_action, idx_audit_created already exist from V5
-- Note: idx_leads_status, idx_leads_created already exist from V10

-- Composite index for audit_logs by tenant + created (high-volume table — tenant-scoped queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON admin.audit_logs(tenant_id, created_at DESC);

-- Composite index for contact_leads status + created (pipeline view queries)
CREATE INDEX IF NOT EXISTS idx_contact_leads_status_created
  ON admin.contact_leads(status, created_at DESC);

-- Index for compliance_reports by generated_by (user-level report lookup)
CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated_by
  ON admin.compliance_reports(generated_by);

-- Index for compliance_reports by tenant + period (tenant-scoped report queries)
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_period
  ON admin.compliance_reports(tenant_id, period_end DESC);
