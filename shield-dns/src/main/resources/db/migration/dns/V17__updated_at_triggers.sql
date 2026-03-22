-- V17: Add missing updated_at triggers for DNS schema tables.
-- Addresses HIGH-03 from DB audit.

CREATE OR REPLACE FUNCTION dns.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- app_time_budgets (column exists, trigger missing)
DROP TRIGGER IF EXISTS trg_app_time_budgets_updated_at ON dns.app_time_budgets;
CREATE TRIGGER trg_app_time_budgets_updated_at
    BEFORE UPDATE ON dns.app_time_budgets
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();

-- app_usage_log
DROP TRIGGER IF EXISTS trg_app_usage_log_updated_at ON dns.app_usage_log;
CREATE TRIGGER trg_app_usage_log_updated_at
    BEFORE UPDATE ON dns.app_usage_log
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();

-- access_schedules
DROP TRIGGER IF EXISTS trg_access_schedules_updated_at ON dns.access_schedules;
CREATE TRIGGER trg_access_schedules_updated_at
    BEFORE UPDATE ON dns.access_schedules
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();

-- approval_requests
DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON dns.approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at
    BEFORE UPDATE ON dns.approval_requests
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();

-- platform_defaults
DROP TRIGGER IF EXISTS trg_platform_defaults_updated_at ON dns.platform_defaults;
CREATE TRIGGER trg_platform_defaults_updated_at
    BEFORE UPDATE ON dns.platform_defaults
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();

-- tenant_dns_settings
DROP TRIGGER IF EXISTS trg_tenant_dns_settings_updated_at ON dns.tenant_dns_settings;
CREATE TRIGGER trg_tenant_dns_settings_updated_at
    BEFORE UPDATE ON dns.tenant_dns_settings
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();
