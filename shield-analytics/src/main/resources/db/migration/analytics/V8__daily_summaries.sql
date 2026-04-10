-- AN2: Pre-computed daily analytics summaries table
-- Populated nightly at 1 AM by DailySummaryJob

CREATE TABLE IF NOT EXISTS analytics.daily_summaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    profile_id      UUID,  -- NULL = tenant-wide summary
    summary_date    DATE NOT NULL,
    total_queries   INTEGER DEFAULT 0,
    total_blocks    INTEGER DEFAULT 0,
    unique_domains  INTEGER DEFAULT 0,
    top_category    VARCHAR(100),
    screen_time_mins INTEGER DEFAULT 0,
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, profile_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_tenant_date
    ON analytics.daily_summaries(tenant_id, summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_profile_date
    ON analytics.daily_summaries(profile_id, summary_date DESC)
    WHERE profile_id IS NOT NULL;
