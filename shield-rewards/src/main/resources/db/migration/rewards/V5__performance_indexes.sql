-- V5: Performance indexes on rewards schema.
-- Addresses CRITICAL-01 (FK index), CRITICAL-02 (tenant), MEDIUM-01 (composite).

-- ── tasks ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_tenant
    ON rewards.tasks(tenant_id);

-- Most common query: active tasks for a profile with status filter
CREATE INDEX IF NOT EXISTS idx_tasks_profile_status_active
    ON rewards.tasks(profile_id, status)
    WHERE is_active = TRUE;

-- Parent pending approvals: profile + status SUBMITTED
CREATE INDEX IF NOT EXISTS idx_tasks_profile_submitted
    ON rewards.tasks(profile_id, created_at DESC)
    WHERE status = 'SUBMITTED';

-- ── reward_bank ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reward_bank_tenant
    ON rewards.reward_bank(tenant_id);

-- Fast lookup for balance queries
CREATE INDEX IF NOT EXISTS idx_reward_bank_profile_id
    ON rewards.reward_bank(profile_id);

-- ── reward_transactions ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reward_txn_tenant
    ON rewards.reward_transactions(tenant_id);

-- FK index — task_id is not indexed
CREATE INDEX IF NOT EXISTS idx_reward_txn_task_id
    ON rewards.reward_transactions(task_id);

-- Profile transaction history (most recent first)
CREATE INDEX IF NOT EXISTS idx_reward_txn_profile_created
    ON rewards.reward_transactions(profile_id, created_at DESC);
