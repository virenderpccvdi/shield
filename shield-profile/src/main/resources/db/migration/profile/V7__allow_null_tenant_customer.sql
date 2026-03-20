-- Allow standalone customers without ISP tenant assignment
ALTER TABLE profile.customers ALTER COLUMN tenant_id DROP NOT NULL;
