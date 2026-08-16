-- Durable, application-scoped PhotonPay virtual-card orchestration.
--
-- A card belongs to one government-fee allocation/payment attempt, never to
-- an applicant or inbox. PAN, expiry, and CVV are intentionally absent. The
-- provider request id and non-sensitive card reference are sufficient for
-- restart recovery and finance reconciliation.

CREATE TABLE IF NOT EXISTS public.issuer_card_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL
    REFERENCES public.government_fee_allocations(id) ON DELETE CASCADE,
  application_id UUID NOT NULL
    REFERENCES public.applications(id) ON DELETE CASCADE,
  official_fee_payment_intent_id UUID NOT NULL
    REFERENCES public.official_fee_payment_intents(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  issuer TEXT NOT NULL DEFAULT 'photonpay' CHECK (issuer = 'photonpay'),
  issuer_request_id TEXT NOT NULL UNIQUE,
  issuer_card_id TEXT UNIQUE,
  card_type TEXT NOT NULL DEFAULT 'share' CHECK (card_type = 'share'),
  status TEXT NOT NULL DEFAULT 'issuing'
    CHECK (status IN (
      'issuing',
      'issued',
      'portal_processing',
      'consumed',
      'cancelling',
      'cancelled',
      'failed',
      'review_required'
    )),
  currency TEXT NOT NULL,
  limit_amount NUMERIC(20, 2) NOT NULL CHECK (limit_amount > 0),
  masked_pan TEXT,
  claim_count INTEGER NOT NULL DEFAULT 0 CHECK (claim_count >= 0),
  locked_by TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  provider_evidence_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ,
  portal_processing_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (allocation_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS issuer_card_attempts_allocation_idx
  ON public.issuer_card_attempts(allocation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS issuer_card_attempts_application_idx
  ON public.issuer_card_attempts(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS issuer_card_attempts_intent_idx
  ON public.issuer_card_attempts(official_fee_payment_intent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS issuer_card_attempts_lease_idx
  ON public.issuer_card_attempts(lease_expires_at)
  WHERE status IN ('issuing', 'issued', 'portal_processing', 'failed', 'review_required');
CREATE UNIQUE INDEX IF NOT EXISTS issuer_card_attempts_one_open_allocation_idx
  ON public.issuer_card_attempts(allocation_id)
  WHERE status <> 'cancelled';

ALTER TABLE public.issuer_card_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.issuer_card_attempts FROM anon, authenticated;
GRANT ALL ON TABLE public.issuer_card_attempts TO service_role;

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
DECLARE
  v_allocation public.government_fee_allocations;
  v_intent public.official_fee_payment_intents;
  v_attempt public.issuer_card_attempts;
  v_attempt_number INTEGER;
BEGIN
  IF NULLIF(trim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'issuer-card worker id is required';
  END IF;

  SELECT * INTO v_intent
  FROM public.official_fee_payment_intents
  WHERE id = p_official_fee_payment_intent_id
    AND application_id = p_application_id
  FOR UPDATE;

  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'official-fee payment intent does not belong to application';
  END IF;
  IF v_intent.status NOT IN ('admin_approved', 'ready', 'manual_review', 'failed', 'pending')
     OR v_intent.user_consented_at IS NULL THEN
    RAISE EXCEPTION 'official-fee payment intent is not authorized for card issuance';
  END IF;

  SELECT * INTO v_allocation
  FROM public.government_fee_allocations
  WHERE application_id = p_application_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_allocation.id IS NULL THEN
    RAISE EXCEPTION 'government-fee allocation is missing for application';
  END IF;
  IF v_allocation.amount_cents <= 0 THEN
    RAISE EXCEPTION 'government-fee allocation amount must be positive';
  END IF;
  IF v_allocation.state IN ('consumed', 'released') THEN
    RAISE EXCEPTION 'government-fee allocation is already %', v_allocation.state;
  END IF;
  IF v_allocation.state = 'review_required' THEN
    RAISE EXCEPTION 'government-fee allocation requires reconciliation review';
  END IF;
  IF v_allocation.state IN ('reserved_pending_treasury', 'reserved') THEN
    IF NOT p_allow_pending_treasury THEN
      RAISE EXCEPTION 'government-fee allocation is not treasury-issuable';
    END IF;
    UPDATE public.government_fee_allocations
    SET
      state = 'issuable',
      official_fee_payment_intent_id = COALESCE(
        official_fee_payment_intent_id,
        p_official_fee_payment_intent_id
      ),
      metadata_redacted = metadata_redacted || jsonb_build_object(
        'issuable_override', true,
        'issuable_override_at', now()
      ),
      updated_at = now()
    WHERE id = v_allocation.id
    RETURNING * INTO v_allocation;
  ELSIF v_allocation.state NOT IN ('issuable', 'card_issued', 'portal_processing') THEN
    RAISE EXCEPTION 'government-fee allocation cannot issue from state %', v_allocation.state;
  END IF;

  IF v_allocation.official_fee_payment_intent_id IS NOT NULL
     AND v_allocation.official_fee_payment_intent_id <> p_official_fee_payment_intent_id THEN
    RAISE EXCEPTION 'government-fee allocation is bound to another payment intent';
  END IF;

  UPDATE public.government_fee_allocations
  SET official_fee_payment_intent_id = p_official_fee_payment_intent_id,
      updated_at = now()
  WHERE id = v_allocation.id
    AND official_fee_payment_intent_id IS NULL;

  SELECT * INTO v_attempt
  FROM public.issuer_card_attempts
  WHERE allocation_id = v_allocation.id
    AND status <> 'cancelled'
  ORDER BY attempt_number DESC
  LIMIT 1
  FOR UPDATE;

  IF v_attempt.status = 'consumed' THEN
    RAISE EXCEPTION 'official fee has already consumed its issuer card';
  END IF;

  IF v_attempt.id IS NULL THEN
    SELECT COALESCE(max(attempt_number), 0) + 1
    INTO v_attempt_number
    FROM public.issuer_card_attempts
    WHERE allocation_id = v_allocation.id;

    INSERT INTO public.issuer_card_attempts (
      allocation_id,
      application_id,
      official_fee_payment_intent_id,
      attempt_number,
      issuer_request_id,
      currency,
      limit_amount
    )
    VALUES (
      v_allocation.id,
      p_application_id,
      p_official_fee_payment_intent_id,
      v_attempt_number,
      'viza-' || v_allocation.id::text || '-' || v_attempt_number::text,
      upper(v_allocation.currency),
      round(v_allocation.amount_cents::numeric / 100, 2)
    )
    RETURNING * INTO v_attempt;
  END IF;

  UPDATE public.issuer_card_attempts
  SET
    claim_count = claim_count + 1,
    locked_by = p_worker_id,
    lease_expires_at = now() + make_interval(
      secs => greatest(60, least(COALESCE(p_lease_seconds, 600), 3600))
    ),
    updated_at = now()
  WHERE id = v_attempt.id
  RETURNING * INTO v_attempt;

  RETURN v_attempt;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_issuer_card_issued(
  p_attempt_id UUID,
  p_worker_id TEXT,
  p_issuer_card_id TEXT,
  p_masked_pan TEXT,
  p_provider_evidence_redacted JSONB DEFAULT '{}'::jsonb
)
RETURNS public.issuer_card_attempts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.issuer_card_attempts;
BEGIN
  UPDATE public.issuer_card_attempts AS attempt
  SET
    status = 'issued',
    issuer_card_id = p_issuer_card_id,
    masked_pan = NULLIF(p_masked_pan, ''),
    provider_evidence_redacted = COALESCE(p_provider_evidence_redacted, '{}'::jsonb),
    issued_at = COALESCE(attempt.issued_at, now()),
    last_error_code = NULL,
    last_error_message = NULL,
    updated_at = now()
  WHERE attempt.id = p_attempt_id
    AND attempt.locked_by = p_worker_id
    AND attempt.status IN ('issuing', 'failed', 'review_required', 'issued')
  RETURNING attempt.* INTO v_attempt;

  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'issuer-card attempt is not claimable by this worker';
  END IF;

  UPDATE public.government_fee_allocations
  SET state = 'card_issued', updated_at = now()
  WHERE id = v_attempt.allocation_id
    AND state IN ('issuable', 'card_issued');

  RETURN v_attempt;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_issuer_card_portal_processing(
  p_attempt_id UUID,
  p_worker_id TEXT
)
RETURNS public.issuer_card_attempts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.issuer_card_attempts;
BEGIN
  UPDATE public.issuer_card_attempts AS attempt
  SET
    status = 'portal_processing',
    portal_processing_at = COALESCE(attempt.portal_processing_at, now()),
    updated_at = now()
  WHERE attempt.id = p_attempt_id
    AND attempt.locked_by = p_worker_id
    AND attempt.status IN ('issued', 'portal_processing')
  RETURNING attempt.* INTO v_attempt;

  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'issuer-card attempt is not issued for this worker';
  END IF;

  UPDATE public.government_fee_allocations
  SET state = 'portal_processing', updated_at = now()
  WHERE id = v_attempt.allocation_id
    AND state IN ('card_issued', 'portal_processing');

  RETURN v_attempt;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_issuer_card_attempt(
  p_attempt_id UUID,
  p_worker_id TEXT,
  p_outcome TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_provider_evidence_redacted JSONB DEFAULT '{}'::jsonb
)
RETURNS public.issuer_card_attempts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.issuer_card_attempts;
BEGIN
  IF p_outcome NOT IN ('consumed', 'cancelled', 'failed', 'review_required') THEN
    RAISE EXCEPTION 'unsupported issuer-card outcome %', p_outcome;
  END IF;

  SELECT * INTO v_attempt
  FROM public.issuer_card_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF v_attempt.id IS NULL
     OR (v_attempt.locked_by IS NOT NULL AND v_attempt.locked_by <> p_worker_id) THEN
    RAISE EXCEPTION 'issuer-card attempt cannot be finished by this worker';
  END IF;
  IF v_attempt.status = p_outcome THEN
    RETURN v_attempt;
  END IF;
  IF v_attempt.status = 'consumed' THEN
    RAISE EXCEPTION 'consumed issuer-card attempt cannot transition to %', p_outcome;
  END IF;

  UPDATE public.issuer_card_attempts AS attempt
  SET
    status = p_outcome,
    consumed_at = CASE WHEN p_outcome = 'consumed' THEN now() ELSE attempt.consumed_at END,
    cancelled_at = CASE WHEN p_outcome = 'cancelled' THEN now() ELSE attempt.cancelled_at END,
    locked_by = NULL,
    lease_expires_at = NULL,
    last_error_code = NULLIF(p_error_code, ''),
    last_error_message = left(NULLIF(p_error_message, ''), 2000),
    provider_evidence_redacted = attempt.provider_evidence_redacted ||
      COALESCE(p_provider_evidence_redacted, '{}'::jsonb),
    updated_at = now()
  WHERE attempt.id = p_attempt_id
    AND (attempt.locked_by = p_worker_id OR attempt.locked_by IS NULL)
  RETURNING attempt.* INTO v_attempt;

  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'issuer-card attempt cannot be finished by this worker';
  END IF;

  UPDATE public.government_fee_allocations
  SET
    state = CASE p_outcome
      WHEN 'consumed' THEN 'consumed'
      WHEN 'cancelled' THEN 'issuable'
      WHEN 'failed' THEN 'issuable'
      ELSE 'review_required'
    END,
    consumed_at = CASE WHEN p_outcome = 'consumed' THEN now() ELSE consumed_at END,
    updated_at = now()
  WHERE id = v_attempt.allocation_id;

  RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_issuer_card_attempt(UUID, UUID, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_issuer_card_issued(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_issuer_card_portal_processing(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_issuer_card_attempt(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_issuer_card_attempt(UUID, UUID, TEXT, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_issuer_card_issued(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_issuer_card_portal_processing(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_issuer_card_attempt(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON TABLE public.issuer_card_attempts IS
  'Durable PhotonPay issuance attempts per government-fee allocation. Card secrets are never stored.';
