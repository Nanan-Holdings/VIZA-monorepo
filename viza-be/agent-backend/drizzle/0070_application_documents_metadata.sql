-- =============================================================================
-- application_documents.metadata (DOCUP-002)
--
-- Stores OCR / MRZ consistency snapshots and any other per-document
-- side-channel info (e.g. photo crop dimensions, face-match scores).
-- Keeps the columns column-set tight while letting us iterate without
-- another migration per signal.
-- =============================================================================

ALTER TABLE application_documents
  ADD COLUMN IF NOT EXISTS metadata JSONB;
