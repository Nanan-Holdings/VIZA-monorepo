-- =============================================================================
-- Australia Visitor (Subclass 600) automation support
--
-- Adds three columns to submission_queue, parallel to ceac_result_payload /
-- fv_result_payload / uk_result_payload, so the submission-service worker can
-- persist a structured outcome blob, the ImmiAccount-assigned Transaction
-- Reference Number (TRN), and the storage path of the captured Review-page
-- screenshot used for the user-facing handoff.
--
-- submission_queue.status is a TEXT column with no CHECK constraint, so the
-- new au_prefill_pending / au_prefill_processing / au_prefilled /
-- au_prefill_failed / au_blocked values do not require a DDL change — the
-- application layer (src/types.ts in submission-service) owns the enum.
--
-- applications.submission_result_status is also TEXT without a CHECK, so the
-- new `stopped_at_review` value introduced for AU does not require a DDL
-- change either; only the comment is refreshed for documentation.
-- =============================================================================

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS au_result_payload JSONB,
  ADD COLUMN IF NOT EXISTS au_trn TEXT,
  ADD COLUMN IF NOT EXISTS au_review_screenshot_storage_path TEXT;

COMMENT ON COLUMN submission_queue.au_result_payload IS
  'AU Subclass 600 RunResult JSON payload (reachedPage, trn, pagesWalked, validationErrors).';
COMMENT ON COLUMN submission_queue.au_trn IS
  'ImmiAccount-assigned Transaction Reference Number once a draft is created.';
COMMENT ON COLUMN submission_queue.au_review_screenshot_storage_path IS
  'submission-artifacts bucket path for the captured Review page screenshot — handed off to the user as proof the form is filled and ready for them to submit.';

COMMENT ON COLUMN applications.submission_result_status IS
  'High-level submission status: waiting | processing | submitted | stopped_at_pay | stopped_at_review | failed.';
