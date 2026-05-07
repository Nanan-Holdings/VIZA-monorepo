-- =============================================================================
-- Runner KPI metrics (OPS-005)
--
-- One row per finished runner job. Aggregated weekly by country at
-- read time on /admin/metrics. Captcha + proxy costs surface separately
-- so unit economics (gross margin per package, PAY-007) and ops
-- (anti-bot / proxy budget) read from the same source.
-- =============================================================================

CREATE TABLE IF NOT EXISTS runner_metric (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID REFERENCES runner_job(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  /** ISO week start (Monday 00:00 UTC). Computed at insert. */
  week_start DATE NOT NULL,
  /** true when status='succeeded' on the runner_job. */
  success BOOLEAN NOT NULL,
  /** Wall-clock seconds from runner_job.started_at to finished_at. */
  time_to_submit_s INTEGER,
  captcha_cost_cents INTEGER NOT NULL DEFAULT 0,
  proxy_cost_cents INTEGER NOT NULL DEFAULT 0,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runner_metric_country_week
  ON runner_metric(country, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_runner_metric_application
  ON runner_metric(application_id);

ALTER TABLE runner_metric ENABLE ROW LEVEL SECURITY;
-- Service role only.

-- Helper: ISO week start for a given timestamp (Monday 00:00 UTC).
CREATE OR REPLACE FUNCTION iso_week_start(ts TIMESTAMPTZ)
  RETURNS DATE
  LANGUAGE SQL
  IMMUTABLE
AS $$
  SELECT DATE_TRUNC('week', (ts AT TIME ZONE 'UTC'))::DATE;
$$;
