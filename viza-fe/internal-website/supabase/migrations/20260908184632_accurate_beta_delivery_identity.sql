-- Make the experiment denominator mean confirmed delivery rather than code
-- issuance, and bind social claims to the applicant identity verified by
-- support. Production was initialized with 100 empty slots and no issued
-- assignments before this migration.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.beta_social_assignments
     WHERE code_id IS NOT NULL OR delivered_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'beta_delivery_identity_requires_no_existing_issuance';
  END IF;
END;
$$;

ALTER TABLE public.beta_social_assignments
  ADD COLUMN recipient_identity_hmac TEXT,
  ADD COLUMN delivery_reference TEXT;

ALTER TABLE public.beta_social_assignments
  ADD CONSTRAINT beta_social_assignment_identity_hmac_format CHECK (
    recipient_identity_hmac IS NULL OR recipient_identity_hmac ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT beta_social_assignment_delivery_reference_nonempty CHECK (
    delivery_reference IS NULL OR btrim(delivery_reference) <> ''
  );

ALTER TABLE public.beta_social_assignments
  DROP CONSTRAINT beta_social_assignment_lifecycle;

ALTER TABLE public.beta_social_assignments
  ADD CONSTRAINT beta_social_assignment_lifecycle CHECK (
    (
      verified_at IS NULL AND verified_by IS NULL
      AND recipient_reference IS NULL AND recipient_identity_hmac IS NULL
      AND platform IS NULL AND proof_reference IS NULL
      AND code_id IS NULL AND issued_at IS NULL
      AND delivered_by IS NULL AND delivered_at IS NULL
      AND delivery_reference IS NULL
    )
    OR
    (
      verified_at IS NOT NULL AND verified_by IS NOT NULL
      AND recipient_reference IS NOT NULL AND recipient_identity_hmac IS NOT NULL
      AND platform IS NOT NULL AND proof_reference IS NOT NULL
      AND code_id IS NOT NULL AND issued_at IS NOT NULL
      AND delivered_by IS NULL AND delivered_at IS NULL
      AND delivery_reference IS NULL
    )
    OR
    (
      verified_at IS NOT NULL AND verified_by IS NOT NULL
      AND recipient_reference IS NOT NULL AND recipient_identity_hmac IS NOT NULL
      AND platform IS NOT NULL AND proof_reference IS NOT NULL
      AND code_id IS NOT NULL AND issued_at IS NOT NULL
      AND delivered_by IS NOT NULL AND delivered_at IS NOT NULL
      AND delivery_reference IS NOT NULL
    )
  );

CREATE TABLE public.beta_social_invite_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.beta_social_assignments(id) ON DELETE RESTRICT,
  code_id UUID NOT NULL REFERENCES public.beta_access_codes(id) ON DELETE RESTRICT,
  campaign TEXT NOT NULL,
  slot_number SMALLINT NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('promo_code', 'link_suffix')),
  recipient_reference TEXT NOT NULL,
  recipient_identity_hmac TEXT NOT NULL CHECK (recipient_identity_hmac ~ '^[a-f0-9]{64}$'),
  platform TEXT NOT NULL,
  proof_reference TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL CHECK (btrim(reason) <> '')
);

CREATE INDEX beta_social_invite_cancellations_assignment_idx
  ON public.beta_social_invite_cancellations(assignment_id, cancelled_at DESC);

ALTER TABLE public.beta_social_invite_cancellations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beta_social_invite_cancellations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.beta_social_invite_cancellations TO service_role;

CREATE OR REPLACE FUNCTION private.enforce_beta_social_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.campaign = 'launch-beta-2026' AND NEW.audience = 'social' THEN
    -- A cancelled, never-delivered code is retained as disabled audit evidence
    -- but detached so the randomized slot can be safely reissued.
    IF NEW.status = 'disabled' AND NEW.assignment_id IS NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.assignment_id IS NULL OR NOT EXISTS (
      SELECT 1
        FROM public.beta_social_assignments assignment
       WHERE assignment.id = NEW.assignment_id
         AND assignment.campaign = NEW.campaign
         AND assignment.delivery_method = NEW.delivery_method
         AND assignment.verified_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'beta_social_assignment_required';
    END IF;
  ELSIF NEW.assignment_id IS NOT NULL THEN
    RAISE EXCEPTION 'beta_assignment_only_valid_for_launch_social';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.issue_verified_social_invite(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ);

CREATE FUNCTION public.issue_verified_social_invite(
  p_recipient_reference TEXT,
  p_recipient_identity_hmac TEXT,
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
  IF p_recipient_identity_hmac !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'beta_social_recipient_identity_required';
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
       AND (
         assignment.recipient_reference = normalized_recipient
         OR assignment.recipient_identity_hmac = p_recipient_identity_hmac
       )
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
         recipient_identity_hmac = p_recipient_identity_hmac,
         platform = pg_catalog.btrim(p_platform),
         proof_reference = pg_catalog.btrim(p_proof_reference),
         verified_by = p_actor_id,
         verified_at = now(),
         issued_at = now(),
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

CREATE FUNCTION public.mark_social_invite_delivered(
  p_assignment_id UUID,
  p_actor_id UUID,
  p_delivery_reference TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  assignment public.beta_social_assignments%ROWTYPE;
  normalized_reference TEXT := pg_catalog.btrim(p_delivery_reference);
BEGIN
  IF normalized_reference = '' OR length(normalized_reference) > 500 THEN
    RAISE EXCEPTION 'beta_social_delivery_evidence_required';
  END IF;

  SELECT row.* INTO assignment
    FROM public.beta_social_assignments row
   WHERE row.id = p_assignment_id
     AND row.campaign = 'launch-beta-2026'
   FOR UPDATE;
  IF NOT FOUND OR assignment.code_id IS NULL OR assignment.issued_at IS NULL THEN
    RAISE EXCEPTION 'beta_social_assignment_not_issued';
  END IF;
  IF assignment.delivered_at IS NOT NULL THEN
    IF assignment.delivery_reference IS DISTINCT FROM normalized_reference THEN
      RAISE EXCEPTION 'beta_social_delivery_already_recorded';
    END IF;
    RETURN;
  END IF;

  UPDATE public.beta_social_assignments row
     SET delivered_by = p_actor_id,
         delivered_at = now(),
         delivery_reference = normalized_reference
   WHERE row.id = assignment.id;
END;
$$;

CREATE FUNCTION public.cancel_undelivered_social_invite(
  p_assignment_id UUID,
  p_actor_id UUID,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  assignment public.beta_social_assignments%ROWTYPE;
  normalized_reason TEXT := pg_catalog.btrim(p_reason);
BEGIN
  IF normalized_reason = '' OR length(normalized_reason) > 500 THEN
    RAISE EXCEPTION 'beta_social_cancellation_reason_required';
  END IF;

  SELECT row.* INTO assignment
    FROM public.beta_social_assignments row
   WHERE row.id = p_assignment_id
     AND row.campaign = 'launch-beta-2026'
   FOR UPDATE;
  IF NOT FOUND OR assignment.code_id IS NULL OR assignment.issued_at IS NULL THEN
    RAISE EXCEPTION 'beta_social_assignment_not_issued';
  END IF;
  IF assignment.delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'beta_social_delivered_invite_cannot_be_cancelled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.beta_access_grants grant_row
     WHERE grant_row.code_id = assignment.code_id
  ) THEN
    RAISE EXCEPTION 'beta_social_claimed_invite_cannot_be_cancelled';
  END IF;

  INSERT INTO public.beta_social_invite_cancellations (
    assignment_id, code_id, campaign, slot_number, delivery_method,
    recipient_reference, recipient_identity_hmac, platform, proof_reference,
    issued_at, cancelled_by, reason
  ) VALUES (
    assignment.id, assignment.code_id, assignment.campaign,
    assignment.slot_number, assignment.delivery_method,
    assignment.recipient_reference, assignment.recipient_identity_hmac,
    assignment.platform, assignment.proof_reference, assignment.issued_at,
    p_actor_id, normalized_reason
  );

  UPDATE public.beta_access_codes code
     SET status = 'disabled', assignment_id = NULL
   WHERE code.id = assignment.code_id;

  UPDATE public.beta_social_assignments row
     SET recipient_reference = NULL,
         recipient_identity_hmac = NULL,
         platform = NULL,
         proof_reference = NULL,
         verified_by = NULL,
         verified_at = NULL,
         code_id = NULL,
         issued_at = NULL,
         delivered_by = NULL,
         delivered_at = NULL,
         delivery_reference = NULL
   WHERE row.id = assignment.id;
END;
$$;

CREATE FUNCTION public.claim_social_beta_access(
  p_code_hash TEXT,
  p_delivery_method TEXT,
  p_claimant_identity_hmac TEXT,
  p_applicant_id UUID,
  p_application_id UUID,
  p_order_id UUID,
  p_country TEXT,
  p_base_agency_fee_cents INTEGER
)
RETURNS TABLE (
  grant_id UUID,
  audience TEXT,
  delivery_method TEXT,
  access_scope TEXT,
  discount_percent INTEGER,
  discount_cents INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  access_code public.beta_access_codes%ROWTYPE;
  assignment public.beta_social_assignments%ROWTYPE;
  existing_grant public.beta_access_grants%ROWTYPE;
  inserted_grant public.beta_access_grants%ROWTYPE;
  calculated_discount INTEGER;
BEGIN
  IF p_code_hash !~ '^[a-f0-9]{64}$'
     OR p_claimant_identity_hmac !~ '^[a-f0-9]{64}$'
     OR p_delivery_method NOT IN ('promo_code', 'link_suffix')
     OR p_base_agency_fee_cents < 0 THEN
    RAISE EXCEPTION 'beta_social_claim_invalid';
  END IF;

  SELECT code.* INTO access_code
    FROM public.beta_access_codes code
   WHERE code.code_hash = p_code_hash
     AND code.status = 'active'
     AND code.audience = 'social'
   FOR UPDATE;
  IF NOT FOUND OR (access_code.expires_at IS NOT NULL AND access_code.expires_at <= now()) THEN
    RAISE EXCEPTION 'beta_social_claim_invalid';
  END IF;

  SELECT row.* INTO assignment
    FROM public.beta_social_assignments row
   WHERE row.id = access_code.assignment_id
   FOR UPDATE;
  IF NOT FOUND OR assignment.delivered_at IS NULL
     OR assignment.delivery_method <> p_delivery_method
     OR assignment.recipient_identity_hmac <> p_claimant_identity_hmac THEN
    RAISE EXCEPTION 'beta_social_claim_invalid';
  END IF;

  calculated_discount := pg_catalog.round(
    p_base_agency_fee_cents::numeric * access_code.discount_percent::numeric / 100
  )::integer;

  BEGIN
    INSERT INTO public.beta_access_grants (
      code_id, applicant_id, first_application_id, first_order_id, country,
      campaign, audience, delivery_method, discount_percent, access_scope,
      base_agency_fee_cents, discount_cents
    ) VALUES (
      access_code.id, p_applicant_id, p_application_id, p_order_id,
      pg_catalog.lower(pg_catalog.btrim(p_country)), access_code.campaign,
      access_code.audience, access_code.delivery_method,
      access_code.discount_percent, access_code.access_scope,
      p_base_agency_fee_cents, calculated_discount
    )
    RETURNING * INTO inserted_grant;
  EXCEPTION WHEN unique_violation THEN
    SELECT grant_row.* INTO existing_grant
      FROM public.beta_access_grants grant_row
     WHERE grant_row.code_id = access_code.id;
    IF NOT FOUND OR existing_grant.applicant_id <> p_applicant_id
       OR existing_grant.first_application_id <> p_application_id
       OR existing_grant.first_order_id <> p_order_id THEN
      RAISE EXCEPTION 'beta_social_claim_used';
    END IF;
    inserted_grant := existing_grant;
  END;

  RETURN QUERY SELECT inserted_grant.id, inserted_grant.audience,
    inserted_grant.delivery_method, inserted_grant.access_scope,
    inserted_grant.discount_percent, inserted_grant.discount_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_verified_social_invite(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_social_invite_delivered(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_undelivered_social_invite(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_social_beta_access(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_verified_social_invite(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_social_invite_delivered(UUID, UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_undelivered_social_invite(UUID, UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_social_beta_access(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, INTEGER)
  TO service_role;

COMMENT ON COLUMN public.beta_social_assignments.recipient_identity_hmac IS
  'Keyed HMAC of the normalized applicant email verified by support; never a raw email or unsalted hash.';
COMMENT ON COLUMN public.beta_social_assignments.delivery_reference IS
  'Operator evidence that the one-time value was actually sent to the intended recipient.';
COMMENT ON TABLE public.beta_social_invite_cancellations IS
  'Audit trail for issued-but-undelivered social invites revoked before their slot was safely reissued.';
