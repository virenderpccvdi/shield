-- Shield Auth — V4: Add MFA (TOTP) columns to users table

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT;
