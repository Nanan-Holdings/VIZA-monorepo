-- The launch social cohort is a sealed 100-person experiment. Operators can
-- initialize it once, but cannot choose a participant's promo/link arm.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.beta_access_codes
     WHERE campaign = 'launch-beta-2026'
       AND audience = 'social'
  ) THEN
    RAISE EXCEPTION 'beta_social_cohort_requires_empty_campaign';
  END IF;
END;
$$;

CREATE TABLE public.beta_campaign_cohorts (
  campaign TEXT PRIMARY KEY,
  audience TEXT NOT NULL CHECK (audience = 'social'),
  target_count SMALLINT NOT NULL CHECK (target_count = 100),
  state TEXT NOT NULL CHECK (state IN ('sealed', 'closed')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sealed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.beta_social_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign TEXT NOT NULL REFERENCES public.beta_campaign_cohorts(campaign) ON DELETE RESTRICT,
  slot_number SMALLINT NOT NULL CHECK (slot_number BETWEEN 1 AND 100),
  allocation_order SMALLINT NOT NULL CHECK (allocation_order BETWEEN 1 AND 100),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('promo_code', 'link_suffix')),
  recipient_reference TEXT CHECK (recipient_reference IS NULL OR btrim(recipient_reference) <> ''),
  platform TEXT CHECK (platform IS NULL OR btrim(platform) <> ''),
  proof_reference TEXT CHECK (proof_reference IS NULL OR btrim(proof_reference) <> ''),
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  code_id UUID UNIQUE,
  issued_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT beta_social_assignment_slot_unique UNIQUE (campaign, slot_number),
  CONSTRAINT beta_social_assignment_order_unique UNIQUE (campaign, allocation_order),
  CONSTRAINT beta_social_assignment_recipient_unique UNIQUE (campaign, recipient_reference),
  CONSTRAINT beta_social_assignment_lifecycle CHECK (
    (verified_at IS NULL AND verified_by IS NULL AND recipient_reference IS NULL
      AND platform IS NULL AND proof_reference IS NULL AND code_id IS NULL
      AND issued_at IS NULL AND delivered_by IS NULL AND delivered_at IS NULL)
    OR
    (verified_at IS NOT NULL AND verified_by IS NOT NULL AND recipient_reference IS NOT NULL
      AND platform IS NOT NULL AND proof_reference IS NOT NULL AND code_id IS NOT NULL
      AND issued_at IS NOT NULL AND delivered_by IS NOT NULL AND delivered_at IS NOT NULL)
  )
);

ALTER TABLE public.beta_access_codes
  ADD COLUMN assignment_id UUID UNIQUE
    REFERENCES public.beta_social_assignments(id) ON DELETE RESTRICT;

ALTER TABLE public.beta_social_assignments
  ADD CONSTRAINT beta_social_assignment_code_fk
  FOREIGN KEY (code_id) REFERENCES public.beta_access_codes(id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX beta_social_assignments_funnel_idx
  ON public.beta_social_assignments(campaign, delivery_method, delivered_at);

ALTER TABLE public.beta_campaign_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_social_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beta_campaign_cohorts, public.beta_social_assignments
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.beta_campaign_cohorts, public.beta_social_assignments TO service_role;

CREATE OR REPLACE FUNCTION private.enforce_beta_social_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.campaign = 'launch-beta-2026' AND NEW.audience = 'social' THEN
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

CREATE TRIGGER enforce_beta_social_assignment_trigger
BEFORE INSERT OR UPDATE OF campaign, audience, delivery_method, assignment_id
ON public.beta_access_codes
FOR EACH ROW EXECUTE FUNCTION private.enforce_beta_social_assignment();

REVOKE ALL ON FUNCTION private.enforce_beta_social_assignment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.initialize_beta_social_cohort(
  p_delivery_plan TEXT[],
  p_created_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing_count INTEGER;
  promo_count INTEGER;
  link_count INTEGER;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('launch-beta-2026:social-cohort', 0)
  );

  IF pg_catalog.array_length(p_delivery_plan, 1) IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'beta_social_plan_must_have_100_slots';
  END IF;

  SELECT
    count(*) FILTER (WHERE method = 'promo_code'),
    count(*) FILTER (WHERE method = 'link_suffix')
    INTO promo_count, link_count
    FROM pg_catalog.unnest(p_delivery_plan) AS methods(method);

  IF promo_count <> 50 OR link_count <> 50 THEN
    RAISE EXCEPTION 'beta_social_plan_must_be_50_50';
  END IF;

  SELECT count(*) INTO existing_count
    FROM public.beta_social_assignments
   WHERE campaign = 'launch-beta-2026';

  IF existing_count > 0 THEN
    SELECT
      count(*) FILTER (WHERE delivery_method = 'promo_code'),
      count(*) FILTER (WHERE delivery_method = 'link_suffix')
      INTO promo_count, link_count
      FROM public.beta_social_assignments
     WHERE campaign = 'launch-beta-2026';
    IF existing_count <> 100 OR promo_count <> 50 OR link_count <> 50 OR NOT EXISTS (
      SELECT 1
        FROM public.beta_campaign_cohorts
       WHERE campaign = 'launch-beta-2026'
         AND audience = 'social'
         AND target_count = 100
         AND state = 'sealed'
    ) THEN
      RAISE EXCEPTION 'beta_social_cohort_inconsistent';
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.beta_campaign_cohorts (
    campaign, audience, target_count, state, created_by, sealed_at
  ) VALUES (
    'launch-beta-2026', 'social', 100, 'sealed', p_created_by, now()
  );

  INSERT INTO public.beta_social_assignments (
    campaign, slot_number, allocation_order, delivery_method
  )
  SELECT
    'launch-beta-2026', ordinality::smallint, ordinality::smallint, method
    FROM pg_catalog.unnest(p_delivery_plan) WITH ORDINALITY AS plan(method, ordinality);
END;
$$;

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
    FROM public.beta_campaign_cohorts
   WHERE campaign = 'launch-beta-2026' AND state = 'sealed'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'beta_social_cohort_not_initialized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.beta_social_assignments
     WHERE campaign = 'launch-beta-2026'
       AND recipient_reference = normalized_recipient
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

  -- Stamp the verification first so the code-table trigger can validate the
  -- assignment. The lifecycle constraint is deferred only within this function
  -- by completing the row before the statement ends.
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

REVOKE ALL ON FUNCTION public.initialize_beta_social_cohort(TEXT[], UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_verified_social_invite(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_beta_social_cohort(TEXT[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_verified_social_invite(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- A friend entitlement is applicant-level, so a later-country submission also
-- completes that participant's funnel even when the first application was abandoned.
CREATE OR REPLACE FUNCTION private.mark_beta_application_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'processing', 'under_review', 'approved', 'rejected', 'completed')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.beta_access_grants
       SET submitted_at = COALESCE(submitted_at, now())
     WHERE first_application_id = NEW.id
        OR (audience = 'friends' AND applicant_id = NEW.applicant_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.mark_beta_application_submitted() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.beta_campaign_cohorts IS
  'Sealed launch-beta cohort definitions. The social campaign is exactly 100 participants.';
COMMENT ON TABLE public.beta_social_assignments IS
  'Randomized social A/B slots with support verification and delivered-invite evidence.';
