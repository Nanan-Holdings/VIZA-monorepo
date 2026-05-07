-- =============================================================================
-- Per-failure-class alert throttling (OPS-003)
--
-- Tracks the last-fired timestamp for each alert class so the dispatcher
-- can suppress duplicates inside a configurable window (default 15 min).
-- Atomic insert-or-update keyed on `class`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS alert_throttle (
  class TEXT PRIMARY KEY,
  last_fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fire_count INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE alert_throttle ENABLE ROW LEVEL SECURITY;
-- Service role only.
