-- V14: Add missing updated_at triggers + index for visitor log pagination.
-- Also adds index on website_visitors for paginated queries.

CREATE OR REPLACE FUNCTION admin.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- isp_branding (has updated_at but no trigger)
DROP TRIGGER IF EXISTS trg_isp_branding_updated_at ON admin.isp_branding;
CREATE TRIGGER trg_isp_branding_updated_at
    BEFORE UPDATE ON admin.isp_branding
    FOR EACH ROW EXECUTE FUNCTION admin.set_updated_at();

-- ai_settings
DROP TRIGGER IF EXISTS trg_ai_settings_updated_at ON admin.ai_settings;
CREATE TRIGGER trg_ai_settings_updated_at
    BEFORE UPDATE ON admin.ai_settings
    FOR EACH ROW EXECUTE FUNCTION admin.set_updated_at();

-- subscription_plans
DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON admin.subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at
    BEFORE UPDATE ON admin.subscription_plans
    FOR EACH ROW EXECUTE FUNCTION admin.set_updated_at();

-- ── Visitor log pagination indexes ──────────────────────────────────────────
-- website_visitors uses visited_at (not created_at), no source column
CREATE INDEX IF NOT EXISTS idx_website_visitors_visited_at
    ON admin.website_visitors(visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_visitors_country_visited
    ON admin.website_visitors(country, visited_at DESC);

-- Contact leads pagination (indexes may already exist — IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_contact_leads_created_at
    ON admin.contact_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_leads_status_created
    ON admin.contact_leads(status, created_at DESC);
