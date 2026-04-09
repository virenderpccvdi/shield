-- V15: Schema fixes identified in audit
-- 1. Add missing updated_at trigger for contact_leads (was missed in V14)
-- The trigger function already exists (set_updated_at) from V14
CREATE TRIGGER set_contact_leads_updated_at
    BEFORE UPDATE ON admin.contact_leads
    FOR EACH ROW EXECUTE FUNCTION admin.set_updated_at();

-- 2. Remove duplicate indexes (created in both V12/V13 and V14)
DROP INDEX IF EXISTS admin.idx_contact_leads_created_at;  -- duplicate of idx_leads_created
DROP INDEX IF EXISTS admin.idx_website_visitors_visited_at;  -- duplicate of idx_visitors_visited

-- 3. Add CHECK constraint for ai_settings provider
ALTER TABLE admin.ai_settings
    ADD CONSTRAINT chk_ai_provider
    CHECK (provider IN ('DEEPSEEK', 'ANTHROPIC', 'OPENAI'));

-- 4. Add index for contact_leads.assigned_to (FK without index)
CREATE INDEX IF NOT EXISTS idx_contact_leads_assigned_to ON admin.contact_leads(assigned_to) WHERE assigned_to IS NOT NULL;
