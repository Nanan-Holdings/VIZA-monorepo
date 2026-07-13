-- Align Indonesia B1 e-VoA document checklist with the official
-- evisa.imigrasi.go.id B1 portal evidence captured during live smoke.
-- B1 does not use the generic proof-of-funds checklist item.

DELETE FROM document_requirements
WHERE country = 'indonesia'
  AND visa_type = 'ID_B1_EVOA';

WITH b1_package AS (
  SELECT id
  FROM visa_packages
  WHERE country = 'indonesia'
    AND visa_type = 'ID_B1_EVOA'
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
INSERT INTO document_requirements (
  visa_package_id,
  country,
  visa_type,
  requirement_key,
  label_en,
  label_zh,
  description,
  required,
  sort_order,
  metadata
)
SELECT
  b1_package.id,
  'indonesia',
  'ID_B1_EVOA',
  requirement_key,
  label_en,
  label_zh,
  description,
  required,
  sort_order,
  metadata
FROM b1_package
CROSS JOIN (
  VALUES
    (
      'passport_copy',
      'Passport bio page',
      '护照资料页',
      'Official requirement: upload a sharp, in-focus, landscape passport bio page photo or scan. It must not be ghosted, covered, cropped, folded, or blurry.',
      true,
      10,
      '{"document_type":"passport_copy","accept":[".pdf",".jpg",".jpeg",".png",".webp"],"source":"official_evisa_portal"}'::jsonb
    ),
    (
      'photo',
      'Newest formal photo',
      '近期证件照',
      'Official requirement: JPEG/JPG/PNG color photo, minimum 400x600px, maximum 2MB, proper composition. Head including hair to chin should be 50%-60% of image height; eye height should be 50%-60%. Avoid blurry, non-face, expression, too-close, or too-far photos.',
      true,
      20,
      '{"document_type":"photo","accept":[".jpg",".jpeg",".png"],"source":"official_evisa_portal"}'::jsonb
    ),
    (
      'return_ticket',
      'Return or onward ticket',
      '返程或续程机票',
      'Official requirement: return ticket or onward ticket to continue the journey to another country. PDF format.',
      true,
      30,
      '{"document_type":"return_ticket","accept":[".pdf"],"source":"official_evisa_portal"}'::jsonb
    ),
    (
      'passport_validity_support',
      'Passport validity support document',
      '护照有效期支持材料',
      'Official support document: passport valid for at least 6 months. For travel documents other than passports, validity must be at least 12 months. VIZA can generate this PDF from the passport bio page when possible.',
      false,
      40,
      '{"document_type":"passport_validity_support","accept":[".pdf"],"source":"official_evisa_portal","auto_generatable":true}'::jsonb
    )
) AS requirements(requirement_key, label_en, label_zh, description, required, sort_order, metadata);
