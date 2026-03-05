-- Shield Tenant — V3: Auto-update updated_at

CREATE OR REPLACE FUNCTION tenant.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenant.tenants
    FOR EACH ROW EXECUTE FUNCTION tenant.set_updated_at();
