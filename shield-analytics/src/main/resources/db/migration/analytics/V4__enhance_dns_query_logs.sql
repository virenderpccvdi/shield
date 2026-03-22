-- V4: Enhance dns_query_logs with root_domain, app_name, and is_cdn columns
-- for efficient app-level aggregation and CDN traffic identification.

ALTER TABLE analytics.dns_query_logs
    ADD COLUMN IF NOT EXISTS root_domain VARCHAR(253),
    ADD COLUMN IF NOT EXISTS app_name    VARCHAR(128),
    ADD COLUMN IF NOT EXISTS is_cdn      BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_dns_logs_root_domain
    ON analytics.dns_query_logs (profile_id, root_domain, queried_at);

CREATE INDEX IF NOT EXISTS idx_dns_logs_app_name
    ON analytics.dns_query_logs (profile_id, app_name);
