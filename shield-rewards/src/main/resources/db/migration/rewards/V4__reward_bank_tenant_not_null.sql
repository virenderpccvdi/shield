-- V4: Make reward_bank.tenant_id NOT NULL with a default for existing rows
-- Step 1: Backfill existing rows from child_profiles where a match exists
UPDATE rewards.reward_bank rb
SET tenant_id = cp.tenant_id
FROM profile.child_profiles cp
WHERE cp.id = rb.profile_id
  AND rb.tenant_id IS NULL;

-- Step 2: Delete orphaned reward_bank rows with no matching child profile
-- (These are test/demo data with fake profile UUIDs that no longer exist)
DELETE FROM rewards.reward_bank rb
WHERE rb.tenant_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM profile.child_profiles cp WHERE cp.id = rb.profile_id
  );

-- Step 3: Apply NOT NULL constraint (safe now — all remaining rows have tenant_id)
ALTER TABLE rewards.reward_bank
    ALTER COLUMN tenant_id SET NOT NULL;
