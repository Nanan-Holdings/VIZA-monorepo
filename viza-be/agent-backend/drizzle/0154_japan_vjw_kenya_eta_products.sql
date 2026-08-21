-- Canonical online products for the first Japan/ Kenya automation release.
-- JP_VISIT_JAPAN_WEB is an arrival declaration, not a visa. Its live runner
-- remains disabled until the Digital Agency authorization/compliance gate is
-- cleared under the current Visit Japan Web terms. KE_ETA may be submitted on
-- behalf of another traveller under the official Kenya FAQ. Russia, Brazil,
-- and Kenya F88 are intentionally absent.

WITH products(country, visa_type, name, description, metadata) AS (
  VALUES
    (
      'japan',
      'JP_VISIT_JAPAN_WEB',
      'Japan Visit Japan Web',
      'Japan Visit Japan Web immigration and customs arrival declaration for one Chinese ordinary-passport tourism traveller. This is not a visa. The service is free on official channels. Live third-party registration, form filling, or submission remains a launch-compliance-gated capability pending confirmation of current Digital Agency terms and authorization.',
      jsonb_build_object(
        'official_portal_url', 'https://services.digital.go.jp/en/visit-japan-web/',
        'official_policy_url', 'https://www.digital.go.jp/en/policies/visit_japan_web',
        'immigration_source_url', 'https://www.moj.go.jp/isa/immigration/procedures/translation.html?hl=en',
        'customs_source_url', 'https://www.customs.go.jp/english/passenger/declaration/declaration_app.html',
        'form_seed', 'scripts/seed-jp-visit-japan-web-form-fields.ts',
        'scope', 'single_traveller_chinese_ordinary_passport_tourism',
        'support_level', 'automated',
        'automation_gate', 'requires_official_authorization',
        'launch_compliance_gate', 'Visit Japan Web Terms of Use (2026-07-22) Article 8(3) requires user operation unless Digital Agency separately authorizes otherwise; verify current terms before enabling live runner.',
        'official_free', TRUE,
        'group_submission', 'out_of_scope_v1',
        'included_procedures', jsonb_build_array('immigration', 'customs'),
        'government_fee', jsonb_build_object(
          'mode', 'display_only',
          'amount_cents', 0,
          'currency', 'USD',
          'label', 'Visit Japan Web government fee',
          'payer', 'applicant',
          'collection_method', 'official_portal',
          'source_url', 'https://www.customs.go.jp/english/news/20260528e.html'
        )
      )
    ),
    (
      'kenya',
      'KE_ETA',
      'Kenya Electronic Travel Authorisation',
      'Kenya official eTA for one Chinese ordinary-passport tourism traveller. The official FAQ permits an authorized person to apply on behalf of another traveller. Standard government fee baseline is USD 30; expedited service is a separate official option and must be rechecked at submission.',
      jsonb_build_object(
        'official_portal_url', 'https://etakenya.go.ke/',
        'official_how_to_apply_url', 'https://etakenya.go.ke/form/apply/how-to-apply?type=tourist',
        'official_faq_url', 'https://etakenya.go.ke/faqs',
        'official_eligibility_url', 'https://etakenya.go.ke/eligibility',
        'form_seed', 'scripts/seed-ke-eta-form-fields.ts',
        'scope', 'single_traveller_chinese_ordinary_passport_tourism',
        'support_level', 'automated',
        'automation_gate', 'ready',
        'apply_on_behalf_allowed', TRUE,
        'eta_valid_for_travel_days', 90,
        'standard_processing_business_days', 3,
        'fee_variants', jsonb_build_array(
          jsonb_build_object('code', 'standard', 'amount_cents', 3000, 'currency', 'USD'),
          jsonb_build_object('code', 'expedited', 'surcharge_cents', 10000, 'currency', 'USD')
        ),
        'government_fee', jsonb_build_object(
          'mode', 'display_only',
          'amount_cents', 3000,
          'currency', 'USD',
          'label', 'Kenya standard eTA government fee',
          'payer', 'applicant',
          'collection_method', 'official_portal',
          'source_url', 'https://etakenya.go.ke/faqs'
        ),
        'out_of_scope', jsonb_build_array('F88', 'separate_arrival_card', 'non_tourism_purpose_v1')
      )
    )
), inserted AS (
  INSERT INTO public.visa_packages (country, visa_type, name, description, metadata)
  SELECT product.country, product.visa_type, product.name, product.description, product.metadata
  FROM products product
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.visa_packages existing
    WHERE LOWER(TRIM(existing.country)) = product.country
      AND UPPER(TRIM(existing.visa_type)) = product.visa_type
  )
  RETURNING id
)
UPDATE public.visa_packages package
SET
  name = product.name,
  description = product.description,
  metadata = COALESCE(package.metadata, '{}'::JSONB) || product.metadata,
  is_active = TRUE,
  updated_at = NOW()
FROM products product
WHERE LOWER(TRIM(package.country)) = product.country
  AND UPPER(TRIM(package.visa_type)) = product.visa_type;

-- Government fee catalog rows are separate from VIZA agency pricing. The
-- package seed is idempotent: update the current row, then replace only the
-- package-owned display-only government rule.
INSERT INTO public.package_pricing (
  visa_package_id,
  currency,
  government_fee_cents,
  agency_fee_cents,
  source,
  updated_at
)
SELECT package.id,
       CASE package.visa_type WHEN 'KE_ETA' THEN 'USD' ELSE 'USD' END,
       CASE package.visa_type WHEN 'KE_ETA' THEN 3000 ELSE 0 END,
       CASE package.visa_type WHEN 'KE_ETA' THEN 9900 ELSE 0 END,
       'seed',
       NOW()
FROM public.visa_packages package
WHERE (LOWER(TRIM(package.country)), UPPER(TRIM(package.visa_type))) IN (
  ('japan', 'JP_VISIT_JAPAN_WEB'),
  ('kenya', 'KE_ETA')
)
ON CONFLICT (visa_package_id, currency)
DO UPDATE SET
  government_fee_cents = EXCLUDED.government_fee_cents,
  agency_fee_cents = EXCLUDED.agency_fee_cents,
  source = EXCLUDED.source,
  updated_at = NOW();

DELETE FROM public.government_fee_rules rule
WHERE rule.visa_package_id IN (
  SELECT package.id
  FROM public.visa_packages package
  WHERE (LOWER(TRIM(package.country)), UPPER(TRIM(package.visa_type))) IN (
    ('japan', 'JP_VISIT_JAPAN_WEB'),
    ('kenya', 'KE_ETA')
  )
)
AND rule.fee_type = 'government_fee';

INSERT INTO public.government_fee_rules (
  visa_package_id,
  country,
  visa_type,
  fee_type,
  mode,
  amount_cents,
  currency,
  label,
  payer,
  collection_method,
  effective_from,
  source_url,
  notes,
  metadata
)
SELECT package.id,
       package.country,
       package.visa_type,
       'government_fee',
       'display_only',
       CASE package.visa_type WHEN 'KE_ETA' THEN 3000 ELSE 0 END,
       'USD',
       CASE package.visa_type
         WHEN 'KE_ETA' THEN 'Kenya standard eTA government fee'
         ELSE 'Visit Japan Web government fee'
       END,
       'applicant',
       'official_portal',
       CURRENT_DATE,
       CASE package.visa_type
         WHEN 'KE_ETA' THEN 'https://etakenya.go.ke/faqs'
         ELSE 'https://www.customs.go.jp/english/news/20260528e.html'
       END,
       CASE package.visa_type
         WHEN 'KE_ETA' THEN 'Standard USD 30 baseline; expedited surcharge and availability must be confirmed against the official portal at submission.'
         ELSE 'Official Visit Japan Web is free. Do not create an official-fee payment intent; live third-party automation is gated on Digital Agency authorization.'
       END,
       jsonb_build_object(
         'official_free', package.visa_type = 'JP_VISIT_JAPAN_WEB',
         'package', package.visa_type,
         'automation_gate', CASE package.visa_type
           WHEN 'JP_VISIT_JAPAN_WEB' THEN 'requires_official_authorization'
           ELSE 'ready'
         END
       )
FROM public.visa_packages package
WHERE (LOWER(TRIM(package.country)), UPPER(TRIM(package.visa_type))) IN (
  ('japan', 'JP_VISIT_JAPAN_WEB'),
  ('kenya', 'KE_ETA')
);

-- Replace package-owned supporting-document metadata. These are upload
-- requirements, not answer fields or storage paths.
DELETE FROM public.document_requirements requirement
WHERE requirement.visa_package_id IN (
  SELECT package.id
  FROM public.visa_packages package
  WHERE (LOWER(TRIM(package.country)), UPPER(TRIM(package.visa_type))) IN (
    ('japan', 'JP_VISIT_JAPAN_WEB'),
    ('kenya', 'KE_ETA')
  )
);

WITH requirements(country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata) AS (
  VALUES
    ('japan', 'JP_VISIT_JAPAN_WEB', 'passport_copy', 'Passport biodata page', '护照资料页', 'Used for passport OCR and applicant-side verification. Visit Japan Web structured answers remain separate from this upload.', TRUE, 10, '{"document_type":"passport_copy","accept":[".pdf",".jpg",".jpeg",".png"],"official_portal_upload":false,"preparation_only":true}'::JSONB),
    ('japan', 'JP_VISIT_JAPAN_WEB', 'flight_itinerary', 'Japan arrival itinerary', '日本抵达行程', 'Used to verify arrival date, port, and flight number entered in Visit Japan Web.', TRUE, 20, '{"document_type":"flight_booking","accept":[".pdf",".jpg",".jpeg",".png"],"official_portal_upload":false,"answer_source":true}'::JSONB),
    ('japan', 'JP_VISIT_JAPAN_WEB', 'accommodation_booking', 'Japan accommodation booking', '日本住宿预订', 'Used to verify the accommodation name, address, postal code, and telephone entered in Visit Japan Web.', TRUE, 30, '{"document_type":"hotel_booking","accept":[".pdf",".jpg",".jpeg",".png"],"official_portal_upload":false,"answer_source":true}'::JSONB),
    ('kenya', 'KE_ETA', 'passport_copy', 'Passport biodata page', '护照资料页', 'Official eTA preparation material; passport must remain valid for at least six months after planned arrival and have at least one blank page.', TRUE, 10, '{"document_type":"passport_copy","accept":[".pdf",".jpg",".jpeg",".png"],"source":"kenya_eta_official","minimum_validity_months":6,"minimum_blank_pages":1}'::JSONB),
    ('kenya', 'KE_ETA', 'applicant_photo', 'Selfie or passport-type photograph', '自拍或护照照片', 'Official eTA upload material. Exact current image constraints must be checked against the live portal.', TRUE, 20, '{"document_type":"photo","accept":[".jpg",".jpeg",".png"],"source":"kenya_eta_official","live_constraints_required":true}'::JSONB),
    ('kenya', 'KE_ETA', 'flight_itinerary', 'Arrival and departure itinerary', '抵达和离境行程', 'Official eTA itinerary evidence for the planned Kenya trip.', TRUE, 30, '{"document_type":"flight_booking","accept":[".pdf",".jpg",".jpeg",".png"],"source":"kenya_eta_official"}'::JSONB),
    ('kenya', 'KE_ETA', 'accommodation_booking', 'Accommodation booking confirmation', '住宿预订确认', 'Official eTA accommodation evidence.', TRUE, 40, '{"document_type":"hotel_booking","accept":[".pdf",".jpg",".jpeg",".png"],"source":"kenya_eta_official"}'::JSONB),
    ('kenya', 'KE_ETA', 'purpose_specific_support', 'Purpose-specific supporting document', '访问目的相关支持材料', 'Conditional: only when the selected purpose requires additional evidence. Not collected in the first-phase tourism form.', FALSE, 50, '{"document_type":"purpose_specific_evidence","accept":[".pdf",".jpg",".jpeg",".png"],"applicability":"conditional","first_phase":"tourism_only","source":"kenya_eta_official"}'::JSONB)
), packages AS (
  SELECT id, LOWER(TRIM(country)) AS country, UPPER(TRIM(visa_type)) AS visa_type
  FROM public.visa_packages
  WHERE (LOWER(TRIM(country)), UPPER(TRIM(visa_type))) IN (
    ('japan', 'JP_VISIT_JAPAN_WEB'),
    ('kenya', 'KE_ETA')
  )
)
INSERT INTO public.document_requirements (
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
SELECT packages.id,
       requirements.country,
       requirements.visa_type,
       requirements.requirement_key,
       requirements.label_en,
       requirements.label_zh,
       requirements.description,
       requirements.required,
       requirements.sort_order,
       requirements.metadata
FROM requirements
JOIN packages
  ON packages.country = requirements.country
 AND packages.visa_type = requirements.visa_type;
