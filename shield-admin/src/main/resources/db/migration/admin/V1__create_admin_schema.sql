CREATE SCHEMA IF NOT EXISTS admin;

CREATE TABLE admin.isp_branding (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL UNIQUE,
    app_name        VARCHAR(100) NOT NULL DEFAULT 'Shield',
    logo_url        VARCHAR(500),
    primary_color   VARCHAR(7) DEFAULT '#1565C0',
    secondary_color VARCHAR(7) DEFAULT '#42A5F5',
    support_email   VARCHAR(255),
    support_phone   VARCHAR(30),
    website_url     VARCHAR(500),
    app_bundle_id   VARCHAR(100),
    play_store_url  VARCHAR(500),
    custom_domain   VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin.tr069_provisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    device_serial   VARCHAR(255) NOT NULL,
    device_model    VARCHAR(100),
    mac_address     VARCHAR(17),
    ip_address      VARCHAR(45),
    dns_primary     VARCHAR(45),
    dns_secondary   VARCHAR(45),
    provision_status VARCHAR(30) DEFAULT 'PENDING' CHECK (provision_status IN ('PENDING','PROVISIONED','FAILED','DEPROVISIONED')),
    provisioned_at  TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ,
    raw_data        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, device_serial)
);
CREATE INDEX idx_tr069_tenant ON admin.tr069_provisions (tenant_id, provision_status);

CREATE TABLE admin.bulk_import_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    initiated_by    UUID NOT NULL,
    job_type        VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER_IMPORT',
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
    total_records   INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    success_count   INTEGER DEFAULT 0,
    failure_count   INTEGER DEFAULT 0,
    error_details   JSONB,
    file_name       VARCHAR(255),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_import_tenant ON admin.bulk_import_jobs (tenant_id, created_at DESC);

CREATE TABLE admin.compliance_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    report_type     VARCHAR(50) NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    report_data     JSONB,
    generated_by    UUID,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    file_url        VARCHAR(500)
);

GRANT ALL ON SCHEMA admin TO shield;
GRANT ALL ON ALL TABLES IN SCHEMA admin TO shield;
GRANT ALL ON ALL SEQUENCES IN SCHEMA admin TO shield;
