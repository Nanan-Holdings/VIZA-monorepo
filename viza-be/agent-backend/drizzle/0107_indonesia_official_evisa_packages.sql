-- Keep Indonesia eVisa catalog entries aligned with the official
-- evisa.imigrasi.go.id portal. C1 and B1 are separate VIZA packages, but both
-- use the same official Indonesia eVisa portal intake.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY country, visa_type
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM visa_packages
  WHERE country = 'indonesia'
    AND visa_type IN ('ID_C1_TOURIST', 'ID_B1_EVOA')
)
DELETE FROM visa_packages
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE visa_packages
SET
  name = 'Indonesia C1 Tourist Single Entry eVisa',
  description = 'Indonesia C1 Tourist Single Entry eVisa submitted through the official Indonesia eVisa portal evisa.imigrasi.go.id. VIZA mirrors the official passport/photo upload, application form, declarations, payment, and status tracking flow.',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'official_portal_url', 'https://evisa.imigrasi.go.id/',
    'submission_provider', 'indonesia_c1_live',
    'form_seed', 'scripts/seed-id-c1-tourist-form-fields.ts'
  ),
  updated_at = NOW()
WHERE country = 'indonesia'
  AND visa_type = 'ID_C1_TOURIST';

INSERT INTO visa_packages (country, visa_type, name, description, metadata)
VALUES (
  'indonesia',
  'ID_B1_EVOA',
  'Indonesia B1 e-VoA',
  'Indonesia B1 electronic Visa on Arrival submitted through the official Indonesia eVisa portal evisa.imigrasi.go.id. VIZA mirrors the official passport/photo upload, application form, declarations, payment, and status tracking flow.',
  jsonb_build_object(
    'official_portal_url', 'https://evisa.imigrasi.go.id/',
    'submission_provider', 'indonesia_b1_evoa_live',
    'form_seed', 'scripts/seed-id-b1-evoa-form-fields.ts'
  )
)
ON CONFLICT DO NOTHING;

UPDATE visa_packages
SET
  name = 'Indonesia B1 e-VoA',
  description = 'Indonesia B1 electronic Visa on Arrival submitted through the official Indonesia eVisa portal evisa.imigrasi.go.id. VIZA mirrors the official passport/photo upload, application form, declarations, payment, and status tracking flow.',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'official_portal_url', 'https://evisa.imigrasi.go.id/',
    'submission_provider', 'indonesia_b1_evoa_live',
    'form_seed', 'scripts/seed-id-b1-evoa-form-fields.ts'
  ),
  updated_at = NOW()
WHERE country = 'indonesia'
  AND visa_type = 'ID_B1_EVOA';
