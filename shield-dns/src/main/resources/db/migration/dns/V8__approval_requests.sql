-- FC-04: Two-way domain approval requests
-- Child requests access to a blocked domain; parent approves/denies from notification.
CREATE TABLE IF NOT EXISTS dns.approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  profile_id      UUID NOT NULL,
  customer_id     UUID,
  domain          VARCHAR(255),
  app_package     VARCHAR(255),
  request_type    VARCHAR(10) NOT NULL DEFAULT 'DOMAIN', -- DOMAIN or APP
  status          VARCHAR(10) NOT NULL DEFAULT 'PENDING', -- PENDING/APPROVED/DENIED/EXPIRED
  duration_type   VARCHAR(10), -- ONE_HOUR/TODAY/PERMANENT
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_req_profile ON dns.approval_requests(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_req_tenant  ON dns.approval_requests(tenant_id, status);
