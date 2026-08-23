-- Align the already-installed ICP transaction-783 Document Center checklist
-- with the audited public service card. Applicant intake collection remains
-- separate from runner-only content review, identity-session, and payment
-- checkpoints.

DELETE FROM document_requirements old_requirement
WHERE old_requirement.country = 'united_arab_emirates'
  AND old_requirement.visa_type = 'AE_TOURIST_VISA'
  AND old_requirement.requirement_key = 'uae_health_insurance'
  AND EXISTS (
    SELECT 1
    FROM document_requirements canonical
    WHERE canonical.country = old_requirement.country
      AND canonical.visa_type = old_requirement.visa_type
      AND canonical.requirement_key = 'uae_health_coverage_evidence'
  );

UPDATE document_requirements
SET requirement_key = 'uae_health_coverage_evidence'
WHERE country = 'united_arab_emirates'
  AND visa_type = 'AE_TOURIST_VISA'
  AND requirement_key = 'uae_health_insurance';

DELETE FROM document_requirements old_requirement
WHERE old_requirement.country = 'united_arab_emirates'
  AND old_requirement.visa_type = 'AE_TOURIST_VISA'
  AND old_requirement.requirement_key = 'uae_accommodation_proof'
  AND EXISTS (
    SELECT 1
    FROM document_requirements canonical
    WHERE canonical.country = old_requirement.country
      AND canonical.visa_type = old_requirement.visa_type
      AND canonical.requirement_key = 'uae_accommodation_evidence'
  );

UPDATE document_requirements
SET requirement_key = 'uae_accommodation_evidence'
WHERE country = 'united_arab_emirates'
  AND visa_type = 'AE_TOURIST_VISA'
  AND requirement_key = 'uae_accommodation_proof';

DELETE FROM document_requirements old_requirement
WHERE old_requirement.country = 'united_arab_emirates'
  AND old_requirement.visa_type = 'AE_TOURIST_VISA'
  AND old_requirement.requirement_key = 'national_identity_card'
  AND EXISTS (
    SELECT 1
    FROM document_requirements canonical
    WHERE canonical.country = old_requirement.country
      AND canonical.visa_type = old_requirement.visa_type
      AND canonical.requirement_key = 'national_identity_copy'
  );

UPDATE document_requirements
SET requirement_key = 'national_identity_copy'
WHERE country = 'united_arab_emirates'
  AND visa_type = 'AE_TOURIST_VISA'
  AND requirement_key = 'national_identity_card';

UPDATE document_requirements
SET description = 'Official, stamped, signed, colored bank statement covering six months and showing at least USD 4,000 or equivalent in each month.',
    required = true,
    metadata = (COALESCE(metadata, '{}'::jsonb) - 'minimum_balance_usd') || '{
      "document_type":"bank_statement",
      "statement_months":6,
      "minimum_monthly_balance_usd_equivalent":4000,
      "must_be_official":true,
      "must_be_stamped":true,
      "must_be_signed":true,
      "must_be_colored":true,
      "content_review_required":true,
      "source":"uae_icp_service_783"
    }'::jsonb
WHERE country = 'united_arab_emirates'
  AND visa_type = 'AE_TOURIST_VISA'
  AND requirement_key = 'six_month_bank_statement';

UPDATE document_requirements
SET label_en = 'UAE medical insurance',
    label_zh = '阿联酋医疗保险',
    description = 'Medical-insurance evidence issued in the United Arab Emirates and valid for at least 180 days.',
    required = true,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{
      "document_type":"travel_insurance",
      "issuer_country":"United Arab Emirates",
      "minimum_validity_days":180,
      "content_review_required":true,
      "source":"uae_icp_service_783"
    }'::jsonb
WHERE country = 'united_arab_emirates'
  AND visa_type = 'AE_TOURIST_VISA'
  AND requirement_key = 'uae_health_coverage_evidence';

UPDATE document_requirements
SET description = 'Not listed as an always-required public service-card document. Collect only if the authenticated transaction-783 form requests it for the entered data.',
    required = false,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{
      "document_type":"hotel_booking",
      "applicability":"conditional",
      "condition_source":"authenticated_transaction_783_request",
      "source":"uae_icp_service_783"
    }'::jsonb
WHERE country = 'united_arab_emirates'
  AND visa_type = 'AE_TOURIST_VISA'
  AND requirement_key = 'uae_accommodation_evidence';

UPDATE document_requirements
SET label_en = 'National identity document',
    label_zh = '本国身份证件',
    description = 'Optional on the public service card. Collect only if the authenticated transaction-783 form requests it for the entered data.',
    required = false,
    metadata = (COALESCE(metadata, '{}'::jsonb) - 'condition_field' - 'condition_values') || '{
      "document_type":"national_identity_card",
      "applicability":"optional",
      "condition_source":"authenticated_transaction_783_request",
      "source":"uae_icp_service_783"
    }'::jsonb
WHERE country = 'united_arab_emirates'
  AND visa_type = 'AE_TOURIST_VISA'
  AND requirement_key = 'national_identity_copy';
