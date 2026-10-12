-- Disable payment execution while preserving historical payment tables/data.
--
-- Payment fields remain in the schema for read compatibility and audit history.
-- They are no longer an application prerequisite, and this migration removes
-- the database-side execution/fence paths that could create or settle a
-- payment when an old client or configured credential is still present.

ALTER TABLE IF EXISTS public.application_submission_entitlements
  ALTER COLUMN agency_fee_status SET DEFAULT 'waived',
  ALTER COLUMN official_fee_status SET DEFAULT 'not_required',
  ALTER COLUMN decision_status SET DEFAULT 'ready';

-- Existing rows which were waiting solely for checkout are released. Existing
-- captured/paid or review records are retained as historical facts; no payment
-- success is fabricated by this migration.
UPDATE public.application_submission_entitlements
SET agency_fee_status = CASE
      WHEN agency_fee_status = 'required' THEN 'waived'
      ELSE agency_fee_status
    END,
    official_fee_status = CASE
      WHEN official_fee_status = 'required' THEN 'not_required'
      ELSE official_fee_status
    END,
    decision_status = CASE
      WHEN decision_status = 'payment_required' THEN 'ready'
      ELSE decision_status
    END,
    decision_reason = CASE
      WHEN decision_status = 'payment_required' THEN 'payments_disabled'
      ELSE decision_reason
    END,
    updated_at = now()
WHERE agency_fee_status = 'required'
   OR official_fee_status = 'required'
   OR decision_status = 'payment_required';

-- Retain the public RPC signatures for old clients, but make every checkout,
-- payment callback, and official-fee queue insertion fail before any write.
CREATE OR REPLACE FUNCTION public.ensure_submission_checkout_order(
  p_application_id UUID,
  p_payer_auth_user_id UUID,
  p_return_to TEXT DEFAULT NULL,
  p_checkout_claim_token UUID DEFAULT gen_random_uuid()
)
RETURNS TABLE(
  order_id UUID,
  stripe_checkout_session_id TEXT,
  order_created BOOLEAN,
  checkout_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'payments_disabled'
    USING ERRCODE = '0A000', DETAIL = 'payments_disabled';
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_submission_order_payment(
  p_order_id UUID,
  p_provider_payment_id TEXT,
  p_provider_session_id TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_tax_amount_cents BIGINT DEFAULT NULL,
  p_tax_country TEXT DEFAULT NULL,
  p_tax_rate_basis_points INTEGER DEFAULT NULL,
  p_provider TEXT DEFAULT 'stripe'
)
RETURNS TABLE(
  order_id UUID,
  application_id UUID,
  payment_record_id UUID,
  entitlement_ready BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'payments_disabled'
    USING ERRCODE = '0A000', DETAIL = 'payments_disabled';
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_official_fee_submission(
  p_application_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_provider TEXT,
  p_current_stage TEXT,
  p_manual_action_status TEXT,
  p_payment_status TEXT,
  p_official_status TEXT,
  p_result_payload JSONB,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
  queue_id UUID,
  queue_status TEXT,
  queue_provider TEXT,
  reused_existing BOOLEAN,
  superseded_count INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'payments_disabled'
    USING ERRCODE = '0A000', DETAIL = 'payments_disabled';
END;
$$;

-- Card-attempt claiming is the database entrypoint used immediately before a
-- PhotonPay/Airwallex issuer call. Keep its historical signature so stale
-- workers fail closed instead of creating a new issuer-card attempt.
CREATE OR REPLACE FUNCTION public.claim_issuer_card_attempt(
  p_allocation_id UUID,
  p_application_id UUID,
  p_official_fee_payment_intent_id UUID,
  p_issuer TEXT,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 600
)
RETURNS public.issuer_card_attempts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'payments_disabled'
    USING ERRCODE = '0A000', DETAIL = 'payments_disabled';
END;
$$;

-- Production also has the newer treasury-aware issuer claim signature. Retire
-- it explicitly so replacing the older allocation-based overload cannot leave
-- the active issuer entrypoint callable.
CREATE OR REPLACE FUNCTION public.claim_issuer_card_attempt(
  p_application_id UUID,
  p_official_fee_payment_intent_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 600,
  p_allow_pending_treasury BOOLEAN DEFAULT false
)
RETURNS public.issuer_card_attempts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'payments_disabled'
    USING ERRCODE = '0A000', DETAIL = 'payments_disabled';
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_submission_checkout_order(UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.confirm_submission_order_payment(
  UUID, TEXT, TEXT, TIMESTAMPTZ, BIGINT, TEXT, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_issuer_card_attempt(
  UUID, UUID, TEXT, INTEGER, BOOLEAN
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enqueue_official_fee_submission(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_issuer_card_attempt(
  UUID, UUID, UUID, TEXT, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;

-- Remove financial readiness triggers. Consent, authorization, QA, queue
-- ownership, and runner cutover checks remain owned by their own triggers and
-- service code; these three triggers were exclusively payment risk fences.
DROP TRIGGER IF EXISTS enforce_submission_payment_fence_on_queue
  ON public.submission_queue;
DROP TRIGGER IF EXISTS enforce_submission_payment_fence_on_runner
  ON public.runner_job;
DROP TRIGGER IF EXISTS enforce_submission_payment_fence_on_application
  ON public.applications;
DROP TRIGGER IF EXISTS mark_submission_entitlement_review_on_order_risk
  ON public."order";
DROP TRIGGER IF EXISTS mark_submission_entitlement_review_on_payment_risk
  ON public.payment_records;
DROP TRIGGER IF EXISTS mark_submission_entitlement_review_on_allocation_risk
  ON public.government_fee_allocations;
DROP TRIGGER IF EXISTS submission_queue_carry_forward_vietnam_payment_registration_code
  ON public.submission_queue;

-- Keep the private helper safe for any historical trigger/function caller: it
-- now asserts only that the application exists, never a paid entitlement.
CREATE OR REPLACE FUNCTION private.submission_entitlement_ready(p_application_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications AS application
    WHERE application.id = p_application_id
  );
$$;

REVOKE ALL ON FUNCTION private.submission_entitlement_ready(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.enforce_submission_payment_fence()
  FROM PUBLIC, anon, authenticated, service_role;

-- The backend migration history has this Vietnam handoff helper; the website
-- history may not. Guard the privilege cleanup so this migration is portable
-- across both histories while still revoking it wherever it exists.
DO $$
BEGIN
  IF to_regprocedure('public.carry_forward_vietnam_payment_registration_code()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.carry_forward_vietnam_payment_registration_code() FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END;
$$;

-- The fee scraper was the only scheduled government-fee/payment worker in the
-- backend. Unscheduling is idempotent and remains safe when pg_cron is absent.
DO $$
DECLARE
  scheduled_job RECORD;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN;
  END IF;
  FOR scheduled_job IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('viza_fee_scraper', 'viza_payment_reconciliation', 'viza_stripe_reconciliation')
  LOOP
    BEGIN
      PERFORM cron.unschedule(scheduled_job.jobname);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ensure_submission_checkout_order(UUID, UUID, TEXT, UUID) IS
  'Retained for compatibility; payment execution is disabled and this function always raises payments_disabled.';
COMMENT ON FUNCTION public.confirm_submission_order_payment(UUID, TEXT, TEXT, TIMESTAMPTZ, BIGINT, TEXT, INTEGER, TEXT) IS
  'Retained for compatibility; payment callbacks are disabled and this function always raises payments_disabled.';
COMMENT ON FUNCTION public.enqueue_official_fee_submission(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) IS
  'Retained for compatibility; official-fee payment queue execution is disabled and this function always raises payments_disabled.';
COMMENT ON FUNCTION public.claim_issuer_card_attempt(UUID, UUID, UUID, TEXT, TEXT, INTEGER) IS
  'Retained for compatibility; managed card issuance is disabled and this function always raises payments_disabled.';
COMMENT ON FUNCTION public.claim_issuer_card_attempt(UUID, UUID, TEXT, INTEGER, BOOLEAN) IS
  'Retained for compatibility; treasury-aware managed card issuance is disabled and this function always raises payments_disabled.';
