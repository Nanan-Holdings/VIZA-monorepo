-- Synthetic schema-QA drafts deliberately coexist with a customer's real
-- application. Keep them outside the customer-facing ongoing uniqueness gate.
DROP INDEX IF EXISTS public.applications_one_ongoing_country_visa_idx;

CREATE UNIQUE INDEX applications_one_ongoing_country_visa_idx
  ON public.applications (
    applicant_id,
    LOWER(TRIM(country)),
    UPPER(TRIM(visa_type))
  )
  WHERE LOWER(TRIM(COALESCE(status, 'draft'))) NOT IN (
      'submitted', 'submitted_mock', 'form_ready_for_agency',
      'completed', 'approved', 'rejected', 'cancelled', 'canceled',
      'archived', 'failed', 'stalled'
    )
    AND COALESCE(purpose, '') <> 'VIZA_PLACEHOLDER_DRY_RUN'
    AND LOWER(TRIM(COALESCE(submission_result_status, ''))) NOT IN (
      'completed', 'complete', 'submitted', 'success', 'done'
    )
    AND LOWER(TRIM(COALESCE(result_status, ''))) NOT IN (
      'approved', 'approved_pending_document', 'issued', 'granted',
      'rejected', 'refused', 'denied'
    )
    AND LOWER(TRIM(COALESCE(submission_result ->> 'submitted', ''))) <> 'true'
    AND LOWER(TRIM(COALESCE(submission_result ->> 'status', ''))) <> 'submitted';
