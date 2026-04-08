-- Allow platform customers (no ISP tenant) to have child profiles and devices
ALTER TABLE profile.child_profiles  ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE profile.devices         ALTER COLUMN tenant_id DROP NOT NULL;
