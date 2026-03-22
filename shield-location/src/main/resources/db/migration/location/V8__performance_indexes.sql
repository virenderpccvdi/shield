-- V8: Performance indexes on location schema.
-- Addresses CRITICAL-02 (tenant indexes) from DB audit.

-- ── location_points (partitioned) ───────────────────────────────────────────
-- Tenant index on parent — propagates to all partitions
CREATE INDEX IF NOT EXISTS idx_location_points_tenant
    ON location.location_points(tenant_id);

-- Profile + time range queries (most common access pattern)
-- Note: partition index on (profile_id, recorded_at) already exists per V1 conventions
-- Adding tenant-scoped variant for ISP admin queries
CREATE INDEX IF NOT EXISTS idx_location_points_tenant_profile
    ON location.location_points(tenant_id, profile_id, recorded_at DESC);

-- ── geofence_events ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_id
    ON location.geofence_events(geofence_id);

CREATE INDEX IF NOT EXISTS idx_geofence_events_profile_occurred
    ON location.geofence_events(profile_id, occurred_at DESC);

-- ── geofences ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_geofences_profile_id
    ON location.geofences(profile_id);

CREATE INDEX IF NOT EXISTS idx_geofences_tenant_id
    ON location.geofences(tenant_id);

-- ── spoofing_alerts (no tenant_id column) ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_spoofing_alerts_profile_detected
    ON location.spoofing_alerts(profile_id, detected_at DESC);

-- ── named_places ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_named_places_profile_id
    ON location.named_places(profile_id);

-- ── sos_events ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sos_events_tenant
    ON location.sos_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_sos_events_profile_created
    ON location.sos_events(profile_id, created_at DESC);

-- Active/unacknowledged SOS fast lookup (triggered but not yet resolved)
CREATE INDEX IF NOT EXISTS idx_sos_events_active
    ON location.sos_events(profile_id, triggered_at DESC)
    WHERE acknowledged_at IS NULL;
