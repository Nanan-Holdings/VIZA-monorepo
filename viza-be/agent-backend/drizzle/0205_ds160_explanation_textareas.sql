-- Align the three conditional DS-160 explanation controls with current CEAC DOM observations.
-- This metadata-only update preserves all existing applicant answers.

UPDATE public.visa_form_fields
SET field_type = 'textarea',
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'marital_status_other_explain',
    'passport_document_type_explain',
    'occupation_other_explain'
  );
