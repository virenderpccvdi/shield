# 04 — Database Design

## Database: `shield_db` on PostgreSQL 18 (port 5454)

Each microservice has its **own schema** for logical isolation. Flyway migrations are per-service. RLS policies enforce tenant data isolation.

```sql
-- Setup
CREATE DATABASE shield_db;
CREATE USER shield WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE shield_db TO shield;

-- Create schemas
\c shield_db
CREATE SCHEMA auth;
CREATE SCHEMA tenant;
CREATE SCHEMA profile;
CREATE SCHEMA dns;
CREATE SCHEMA location;
CREATE SCHEMA notification;
CREATE SCHEMA rewards;
CREATE SCHEMA analytics;
GRANT ALL ON SCHEMA auth, tenant, profile, dns, location, notification, rewards, analytics TO shield;
```

---

## Schema: `auth`

```sql
-- Users — all login accounts (Global Admin, ISP Admin, Customer)
CREATE TABLE auth.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,                           -- NULL for GLOBAL_ADMIN
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(50)  NOT NULL,          -- GLOBAL_ADMIN | ISP_ADMIN | CUSTOMER
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    mfa_enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
    mfa_secret      VARCHAR(100),
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_tenant ON auth.users(tenant_id);

-- Refresh tokens (also cached in Redis with TTL)
CREATE TABLE auth.refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    device_name     VARCHAR(100),
    ip_address      INET,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Child app tokens (long-lived device tokens)
CREATE TABLE auth.child_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    customer_id     UUID NOT NULL,
    device_name     VARCHAR(100),
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    pin_hash        VARCHAR(255) NOT NULL,           -- 4-digit PIN BCrypt
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE auth.password_resets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login audit log
CREATE TABLE auth.login_audit (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID,
    email           VARCHAR(255),
    ip_address      INET,
    user_agent      TEXT,
    success         BOOLEAN NOT NULL,
    failure_reason  VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

---

## Schema: `tenant`

```sql
-- ISP Tenants
CREATE TABLE tenant.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,     -- used in DoH subdomain
    plan_tier       VARCHAR(50)  NOT NULL DEFAULT 'STARTER',
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    country_code    VARCHAR(5),
    contact_email   VARCHAR(255),
    feature_flags   JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ISP branding / white-label config
CREATE TABLE tenant.tenant_branding (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID UNIQUE NOT NULL REFERENCES tenant.tenants(id),
    app_name        VARCHAR(100) NOT NULL DEFAULT 'Shield',
    logo_url        TEXT,
    primary_color   VARCHAR(7)   DEFAULT '#1976D2',
    secondary_color VARCHAR(7)   DEFAULT '#42A5F5',
    support_url     TEXT,
    support_email   VARCHAR(255),
    portal_domain   VARCHAR(255),
    privacy_policy_url TEXT,
    terms_url       TEXT,
    custom_legal_text TEXT
);

-- Resource quotas per tenant
CREATE TABLE tenant.tenant_quotas (
    tenant_id           UUID PRIMARY KEY REFERENCES tenant.tenants(id),
    max_customers       INTEGER NOT NULL DEFAULT 1000,
    max_profiles_total  INTEGER NOT NULL DEFAULT 5000,
    log_retention_days  INTEGER NOT NULL DEFAULT 30,
    api_rate_limit      INTEGER NOT NULL DEFAULT 100,
    max_devices_per_profile INTEGER NOT NULL DEFAULT 5
);

-- ISP-level domain blocklist
CREATE TABLE tenant.tenant_blocklist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenant.tenants(id),
    domain      VARCHAR(500) NOT NULL,
    reason      TEXT,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, domain)
);

-- Global blocklist entries (managed by Global Admin)
CREATE TABLE tenant.global_blocklist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain      VARCHAR(500) UNIQUE NOT NULL,
    category    VARCHAR(100),
    source      VARCHAR(100),          -- IWF, PhishTank, URLhaus, etc.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Schema: `profile`

```sql
-- Customer accounts (household / family subscription)
CREATE TABLE profile.customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,          -- references auth.users.id
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'BASIC',
    subscription_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    subscription_expires_at TIMESTAMPTZ,
    max_profiles    INTEGER NOT NULL DEFAULT 5,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_tenant ON profile.customers(tenant_id);
CREATE INDEX idx_customers_user ON profile.customers(user_id);

-- Family members / co-guardians (up to 4 per household)
CREATE TABLE profile.family_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES profile.customers(id),
    user_id         UUID NOT NULL,          -- references auth.users.id
    role            VARCHAR(20) NOT NULL DEFAULT 'SECONDARY', -- PRIMARY | SECONDARY
    invite_email    VARCHAR(255),
    invite_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Child profiles (managed entities — not login accounts)
CREATE TABLE profile.child_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    customer_id         UUID NOT NULL REFERENCES profile.customers(id),
    name                VARCHAR(100) NOT NULL,
    avatar_url          TEXT,
    date_of_birth       DATE,
    age_group           VARCHAR(20) NOT NULL DEFAULT 'CHILD',
    dns_client_id       VARCHAR(100) UNIQUE NOT NULL,  -- AdGuard client ID
    filter_level        VARCHAR(20) NOT NULL DEFAULT 'STRICT',
    notes               TEXT,                           -- private parent notes
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Age groups: TODDLER (0-5), CHILD (6-11), PRETEEN (10-12), TEEN (13-17)
-- Filter levels: MAXIMUM, STRICT, MODERATE, LIGHT, MINIMAL
CREATE INDEX idx_child_profiles_customer ON profile.child_profiles(customer_id);
CREATE INDEX idx_child_profiles_dns ON profile.child_profiles(dns_client_id);

-- Devices registered to child profiles
CREATE TABLE profile.devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    profile_id      UUID NOT NULL REFERENCES profile.child_profiles(id),
    name            VARCHAR(100) NOT NULL,
    device_type     VARCHAR(50),            -- PHONE, TABLET, LAPTOP, CONSOLE, TV
    mac_address     VARCHAR(50),
    last_ip         INET,
    last_seen_at    TIMESTAMPTZ,
    battery_level   INTEGER,
    is_online       BOOLEAN NOT NULL DEFAULT FALSE,
    dns_method      VARCHAR(20) DEFAULT 'DOH',  -- DOH, WIREGUARD, DHCP
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_devices_profile ON profile.devices(profile_id);
```

---

## Schema: `dns`

```sql
-- Per-profile DNS filtering rules
CREATE TABLE dns.dns_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    profile_id          UUID UNIQUE NOT NULL,
    -- Category enables (JSONB map of category → boolean)
    enabled_categories  JSONB NOT NULL DEFAULT '{}',
    -- Custom domain lists
    custom_allowlist    TEXT[],             -- always allow these domains
    custom_blocklist    TEXT[],             -- always block these domains
    -- Safety features
    safesearch_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    youtube_restricted  BOOLEAN NOT NULL DEFAULT TRUE,
    ads_blocked         BOOLEAN NOT NULL DEFAULT TRUE,
    -- Time budgets (JSONB map of app → daily minutes)
    time_budgets        JSONB NOT NULL DEFAULT '{}',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly schedule (24h × 7-day grid stored as JSONB)
CREATE TABLE dns.schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    profile_id          UUID UNIQUE NOT NULL,
    -- Grid: {monday: [0,0,0,...1,1,1,...] (24 hours, 1=blocked, 0=allowed)}
    grid                JSONB NOT NULL DEFAULT '{}',
    -- Active preset (null = custom)
    active_preset       VARCHAR(50),
    -- Temporary override
    override_active     BOOLEAN NOT NULL DEFAULT FALSE,
    override_type       VARCHAR(30),        -- PAUSE | HOMEWORK | FOCUS | BEDTIME_NOW
    override_ends_at    TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily time budget usage (Redis primary, PostgreSQL for persistence)
CREATE TABLE dns.budget_usage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID NOT NULL,
    date        DATE NOT NULL,
    app_usage   JSONB NOT NULL DEFAULT '{}',  -- {youtube: 45, tiktok: 20, ...} minutes
    UNIQUE(profile_id, date)
);

-- Time extension requests from child
CREATE TABLE dns.extension_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    customer_id     UUID NOT NULL,
    app_name        VARCHAR(100),
    requested_mins  INTEGER NOT NULL,
    message         TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Schema: `location`

```sql
-- GPS location points (partitioned by day for performance)
CREATE TABLE location.location_points (
    id              BIGSERIAL,
    tenant_id       UUID NOT NULL,
    profile_id      UUID NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    accuracy_m      REAL,
    altitude_m      REAL,
    speed_kmh       REAL,
    heading         REAL,
    address         TEXT,                   -- reverse-geocoded
    recorded_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

-- Create daily partitions (automate with pg_partman in production)
CREATE TABLE location.location_points_y2026m01 PARTITION OF location.location_points
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE INDEX idx_location_profile ON location.location_points(profile_id, recorded_at DESC);
CREATE INDEX idx_location_coords ON location.location_points USING GIST(
    ST_MakePoint(longitude, latitude)  -- requires PostGIS for geo queries
);

-- Geofences (circle or polygon)
CREATE TABLE location.geofences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    customer_id     UUID NOT NULL,
    profile_id      UUID,                   -- NULL = applies to all profiles
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(20) NOT NULL,   -- CIRCLE | POLYGON
    center_lat      DOUBLE PRECISION,       -- for CIRCLE type
    center_lng      DOUBLE PRECISION,
    radius_m        REAL,                   -- for CIRCLE type
    polygon_coords  JSONB,                  -- for POLYGON type [[lat,lng],...]
    alert_on_enter  BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_exit   BOOLEAN NOT NULL DEFAULT TRUE,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named places (Home, School, etc.)
CREATE TABLE location.named_places (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL,
    name            VARCHAR(100) NOT NULL,
    icon            VARCHAR(50),            -- home, school, sports, grandparents
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    radius_m        REAL NOT NULL DEFAULT 200,
    alert_on_arrival BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_departure BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Panic / SOS events
CREATE TABLE location.panic_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    customer_id     UUID NOT NULL,
    profile_id      UUID NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    address         TEXT,
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Schema: `rewards`

```sql
-- Tasks / chores created by parent
CREATE TABLE rewards.tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    profile_id      UUID NOT NULL,
    customer_id     UUID NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    emoji           VARCHAR(10),
    reward_minutes  INTEGER NOT NULL,       -- minutes of screen time awarded
    reward_app      VARCHAR(100),           -- specific app (null = general bank)
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    recurring       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task completion records
CREATE TABLE rewards.task_completions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES rewards.tasks(id),
    profile_id      UUID NOT NULL,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    notes           TEXT
);

-- Reward bank balance per profile
CREATE TABLE rewards.reward_bank (
    profile_id          UUID PRIMARY KEY,
    balance_minutes     INTEGER NOT NULL DEFAULT 0,
    total_earned        INTEGER NOT NULL DEFAULT 0,
    total_used          INTEGER NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Achievements / badges
CREATE TABLE rewards.achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    type            VARCHAR(100) NOT NULL,   -- SCREEN_TIME_CHAMPION, FOCUS_MASTER, etc.
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    streak_count    INTEGER
);

-- Streak tracking
CREATE TABLE rewards.streaks (
    profile_id      UUID PRIMARY KEY,
    current_streak  INTEGER NOT NULL DEFAULT 0,
    longest_streak  INTEGER NOT NULL DEFAULT 0,
    last_streak_date DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Schema: `analytics`

```sql
-- DNS query logs (primary analytics table)
-- Phase 1: PostgreSQL with partitioning | Phase 2: ClickHouse
CREATE TABLE analytics.dns_query_logs (
    id              BIGSERIAL,
    tenant_id       UUID NOT NULL,
    customer_id     UUID NOT NULL,
    profile_id      UUID NOT NULL,
    device_id       UUID,
    domain          VARCHAR(500) NOT NULL,
    category        VARCHAR(100),
    action          VARCHAR(20) NOT NULL,    -- ALLOWED | BLOCKED
    block_reason    VARCHAR(200),
    query_type      VARCHAR(10),             -- A | AAAA | CNAME
    response_ms     INTEGER,
    queried_at      TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (queried_at);

-- Create monthly partitions
CREATE TABLE analytics.dns_query_logs_y2026m01 PARTITION OF analytics.dns_query_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE INDEX idx_dns_profile_time ON analytics.dns_query_logs(profile_id, queried_at DESC);
CREATE INDEX idx_dns_tenant_time ON analytics.dns_query_logs(tenant_id, queried_at DESC);
CREATE INDEX idx_dns_domain ON analytics.dns_query_logs(domain);
CREATE INDEX idx_dns_action ON analytics.dns_query_logs(action, queried_at DESC);
```

---

## Redis Key Patterns

| Key Pattern | TTL | Purpose |
|------------|-----|---------|
| `rt:{userId}` | 30 days | Refresh token hash |
| `jwtbl:{jti}` | 1 hour | JWT blacklist (on logout) |
| `session:{userId}` | 1 hour | Session data cache |
| `budget:{profileId}:{app}` | Until midnight | Daily time budget usage |
| `budget:reset:{profileId}` | Until midnight | Midnight budget reset flag |
| `ratelimit:{ip}` | 1 minute | Rate limit counter |
| `ratelimit:user:{userId}` | 1 minute | Per-user rate limit |
| `online:{profileId}` | 5 minutes | Child device online presence |
| `battery:{profileId}` | 10 minutes | Last known battery level |
| `location:{profileId}` | 5 minutes | Last known GPS position cache |
| `geofence:{profileId}` | 10 minutes | Active geofences cache |
| `dns-rules:{profileId}` | 5 minutes | DNS rules cache (avoid DB hit per query) |
| `ai:queue` | — | AI analysis job queue (LIST) |

---

## Migration Strategy

Each service uses Flyway with its own schema and history table:

```yaml
# shield-auth/src/main/resources/application.yml
spring.flyway:
  schemas: auth
  table: schema_version   # per-service history table
  locations: classpath:db/migration/auth
  baseline-on-migrate: true
```

Migration files:
```
src/main/resources/db/migration/auth/
  V1__init_users.sql
  V2__add_refresh_tokens.sql
  V3__add_child_tokens.sql
  V4__add_login_audit.sql
```
