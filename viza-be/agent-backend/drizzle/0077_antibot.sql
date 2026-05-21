-- =============================================================================
-- Anti-bot infrastructure (ANTIBOT-002 / ANTIBOT-003)
-- =============================================================================

ALTER TABLE runner_job
  ADD COLUMN IF NOT EXISTS fingerprint_history JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS proxy_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  region TEXT,
  /** Bright Data sticky-session id (zone:gIP). */
  sticky_session_id TEXT NOT NULL UNIQUE,
  cooled_until TIMESTAMPTZ,
  last_challenge_at TIMESTAMPTZ,
  /** Failure-streak counter — resets when used successfully. */
  challenge_streak INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proxy_pool_cooled
  ON proxy_pool(cooled_until, is_active);

ALTER TABLE proxy_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proxy_pool_select_authenticated"
  ON proxy_pool FOR SELECT
  USING (auth.role() = 'authenticated');
