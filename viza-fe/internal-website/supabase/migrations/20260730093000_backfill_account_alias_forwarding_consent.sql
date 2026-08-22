-- Promote explicit application-level alias forwarding acceptance to the
-- account-level consent audit table. This lets one permanent applicant alias
-- serve every current and future application without silently inventing
-- consent for users who never accepted it.
--
-- Early website-only installs created consent_event with a closed doc_kind
-- CHECK that predates alias_email_forwarding. The backend migration track and
-- current production schema intentionally keep this audit field open-ended.
-- Remove the legacy constraint before inserting the newer consent kind so a
-- clean website migration replay cannot fail here.
ALTER TABLE public.consent_event
  DROP CONSTRAINT IF EXISTS consent_event_doc_kind_check;

INSERT INTO public.consent_event (
  user_id,
  applicant_id,
  email,
  doc_kind,
  doc_version,
  ip,
  ua,
  ts
)
SELECT
  profile.auth_user_id,
  accepted.applicant_id,
  LOWER(profile.email),
  'alias_email_forwarding',
  '2026-07-22',
  accepted.ip_address,
  accepted.user_agent,
  COALESCE(accepted.created_at, NOW())
FROM (
  SELECT DISTINCT ON (applicant_id)
    applicant_id,
    ip_address,
    user_agent,
    created_at
  FROM public.consent_events
  WHERE applicant_id IS NOT NULL
    AND consent_type = 'alias_email_forwarding'
    AND version = '2026-07-22'
    AND document_hash = 'sha256:5d2d7fcccd083bbde90b9d42529b5f8cab380fd7bf26a79eb2ba84315f1fb212'
    AND accepted = TRUE
    AND revoked_at IS NULL
  ORDER BY applicant_id, created_at DESC
) AS accepted
JOIN public.applicant_profiles AS profile
  ON profile.id = accepted.applicant_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.consent_event AS existing
  WHERE existing.applicant_id = accepted.applicant_id
    AND existing.doc_kind = 'alias_email_forwarding'
    AND existing.doc_version = '2026-07-22'
);
