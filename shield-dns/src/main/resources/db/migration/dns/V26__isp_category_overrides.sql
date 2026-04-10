-- V26: ISP-level category force-block
-- Allows an ISP tenant to permanently block certain content categories for ALL
-- child profiles under that tenant. Customers cannot override these blocks.
--
-- isp_enforced column on content_categories: marks a category as a platform-wide
-- enforcement (managed by GLOBAL_ADMIN for all ISPs).
--
-- isp_category_overrides table: per-ISP category overrides (managed by ISP_ADMIN).

ALTER TABLE dns.filter_categories
    ADD COLUMN IF NOT EXISTS isp_enforced BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS dns.isp_category_overrides (
    tenant_id   UUID        NOT NULL,
    category    VARCHAR(100) NOT NULL,
    blocked     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, category)
);

CREATE INDEX IF NOT EXISTS idx_isp_cat_overrides_tenant
    ON dns.isp_category_overrides(tenant_id);

COMMENT ON TABLE dns.isp_category_overrides IS
    'Per-ISP category overrides. blocked=true means that category cannot be unblocked by customers.';
