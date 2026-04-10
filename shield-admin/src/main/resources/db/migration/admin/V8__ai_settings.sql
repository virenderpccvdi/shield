-- AI provider configuration managed by super admin
CREATE TABLE IF NOT EXISTS admin.ai_settings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider         VARCHAR(50)  NOT NULL DEFAULT 'DEEPSEEK',   -- DEEPSEEK | ANTHROPIC | OPENAI
    model_name       VARCHAR(100) NOT NULL DEFAULT 'deepseek-chat',
    fast_model_name  VARCHAR(100),                               -- for quick / cheap operations
    api_key_encrypted VARCHAR(500),                              -- stored as-is (encrypt at rest via DB/vault later)
    api_base_url     VARCHAR(500),                               -- optional URL override
    max_tokens       INTEGER          DEFAULT 2000,
    temperature      DOUBLE PRECISION DEFAULT 0.7,
    enabled          BOOLEAN          DEFAULT true,
    updated_at       TIMESTAMP        DEFAULT NOW(),
    updated_by       VARCHAR(200)
);

-- Seed default DeepSeek config (only if table is empty)
-- NOTE: api_key_encrypted is intentionally empty — configure via Admin → AI Settings panel
INSERT INTO admin.ai_settings (provider, model_name, fast_model_name, api_key_encrypted, enabled, updated_by)
SELECT 'DEEPSEEK', 'deepseek-chat', 'deepseek-chat', '', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM admin.ai_settings);
