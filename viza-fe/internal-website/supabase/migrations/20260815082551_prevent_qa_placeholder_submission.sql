-- Prevent synthetic QA values from entering any real submission queue and
-- remove the persisted sentinels created by the retired hosted QA workflow.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.prevent_synthetic_application_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  application_purpose TEXT;
  requested_mode TEXT;
  has_synthetic_answers BOOLEAN;
BEGIN
  SELECT application.purpose
  INTO application_purpose
  FROM public.applications AS application
  WHERE application.id = NEW.application_id;

  requested_mode := LOWER(TRIM(COALESCE(to_jsonb(NEW) ->> 'mode', '')));

  SELECT EXISTS (
    SELECT 1
    FROM public.visa_application_answers AS answer
    WHERE answer.application_id = NEW.application_id
      AND (
        COALESCE(answer.value_text, '') ~*
          '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid'
        OR COALESCE(answer.value_json::TEXT, '') ~*
          '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid'
      )
  )
  INTO has_synthetic_answers;

  IF application_purpose = 'VIZA_PLACEHOLDER_DRY_RUN' THEN
    IF TG_TABLE_NAME <> 'submission_queue' OR requested_mode <> 'dry_run' THEN
      RAISE EXCEPTION
        'Synthetic QA application % cannot enter a live submission queue',
        NEW.application_id
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF has_synthetic_answers THEN
    RAISE EXCEPTION
      'Application % contains synthetic QA answers and cannot be queued',
      NEW.application_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_synthetic_application_submission() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.prevent_synthetic_application_submission() FROM anon;
REVOKE ALL ON FUNCTION private.prevent_synthetic_application_submission() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_synthetic_application_submission
  ON public.submission_queue;
CREATE TRIGGER prevent_synthetic_application_submission
BEFORE INSERT OR UPDATE OF application_id, mode, status
ON public.submission_queue
FOR EACH ROW
EXECUTE FUNCTION private.prevent_synthetic_application_submission();

DROP TRIGGER IF EXISTS prevent_synthetic_runner_submission
  ON public.runner_job;
CREATE TRIGGER prevent_synthetic_runner_submission
BEFORE INSERT OR UPDATE OF application_id, status
ON public.runner_job
FOR EACH ROW
EXECUTE FUNCTION private.prevent_synthetic_application_submission();

DROP TRIGGER IF EXISTS prevent_synthetic_ds160_submission
  ON public.ds160_submission_jobs;
CREATE TRIGGER prevent_synthetic_ds160_submission
BEFORE INSERT OR UPDATE OF application_id, mode, status
ON public.ds160_submission_jobs
FOR EACH ROW
EXECUTE FUNCTION private.prevent_synthetic_application_submission();

CREATE OR REPLACE FUNCTION private.prevent_synthetic_answer_on_real_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  application_purpose TEXT;
BEGIN
  IF NOT (
    COALESCE(NEW.value_text, '') ~*
      '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid'
    OR COALESCE(NEW.value_json::TEXT, '') ~*
      '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT application.purpose
  INTO application_purpose
  FROM public.applications AS application
  WHERE application.id = NEW.application_id;

  IF application_purpose IS DISTINCT FROM 'VIZA_PLACEHOLDER_DRY_RUN' THEN
    RAISE EXCEPTION
      'Synthetic QA data cannot be saved to application %',
      NEW.application_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_synthetic_answer_on_real_application() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.prevent_synthetic_answer_on_real_application() FROM anon;
REVOKE ALL ON FUNCTION private.prevent_synthetic_answer_on_real_application() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_synthetic_answer_on_real_application
  ON public.visa_application_answers;
CREATE TRIGGER prevent_synthetic_answer_on_real_application
BEFORE INSERT OR UPDATE OF application_id, value_text, value_json
ON public.visa_application_answers
FOR EACH ROW
EXECUTE FUNCTION private.prevent_synthetic_answer_on_real_application();

DELETE FROM public.visa_application_answers AS answer
WHERE COALESCE(answer.value_text, '') ~*
    '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid'
  OR COALESCE(answer.value_json::TEXT, '') ~*
    '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid';

DELETE FROM public.universal_profile_answers AS answer
WHERE COALESCE(answer.value_text, '') ~*
    '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid'
  OR COALESCE(answer.value_zh, '') ~*
    '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid'
  OR COALESCE(answer.value_en, '') ~*
    '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)|qa[[:space:]_-]*placeholder|^qa[[:space:]_-]+edward[[:space:]_-]+viza$|@example[.]invalid';

UPDATE public.applicant_profiles
SET
  address = CASE
    WHEN COALESCE(address, '') ~* '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)'
      THEN NULL
    ELSE address
  END,
  address_zh = CASE
    WHEN COALESCE(address_zh, '') ~* '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)'
      THEN NULL
    ELSE address_zh
  END,
  address_en = CASE
    WHEN COALESCE(address_en, '') ~* '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)'
      THEN NULL
    ELSE address_en
  END,
  wechat = CASE
    WHEN LOWER(TRIM(COALESCE(wechat, ''))) = 'qa_edward_viza'
      THEN NULL
    ELSE wechat
  END,
  updated_at = NOW()
WHERE COALESCE(address, '') ~* '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)'
   OR COALESCE(address_zh, '') ~* '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)'
   OR COALESCE(address_en, '') ~* '(^|[^[:alnum:]])viza[[:space:]_-]*qa([^[:alnum:]]|$)'
   OR LOWER(TRIM(COALESCE(wechat, ''))) = 'qa_edward_viza';
