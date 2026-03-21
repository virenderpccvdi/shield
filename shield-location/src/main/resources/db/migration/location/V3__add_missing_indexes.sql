-- V3: Add missing indexes for geofence_events and named_places
-- Note: idx_loc_profile_time already exists from V1 (location_points)
-- Note: idx_geofence_profile already exists from V1 (geofences)

-- Index for geofence_events queries by profile_id (most common query)
CREATE INDEX IF NOT EXISTS idx_geofence_events_profile_occurred
  ON location.geofence_events(profile_id, occurred_at DESC);

-- Index for geofence_events queries by geofence_id
CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_occurred
  ON location.geofence_events(geofence_id, occurred_at DESC);

-- Index for named_places queries by profile_id
CREATE INDEX IF NOT EXISTS idx_named_places_profile
  ON location.named_places(profile_id);

-- Index for named_places active lookup (partial index)
CREATE INDEX IF NOT EXISTS idx_named_places_profile_active
  ON location.named_places(profile_id, is_active) WHERE is_active = true;

-- Index for geofences active lookup (partial index — supplements existing non-partial idx_geofence_profile)
CREATE INDEX IF NOT EXISTS idx_geofences_profile_active
  ON location.geofences(profile_id, is_active) WHERE is_active = true;

GRANT ALL ON ALL TABLES IN SCHEMA location TO shield;
