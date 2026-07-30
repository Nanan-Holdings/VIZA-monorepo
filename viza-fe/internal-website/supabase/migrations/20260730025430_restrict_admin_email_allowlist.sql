-- Restrict production admin roles to the explicitly approved email allowlist.
-- These users may also retain applicant_profiles rows so the same account can
-- continue to use the client portal when signing in through /client/login.

UPDATE public.users
SET role = 'staff'
WHERE role = 'admin'
  AND lower(email) NOT IN (
    'czz19974931995@gmail.com',
    'edward.zehua.zhang@gmail.com',
    'fionatsui2017@gmail.com',
    'junjieran05@gmail.com',
    'e1484122@u.nus.edu',
    'nanan.viza2016@gmail.com'
  );

INSERT INTO public.users (id, email, role, name, deleted_at, deleted_by)
SELECT
  auth_user.id,
  lower(auth_user.email),
  'admin',
  COALESCE(
    NULLIF(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
    split_part(auth_user.email, '@', 1)
  ),
  NULL,
  NULL
FROM auth.users AS auth_user
WHERE auth_user.email IS NOT NULL
  AND auth_user.email_confirmed_at IS NOT NULL
  AND lower(auth_user.email) IN (
    'czz19974931995@gmail.com',
    'edward.zehua.zhang@gmail.com',
    'fionatsui2017@gmail.com',
    'junjieran05@gmail.com',
    'e1484122@u.nus.edu',
    'nanan.viza2016@gmail.com'
  )
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  role = 'admin',
  deleted_at = NULL,
  deleted_by = NULL;
