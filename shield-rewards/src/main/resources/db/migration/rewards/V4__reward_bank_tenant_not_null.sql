-- V4: Make reward_bank.tenant_id NOT NULL with a default for existing rows
-- Backfill existing rows from child_profiles before applying constraint
UPDATE rewards.reward_bank rb
SET tenant_id = cp.tenant_id
FROM profile.child_profiles cp
WHERE cp.id = rb.profile_id
  AND rb.tenant_id IS NULL;

ALTER TABLE rewards.reward_bank
    ALTER COLUMN tenant_id SET NOT NULL;
