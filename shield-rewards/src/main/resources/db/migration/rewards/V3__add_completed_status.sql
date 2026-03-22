-- V3: Add COMPLETED to tasks status CHECK constraint
-- TaskService.completeTask() sets status='COMPLETED' which violated the V1 constraint.
ALTER TABLE rewards.tasks
    DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE rewards.tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('PENDING','SUBMITTED','APPROVED','REJECTED','EXPIRED','COMPLETED'));
