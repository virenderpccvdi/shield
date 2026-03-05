-- Platform-wide DNS defaults (single row, tenant_id=NULL, profile_id=NULL sentinel)
CREATE TABLE dns.platform_defaults (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled_categories  JSONB NOT NULL DEFAULT '{}',
    custom_allowlist    JSONB NOT NULL DEFAULT '[]',
    custom_blocklist    JSONB NOT NULL DEFAULT '[]',
    safesearch_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    youtube_restricted  BOOLEAN NOT NULL DEFAULT TRUE,
    ads_blocked         BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed single row with STRICT defaults
INSERT INTO dns.platform_defaults (enabled_categories, custom_allowlist, custom_blocklist)
VALUES (
  '{"malware":false,"phishing":false,"csam":false,"ransomware":false,"hacking":false,
    "vpn_proxy":false,"anonymizers":false,"tor":false,"adult":false,"pornography":false,
    "nudity":false,"dating":false,"hate_speech":false,"violence":false,"weapons":false,
    "gambling":false,"alcohol":false,"tobacco":false,"drugs":false,"crypto":false,
    "gaming":true,"online_gaming":true,"esports":true,"social_media":true,"messaging":true,
    "streaming":true,"music":true,"podcasts":true,"live_streaming":true,"chat":true,
    "forums":true,"downloads":true,"software":true,"shopping":true,"news":true,
    "sports":true,"entertainment":true,"humor":true,"education":true,"search_engines":true,
    "reference":true,"ads":true,"game_stores":true}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb
);

GRANT ALL ON dns.platform_defaults TO shield;
