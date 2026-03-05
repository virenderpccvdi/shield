-- Shield Profile — V5: Family members and invites tables

CREATE TABLE IF NOT EXISTS profile.family_members (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    family_id   UUID         NOT NULL,
    user_id     UUID         NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'GUARDIAN',
    invited_by  UUID,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_members_family  ON profile.family_members (family_id);
CREATE INDEX idx_family_members_user    ON profile.family_members (user_id);

CREATE TABLE IF NOT EXISTS profile.family_invites (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,
    family_id   UUID         NOT NULL,
    invited_by  UUID         NOT NULL,
    email       VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'CO_PARENT',
    token       VARCHAR(255) NOT NULL UNIQUE,
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_invites_token   ON profile.family_invites (token);
CREATE INDEX idx_family_invites_email   ON profile.family_invites (email);
CREATE INDEX idx_family_invites_family  ON profile.family_invites (family_id);
