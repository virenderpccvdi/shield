-- Contact leads from website contact form
CREATE TABLE IF NOT EXISTS admin.contact_leads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(30),
    company       VARCHAR(255),
    message       TEXT,
    source        VARCHAR(50) DEFAULT 'website',
    status        VARCHAR(20) DEFAULT 'NEW',
    notes         TEXT,
    assigned_to   UUID,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON admin.contact_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON admin.contact_leads(created_at DESC);

-- Website visitor analytics
CREATE TABLE IF NOT EXISTS admin.website_visitors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    VARCHAR(64),
    ip_address    VARCHAR(45),
    country       VARCHAR(100),
    region        VARCHAR(100),
    city          VARCHAR(100),
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    page_path     VARCHAR(500),
    referrer      VARCHAR(500),
    user_agent    TEXT,
    is_mobile     BOOLEAN DEFAULT FALSE,
    visited_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visitors_visited ON admin.website_visitors(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_country ON admin.website_visitors(country);
CREATE INDEX IF NOT EXISTS idx_visitors_session ON admin.website_visitors(session_id);
