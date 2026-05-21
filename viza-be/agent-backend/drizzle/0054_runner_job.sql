-- =============================================================================
-- runner_job — backing table for the submission-service queue (INFRA-002).
--
-- Postgres-backed FIFO with SELECT ... FOR UPDATE SKIP LOCKED for
-- atomic claim. Mirrors the state any external queue (Cloudflare
-- Queues / BullMQ) would expose, so we can swap transports later
-- without changing the producer/consumer contract documented in
-- docs/infra/queue.md.
-- =============================================================================

CREATE TABLE IF NOT EXISTS runner_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  /** queued | running | succeeded | failed | dead_letter | paused */
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  /** Free-form correlation id (Stripe pi, ops handoff, ...). */
  correlation_id TEXT,
  /** Last error message captured from a failed attempt. */
  last_error TEXT,
  /** Timestamps. */
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  /** Worker lease. Null means not currently leased. */
  leased_by TEXT,
  leased_until TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_runner_job_status_country
  ON runner_job(status, country, enqueued_at);
CREATE INDEX IF NOT EXISTS idx_runner_job_application
  ON runner_job(application_id);
CREATE INDEX IF NOT EXISTS idx_runner_job_lease_active
  ON runner_job(leased_until) WHERE status = 'running';

ALTER TABLE runner_job ENABLE ROW LEVEL SECURITY;
-- Service role only; no policies needed.
