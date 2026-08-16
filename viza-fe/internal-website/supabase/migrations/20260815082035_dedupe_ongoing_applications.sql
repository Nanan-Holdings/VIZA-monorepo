-- Keep one in-flight application for each applicant/country/visa type while
-- preserving completed submission history (especially repeat arrival cards).

BEGIN;

LOCK TABLE public.applications IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _ongoing_application_dedup ON COMMIT DROP AS
WITH ongoing AS (
  SELECT
    application.id,
    application.applicant_id,
    application.country,
    application.visa_type,
    application.status,
    application.visa_package_id,
    application.updated_at,
    application.created_at,
    (SELECT COUNT(*) FROM public.payment_records payment WHERE payment.application_id = application.id) AS payment_count,
    (SELECT COUNT(*) FROM public.visa_application_answers answer WHERE answer.application_id = application.id) AS answer_count,
    (SELECT COUNT(*) FROM public.application_documents document WHERE document.application_id = application.id) AS document_count
  FROM public.applications application
  WHERE LOWER(TRIM(COALESCE(application.status, 'draft'))) NOT IN (
      'submitted', 'submitted_mock', 'form_ready_for_agency',
      'completed', 'approved', 'rejected', 'cancelled', 'canceled',
      'archived', 'failed', 'stalled'
    )
    AND COALESCE(application.purpose, '') <> 'VIZA_PLACEHOLDER_DRY_RUN'
    AND LOWER(TRIM(COALESCE(application.submission_result_status, ''))) NOT IN (
      'completed', 'complete', 'submitted', 'success', 'done'
    )
    AND LOWER(TRIM(COALESCE(application.result_status, ''))) NOT IN (
      'approved', 'approved_pending_document', 'issued', 'granted',
      'rejected', 'refused', 'denied'
    )
    AND LOWER(TRIM(COALESCE(application.submission_result ->> 'submitted', ''))) <> 'true'
    AND LOWER(TRIM(COALESCE(application.submission_result ->> 'status', ''))) <> 'submitted'
),
ranked AS (
  SELECT
    ongoing.*,
    FIRST_VALUE(ongoing.id) OVER application_group AS survivor_id,
    ROW_NUMBER() OVER application_group AS survivor_rank
  FROM ongoing
  WINDOW application_group AS (
    PARTITION BY
      ongoing.applicant_id,
      LOWER(TRIM(ongoing.country)),
      UPPER(TRIM(ongoing.visa_type))
    ORDER BY
      CASE LOWER(TRIM(ongoing.status))
        WHEN 'processing' THEN 0
        WHEN 'external_submission_in_progress' THEN 1
        WHEN 'ready_for_submission' THEN 2
        WHEN 'pending' THEN 3
        WHEN 'draft' THEN 4
        ELSE 5
      END,
      (ongoing.payment_count > 0) DESC,
      (ongoing.visa_package_id IS NOT NULL) DESC,
      ongoing.answer_count DESC,
      ongoing.document_count DESC,
      ongoing.updated_at DESC NULLS LAST,
      ongoing.created_at DESC NULLS LAST,
      ongoing.id DESC
  )
)
SELECT id AS duplicate_id, survivor_id
FROM ranked
WHERE survivor_rank > 1;

-- Keep the best answer for every field, preferring a non-empty and then newer
-- value across the survivor and its duplicate rows.
CREATE TEMP TABLE _ongoing_application_answer_dedup ON COMMIT DROP AS
WITH participants AS (
  SELECT survivor_id, survivor_id AS application_id FROM _ongoing_application_dedup
  UNION
  SELECT survivor_id, duplicate_id FROM _ongoing_application_dedup
),
ranked AS (
  SELECT
    answer.id,
    participant.survivor_id,
    ROW_NUMBER() OVER (
      PARTITION BY participant.survivor_id, answer.field_name
      ORDER BY
        (NULLIF(TRIM(answer.value_text), '') IS NOT NULL OR answer.value_json IS NOT NULL) DESC,
        answer.updated_at DESC NULLS LAST,
        answer.created_at DESC NULLS LAST,
        answer.id DESC
    ) AS answer_rank
  FROM participants participant
  JOIN public.visa_application_answers answer
    ON answer.application_id = participant.application_id
)
SELECT id, survivor_id, answer_rank
FROM ranked;

DELETE FROM public.visa_application_answers answer
USING _ongoing_application_answer_dedup ranked
WHERE answer.id = ranked.id
  AND ranked.answer_rank > 1;

UPDATE public.visa_application_answers answer
SET application_id = ranked.survivor_id
FROM _ongoing_application_answer_dedup ranked
WHERE answer.id = ranked.id
  AND ranked.answer_rank = 1
  AND answer.application_id <> ranked.survivor_id;

-- Preserve one document per document type and keep OCR references attached to
-- the retained document/application.
CREATE TEMP TABLE _ongoing_application_document_dedup ON COMMIT DROP AS
WITH participants AS (
  SELECT survivor_id, survivor_id AS application_id FROM _ongoing_application_dedup
  UNION
  SELECT survivor_id, duplicate_id FROM _ongoing_application_dedup
),
ranked AS (
  SELECT
    document.id,
    participant.survivor_id,
    FIRST_VALUE(document.id) OVER document_group AS retained_document_id,
    ROW_NUMBER() OVER document_group AS document_rank
  FROM participants participant
  JOIN public.application_documents document
    ON document.application_id = participant.application_id
  WINDOW document_group AS (
    PARTITION BY participant.survivor_id, document.document_type
    ORDER BY
      (document.storage_path IS NOT NULL) DESC,
      CASE LOWER(TRIM(document.status))
        WHEN 'validated' THEN 0
        WHEN 'approved' THEN 1
        WHEN 'uploaded' THEN 2
        ELSE 3
      END,
      document.updated_at DESC NULLS LAST,
      document.created_at DESC NULLS LAST,
      document.id DESC
  )
)
SELECT id, survivor_id, retained_document_id, document_rank
FROM ranked;

UPDATE public.ocr_extractions extraction
SET
  application_id = ranked.survivor_id,
  document_id = ranked.retained_document_id
FROM _ongoing_application_document_dedup ranked
WHERE extraction.document_id = ranked.id;

DELETE FROM public.application_documents document
USING _ongoing_application_document_dedup ranked
WHERE document.id = ranked.id
  AND ranked.document_rank > 1;

UPDATE public.application_documents document
SET application_id = ranked.survivor_id
FROM _ongoing_application_document_dedup ranked
WHERE document.id = ranked.id
  AND ranked.document_rank = 1
  AND document.application_id <> ranked.survivor_id;

-- Preserve business/audit links that would otherwise be nulled, cascaded, or
-- block deletion. Submission jobs remain scoped to the retained application;
-- jobs owned only by discarded duplicates are intentionally cascade-deleted.
UPDATE public."order" row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.payment_records row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.user_packages row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.application_events row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.application_packets row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.application_signatures row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.consent_events row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.data_privacy_requests row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.invoice_requests row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.notification_events row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.ocr_extractions row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.refund_records row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.appointment_accounts row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.consent_event row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.notification_event_log row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.pii_access_log row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.pii_retention_jobs row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.signature_event row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.staff_chat_thread row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;
UPDATE public.universal_profile_answers row_ref SET source_application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.source_application_id = dedup.duplicate_id;
UPDATE public.universal_profile_documents row_ref SET source_application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.source_application_id = dedup.duplicate_id;
UPDATE public.visa_chat_sessions row_ref SET application_id = dedup.survivor_id
FROM _ongoing_application_dedup dedup WHERE row_ref.application_id = dedup.duplicate_id;

DELETE FROM public.applications application
USING _ongoing_application_dedup dedup
WHERE application.id = dedup.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS applications_one_ongoing_country_visa_idx
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

COMMIT;
