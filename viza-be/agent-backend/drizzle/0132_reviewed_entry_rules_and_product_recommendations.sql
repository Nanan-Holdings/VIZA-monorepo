-- Reviewed entry-rule metadata and product recommendations for the initial
-- 11-destination x 7-passport deterministic eligibility matrix.

ALTER TABLE public.visa_entry_rules
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'placeholder',
  ADD COLUMN IF NOT EXISTS required_inputs TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS effective_to DATE,
  ADD COLUMN IF NOT EXISTS review_due_at DATE;

ALTER TABLE public.visa_entry_rules
  DROP CONSTRAINT IF EXISTS visa_entry_rules_outcome_check;
ALTER TABLE public.visa_entry_rules
  ADD CONSTRAINT visa_entry_rules_outcome_check
  CHECK (outcome IN ('visa_exempt', 'visa_required', 'conditional', 'unknown', 'not_applicable'));

ALTER TABLE public.visa_entry_rules
  DROP CONSTRAINT IF EXISTS visa_entry_rules_review_status_check;
ALTER TABLE public.visa_entry_rules
  ADD CONSTRAINT visa_entry_rules_review_status_check
  CHECK (review_status IN ('reviewed', 'placeholder'));

ALTER TABLE public.visa_entry_rules
  DROP CONSTRAINT IF EXISTS visa_entry_rules_product_recommendations_array_check;
ALTER TABLE public.visa_entry_rules
  ADD CONSTRAINT visa_entry_rules_product_recommendations_array_check
  CHECK (jsonb_typeof(product_recommendations) = 'array');

CREATE INDEX IF NOT EXISTS visa_entry_rules_review_status_idx
  ON public.visa_entry_rules (release_id, review_status, destination_country);

ALTER TABLE public.visa_agent_run_diagnostics
  ADD COLUMN IF NOT EXISTS recommended_products JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.promote_visa_knowledge_release(
  target_release_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_release_id UUID;
  expected_rules INTEGER;
  actual_rules INTEGER;
  reviewed_target_rules INTEGER;
BEGIN
  SELECT id, expected_entry_rule_count
    INTO target_release_id, expected_rules
  FROM public.visa_knowledge_releases
  WHERE release_key = target_release_key
    AND status = 'staged'
  FOR UPDATE;

  IF target_release_id IS NULL THEN
    RAISE EXCEPTION 'staged knowledge release not found: %', target_release_key;
  END IF;

  SELECT COUNT(*) INTO actual_rules
  FROM public.visa_entry_rules
  WHERE release_id = target_release_id;

  IF actual_rules <> expected_rules THEN
    RAISE EXCEPTION 'knowledge release entry-rule count mismatch: expected %, received %',
      expected_rules, actual_rules;
  END IF;

  SELECT COUNT(*) INTO reviewed_target_rules
  FROM public.visa_entry_rules
  WHERE release_id = target_release_id
    AND review_status = 'reviewed'
    AND destination_country IN (
      'indonesia', 'vietnam', 'singapore', 'malaysia', 'thailand',
      'south_korea', 'us', 'france', 'philippines', 'uk', 'taiwan'
    )
    AND passport_country_iso3 IN ('CHN', 'SGP', 'GBR', 'USA', 'CAN', 'AUS', 'NZL')
    AND passport_type = 'ordinary'
    AND trip_purpose = 'tourism';

  IF reviewed_target_rules <> 77 THEN
    RAISE EXCEPTION 'reviewed 11-country entry-rule matrix is incomplete: expected 77, received %',
      reviewed_target_rules;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visa_entry_rules
    WHERE release_id = target_release_id
      AND review_status = 'reviewed'
      AND (
        verified_at IS NULL
        OR source_url IS NULL
        OR source_url !~ '^https://'
        OR review_due_at IS NULL
        OR jsonb_typeof(product_recommendations) <> 'array'
        OR (outcome IN ('conditional', 'unknown') AND cardinality(required_inputs) = 0)
      )
  ) THEN
    RAISE EXCEPTION 'reviewed entry rules are missing evidence, review dates, or conditional inputs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.visa_documents WHERE release_id = target_release_id
  ) THEN
    RAISE EXCEPTION 'knowledge release has no documents';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visa_documents vd
    WHERE vd.release_id = target_release_id
      AND (
        vd.source_key IS NULL
        OR vd.source_url IS NULL
        OR vd.verified_at IS NULL
        OR vd.content_hash IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'knowledge release contains documents missing governance metadata';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visa_documents vd
    LEFT JOIN public.visa_chunks vc ON vc.document_id = vd.id
    WHERE vd.release_id = target_release_id
    GROUP BY vd.id
    HAVING COUNT(vc.id) = 0 OR COUNT(vc.embedding) <> COUNT(vc.id)
  ) THEN
    RAISE EXCEPTION 'knowledge release contains empty or unembedded documents';
  END IF;

  UPDATE public.visa_documents
  SET status = 'quarantined', quarantined_at = NOW(),
      quarantine_reason = 'superseded by release ' || target_release_key
  WHERE release_id IN (
    SELECT id FROM public.visa_knowledge_releases WHERE status = 'active'
  );
  UPDATE public.visa_entry_rules
  SET status = 'quarantined', updated_at = NOW()
  WHERE release_id IN (
    SELECT id FROM public.visa_knowledge_releases WHERE status = 'active'
  );
  UPDATE public.visa_knowledge_releases
  SET status = 'quarantined', quarantined_at = NOW()
  WHERE status = 'active';

  UPDATE public.visa_documents
  SET status = 'active', quarantined_at = NULL, quarantine_reason = NULL
  WHERE release_id = target_release_id;
  UPDATE public.visa_entry_rules
  SET status = 'active', updated_at = NOW()
  WHERE release_id = target_release_id;
  UPDATE public.visa_knowledge_releases
  SET status = 'active', activated_at = NOW(), quarantined_at = NULL
  WHERE id = target_release_id;

  RETURN target_release_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_visa_knowledge_release(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_visa_knowledge_release(TEXT) TO service_role;
