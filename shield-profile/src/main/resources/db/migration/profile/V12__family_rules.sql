CREATE TABLE IF NOT EXISTS profile.family_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    icon        VARCHAR(50) DEFAULT 'rule',
    active      BOOLEAN NOT NULL DEFAULT true,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_rules_customer ON profile.family_rules(customer_id, active);
