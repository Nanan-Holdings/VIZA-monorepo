-- =============================================================================
-- Operator takeover for stuck runners (CS-003)
--
-- Runner flips a runner_job to status='needs_human' when it hits an
-- unhandled state (anti-bot, new ID-verify page, …), records a
-- takeover_session row with the remote-debug URL of the live
-- Playwright session, and pages the on-call rotation. Operator picks
-- it up, finishes the flow manually, and writes the captured answers
-- back through closeTakeover.
-- =============================================================================

CREATE TABLE IF NOT EXISTS takeover_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES runner_job(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** queued | claimed | completed | abandoned */
  status TEXT NOT NULL DEFAULT 'queued',
  /** Free-form why the runner gave up. */
  reason TEXT NOT NULL,
  /** Live Playwright remote-debug URL (CDP wss:// + token). Time-limited. */
  remote_debug_url TEXT NOT NULL,
  /** Optional VNC URL for guided takeover. */
  vnc_url TEXT,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  /** Free-form summary of operator actions. */
  operator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_takeover_session_status_created
  ON takeover_session(status, created_at);
CREATE INDEX IF NOT EXISTS idx_takeover_session_job
  ON takeover_session(job_id);

ALTER TABLE takeover_session ENABLE ROW LEVEL SECURITY;
-- Service role only.

CREATE TABLE IF NOT EXISTS takeover_action_log (
  id BIGSERIAL PRIMARY KEY,
  takeover_id UUID NOT NULL REFERENCES takeover_session(id) ON DELETE CASCADE,
  /** open | claim | complete | abandon | answer_write */
  action TEXT NOT NULL,
  actor_user_id UUID,
  detail JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_takeover_action_log_takeover_ts
  ON takeover_action_log(takeover_id, ts);

ALTER TABLE takeover_action_log ENABLE ROW LEVEL SECURITY;
-- Service role only.
