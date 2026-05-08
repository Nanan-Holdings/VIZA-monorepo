-- =============================================================================
-- Document retention + redaction on delivery (DOC-006)
--
-- Per-doc-class retention rules layered on top of the existing
-- LEGAL-003 schedule (drizzle/0049). LEGAL-003 covers global
-- retention horizons; this migration adds the *post-delivery* sweep
-- that fires once an application reaches a terminal status — passport
-- scans + photos do not need to live for 12 months when the visa was
-- issued 30 days ago.
--
-- Defaults baked in (overridable via the function arg):
--   passport_scan / photo  → 30 days post-delivery
--   supporting documents   → 90 days post-delivery
--   submission artefacts   → 180 days post-delivery (debug window)
-- =============================================================================

CREATE OR REPLACE FUNCTION purge_post_delivery_documents(
  passport_days INTEGER DEFAULT 30,
  supporting_days INTEGER DEFAULT 90,
  artefacts_days INTEGER DEFAULT 180
) RETURNS INTEGER
  LANGUAGE plpgsql
AS $$
DECLARE
  started TIMESTAMPTZ := NOW();
  total INTEGER := 0;
  n INTEGER;
BEGIN
  -- Passport scans + photos: tied to applications that hit a terminal
  -- delivered/cancelled status more than `passport_days` days ago.
  DELETE FROM application_documents ad
  USING applications app
  WHERE ad.application_id = app.id
    AND app.status IN ('delivered', 'cancelled')
    AND app.updated_at < NOW() - MAKE_INTERVAL(days => passport_days)
    AND ad.kind IN ('passport', 'photo');
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  -- Supporting documents: longer window, same trigger.
  DELETE FROM supporting_doc_submission s
  USING applications app
  WHERE s.application_id = app.id
    AND app.status IN ('delivered', 'cancelled')
    AND app.updated_at < NOW() - MAKE_INTERVAL(days => supporting_days);
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  -- Submission artefacts: kept for the debug window, then cleared on
  -- terminal-status applications. Real artefact bytes get swept by the
  -- R2/Storage cleanup worker reading retention_purge_log.
  UPDATE submission_queue
     SET ceac_result_payload = NULL,
         uk_result_payload = NULL
   WHERE application_id IN (
     SELECT id FROM applications
      WHERE status IN ('delivered', 'cancelled')
        AND updated_at < NOW() - MAKE_INTERVAL(days => artefacts_days)
   );
  GET DIAGNOSTICS n = ROW_COUNT;
  total := total + n;

  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at)
  VALUES (
    'post_delivery_documents',
    passport_days,
    total,
    started,
    NOW()
  );
  RETURN total;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO retention_purge_log(class, retention_days, rows_deleted, started_at, finished_at, error)
  VALUES ('post_delivery_documents', passport_days, 0, started, NOW(), SQLERRM);
  RAISE;
END;
$$;
