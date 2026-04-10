-- V25__dns_lookup_indexes.sql
-- Performance indexes for DNS lookup hot-path.
-- V16 already added GIN indexes on enabled_categories / custom lists.
-- These partial B-tree indexes target the three most frequent query patterns:
--   1. Blocklist domain active lookups (DNS resolver checks per query)
--   2. Blocklist category scans (filter enforcement)
--   3. Custom rules by profile (profile-level allow/block resolution)

-- DNS resolver: look up a domain in the active blocklist
CREATE INDEX IF NOT EXISTS idx_blocklist_domain_active
    ON dns.domain_blocklist(domain)
    WHERE is_active = TRUE;

-- Filter category enforcement: scan all active entries per category
CREATE INDEX IF NOT EXISTS idx_blocklist_category_active
    ON dns.domain_blocklist(category_id, is_active);

-- Custom rules per profile (used if a dns.custom_rules table exists or is added later)
-- Guard: only create if the table exists to avoid migration failure on fresh installs
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'dns'
          AND table_name = 'custom_rules'
    ) THEN
        EXECUTE '
            CREATE INDEX IF NOT EXISTS idx_custom_rules_profile
                ON dns.custom_rules(profile_id, is_active)
                WHERE is_active = TRUE
        ';
    END IF;
END
$$;

-- Partial index on domain_blocklist source for curated vs manual split queries
CREATE INDEX IF NOT EXISTS idx_blocklist_source
    ON dns.domain_blocklist(source)
    WHERE source IS NOT NULL;

-- Covering index for category + domain combo (DNS resolver category check)
CREATE INDEX IF NOT EXISTS idx_blocklist_category_domain
    ON dns.domain_blocklist(category_id, domain)
    WHERE is_active = TRUE;
