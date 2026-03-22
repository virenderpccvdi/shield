-- PO-01: App PIN Lock — add PIN and biometric settings to users table
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS app_pin VARCHAR(64);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN NOT NULL DEFAULT false;
