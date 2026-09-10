-- Qualify assignment columns because RETURNS TABLE output names are PL/pgSQL
-- variables and otherwise conflict with beta_social_assignments.code_id.
CREATE OR REPLACE FUNCTION public.issue_verified_social_invite(
  p_recipient_reference TEXT,
  p_platform TEXT,
  p_proof_reference TEXT,
  p_actor_id UUID,
  p_code_hash TEXT,
  p_code_hint TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  assignment_id UUID,
  slot_number SMALLINT,
  delivery_method TEXT,
  code_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  selected_assignment public.beta_social_assignments%ROWTYPE;
  inserted_code_id UUID;
  normalized_recipient TEXT := pg_catalog.lower(pg_catalog.btrim(p_recipient_reference));
BEGIN
  IF normalized_recipient = '' OR pg_catalog.btrim(p_platform) = ''
     OR pg_catalog.btrim(p_proof_reference) = '' THEN
    RAISE EXCEPTION 'beta_social_verification_evidence_required';
  END IF;
  IF p_code_hash !~ '^[a-f0-9]{64}$' OR length(p_code_hint) NOT BETWEEN 4 AND 12 THEN
    RAISE EXCEPTION 'beta_social_invalid_code_material';
  END IF;

  PERFORM 1
    FROM public.beta_campaign_cohorts cohort
   WHERE cohort.campaign = 'launch-beta-2026' AND cohort.state = 'sealed'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'beta_social_cohort_not_initialized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.beta_social_assignments assignment
     WHERE assignment.campaign = 'launch-beta-2026'
       AND assignment.recipient_reference = normalized_recipient
  ) THEN
    RAISE EXCEPTION 'beta_social_recipient_already_issued';
  END IF;

  SELECT assignment.* INTO selected_assignment
    FROM public.beta_social_assignments assignment
   WHERE assignment.campaign = 'launch-beta-2026' AND assignment.code_id IS NULL
   ORDER BY assignment.allocation_order
   FOR UPDATE SKIP LOCKED
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'beta_social_cohort_exhausted';
  END IF;

  UPDATE public.beta_social_assignments assignment
     SET recipient_reference = normalized_recipient,
         platform = pg_catalog.btrim(p_platform),
         proof_reference = pg_catalog.btrim(p_proof_reference),
         verified_by = p_actor_id,
         verified_at = now(),
         issued_at = now(),
         delivered_by = p_actor_id,
         delivered_at = now(),
         code_id = pg_catalog.gen_random_uuid()
   WHERE assignment.id = selected_assignment.id
   RETURNING assignment.code_id INTO inserted_code_id;

  INSERT INTO public.beta_access_codes (
    id, campaign, audience, delivery_method, discount_percent, access_scope,
    code_hash, code_hint, status, expires_at, created_by, assignment_id
  ) VALUES (
    inserted_code_id, 'launch-beta-2026', 'social', selected_assignment.delivery_method,
    50, 'one_country', p_code_hash, p_code_hint, 'active', p_expires_at,
    p_actor_id, selected_assignment.id
  );

  RETURN QUERY SELECT selected_assignment.id, selected_assignment.slot_number,
    selected_assignment.delivery_method, inserted_code_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_verified_social_invite(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_verified_social_invite(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
