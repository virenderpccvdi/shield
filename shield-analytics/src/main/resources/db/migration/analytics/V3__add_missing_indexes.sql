-- V3: Add missing indexes for analytics service
-- Note: idx_dns_logs_profile_time, idx_dns_logs_domain, idx_dns_logs_action, idx_dns_logs_tenant_time
--       already exist from V1 on dns_query_logs (partitioned table)

-- Composite index for blocked/allowed queries by profile (action column, not a boolean)
CREATE INDEX IF NOT EXISTS idx_dns_query_logs_profile_action
  ON analytics.dns_query_logs(profile_id, action, queried_at DESC);

-- Index for usage_summaries tenant-level queries
CREATE INDEX IF NOT EXISTS idx_usage_summaries_tenant_date
  ON analytics.usage_summaries(tenant_id, summary_date DESC);
