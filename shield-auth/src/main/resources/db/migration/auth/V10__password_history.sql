-- AU10: Password history — prevent reuse of last 5 passwords
CREATE TABLE IF NOT EXISTS auth.password_history (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON auth.password_history(user_id, created_at DESC);
