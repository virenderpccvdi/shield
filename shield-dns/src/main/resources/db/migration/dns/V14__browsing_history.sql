-- PO-02: Safe Browsing History
-- Stores per-profile DNS query events so parents can review what domains were
-- queried and whether each was blocked by the DNS filter.

CREATE TABLE IF NOT EXISTS dns.browsing_history (
    id           BIGSERIAL PRIMARY KEY,
    profile_id   UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    domain       VARCHAR(255) NOT NULL,
    was_blocked  BOOLEAN NOT NULL DEFAULT FALSE,
    category     VARCHAR(64),
    query_type   VARCHAR(10) DEFAULT 'A',
    client_ip    VARCHAR(45),
    queried_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bh_profile_time ON dns.browsing_history(profile_id, queried_at DESC);
CREATE INDEX idx_bh_tenant_time  ON dns.browsing_history(tenant_id,  queried_at DESC);
