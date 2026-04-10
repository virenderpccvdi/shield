-- V7: Category composite index + 2027 Q2/Q3/Q4 and 2028 Q1 partitions.
-- DB3: Composite index for AI insights category queries (used by shield-ai get_profile_stats).
-- DB4: Pre-create future partitions so no query plan fallback occurs.

-- ── DB3: Category-scoped index ────────────────────────────────────────────────
-- Powers the per-category blocked/allowed counts in the AI insights pipeline.
-- Pattern: WHERE profile_id=? AND queried_at BETWEEN ? AND ? AND category IN (...)
CREATE INDEX IF NOT EXISTS idx_dns_logs_profile_category_time
    ON analytics.dns_query_logs (profile_id, category, queried_at DESC)
    WHERE category IS NOT NULL;

-- After-hours detection index (hour extraction is slow without this)
CREATE INDEX IF NOT EXISTS idx_dns_logs_profile_hour
    ON analytics.dns_query_logs (profile_id, EXTRACT(HOUR FROM queried_at));

-- ── DB4: 2027 Q2-Q4 and 2028 Q1 partitions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics.dns_query_logs_2027_q2 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2027-04-01') TO ('2027-07-01');

CREATE TABLE IF NOT EXISTS analytics.dns_query_logs_2027_q3 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2027-07-01') TO ('2027-10-01');

CREATE TABLE IF NOT EXISTS analytics.dns_query_logs_2027_q4 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2027-10-01') TO ('2028-01-01');

CREATE TABLE IF NOT EXISTS analytics.dns_query_logs_2028_q1 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2028-01-01') TO ('2028-04-01');

-- ── location_points after-hours index ────────────────────────────────────────
-- Not in shield-analytics but used by cross-service queries
-- (kept here as a comment — actual migration goes in shield-location V10)
