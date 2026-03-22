-- PO-06: Advanced Parental Control Schedule
-- Allows parents to define multiple named day-of-week + time-of-day access windows
-- per child profile, with optional hard DNS block outside the allowed window.

CREATE TABLE IF NOT EXISTS dns.access_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL,
    name            VARCHAR(100) NOT NULL,       -- e.g. "School Week", "Weekend"
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    -- Bitmask for days: bit 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    days_bitmask    INTEGER NOT NULL DEFAULT 31,  -- 31 = Mon-Fri (bits 0-4 set)
    allow_start     TIME NOT NULL DEFAULT '07:00',
    allow_end       TIME NOT NULL DEFAULT '21:00',
    -- When true, DNS is blocked outside the allow_start..allow_end window on matching days
    block_outside   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_as_profile ON dns.access_schedules(profile_id);
