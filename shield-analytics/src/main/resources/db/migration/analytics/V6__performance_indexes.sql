-- V6: Additional performance indexes for analytics schema.
-- Addresses CRITICAL-04 (partition indexes), HIGH-04 (tenant isolation).

-- ── dns_query_logs (partitioned) ────────────────────────────────────────────
-- Tenant-scoped ISP admin queries — essential for ISP reports page
CREATE INDEX IF NOT EXISTS idx_dns_logs_tenant_profile_time
    ON analytics.dns_query_logs(tenant_id, profile_id, queried_at DESC);

-- Domain + action composite: top-domains endpoint grouped by domain+action
CREATE INDEX IF NOT EXISTS idx_dns_logs_domain_action_time
    ON analytics.dns_query_logs(domain, action, queried_at DESC);

-- ── usage_summaries ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usage_summaries_profile_date
    ON analytics.usage_summaries(profile_id, summary_date DESC);

-- ── suspicious_activity_alerts ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_suspicious_alerts_profile_detected
    ON analytics.suspicious_activity_alerts(profile_id, detected_at DESC);

-- Unacknowledged alerts fast lookup (AI anomaly detection dashboard)
CREATE INDEX IF NOT EXISTS idx_suspicious_alerts_unacknowledged
    ON analytics.suspicious_activity_alerts(profile_id, detected_at DESC)
    WHERE acknowledged = FALSE;

-- ── Views for tenant data isolation ─────────────────────────────────────────
-- Convenience views to make per-tenant and platform queries explicit.
CREATE OR REPLACE VIEW analytics.tenant_dns_logs AS
    SELECT * FROM analytics.dns_query_logs
    WHERE tenant_id IS NOT NULL;

CREATE OR REPLACE VIEW analytics.platform_dns_logs AS
    SELECT * FROM analytics.dns_query_logs
    WHERE tenant_id IS NULL;
