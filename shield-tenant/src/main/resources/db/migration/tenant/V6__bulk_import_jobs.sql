-- IS-03: Bulk Customer Import — job tracking table
CREATE TABLE IF NOT EXISTS tenant.bulk_import_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  filename         VARCHAR(255),
  total_rows       INT NOT NULL DEFAULT 0,
  success_rows     INT NOT NULL DEFAULT 0,
  failed_rows      INT NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_details    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_import_tenant
  ON tenant.bulk_import_jobs(tenant_id, created_at DESC);
