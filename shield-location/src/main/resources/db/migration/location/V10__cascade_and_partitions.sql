-- V10: DB1 — Add ON DELETE CASCADE to geofence_events.geofence_id FK.
--       DB4 — Pre-create location_points 2027 Q2-Q4 and 2028 Q1 partitions.

-- ── DB1: ON DELETE CASCADE on geofence_events ────────────────────────────────
-- Previously: deleting a geofence with events raised FK constraint error.
-- With CASCADE: events are pruned automatically when the geofence is removed.
ALTER TABLE location.geofence_events
    DROP CONSTRAINT IF EXISTS geofence_events_geofence_id_fkey;

ALTER TABLE location.geofence_events
    ADD CONSTRAINT geofence_events_geofence_id_fkey
    FOREIGN KEY (geofence_id)
    REFERENCES location.geofences(id)
    ON DELETE CASCADE;

-- ── DB2: Unique constraint — one geofence name per profile ───────────────────
-- Prevents duplicate geofences with the same name for the same child.
ALTER TABLE location.geofences
    DROP CONSTRAINT IF EXISTS uq_geofences_profile_name;

ALTER TABLE location.geofences
    ADD CONSTRAINT uq_geofences_profile_name
    UNIQUE (profile_id, name);

-- ── DB4: 2027 Q2-Q4 and 2028 Q1 partitions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS location.location_points_2027_q2 PARTITION OF location.location_points
    FOR VALUES FROM ('2027-04-01') TO ('2027-07-01');

CREATE TABLE IF NOT EXISTS location.location_points_2027_q3 PARTITION OF location.location_points
    FOR VALUES FROM ('2027-07-01') TO ('2027-10-01');

CREATE TABLE IF NOT EXISTS location.location_points_2027_q4 PARTITION OF location.location_points
    FOR VALUES FROM ('2027-10-01') TO ('2028-01-01');

CREATE TABLE IF NOT EXISTS location.location_points_2028_q1 PARTITION OF location.location_points
    FOR VALUES FROM ('2028-01-01') TO ('2028-04-01');
