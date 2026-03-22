-- V6: Grandfather all pre-existing active users as email-verified.
-- Email verification enforcement was added after go-live, so any user already
-- in the database with is_active=true is treated as having verified their email.
UPDATE auth.users
SET email_verified = true
WHERE email_verified = false
  AND is_active     = true;
