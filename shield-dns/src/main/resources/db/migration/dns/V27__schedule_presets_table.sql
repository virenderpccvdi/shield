-- V27: Schedule presets stored in DB
-- Allows admin-configurable schedule presets that are loaded with Redis caching
-- instead of being hardcoded in Java. is_default=true rows are shipped with the
-- platform and cannot be deleted via the API (only overridden).
--
-- grid JSONB: map of day → int[24] where 1=blocked, 0=allowed

CREATE TABLE IF NOT EXISTS dns.schedule_presets (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50)  NOT NULL UNIQUE,
    label       VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    grid        JSONB        NOT NULL,
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_presets_name ON dns.schedule_presets(name);

-- Seed the built-in presets (DO NOTHING on conflict so re-runs are safe)
INSERT INTO dns.schedule_presets (name, label, description, grid, is_default) VALUES
(
    'SCHOOL',
    'School Hours',
    'Blocks internet Mon–Fri 8am–4pm during school hours',
    '{
        "monday":    [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
        "tuesday":   [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
        "wednesday": [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
        "thursday":  [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
        "friday":    [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
        "saturday":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        "sunday":    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    }',
    true
),
(
    'BEDTIME',
    'Bedtime',
    'Blocks internet 10pm–7am every night',
    '{
        "monday":    [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        "tuesday":   [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        "wednesday": [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        "thursday":  [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        "friday":    [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        "saturday":  [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        "sunday":    [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
    }',
    true
),
(
    'STRICT',
    'Strict',
    'School hours + bedtime combined: blocks 8am–4pm weekdays and 10pm–7am every night',
    '{
        "monday":    [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1],
        "tuesday":   [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1],
        "wednesday": [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1],
        "thursday":  [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1],
        "friday":    [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1],
        "saturday":  [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        "sunday":    [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
    }',
    true
),
(
    'WEEKEND',
    'Weekend',
    'Blocks all internet Mon–Fri, weekends are open',
    '{
        "monday":    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        "tuesday":   [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        "wednesday": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        "thursday":  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        "friday":    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        "saturday":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        "sunday":    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    }',
    true
),
(
    'HOMEWORK',
    'Homework Mode',
    'Blocks internet 3pm–6pm Mon–Fri (after-school study window)',
    '{
        "monday":    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        "tuesday":   [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        "wednesday": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        "thursday":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        "friday":    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
        "saturday":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        "sunday":    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    }',
    true
)
ON CONFLICT (name) DO NOTHING;
