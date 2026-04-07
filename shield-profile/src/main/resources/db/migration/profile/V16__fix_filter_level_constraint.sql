-- V16: Update filter_level check constraint to match current codebase values.
-- Old constraint allowed: STRICT, MODERATE, PERMISSIVE
-- New constraint allows:  MAXIMUM, STRICT, MODERATE, RELAXED, LIGHT, MINIMAL, CUSTOM

ALTER TABLE profile.child_profiles
    DROP CONSTRAINT IF EXISTS chk_child_filter_level;

ALTER TABLE profile.child_profiles
    ADD CONSTRAINT chk_child_filter_level
    CHECK (filter_level IN ('MAXIMUM','STRICT','MODERATE','RELAXED','LIGHT','MINIMAL','CUSTOM'));
