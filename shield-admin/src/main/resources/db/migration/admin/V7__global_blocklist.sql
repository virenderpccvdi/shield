-- Global blocklist: domains blocked across all tenants by the platform admin
CREATE TABLE IF NOT EXISTS admin.global_blocklist (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain       VARCHAR(255) NOT NULL UNIQUE,
    reason       VARCHAR(500),
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    added_by     UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_blocklist_domain      ON admin.global_blocklist (domain);
CREATE INDEX IF NOT EXISTS idx_global_blocklist_emergency   ON admin.global_blocklist (is_emergency);
CREATE INDEX IF NOT EXISTS idx_global_blocklist_created_at  ON admin.global_blocklist (created_at DESC);
