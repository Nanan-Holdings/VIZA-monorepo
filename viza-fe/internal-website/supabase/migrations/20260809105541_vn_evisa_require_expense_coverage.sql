-- The official portal keeps its review action disabled until the applicant
-- identifies who covers the trip expenses. Payment method is already a
-- conditional required field once this answer is present.
UPDATE public.visa_form_fields
SET required = true,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'expense_coverage';
