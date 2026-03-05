-- Shield DNS — V2: Updated-at triggers

CREATE OR REPLACE FUNCTION dns.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dns_rules_updated_at
    BEFORE UPDATE ON dns.dns_rules
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();

CREATE TRIGGER trg_schedules_updated_at
    BEFORE UPDATE ON dns.schedules
    FOR EACH ROW EXECUTE FUNCTION dns.set_updated_at();
