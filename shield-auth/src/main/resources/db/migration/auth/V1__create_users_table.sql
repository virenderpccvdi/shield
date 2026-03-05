-- Shield Auth — V1: Create users table in auth schema

CREATE TABLE IF NOT EXISTS auth.users (
    id                     UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id              UUID,
    email                  VARCHAR(254) NOT NULL,
    password_hash          TEXT         NOT NULL,
    name                   VARCHAR(100) NOT NULL,
    phone                  VARCHAR(20),
    role                   VARCHAR(30)  NOT NULL DEFAULT 'CUSTOMER',
    email_verified         BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at          TIMESTAMPTZ,
    failed_login_attempts  INT          NOT NULL DEFAULT 0,
    locked_until           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at             TIMESTAMPTZ,

    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX idx_users_tenant   ON auth.users (tenant_id);
CREATE INDEX idx_users_role     ON auth.users (role);
CREATE INDEX idx_users_active   ON auth.users (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_users_email_ni ON auth.users (LOWER(email));
