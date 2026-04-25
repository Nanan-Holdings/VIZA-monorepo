-- =============================================================================
-- UK Standard Visitor automation support
--
-- Adds two columns to submission_queue, parallel to ceac_result_payload /
-- fv_result_payload, so the submission-service worker can persist a
-- structured outcome blob and the UKVI-assigned application reference
-- once the post-auth flow is mapped.
--
-- submission_queue.status is a TEXT column with no CHECK constraint, so
-- the new uk_prefill_pending / uk_prefill_processing / uk_prefilled /
-- uk_prefill_failed / uk_blocked values do not require a DDL change —
-- the application layer (src/types.ts in submission-service) owns the
-- enum.
--
-- No `uk_accounts` table is added in this migration. The UK orchestrator
-- currently halts at the registration page (pre-auth scaffold). When
-- post-auth selectors are mapped via src/uk/form-recon.ts, a follow-up
-- migration should add a uk_accounts table mirroring fv_accounts:
-- (applicant_id, email, password_encrypted, storage_state_json).
-- =============================================================================

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS uk_result_payload JSONB,
  ADD COLUMN IF NOT EXISTS uk_application_reference TEXT;

COMMENT ON COLUMN submission_queue.uk_result_payload IS
  'UkOrchestrateResult JSON payload (handoffReady flag, stoppedAt page id, pagesVisited, reason).';
COMMENT ON COLUMN submission_queue.uk_application_reference IS
  'UKVI-assigned application reference once the post-auth flow registers an account.';
