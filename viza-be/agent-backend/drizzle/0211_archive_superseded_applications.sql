-- 0211: Keep only the newest application live per applicant + country + visa.
--
-- Creating an application archives the applicant's older applications for the
-- same country and visa type, so client lists show the most recent attempt
-- instead of a stale failure. Rows with an in-flight submission job, QA
-- placeholders and QA-archived rows are never touched. Each archived row
-- records which application superseded it and its previous status; deleting
-- that newer application (for example, a draft whose copy failed) restores
-- the older rows. Archived rows keep all data and stay reachable by id.

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS superseded_by_application_id uuid,
  ADD COLUMN IF NOT EXISTS superseded_previous_status text;

CREATE INDEX IF NOT EXISTS applications_superseded_by_idx
  ON public.applications (superseded_by_application_id)
  WHERE superseded_by_application_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.archive_superseded_applications(p_application_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new public.applications%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO v_new FROM public.applications WHERE id = p_application_id;
  IF NOT FOUND
     OR v_new.applicant_id IS NULL
     OR COALESCE(v_new.purpose, '') = 'VIZA_PLACEHOLDER_DRY_RUN'
     OR v_new.qa_archived_at IS NOT NULL
     OR LOWER(TRIM(COALESCE(v_new.status, ''))) = 'archived' THEN
    RETURN 0;
  END IF;

  UPDATE public.applications AS older
     SET superseded_previous_status = older.status,
         superseded_by_application_id = v_new.id,
         status = 'archived',
         updated_at = NOW()
   WHERE older.applicant_id = v_new.applicant_id
     AND older.id <> v_new.id
     AND LOWER(TRIM(COALESCE(older.country, ''))) = LOWER(TRIM(COALESCE(v_new.country, '')))
     AND UPPER(TRIM(COALESCE(older.visa_type, ''))) = UPPER(TRIM(COALESCE(v_new.visa_type, '')))
     AND (older.created_at < v_new.created_at
          OR (older.created_at = v_new.created_at AND older.id < v_new.id))
     AND LOWER(TRIM(COALESCE(older.status, ''))) <> 'archived'
     AND COALESCE(older.purpose, '') <> 'VIZA_PLACEHOLDER_DRY_RUN'
     AND older.qa_archived_at IS NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.submission_queue AS job
        WHERE job.application_id = older.id
          AND (job.status ILIKE '%pending%'
               OR job.status ILIKE '%processing%'
               OR job.status ILIKE '%scheduled%')
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_superseded_applications(p_application_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.applications AS older
     SET status = COALESCE(older.superseded_previous_status, older.status),
         superseded_by_application_id = NULL,
         superseded_previous_status = NULL,
         updated_at = NOW()
   WHERE older.superseded_by_application_id = p_application_id
     AND LOWER(TRIM(COALESCE(older.status, ''))) = 'archived';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.applications_archive_superseded_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.archive_superseded_applications(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.applications_restore_superseded_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.restore_superseded_applications(OLD.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS applications_archive_superseded ON public.applications;
CREATE TRIGGER applications_archive_superseded
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_archive_superseded_on_insert();

DROP TRIGGER IF EXISTS applications_restore_superseded ON public.applications;
CREATE TRIGGER applications_restore_superseded
  AFTER DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_restore_superseded_on_delete();

REVOKE ALL ON FUNCTION public.archive_superseded_applications(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_superseded_applications(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.applications_archive_superseded_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.applications_restore_superseded_on_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_superseded_applications(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_superseded_applications(uuid) TO service_role;

-- One-time backfill: archive everything older than the newest live row of
-- each applicant + country + visa type.
DO $$
DECLARE
  v_newest record;
BEGIN
  FOR v_newest IN
    SELECT DISTINCT ON (applicant_id, LOWER(TRIM(COALESCE(country, ''))), UPPER(TRIM(COALESCE(visa_type, ''))))
           id
      FROM public.applications
     WHERE applicant_id IS NOT NULL
       AND COALESCE(purpose, '') <> 'VIZA_PLACEHOLDER_DRY_RUN'
       AND qa_archived_at IS NULL
       AND LOWER(TRIM(COALESCE(status, ''))) <> 'archived'
     ORDER BY applicant_id,
              LOWER(TRIM(COALESCE(country, ''))),
              UPPER(TRIM(COALESCE(visa_type, ''))),
              created_at DESC,
              id DESC
  LOOP
    PERFORM public.archive_superseded_applications(v_newest.id);
  END LOOP;
END;
$$;

COMMIT;
