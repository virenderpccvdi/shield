-- V16: Performance indexes — JSONB GIN indexes and missing FK indexes.
-- Addresses CRITICAL-02 (tenant indexes), CRITICAL-03 (GIN), MEDIUM-01 from DB audit.

-- ── GIN indexes on JSONB columns (CRITICAL-03) ──────────────────────────────
-- enabled_categories is queried by category key presence on every DNS rules load
CREATE INDEX IF NOT EXISTS idx_dns_rules_enabled_categories_gin
    ON dns.dns_rules USING GIN (enabled_categories);

CREATE INDEX IF NOT EXISTS idx_dns_rules_custom_allowlist_gin
    ON dns.dns_rules USING GIN (custom_allowlist);

CREATE INDEX IF NOT EXISTS idx_dns_rules_custom_blocklist_gin
    ON dns.dns_rules USING GIN (custom_blocklist);

CREATE INDEX IF NOT EXISTS idx_dns_rules_time_budgets_gin
    ON dns.dns_rules USING GIN (time_budgets);

-- Schedule grid: day/hour grid lookups for bedtime lock and schedule enforcement
CREATE INDEX IF NOT EXISTS idx_schedules_grid_gin
    ON dns.schedules USING GIN (grid);

-- Platform defaults — read on every profile provisioning
CREATE INDEX IF NOT EXISTS idx_platform_defaults_categories_gin
    ON dns.platform_defaults USING GIN (enabled_categories);

-- Tenant DNS settings — read by ISP admin
CREATE INDEX IF NOT EXISTS idx_tenant_dns_settings_categories_gin
    ON dns.tenant_dns_settings USING GIN (enabled_categories);

-- Budget usage JSONB
CREATE INDEX IF NOT EXISTS idx_budget_usage_app_usage_gin
    ON dns.budget_usage USING GIN (app_usage);

-- ── dns_rules — profile/tenant lookups ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dns_rules_tenant_id
    ON dns.dns_rules(tenant_id);

-- Homework mode expiry scan — used by HomeworkModeExpiryJob
CREATE INDEX IF NOT EXISTS idx_dns_rules_homework_active_ends
    ON dns.dns_rules(homework_mode_ends_at)
    WHERE homework_mode_active = TRUE;

-- Bedtime lock scan — used by BedtimeLockService
CREATE INDEX IF NOT EXISTS idx_dns_rules_bedtime_enabled
    ON dns.dns_rules(profile_id)
    WHERE bedtime_enabled = TRUE;

-- Daily budget scan — used by BudgetTrackingService (replaces full table scan)
CREATE INDEX IF NOT EXISTS idx_dns_rules_daily_budget
    ON dns.dns_rules(profile_id)
    WHERE daily_budget_minutes IS NOT NULL AND daily_budget_minutes > 0;

-- ── extension_requests ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_extension_requests_customer_id
    ON dns.extension_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_extension_requests_profile_id
    ON dns.extension_requests(profile_id);

CREATE INDEX IF NOT EXISTS idx_extension_requests_customer_status
    ON dns.extension_requests(customer_id, status);
