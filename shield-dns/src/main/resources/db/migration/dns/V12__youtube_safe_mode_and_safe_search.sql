-- PC-05: YouTube Safe Mode Enforcer (DNS CNAME rewrite to restrict.youtube.com)
-- PC-06: Safe Search Enforcer (DNS CNAME rewrite to forcesafesearch / strict.bing.com / safe.duckduckgo.com)
ALTER TABLE dns.dns_rules
    ADD COLUMN IF NOT EXISTS youtube_safe_mode  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS safe_search        BOOLEAN NOT NULL DEFAULT FALSE;
