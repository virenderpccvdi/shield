-- Shield Tenant — V1: Create tenants table

CREATE TABLE IF NOT EXISTS tenant.tenants (
    id                          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id                   UUID,              -- NULL (tenants table itself is not tenant-scoped)
    slug                        VARCHAR(63)  NOT NULL,
    name                        VARCHAR(150) NOT NULL,
    contact_email               VARCHAR(254),
    contact_phone               VARCHAR(20),
    logo_url                    TEXT,
    primary_color               VARCHAR(9)   NOT NULL DEFAULT '#1565C0',
    plan                        VARCHAR(20)  NOT NULL DEFAULT 'STARTER',
    max_customers               INT          NOT NULL DEFAULT 100,
    max_profiles_per_customer   INT          NOT NULL DEFAULT 5,
    features                    JSONB        NOT NULL DEFAULT '{}',
    is_active                   BOOLEAN      NOT NULL DEFAULT TRUE,
    trial_ends_at               TIMESTAMPTZ,
    subscription_ends_at        TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ,

    CONSTRAINT uq_tenants_slug UNIQUE (slug)
);

CREATE INDEX idx_tenants_active  ON tenant.tenants (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tenants_plan    ON tenant.tenants (plan);
