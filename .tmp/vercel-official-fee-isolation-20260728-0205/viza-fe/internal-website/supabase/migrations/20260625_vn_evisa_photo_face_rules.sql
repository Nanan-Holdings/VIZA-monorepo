-- Vietnam e-Visa photo, face-match, and passport-validity guardrails.
--
-- Mirrors official portal upload limits and date validation so VIZA blocks
-- invalid inputs before the submission-service reaches evisa.gov.vn.

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb)
    || '{"min_days_after_field":"visa_valid_from","min_days_after_field_days":30}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'passport_expiry_date';

WITH vn_requirements(requirement_key, metadata_patch, description_patch) AS (
  VALUES
    (
      'passport_copy',
      '{"document_type":"passport_copy","accept":[".jpg",".jpeg",".png",".webp"],"max_bytes":2097152,"requires_face":true,"face_match_role":"passport","source":"official_vietnam_evisa_portal"}'::jsonb,
      'Clear image of the passport bio-data page. The file must be JPG/JPEG/PNG/WEBP, under 2MB, and contain a detectable face for comparison with the portrait photo.'
    ),
    (
      'photo',
      '{"document_type":"photo","accept":[".jpg",".jpeg",".png",".webp"],"max_bytes":2097152,"requires_face":true,"face_match_role":"portrait","face_match_pair":"passport_copy","source":"official_vietnam_evisa_portal"}'::jsonb,
      'Recent front-facing portrait photo for the Vietnam e-Visa portal. The file must be under 2MB and match the face on the passport data page.'
    )
)
UPDATE document_requirements AS requirement
SET metadata = COALESCE(requirement.metadata, '{}'::jsonb) || vn_requirements.metadata_patch,
    description = vn_requirements.description_patch,
    required = true,
    updated_at = now()
FROM vn_requirements
WHERE lower(requirement.country) = 'vietnam'
  AND upper(requirement.visa_type) IN ('VN_E_VISA', 'EVISA_TOURISM')
  AND requirement.requirement_key = vn_requirements.requirement_key;
