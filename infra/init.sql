-- Enum for API key tiers
CREATE TYPE key_tier AS ENUM ('test', 'free', 'pro', 'enterprise');

-- Enum for key status
CREATE TYPE key_status AS ENUM ('active', 'revoked');

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash    TEXT NOT NULL UNIQUE,       -- store hashed key, never plaintext
  name        TEXT NOT NULL,              -- human label e.g. "My mobile app"
  tier        key_tier NOT NULL DEFAULT 'free',
  status      key_status NOT NULL DEFAULT 'active',
  owner_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

-- Quota config per tier (requests per window)
CREATE TABLE IF NOT EXISTS quota_config (
  tier            key_tier PRIMARY KEY,
  req_limit       INTEGER NOT NULL,       -- max requests
  window_seconds  INTEGER NOT NULL        -- rolling window size
);

-- Seed quota config
INSERT INTO quota_config (tier, req_limit, window_seconds) VALUES
  ('test',       10,    60),       -- 10 req / 1 min  (for local dev)
  ('free',       100,   86400),    -- 100 req / day
  ('pro',        10000, 86400),    -- 10k req / day
  ('enterprise', 0,     86400)     -- 0 = unlimited
ON CONFLICT (tier) DO NOTHING;

-- Usage events table (written by Kafka consumer)
CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL PRIMARY KEY,
  key_id      UUID NOT NULL REFERENCES api_keys(id),
  endpoint    TEXT NOT NULL,
  method      TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_usage_key_id    ON usage_events(key_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_key_time  ON usage_events(key_id, created_at DESC);

-- Admin users (simple, for the dashboard login)
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

