-- Phase 1: durable payment-to-provisioning orchestration.
--
-- Provider callbacks only record a verified event and create one durable job.
-- The worker owns the retryable account/profile/application/inbox/runner steps.
-- No payment credentials, PAN, CVV, or provider signatures are stored here.

CREATE TABLE IF NOT EXISTS public.payment_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES public."order"(id) ON DELETE SET NULL,
  payload_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_lifecycle_events_order_idx
  ON public.payment_lifecycle_events(order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS payment_lifecycle_events_type_idx
  ON public.payment_lifecycle_events(event_type, received_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_provisioning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public."order"(id) ON DELETE CASCADE,
  payment_event_id UUID REFERENCES public.payment_lifecycle_events(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'retry', 'succeeded', 'dead_letter')),
  user_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (user_status IN ('pending', 'completed')),
  profile_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (profile_status IN ('pending', 'completed')),
  application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending', 'completed')),
  inbox_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (inbox_status IN ('pending', 'completed')),
  runner_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (runner_status IN ('pending', 'completed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_provisioning_jobs_claim_idx
  ON public.payment_provisioning_jobs(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS payment_provisioning_jobs_lease_idx
  ON public.payment_provisioning_jobs(lease_expires_at)
  WHERE status = 'running';

ALTER TABLE public.payment_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provisioning_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_lifecycle_events, public.payment_provisioning_jobs
  FROM anon, authenticated;
GRANT ALL ON TABLE public.payment_lifecycle_events, public.payment_provisioning_jobs
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_payment_lifecycle_event(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_order_id UUID,
  p_payload_redacted JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(event_id UUID, job_id UUID, event_replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id UUID;
  v_job_id UUID;
  v_order_id UUID;
  v_replayed BOOLEAN := false;
  v_order_status TEXT;
BEGIN
  INSERT INTO public.payment_lifecycle_events (
    provider,
    provider_event_id,
    event_type,
    order_id,
    payload_redacted
  )
  VALUES (
    p_provider,
    p_provider_event_id,
    p_event_type,
    p_order_id,
    COALESCE(p_payload_redacted, '{}'::jsonb)
  )
  ON CONFLICT (provider, provider_event_id) DO UPDATE
  SET last_seen_at = now()
  RETURNING id, order_id, (xmax <> 0)
  INTO v_event_id, v_order_id, v_replayed;

  IF p_event_type = 'commercial_payment.paid' AND v_order_id IS NOT NULL THEN
    SELECT status
    INTO v_order_status
    FROM public."order"
    WHERE id = v_order_id;

    -- A delayed paid callback must not resurrect a refunded, disputed, or
    -- otherwise non-payable order. A verified paid order is the only input
    -- that can enter the provisioning queue.
    IF v_order_status IN ('paid', 'submitted', 'completed') THEN
      INSERT INTO public.payment_provisioning_jobs (
        order_id,
        payment_event_id,
        provider
      )
      VALUES (v_order_id, v_event_id, p_provider)
      ON CONFLICT (order_id) DO UPDATE
      SET
        payment_event_id = COALESCE(
          public.payment_provisioning_jobs.payment_event_id,
          EXCLUDED.payment_event_id
        ),
        provider = public.payment_provisioning_jobs.provider,
        attempts = CASE
          WHEN public.payment_provisioning_jobs.status = 'dead_letter' THEN 0
          ELSE public.payment_provisioning_jobs.attempts
        END,
        status = CASE
          WHEN public.payment_provisioning_jobs.status = 'dead_letter' THEN 'retry'
          ELSE public.payment_provisioning_jobs.status
        END,
        available_at = CASE
          WHEN public.payment_provisioning_jobs.status = 'dead_letter' THEN now()
          ELSE public.payment_provisioning_jobs.available_at
        END,
        updated_at = now()
      RETURNING id INTO v_job_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_event_id, v_job_id, v_replayed;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_payment_provisioning_jobs(
  p_limit INTEGER DEFAULT 1,
  p_worker_id TEXT DEFAULT 'payment-provisioning-worker',
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.payment_provisioning_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.payment_provisioning_jobs
  SET
    status = 'dead_letter',
    lease_expires_at = NULL,
    locked_by = NULL,
    last_error = COALESCE(last_error, 'worker lease expired after max attempts'),
    updated_at = now()
  WHERE status = 'running'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now()
    AND attempts >= max_attempts;

  RETURN QUERY
  UPDATE public.payment_provisioning_jobs AS job
  SET
    status = 'running',
    attempts = job.attempts + 1,
    lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 3600))),
    locked_by = p_worker_id,
    updated_at = now()
  WHERE job.id IN (
    SELECT candidate.id
    FROM public.payment_provisioning_jobs AS candidate
    WHERE (
      (
        candidate.status IN ('queued', 'retry')
        AND candidate.available_at <= now()
      )
      OR (
        candidate.status = 'running'
        AND candidate.lease_expires_at IS NOT NULL
        AND candidate.lease_expires_at < now()
      )
    )
    AND candidate.attempts < candidate.max_attempts
    ORDER BY candidate.available_at ASC, candidate.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(COALESCE(p_limit, 1), 20))
  )
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_payment_provisioning_job(
  p_job_id UUID,
  p_error TEXT,
  p_retry_delay_seconds INTEGER DEFAULT 60
)
RETURNS public.payment_provisioning_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.payment_provisioning_jobs;
BEGIN
  UPDATE public.payment_provisioning_jobs AS job
  SET
    status = CASE WHEN job.attempts >= job.max_attempts THEN 'dead_letter' ELSE 'retry' END,
    available_at = CASE
      WHEN job.attempts >= job.max_attempts THEN job.available_at
      ELSE now() + make_interval(secs => greatest(5, least(p_retry_delay_seconds, 3600)))
    END,
    lease_expires_at = NULL,
    locked_by = NULL,
    last_error = left(COALESCE(p_error, 'unknown provisioning error'), 2000),
    updated_at = now()
  WHERE job.id = p_job_id
    AND job.status = 'running'
  RETURNING job.* INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'payment provisioning job % is not running', p_job_id;
  END IF;
  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_payment_provisioning_job(p_job_id UUID)
RETURNS public.payment_provisioning_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.payment_provisioning_jobs;
BEGIN
  UPDATE public.payment_provisioning_jobs AS job
  SET
    status = 'succeeded',
    completed_at = now(),
    lease_expires_at = NULL,
    locked_by = NULL,
    last_error = NULL,
    updated_at = now()
  WHERE job.id = p_job_id
    AND job.status = 'running'
  RETURNING job.* INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'payment provisioning job % is not running', p_job_id;
  END IF;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_lifecycle_event(TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_payment_provisioning_jobs(INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_payment_provisioning_job(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_payment_provisioning_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_lifecycle_event(TEXT, TEXT, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_payment_provisioning_jobs(INTEGER, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_payment_provisioning_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_provisioning_job(UUID) TO service_role;

COMMENT ON TABLE public.payment_lifecycle_events IS
  'Verified provider lifecycle events. Payloads are redacted; provider/event id is the replay key.';
COMMENT ON TABLE public.payment_provisioning_jobs IS
  'Durable, lease-based orchestration for paid order account and runner provisioning.';
