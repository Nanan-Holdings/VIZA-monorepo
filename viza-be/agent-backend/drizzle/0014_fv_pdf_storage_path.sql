-- =============================================================================
-- France-Visas: persist the path to the downloaded CERFA PDF in Supabase
-- Storage. Set by submission-service after a successful Finalize +
-- download. Surfaced to the applicant via signed URL so they can print
-- the form for their VAC appointment.
-- =============================================================================

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS fv_pdf_storage_path TEXT;

COMMENT ON COLUMN submission_queue.fv_pdf_storage_path IS
  'Supabase Storage path to the CERFA PDF (under application-documents bucket).';
