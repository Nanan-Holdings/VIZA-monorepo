-- Make terminal issuer-card transitions replay-safe after worker retries.

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

REVOKE ALL ON FUNCTION public.finish_issuer_card_attempt(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_issuer_card_attempt(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
