-- Shield Profile — V2: Auto-update updated_at

CREATE OR REPLACE FUNCTION profile.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON profile.customers
    FOR EACH ROW EXECUTE FUNCTION profile.set_updated_at();

CREATE TRIGGER trg_child_profiles_updated_at
    BEFORE UPDATE ON profile.child_profiles
    FOR EACH ROW EXECUTE FUNCTION profile.set_updated_at();
