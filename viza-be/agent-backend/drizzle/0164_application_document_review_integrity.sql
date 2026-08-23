-- Keep applicant-owned document uploads separate from staff-owned review facts.
--
-- The original owner UPDATE policy is intentionally retained for uploads and
-- replacements. This trigger prevents an authenticated applicant from using
-- that policy to manufacture a reviewed status or replay an old review. A
-- replacement must reset to an unreviewed state; trusted service-role and
-- active staff/admin writers continue through the audited server actions.

CREATE OR REPLACE FUNCTION public.enforce_application_document_review_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_role text := COALESCE(auth.role(), '');
  request_user_id uuid := auth.uid();
BEGIN
  -- Database migrations/maintenance do not carry an end-user JWT. Supabase
  -- server writers use the service-role claim and are separately audited.
  IF request_user_id IS NULL OR request_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = request_user_id
      AND users.role IN ('admin', 'staff')
      AND users.deleted_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('uploaded', 'missing')
     OR NEW.reviewed_at IS NOT NULL
     OR NEW.reviewed_by IS NOT NULL
     OR NEW.document_hash IS NOT NULL
     OR NEW.metadata IS NOT NULL
     OR NEW.review_notes IS NOT NULL
     OR NEW.rejection_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'Applicant document writes must reset privileged review fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_document_review_integrity
  ON public.application_documents;
CREATE TRIGGER application_document_review_integrity
BEFORE INSERT OR UPDATE ON public.application_documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_application_document_review_integrity();

COMMENT ON FUNCTION public.enforce_application_document_review_integrity() IS
  'Prevents applicant JWTs from manufacturing or replaying staff-owned application document review state.';

-- Historical reviewed-looking projections cannot be distinguished from owner
-- forgery because the old UPDATE policy allowed every column to be changed and
-- users/reviewer identifiers were readable. Fail closed once: staff must
-- re-review these documents through an audited writer after this migration.
UPDATE public.application_documents
SET status = 'uploaded',
    rejection_reason = NULL,
    review_notes = NULL,
    reviewed_at = NULL,
    reviewed_by = NULL,
    document_hash = NULL,
    metadata = NULL,
    updated_at = now()
WHERE lower(trim(status)) IN ('validated', 'accepted', 'approved', 'verified', 'ready');
