-- UK Standard Visitor purpose gates must use the values published by the
-- Access UK purpose selector. Update only the four legacy showIf values that
-- were proven to be aliases of current selector options.
--
-- jsonb_set replaces only showIf and preserves any other conditional metadata.
-- The exact old-value predicates make this migration idempotent and prevent
-- it from touching unsupported PPE, organ-donation, or clinical-training
-- branches until their official parent-flow questions are modelled.

UPDATE public.visa_form_fields
SET conditional_logic = jsonb_set(
      conditional_logic,
      '{showIf}',
      to_jsonb('purpose_of_visit === study'::TEXT),
      false
    ),
    updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND conditional_logic->>'showIf' = 'purpose_of_visit === short_study';

UPDATE public.visa_form_fields
SET conditional_logic = jsonb_set(
      conditional_logic,
      '{showIf}',
      to_jsonb('purpose_of_visit === medicalTreatment'::TEXT),
      false
    ),
    updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND conditional_logic->>'showIf' = 'purpose_of_visit === medical';

UPDATE public.visa_form_fields
SET conditional_logic = jsonb_set(
      conditional_logic,
      '{showIf}',
      to_jsonb('purpose_of_visit === marriage'::TEXT),
      false
    ),
    updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND conditional_logic->>'showIf' = 'purpose_of_visit === marriage_civil_partnership';

UPDATE public.visa_form_fields
SET conditional_logic = jsonb_set(
      conditional_logic,
      '{showIf}',
      to_jsonb('purpose_of_visit === academic'::TEXT),
      false
    ),
    updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND conditional_logic->>'showIf' = 'purpose_of_visit === academic_12m';
