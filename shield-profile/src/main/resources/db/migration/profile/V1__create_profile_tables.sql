-- Shield Profile — V1: Customer accounts, child profiles, devices

CREATE SCHEMA IF NOT EXISTS profile;

-- Customer accounts (household subscriptions)
CREATE TABLE profile.customers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    user_id                 UUID NOT NULL UNIQUE,
    subscription_plan       VARCHAR(50)  NOT NULL DEFAULT 'BASIC',
    subscription_status     VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    subscription_expires_at TIMESTAMPTZ,
    max_profiles            INTEGER      NOT NULL DEFAULT 5,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_tenant   ON profile.customers(tenant_id);
CREATE INDEX idx_customers_user     ON profile.customers(user_id);

-- Child profiles
CREATE TABLE profile.child_profiles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID         NOT NULL,
    customer_id    UUID         NOT NULL REFERENCES profile.customers(id) ON DELETE CASCADE,
    name           VARCHAR(100) NOT NULL,
    avatar_url     TEXT,
    date_of_birth  DATE,
    age_group      VARCHAR(20)  NOT NULL DEFAULT 'CHILD',
    dns_client_id  VARCHAR(100) NOT NULL UNIQUE,
    filter_level   VARCHAR(20)  NOT NULL DEFAULT 'STRICT',
    notes          TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_child_profiles_customer ON profile.child_profiles(customer_id);
CREATE INDEX idx_child_profiles_dns      ON profile.child_profiles(dns_client_id);

-- Devices registered to child profiles
CREATE TABLE profile.devices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID         NOT NULL,
    profile_id   UUID         NOT NULL REFERENCES profile.child_profiles(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    device_type  VARCHAR(50),
    mac_address  VARCHAR(50),
    is_online    BOOLEAN      NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    dns_method   VARCHAR(20)  NOT NULL DEFAULT 'DOH',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_devices_profile ON profile.devices(profile_id);
