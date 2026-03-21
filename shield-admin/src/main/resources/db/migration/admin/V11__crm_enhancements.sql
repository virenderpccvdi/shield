-- Enhance contact_leads with pipeline fields
ALTER TABLE admin.contact_leads
    ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(20) DEFAULT 'NEW',
    ADD COLUMN IF NOT EXISTS deal_value     DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS follow_up_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tags           JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS lost_reason    TEXT,
    ADD COLUMN IF NOT EXISTS country        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS city           VARCHAR(100);

-- CRM activity log (calls, emails, meetings, notes per lead)
CREATE TABLE IF NOT EXISTS admin.crm_activities (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id      UUID NOT NULL REFERENCES admin.contact_leads(id) ON DELETE CASCADE,
    type         VARCHAR(20) NOT NULL,  -- NOTE, CALL, EMAIL, MEETING, TASK
    title        VARCHAR(255),
    description  TEXT,
    outcome      VARCHAR(50),           -- COMPLETED, NO_ANSWER, RESCHEDULED, etc.
    performed_by UUID,
    performed_by_name VARCHAR(255),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON admin.crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON admin.crm_activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_date ON admin.crm_activities(performed_at DESC);
