-- Cross-machine ownership for the mainland-China USVisaScheduling runner.
-- A lost worker is deliberately NOT reclaimed by time: official side effects
-- must be reconciled before an administrator settles its active claim.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.us_appointment_runner_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.appointment_assistance_jobs(id) ON DELETE RESTRICT,
  worker_id TEXT NOT NULL CHECK (length(btrim(worker_id)) BETWEEN 1 AND 128 AND worker_id = btrim(worker_id)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'skipped')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at TIMESTAMPTZ,
  CHECK ((status = 'active' AND finished_at IS NULL) OR (status <> 'active' AND finished_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS us_appointment_runner_claims_one_active_job_idx
  ON private.us_appointment_runner_claims(job_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS us_appointment_runner_claims_job_history_idx
  ON private.us_appointment_runner_claims(job_id, claimed_at DESC);

ALTER TABLE private.us_appointment_runner_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.us_appointment_runner_claims FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_us_appointment_runner_job(p_job_id UUID, p_worker_id TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job public.appointment_assistance_jobs;
  v_claim_id UUID;
BEGIN
  IF p_job_id IS NULL OR p_worker_id IS NULL OR length(btrim(p_worker_id)) NOT BETWEEN 1 AND 128
     OR p_worker_id <> btrim(p_worker_id) THEN
    RAISE EXCEPTION 'us_appointment_claim_invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- Serialize eligibility and claim creation on the exact persisted job.
  SELECT * INTO v_job FROM public.appointment_assistance_jobs
  WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_job.mode IS DISTINCT FROM 'assisted_live'
     OR v_job.country_code IS DISTINCT FROM 'US'
     OR v_job.applying_country_code IS DISTINCT FROM 'CN'
     OR v_job.scheduling_provider IS DISTINCT FROM 'usvisascheduling'
     OR v_job.status NOT IN (
       'appointment_consent_received', 'appointment_account_required', 'appointment_login_required',
       'appointment_payment_completed', 'appointment_no_slots_available', 'appointment_booked',
       'appointment_status_check_in_progress'
     )
     OR (v_job.requires_user_action IS TRUE AND COALESCE(v_job.current_manual_action, '') NOT IN ('login', 'account_email_verification'))
     OR (v_job.current_manual_action IS NOT NULL AND v_job.current_manual_action NOT IN ('login', 'account_email_verification')) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM private.us_appointment_runner_claims WHERE job_id = p_job_id AND status = 'active') THEN
    RETURN NULL;
  END IF;

  INSERT INTO private.us_appointment_runner_claims(job_id, worker_id)
  VALUES (p_job_id, p_worker_id) RETURNING id INTO v_claim_id;
  RETURN v_claim_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_us_appointment_runner_job(p_claim_id UUID, p_worker_id TEXT, p_outcome TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_claim_id IS NULL OR p_worker_id IS NULL OR length(btrim(p_worker_id)) NOT BETWEEN 1 AND 128
     OR p_worker_id <> btrim(p_worker_id)
     OR p_outcome IS NULL OR p_outcome NOT IN ('completed', 'failed', 'skipped') THEN
    RAISE EXCEPTION 'us_appointment_claim_invalid_arguments' USING ERRCODE = '22023';
  END IF;

  UPDATE private.us_appointment_runner_claims
  SET status = p_outcome, finished_at = clock_timestamp()
  WHERE id = p_claim_id AND worker_id = p_worker_id AND status = 'active';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_us_appointment_runner_job(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_us_appointment_runner_job(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_us_appointment_runner_job(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_us_appointment_runner_job(UUID, TEXT, TEXT) TO service_role;

COMMENT ON TABLE private.us_appointment_runner_claims IS 'Service-owned US appointment execution claims. Active claims never expire automatically; reconcile official side effects before settling a lost worker. Stores no applicant or portal data.';
