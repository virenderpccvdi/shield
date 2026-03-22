-- V8: Performance indexes on tenant schema.
-- Addresses CRITICAL-03 (GIN on features JSONB) from DB audit.

-- ── tenants — JSONB features ─────────────────────────────────────────────────
-- FeatureGateService queries features JSONB by key on every feature check.
-- Without a GIN index this is a full table scan per request.
CREATE INDEX IF NOT EXISTS idx_tenants_features_gin
    ON tenant.tenants USING GIN (features);

-- Active tenant filter (most queries skip inactive tenants)
CREATE INDEX IF NOT EXISTS idx_tenants_active
    ON tenant.tenants(id, plan)
    WHERE is_active = TRUE;

-- Slug lookup (DNS provisioning, routing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug
    ON tenant.tenants(slug)
    WHERE slug IS NOT NULL;
