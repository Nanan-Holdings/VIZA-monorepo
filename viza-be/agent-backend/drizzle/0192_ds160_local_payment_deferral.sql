-- Explicit local DS-160 test authorization. Financial readiness is unchanged.
CREATE TABLE IF NOT EXISTS private.ds160_local_payment_deferrals (
  application_id UUID PRIMARY KEY REFERENCES public.applications(id),
  applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id),
  payer_auth_user_id UUID NOT NULL,
  bound_queue_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  reason TEXT NOT NULL DEFAULT 'explicit_local_ds160_test',
  CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '4 hours')
);
ALTER TABLE private.ds160_local_payment_deferrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ds160_local_payment_deferrals FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.ds160_payment_deferral_eligible(p_application_id UUID, p_payer UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.applicant_profiles p ON p.id = a.applicant_id
    JOIN public.application_submission_entitlements e ON e.application_id = a.id
    WHERE a.id = p_application_id
      AND upper(regexp_replace(trim(a.country), '[ /-]+', '_', 'g')) IN ('US','USA','UNITED_STATES','UNITED_STATES_OF_AMERICA')
      AND upper(regexp_replace(trim(a.visa_type), '[ /-]+', '_', 'g')) IN ('DS160','DS_160','B1_B2','US_B1_B2')
      AND e.payer_auth_user_id = p_payer
      AND (p.auth_user_id = p_payer OR p.dependant_of_user_id = p_payer
        OR EXISTS (SELECT 1 FROM public.application_group g WHERE g.id = a.group_id AND g.payer_user_id = p_payer))
      AND e.decision_status = 'payment_required'
      AND e.agency_fee_status <> 'review_required' AND e.official_fee_status <> 'review_required'
      AND NOT EXISTS (SELECT 1 FROM public."order" o WHERE o.application_id = a.id AND o.status IN ('refunded','disputed','chargeback'))
      AND NOT EXISTS (SELECT 1 FROM public.payment_records r WHERE r.application_id = a.id AND r.status IN ('refunded','partially_refunded','disputed','chargeback'))
  );
$$;

CREATE OR REPLACE FUNCTION public.grant_ds160_local_payment_deferral(
  p_application_id UUID, p_payer_auth_user_id UUID, p_ttl_seconds INTEGER DEFAULT 14400
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_grant private.ds160_local_payment_deferrals;
  v_app public.applications;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 60 OR p_ttl_seconds > 14400 THEN
    RAISE EXCEPTION 'invalid_deferral_ttl';
  END IF;
  SELECT * INTO v_app FROM public.applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR NOT private.ds160_payment_deferral_eligible(p_application_id, p_payer_auth_user_id) THEN
    RAISE EXCEPTION 'ds160_payment_deferral_ineligible' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_grant FROM private.ds160_local_payment_deferrals WHERE application_id = p_application_id FOR UPDATE;
  IF FOUND THEN
    IF v_grant.payer_auth_user_id <> p_payer_auth_user_id OR v_grant.applicant_id <> v_app.applicant_id
       OR v_grant.revoked_at IS NOT NULL OR v_grant.expires_at <= v_now THEN
      RAISE EXCEPTION 'ds160_payment_deferral_unavailable' USING ERRCODE = '42501';
    END IF;
    -- Never extend the deadline or erase the first queue binding on a retry.
  ELSE
    IF v_app.ds160_application_id IS NOT NULL OR v_app.submission_result IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.submission_queue q WHERE q.application_id = p_application_id) THEN
      RAISE EXCEPTION 'ds160_payment_deferral_requires_fresh_application' USING ERRCODE = '42501';
    END IF;
    INSERT INTO private.ds160_local_payment_deferrals(application_id, applicant_id, payer_auth_user_id, created_at, expires_at)
    VALUES (p_application_id, v_app.applicant_id, p_payer_auth_user_id, v_now, v_now + make_interval(secs => p_ttl_seconds))
    RETURNING * INTO v_grant;
  END IF;
  RETURN jsonb_build_object('financialStatus','deferred','expiresAt',v_grant.expires_at,'boundQueueId',v_grant.bound_queue_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_ds160_local_payment_deferral(p_application_id UUID, p_payer_auth_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  UPDATE private.ds160_local_payment_deferrals SET revoked_at = COALESCE(revoked_at, clock_timestamp())
  WHERE application_id = p_application_id AND payer_auth_user_id = p_payer_auth_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_submission_payment_fence()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_application_id UUID;
  v_purpose TEXT;
  v_dry_run BOOLEAN := false;
  v_status TEXT;
  v_grant private.ds160_local_payment_deferrals;
BEGIN
  IF TG_TABLE_NAME = 'applications' THEN
    v_application_id := NEW.id;
  ELSE
    v_application_id := NEW.application_id;
    v_status := lower(COALESCE(to_jsonb(NEW) ->> 'status', ''));
    IF v_status NOT IN ('pending', 'queued', 'claimed', 'running', 'processing', 'scheduled')
       AND v_status <> 'france_live_official_portal_opened'
       AND v_status NOT LIKE '%\_pending' ESCAPE '\'
       AND v_status NOT LIKE '%\_scheduled' ESCAPE '\'
       AND v_status NOT LIKE '%\_processing' ESCAPE '\' THEN
      RETURN NEW;
    END IF;
  END IF;
  SELECT a.purpose INTO v_purpose FROM public.applications a WHERE a.id = v_application_id;
  IF TG_TABLE_NAME = 'submission_queue' THEN
    v_dry_run := lower(COALESCE(to_jsonb(NEW) ->> 'mode', '')) = 'dry_run';
  ELSIF TG_TABLE_NAME = 'runner_job' THEN
    v_dry_run := lower(COALESCE(to_jsonb(NEW) -> 'metadata' ->> 'mode', '')) = 'dry_run';
  END IF;
  IF v_purpose = 'VIZA_PLACEHOLDER_DRY_RUN' AND v_dry_run
     AND session_user IN ('postgres', 'supabase_admin')
     AND current_setting('app.viza_schema_qa_payment_bypass', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF private.submission_entitlement_ready(v_application_id) THEN RETURN NEW; END IF;

  -- A protected grant is used only by this one CEAC queue and its application.
  -- runner_job, government-payment APIs and appointment authorization do not use it.
  IF TG_TABLE_NAME IN ('submission_queue','applications') THEN
    SELECT * INTO v_grant FROM private.ds160_local_payment_deferrals
    WHERE application_id = v_application_id FOR UPDATE;
    IF FOUND AND v_grant.revoked_at IS NULL AND v_grant.expires_at > clock_timestamp()
       AND EXISTS (SELECT 1 FROM public.applications a WHERE a.id = v_application_id AND a.applicant_id = v_grant.applicant_id)
       AND private.ds160_payment_deferral_eligible(v_application_id, v_grant.payer_auth_user_id) THEN
      IF TG_TABLE_NAME = 'submission_queue'
         AND to_jsonb(NEW) ->> 'provider' = 'ceac_live'
         AND to_jsonb(NEW) ->> 'mode' = 'live_assisted'
         AND v_status IN ('ds160_live_assisted_pending','ds160_live_assisted_processing') THEN
        IF v_grant.bound_queue_id IS NULL AND TG_OP = 'INSERT' THEN
          UPDATE private.ds160_local_payment_deferrals SET bound_queue_id = NEW.id
          WHERE application_id = v_application_id AND bound_queue_id IS NULL;
          RETURN NEW;
        ELSIF v_grant.bound_queue_id = NEW.id THEN
          RETURN NEW;
        END IF;
      ELSIF TG_TABLE_NAME = 'applications' AND EXISTS (
        SELECT 1 FROM public.submission_queue q
        WHERE q.id = v_grant.bound_queue_id AND q.application_id = v_application_id
          AND q.provider = 'ceac_live' AND q.mode = 'live_assisted'
      ) THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'application_payment_required' USING ERRCODE = '42501', DETAIL = 'application_payment_required';
END;
$$;

REVOKE ALL ON FUNCTION private.ds160_payment_deferral_eligible(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS enforce_submission_payment_fence_on_queue ON public.submission_queue;
CREATE TRIGGER enforce_submission_payment_fence_on_queue
BEFORE INSERT OR UPDATE OF application_id, status, mode, provider ON public.submission_queue
FOR EACH ROW EXECUTE FUNCTION private.enforce_submission_payment_fence();
REVOKE ALL ON FUNCTION private.enforce_submission_payment_fence() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.grant_ds160_local_payment_deferral(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_ds160_local_payment_deferral(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ds160_local_payment_deferral(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_ds160_local_payment_deferral(UUID, UUID) TO service_role;

COMMENT ON TABLE private.ds160_local_payment_deferrals IS 'Short-lived, one-queue local DS160 authorization; never financial payment evidence. Revoke after the run.';
