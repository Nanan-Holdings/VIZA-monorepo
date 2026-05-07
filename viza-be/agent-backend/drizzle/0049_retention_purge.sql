-- =============================================================================
-- Retention purge functions + audit log (LEGAL-003)
--
-- Each `purge_*` function deletes rows older than the supplied
-- retention_days, writes one summary row to retention_purge_log, and
-- returns the count. R2 / Storage object cleanup is decoupled — a
-- background worker reads retention_purge_log and removes any object
-- whose database row no longer exists.
-- =============================================================================

CREATE TABLE IF NOT EXISTS retention_purge_log (
  id BIGSERIAL PRIMARY KEY,
  class TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  rows_deleted INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_retention_purge_log_class_started
  ON retention_purge_log(class, started_at DESC);

ALTER TABLE retention_purge_log ENABLE ROW LEVEL SECURITY;
-- service-role only; no policies declared.

-- ---------------------------------------------------------------------------
-- visa_application_answers — 36 months default
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_application_answers(retention_days INTEGER)
  RETURNS INTEGER
  LANGUAGE plpgsql
AS $$
DECLARE
  started TIMESTAMPTZ := NOW();
  cutoff TIMESTAMPTZ := NOW() - MAKE_INTERVAL(days => retention_days);
  rows_deleted INTEGER;
BEGIN
  DELETE FROM visa_application_answers
  WHERE application_id IN (
    SELECT id FROM applications WHERE updated_at < cutoff
  );
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at)
  VALUES ('visa_application_answers', retention_days, rows_deleted, started, NOW());
  RETURN rows_deleted;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at, error)
  VALUES ('visa_application_answers', retention_days, 0, started, NOW(), SQLERRM);
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------------
-- application_documents — 12 months default. Storage cleanup is handled
-- separately by the R2 / Storage purge worker reading retention_purge_log.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_application_documents(retention_days INTEGER)
  RETURNS INTEGER
  LANGUAGE plpgsql
AS $$
DECLARE
  started TIMESTAMPTZ := NOW();
  cutoff TIMESTAMPTZ := NOW() - MAKE_INTERVAL(days => retention_days);
  rows_deleted INTEGER;
BEGIN
  DELETE FROM application_documents
  WHERE created_at < cutoff;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at)
  VALUES ('application_documents', retention_days, rows_deleted, started, NOW());
  RETURN rows_deleted;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at, error)
  VALUES ('application_documents', retention_days, 0, started, NOW(), SQLERRM);
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------------
-- submission_queue + per-country *_result_payload — 12 months default.
-- We null out the payload columns on the queue rows rather than deleting
-- the rows (preserves the operational history of which jobs ran).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_submission_artifacts(retention_days INTEGER)
  RETURNS INTEGER
  LANGUAGE plpgsql
AS $$
DECLARE
  started TIMESTAMPTZ := NOW();
  cutoff TIMESTAMPTZ := NOW() - MAKE_INTERVAL(days => retention_days);
  rows_deleted INTEGER;
BEGIN
  UPDATE submission_queue
  SET ceac_result_payload = NULL
  WHERE updated_at < cutoff
    AND ceac_result_payload IS NOT NULL;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at)
  VALUES ('submission_artifacts', retention_days, rows_deleted, started, NOW());
  RETURN rows_deleted;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at, error)
  VALUES ('submission_artifacts', retention_days, 0, started, NOW(), SQLERRM);
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------------
-- recon walker captures — placeholder. The walker writes to
-- submission-artifacts/recon/<country>/<run-id>/. Database has no row
-- to delete, so the function only logs intent for the R2 / Storage
-- cleanup worker.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_recon_artifacts(retention_days INTEGER)
  RETURNS INTEGER
  LANGUAGE plpgsql
AS $$
DECLARE
  started TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at)
  VALUES ('recon_artifacts', retention_days, 0, started, NOW());
  RETURN 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- Audit logs (secret_access_log, consent_event, pii_access_log when present)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_audit_logs(retention_days INTEGER)
  RETURNS INTEGER
  LANGUAGE plpgsql
AS $$
DECLARE
  started TIMESTAMPTZ := NOW();
  cutoff TIMESTAMPTZ := NOW() - MAKE_INTERVAL(days => retention_days);
  total INTEGER := 0;
  n INTEGER;
BEGIN
  DELETE FROM secret_access_log WHERE ts < cutoff;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  DELETE FROM consent_event WHERE ts < cutoff;
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  -- pii_access_log lands in LEGAL-005; tolerate its absence.
  BEGIN
    EXECUTE 'DELETE FROM pii_access_log WHERE ts < $1' USING cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at)
  VALUES ('audit_logs', retention_days, total, started, NOW());
  RETURN total;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at, error)
  VALUES ('audit_logs', retention_days, 0, started, NOW(), SQLERRM);
  RAISE;
END;
$$;
