CREATE SCHEMA IF NOT EXISTS location;

CREATE TABLE location.location_points (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    profile_id  UUID NOT NULL,
    device_id   UUID,
    latitude    DECIMAL(10,8) NOT NULL,
    longitude   DECIMAL(11,8) NOT NULL,
    accuracy    DECIMAL(8,2),
    altitude    DECIMAL(10,2),
    speed       DECIMAL(8,2),
    heading     DECIMAL(6,2),
    battery_pct INTEGER,
    is_moving   BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE location.location_points_2026_q1 PARTITION OF location.location_points
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE location.location_points_2026_q2 PARTITION OF location.location_points
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE location.location_points_2026_q3 PARTITION OF location.location_points
    FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE location.location_points_2026_q4 PARTITION OF location.location_points
    FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
CREATE TABLE location.location_points_2027_q1 PARTITION OF location.location_points
    FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');

CREATE INDEX idx_loc_profile_time ON location.location_points (profile_id, recorded_at DESC);

CREATE TABLE location.geofences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    profile_id  UUID NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    center_lat  DECIMAL(10,8) NOT NULL,
    center_lng  DECIMAL(11,8) NOT NULL,
    radius_meters DECIMAL(10,2) NOT NULL DEFAULT 100,
    is_active   BOOLEAN DEFAULT TRUE,
    alert_on_enter BOOLEAN DEFAULT TRUE,
    alert_on_exit  BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofence_profile ON location.geofences (profile_id, is_active);

CREATE TABLE location.geofence_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    profile_id  UUID NOT NULL,
    geofence_id UUID NOT NULL REFERENCES location.geofences(id),
    event_type  VARCHAR(20) NOT NULL CHECK (event_type IN ('ENTER','EXIT')),
    latitude    DECIMAL(10,8),
    longitude   DECIMAL(11,8),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified    BOOLEAN DEFAULT FALSE
);

CREATE TABLE location.sos_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    profile_id  UUID NOT NULL,
    latitude    DECIMAL(10,8),
    longitude   DECIMAL(11,8),
    message     VARCHAR(500),
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ACKNOWLEDGED','RESOLVED')),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sos_profile ON location.sos_events (profile_id, status);

CREATE TABLE location.named_places (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    profile_id  UUID NOT NULL,
    name        VARCHAR(100) NOT NULL,
    place_type  VARCHAR(50) DEFAULT 'CUSTOM',
    center_lat  DECIMAL(10,8) NOT NULL,
    center_lng  DECIMAL(11,8) NOT NULL,
    radius_meters DECIMAL(10,2) NOT NULL DEFAULT 150,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON SCHEMA location TO shield;
GRANT ALL ON ALL TABLES IN SCHEMA location TO shield;
GRANT ALL ON ALL SEQUENCES IN SCHEMA location TO shield;
