-- Add filter_level to dns_rules so the resolver can read it without cross-schema join
ALTER TABLE dns.dns_rules
    ADD COLUMN IF NOT EXISTS filter_level VARCHAR(20) NOT NULL DEFAULT 'MODERATE';

-- Backfill from profile.child_profiles
UPDATE dns.dns_rules dr
SET    filter_level = cp.filter_level
FROM   profile.child_profiles cp
WHERE  cp.id = dr.profile_id
AND    cp.filter_level IS NOT NULL;
