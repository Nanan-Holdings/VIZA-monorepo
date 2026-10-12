-- Reconcile two CEAC control types and mark the duplicate present-job title
-- as persistence-only metadata. Metadata only; existing applicant answers are
-- preserved, including any historical aliases.

UPDATE public.visa_form_fields
SET field_type = 'select',
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name = 'sex';

UPDATE public.visa_form_fields
SET field_type = 'text',
    options = NULL,
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"maxLength":2,"pattern":"^[1-9][0-9]?$"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name = 'number_of_former_spouses';

UPDATE public.visa_form_fields
SET field_type = 'textarea',
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"maxLength":4000}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name = 'former_spouse_how_marriage_ended';

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"legacy_compatibility_only":true}'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name = 'job_title';
