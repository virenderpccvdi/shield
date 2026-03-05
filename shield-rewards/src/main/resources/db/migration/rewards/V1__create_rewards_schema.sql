CREATE SCHEMA IF NOT EXISTS rewards;

CREATE TABLE rewards.tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    profile_id      UUID NOT NULL,
    created_by      UUID NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     VARCHAR(1000),
    reward_minutes  INTEGER NOT NULL DEFAULT 30,
    reward_points   INTEGER NOT NULL DEFAULT 10,
    due_date        DATE,
    recurrence      VARCHAR(20) DEFAULT 'ONCE' CHECK (recurrence IN ('ONCE','DAILY','WEEKLY')),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUBMITTED','APPROVED','REJECTED','EXPIRED')),
    is_active       BOOLEAN DEFAULT TRUE,
    submitted_at    TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    approved_by     UUID,
    rejection_note  VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tasks_profile ON rewards.tasks (profile_id, status, is_active);

CREATE TABLE rewards.reward_bank (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    profile_id      UUID NOT NULL UNIQUE,
    points_balance  INTEGER NOT NULL DEFAULT 0,
    minutes_balance INTEGER NOT NULL DEFAULT 0,
    total_earned_points  INTEGER NOT NULL DEFAULT 0,
    total_earned_minutes INTEGER NOT NULL DEFAULT 0,
    streak_days     INTEGER NOT NULL DEFAULT 0,
    last_task_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rewards.reward_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    profile_id      UUID NOT NULL,
    task_id         UUID REFERENCES rewards.tasks(id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('EARN','REDEEM','BONUS','DEDUCT')),
    points          INTEGER NOT NULL DEFAULT 0,
    minutes         INTEGER NOT NULL DEFAULT 0,
    description     VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_txn_profile ON rewards.reward_transactions (profile_id, created_at DESC);

CREATE TABLE rewards.achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    profile_id      UUID NOT NULL,
    badge_type      VARCHAR(50) NOT NULL,
    badge_name      VARCHAR(100) NOT NULL,
    description     VARCHAR(500),
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, badge_type)
);
CREATE INDEX idx_achieve_profile ON rewards.achievements (profile_id);

GRANT ALL ON SCHEMA rewards TO shield;
GRANT ALL ON ALL TABLES IN SCHEMA rewards TO shield;
GRANT ALL ON ALL SEQUENCES IN SCHEMA rewards TO shield;
