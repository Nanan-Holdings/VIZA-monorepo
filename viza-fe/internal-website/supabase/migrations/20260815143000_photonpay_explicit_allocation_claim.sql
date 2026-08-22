-- Bind PhotonPay issuer claims to the exact allocation selected by the
-- managed official-fee execution context. Never infer a financial allocation
-- from whichever application row happened to be created most recently.

DROP FUNCTION IF EXISTS public.claim_issuer_card_attempt(
  UUID, UUID, TEXT, INTEGER, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.claim_issuer_card_attempt(
  p_allocation_id UUID,
  p_application_id UUID,
  p_official_fee_payment_intent_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 600
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
  IF v_intent.payment_method_type IS DISTINCT FROM 'viza_managed_virtual_card' THEN
    RAISE EXCEPTION 'issuer-card attempts require a VIZA-managed virtual-card intent';
  END IF;
  IF v_intent.status NOT IN ('admin_approved', 'ready', 'failed', 'pending')
     OR v_intent.user_consented_at IS NULL
     OR v_intent.user_consent_snapshot_json IS NULL THEN
    RAISE EXCEPTION 'official-fee payment intent is not authorized for card issuance';
  END IF;

  SELECT * INTO v_allocation
  FROM public.government_fee_allocations
  WHERE id = p_allocation_id
    AND application_id = p_application_id
  FOR UPDATE;

  IF v_allocation.id IS NULL THEN
    RAISE EXCEPTION 'government-fee allocation does not belong to application';
  END IF;
  IF v_allocation.amount_cents <= 0 THEN
    RAISE EXCEPTION 'government-fee allocation amount must be positive';
  END IF;
  IF v_allocation.state NOT IN ('issuable', 'card_issued', 'portal_processing') THEN
    RAISE EXCEPTION 'government-fee allocation cannot issue from state %', v_allocation.state;
  END IF;
  IF v_allocation.official_fee_payment_intent_id IS NOT NULL
     AND v_allocation.official_fee_payment_intent_id <> p_official_fee_payment_intent_id THEN
    RAISE EXCEPTION 'government-fee allocation is bound to another payment intent';
  END IF;
  IF upper(v_allocation.currency) IS DISTINCT FROM upper(v_intent.official_fee_currency) THEN
    RAISE EXCEPTION 'government-fee allocation currency does not match payment intent';
  END IF;
  IF v_allocation.amount_cents IS DISTINCT FROM
     round(v_intent.official_fee_amount * 100)::BIGINT THEN
    RAISE EXCEPTION 'government-fee allocation amount does not match payment intent';
  END IF;

  UPDATE public.government_fee_allocations
  SET official_fee_payment_intent_id = p_official_fee_payment_intent_id,
      updated_at = now()
  WHERE id = p_allocation_id
    AND official_fee_payment_intent_id IS NULL
  RETURNING * INTO v_allocation;

  IF v_allocation.id IS NULL THEN
    SELECT * INTO v_allocation
    FROM public.government_fee_allocations
    WHERE id = p_allocation_id
      AND application_id = p_application_id
      AND official_fee_payment_intent_id = p_official_fee_payment_intent_id
    FOR UPDATE;
  END IF;

  SELECT * INTO v_attempt
  FROM public.issuer_card_attempts
  WHERE allocation_id = p_allocation_id
    AND status <> 'cancelled'
  ORDER BY attempt_number DESC
  LIMIT 1
  FOR UPDATE;

  IF v_attempt.status = 'consumed' THEN
    RAISE EXCEPTION 'official fee has already consumed its issuer card';
  END IF;
  IF v_attempt.id IS NOT NULL
     AND (
       v_attempt.application_id <> p_application_id
       OR v_attempt.official_fee_payment_intent_id <> p_official_fee_payment_intent_id
     ) THEN
    RAISE EXCEPTION 'issuer-card attempt belongs to another execution context';
  END IF;

  IF v_attempt.id IS NULL THEN
    SELECT COALESCE(max(attempt_number), 0) + 1
    INTO v_attempt_number
    FROM public.issuer_card_attempts
    WHERE allocation_id = p_allocation_id;

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
      p_allocation_id,
      p_application_id,
      p_official_fee_payment_intent_id,
      v_attempt_number,
      'viza-' || p_allocation_id::text || '-' || v_attempt_number::text,
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

REVOKE ALL ON FUNCTION public.claim_issuer_card_attempt(
  UUID, UUID, UUID, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_issuer_card_attempt(
  UUID, UUID, UUID, TEXT, INTEGER
) TO service_role;

COMMENT ON FUNCTION public.claim_issuer_card_attempt(
  UUID, UUID, UUID, TEXT, INTEGER
) IS 'Claims one PhotonPay attempt for an explicitly selected application allocation and managed official-fee intent.';
