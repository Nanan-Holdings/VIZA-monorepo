-- Stage 4 evidence-driven database index improvements.
--
-- This migration is intentionally non-transactional: each statement must run
-- independently through the protected concurrent-index batch executor. It
-- changes no rows and removes no existing indexes.

CREATE INDEX CONCURRENTLY IF NOT EXISTS submission_queue_application_latest_idx
  ON public.submission_queue (application_id, updated_at DESC, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS visa_chunks_document_id_idx
  ON public.visa_chunks (document_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS pii_access_log_application_id_idx
  ON public.pii_access_log (application_id);
