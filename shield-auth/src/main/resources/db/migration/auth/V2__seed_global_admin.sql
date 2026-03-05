-- Shield Auth — V2: Seed the default Global Admin
-- Password: Shield@Admin2026# (bcrypt hash — change immediately in production!)
-- Hash generated with BCrypt cost=12

INSERT INTO auth.users (id, tenant_id, email, password_hash, name, role, email_verified, is_active)
VALUES (
    gen_random_uuid(),
    NULL,
    'admin@rstglobal.in',
    '$2b$12$LhA9.ngpHg9Kf9uTXzKTcuHz/XZ6pvQNQrtKWVHehDmpJcVQrI7Gu',
    'Global Admin',
    'GLOBAL_ADMIN',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO NOTHING;
