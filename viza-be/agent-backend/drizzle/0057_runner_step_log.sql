-- =============================================================================
-- Per-step runner trace (OPS-002)
--
-- One row per page transition / Playwright step. The runner emits these
-- inside its existing handler; the staff portal renders them as a
-- timeline with screenshot + HAR + console links and a diff view
-- against the previous run for the same application.
-- =============================================================================

CREATE TABLE IF NOT EXISTS runner_step_log (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES runner_job(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  /** Stable step identifier — country runners pick from a fixed set. */
  name TEXT NOT NULL,
  /** ok | failed | skipped | gate (waiting on external signal) */
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  /** Storage paths under the submission-artifacts bucket. */
  screenshot_path TEXT,
  har_path TEXT,
  console_path TEXT,
  /** Inline error message when status='failed'. */
  error TEXT,
  /** Free-form metadata — selectors hit, response statuses, etc. */
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_runner_step_log_job_step
  ON runner_step_log(job_id, step_index);
CREATE INDEX IF NOT EXISTS idx_runner_step_log_application
  ON runner_step_log(application_id, started_at DESC);

ALTER TABLE runner_step_log ENABLE ROW LEVEL SECURITY;
-- Service role only.
