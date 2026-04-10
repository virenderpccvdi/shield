-- V25__dns_lookup_indexes.sql
-- Performance indexes for DNS lookup hot-path.
-- V16 already added GIN indexes on enabled_categories / custom lists.
-- Note: domain_blocklist has no is_active column — indexes are non-partial.

-- DNS resolver: look up a domain in the blocklist by domain
CREATE INDEX IF NOT EXISTS idx_blocklist_domain_lookup
    ON dns.domain_blocklist(domain);

-- Filter category enforcement: scan all entries per category
CREATE INDEX IF NOT EXISTS idx_blocklist_category_active
    ON dns.domain_blocklist(category_id);

-- Partial index on domain_blocklist source for curated vs manual split queries
CREATE INDEX IF NOT EXISTS idx_blocklist_source
    ON dns.domain_blocklist(source)
    WHERE source IS NOT NULL;

-- Covering index for category + domain combo (DNS resolver category check)
CREATE INDEX IF NOT EXISTS idx_blocklist_category_domain
    ON dns.domain_blocklist(category_id, domain);
