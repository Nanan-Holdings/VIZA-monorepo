-- UK portal credentials belong only in the service-only uk_accounts table.
-- Remove legacy copies from customer-readable application result JSON.

UPDATE public.applications
SET
  submission_result = submission_result - ARRAY[
    'portalUrl',
    'portalUsername',
    'generatedPasswordCipher',
    'password',
    'generatedPassword',
    'portalPassword',
    'passwordCipher'
  ]::text[],
  submission_result_updated_at = now()
WHERE upper(COALESCE(submission_result->>'country', '')) = 'UK'
  AND submission_result ?| ARRAY[
    'portalUrl',
    'portalUsername',
    'generatedPasswordCipher',
    'password',
    'generatedPassword',
    'portalPassword',
    'passwordCipher'
  ];
