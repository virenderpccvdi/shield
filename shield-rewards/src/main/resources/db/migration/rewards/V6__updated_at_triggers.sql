-- V6: Add missing updated_at trigger for rewards schema.
-- reward_bank has updated_at column but no trigger (HIGH-03).

CREATE OR REPLACE FUNCTION rewards.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_reward_bank_updated_at ON rewards.reward_bank;
CREATE TRIGGER trg_reward_bank_updated_at
    BEFORE UPDATE ON rewards.reward_bank
    FOR EACH ROW EXECUTE FUNCTION rewards.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON rewards.tasks;
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON rewards.tasks
    FOR EACH ROW EXECUTE FUNCTION rewards.set_updated_at();
