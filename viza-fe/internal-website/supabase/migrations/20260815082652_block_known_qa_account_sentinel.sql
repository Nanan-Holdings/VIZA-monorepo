-- Patch already-migrated databases for the dedicated QA account's historical
-- WeChat sentinel. Fresh databases also recognize it in the preceding guard.

CREATE OR REPLACE FUNCTION private.prevent_known_qa_account_sentinel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  application_purpose TEXT;
BEGIN
  IF LOWER(TRIM(COALESCE(NEW.value_text, ''))) <> 'qa_edward_viza'
    AND LOWER(TRIM(COALESCE(NEW.value_json::TEXT, ''))) <> 'qa_edward_viza'
  THEN
    RETURN NEW;
  END IF;

  SELECT application.purpose
  INTO application_purpose
  FROM public.applications AS application
  WHERE application.id = NEW.application_id;

  IF application_purpose IS DISTINCT FROM 'VIZA_PLACEHOLDER_DRY_RUN' THEN
    RAISE EXCEPTION
      'Synthetic QA account data cannot be saved to application %',
      NEW.application_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_known_qa_account_sentinel() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.prevent_known_qa_account_sentinel() FROM anon;
REVOKE ALL ON FUNCTION private.prevent_known_qa_account_sentinel() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_known_qa_account_sentinel
  ON public.visa_application_answers;
CREATE TRIGGER prevent_known_qa_account_sentinel
BEFORE INSERT OR UPDATE OF application_id, value_text, value_json
ON public.visa_application_answers
FOR EACH ROW
EXECUTE FUNCTION private.prevent_known_qa_account_sentinel();

DELETE FROM public.visa_application_answers AS answer
USING public.applications AS application
WHERE application.id = answer.application_id
  AND application.purpose IS DISTINCT FROM 'VIZA_PLACEHOLDER_DRY_RUN'
  AND (
    LOWER(TRIM(COALESCE(answer.value_text, ''))) = 'qa_edward_viza'
    OR LOWER(TRIM(COALESCE(answer.value_json::TEXT, ''))) = 'qa_edward_viza'
  );

UPDATE public.applicant_profiles
SET wechat = NULL, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(wechat, ''))) = 'qa_edward_viza';
