-- Audit Logs table
CREATE TABLE IF NOT EXISTS admin.audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    user_name       VARCHAR(200),
    action          VARCHAR(50)    NOT NULL,
    resource_type   VARCHAR(50),
    resource_id     VARCHAR(200),
    details         JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user    ON admin.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON admin.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin.audit_logs (created_at DESC);

GRANT ALL ON admin.audit_logs TO shield;
