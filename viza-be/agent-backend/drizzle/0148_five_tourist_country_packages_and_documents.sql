-- Canonical tourist-product catalog and Document Center requirements for the
-- five official-source schemas added in the 2026-08-16 country-form audit.
-- Applicant uploads stay in application_documents; visa_form_fields contains
-- answers only.

WITH products(country, visa_type, name, description, metadata) AS (
  VALUES
    (
      'canada',
      'CA_TRV',
      'Canada Tourist Visitor Visa (TRV)',
      'Canada Temporary Resident Visa application for tourism. eTA is a separate product, and IRCC—not the applicant—decides whether an issued TRV is single or multiple entry.',
      '{"official_portal_url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/apply-visitor-visa.html","form_seed":"scripts/seed-ca-trv-form-fields.ts","scope":"tourist_trv_only","schema_status":"public_form_reconstruction","live_portal_qa_required":true}'::jsonb
    ),
    (
      'turkey',
      'TR_E_VISA',
      'Türkiye Tourist e-Visa',
      'Türkiye Ministry of Foreign Affairs e-Visa for eligible tourism and trade travel. Entry count, stay, validity, fee, and supporting-document rules are derived by the official portal.',
      '{"official_portal_url":"https://evisa.gov.tr/en/apply/","form_seed":"scripts/seed-tr-e-visa-form-fields.ts","scope":"official_evisa_tourism_trade","schema_status":"official_public_source_reconstruction","live_portal_qa_required":true}'::jsonb
    ),
    (
      'india',
      'IN_E_VISA',
      'India e-Tourist Visa',
      'India e-Tourist Visa for the official 30-day, one-year, and five-year tourist variants. Business, medical, conference, and other e-Visa categories are separate products.',
      '{"official_portal_url":"https://indianvisaonline.gov.in/evisa/","form_seed":"scripts/seed-in-e-visa-form-fields.ts","scope":"e_tourist_only","schema_status":"official_public_source_reconstruction","live_portal_qa_required":true}'::jsonb
    ),
    (
      'saudi_arabia',
      'SA_E_VISA',
      'Saudi Arabia Tourist eVisa',
      'VisitSaudi self-service Tourist eVisa only: normally one-year multiple entry with a maximum stay of 90 days. Other Saudi visit, work, study, Hajj, embassy, and visa-on-arrival routes are separate products.',
      '{"official_portal_url":"https://visa.visitsaudi.com/","form_seed":"scripts/seed-sa-e-visa-form-fields.ts","scope":"visitsaudi_tourist_evisa_only","schema_status":"public_and_client_script_reconstruction","live_portal_qa_required":true}'::jsonb
    ),
    (
      'united_arab_emirates',
      'AE_TOURIST_VISA',
      'UAE 5-Year Multiple-Entry Tourist Visa',
      'ICP self-sponsored five-year multiple-entry tourist visa, service 377-005-001-031, transaction 783. Sponsored 30-day and 60-day tourist routes are separate products.',
      '{"official_portal_url":"https://icp.gov.ae/en/services-details/?serviceid=68f5bc968c587a0011cb16cd","official_service_code":"377-005-001-031","official_transaction_id":783,"form_seed":"scripts/seed-ae-tourist-visa-form-fields.ts","scope":"icp_self_sponsored_five_year_only","schema_status":"public_template_reconstruction","live_portal_qa_required":true}'::jsonb
    )
)
INSERT INTO visa_packages (country, visa_type, name, description, metadata)
SELECT country, visa_type, name, description, metadata
FROM products
WHERE NOT EXISTS (
  SELECT 1
  FROM visa_packages existing
  WHERE lower(existing.country) = lower(products.country)
    AND upper(existing.visa_type) = upper(products.visa_type)
);

WITH products(country, visa_type, name, description, metadata) AS (
  VALUES
    ('canada', 'CA_TRV', 'Canada Tourist Visitor Visa (TRV)', 'Canada Temporary Resident Visa application for tourism. eTA is a separate product, and IRCC—not the applicant—decides whether an issued TRV is single or multiple entry.', '{"official_portal_url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/apply-visitor-visa.html","form_seed":"scripts/seed-ca-trv-form-fields.ts","scope":"tourist_trv_only","schema_status":"public_form_reconstruction","live_portal_qa_required":true}'::jsonb),
    ('turkey', 'TR_E_VISA', 'Türkiye Tourist e-Visa', 'Türkiye Ministry of Foreign Affairs e-Visa for eligible tourism and trade travel. Entry count, stay, validity, fee, and supporting-document rules are derived by the official portal.', '{"official_portal_url":"https://evisa.gov.tr/en/apply/","form_seed":"scripts/seed-tr-e-visa-form-fields.ts","scope":"official_evisa_tourism_trade","schema_status":"official_public_source_reconstruction","live_portal_qa_required":true}'::jsonb),
    ('india', 'IN_E_VISA', 'India e-Tourist Visa', 'India e-Tourist Visa for the official 30-day, one-year, and five-year tourist variants. Business, medical, conference, and other e-Visa categories are separate products.', '{"official_portal_url":"https://indianvisaonline.gov.in/evisa/","form_seed":"scripts/seed-in-e-visa-form-fields.ts","scope":"e_tourist_only","schema_status":"official_public_source_reconstruction","live_portal_qa_required":true}'::jsonb),
    ('saudi_arabia', 'SA_E_VISA', 'Saudi Arabia Tourist eVisa', 'VisitSaudi self-service Tourist eVisa only: normally one-year multiple entry with a maximum stay of 90 days. Other Saudi visit, work, study, Hajj, embassy, and visa-on-arrival routes are separate products.', '{"official_portal_url":"https://visa.visitsaudi.com/","form_seed":"scripts/seed-sa-e-visa-form-fields.ts","scope":"visitsaudi_tourist_evisa_only","schema_status":"public_and_client_script_reconstruction","live_portal_qa_required":true}'::jsonb),
    ('united_arab_emirates', 'AE_TOURIST_VISA', 'UAE 5-Year Multiple-Entry Tourist Visa', 'ICP self-sponsored five-year multiple-entry tourist visa, service 377-005-001-031, transaction 783. Sponsored 30-day and 60-day tourist routes are separate products.', '{"official_portal_url":"https://icp.gov.ae/en/services-details/?serviceid=68f5bc968c587a0011cb16cd","official_service_code":"377-005-001-031","official_transaction_id":783,"form_seed":"scripts/seed-ae-tourist-visa-form-fields.ts","scope":"icp_self_sponsored_five_year_only","schema_status":"public_template_reconstruction","live_portal_qa_required":true}'::jsonb)
)
UPDATE visa_packages package
SET name = products.name,
    description = products.description,
    metadata = COALESCE(package.metadata, '{}'::jsonb) || products.metadata,
    is_active = true,
    updated_at = now()
FROM products
WHERE lower(package.country) = lower(products.country)
  AND upper(package.visa_type) = upper(products.visa_type);

DELETE FROM document_requirements
WHERE (country, visa_type) IN (
  ('canada', 'CA_TRV'),
  ('turkey', 'TR_E_VISA'),
  ('india', 'IN_E_VISA'),
  ('saudi_arabia', 'SA_E_VISA'),
  ('united_arab_emirates', 'AE_TOURIST_VISA')
);

WITH requirements(country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata) AS (
  VALUES
    ('canada', 'CA_TRV', 'passport_copy', 'Passport or travel-document pages', '护照或旅行证件页面', 'Required IRCC identity evidence. Upload the bio page and every page containing visas, stamps, or markings. The personalized IRCC checklist remains authoritative.', true, 10, '{"document_type":"passport_copy","accept":[".pdf",".jpg",".jpeg",".png"],"source":"ircc_guide_5256"}'::jsonb),
    ('canada', 'CA_TRV', 'photo', 'Digital visa photograph', '电子签证照片', 'Recent digital photograph meeting the current IRCC temporary-resident specifications.', true, 20, '{"document_type":"photo","accept":[".jpg",".jpeg",".png"],"source":"ircc_personalized_checklist"}'::jsonb),
    ('canada', 'CA_TRV', 'proof_of_funds', 'Financial support evidence', '资金证明', 'Evidence that the applicant can support the visit. Exact documents and coverage are determined by the personalized IRCC checklist.', false, 30, '{"document_type":"proof_of_funds","accept":[".pdf",".jpg",".jpeg",".png"],"source":"ircc_guide_5256","applicability":"conditional"}'::jsonb),
    ('canada', 'CA_TRV', 'purpose_of_travel_evidence', 'Purpose-of-travel evidence', '旅行目的证明', 'Itinerary, accommodation, invitation, or other evidence requested by the personalized IRCC checklist.', false, 40, '{"document_type":"travel_itinerary","accept":[".pdf",".jpg",".jpeg",".png",".doc",".docx"],"source":"ircc_personalized_checklist","applicability":"conditional"}'::jsonb),
    ('canada', 'CA_TRV', 'family_information_form', 'Family Information form', '家庭信息表', 'IMM 5707 or IMM 5645, selected by the applicant package. VIZA can generate the currently resolved form from canonical answers.', false, 50, '{"document_type":"generated_form","accept":[".pdf"],"source":"ircc_country_package","applicability":"conditional","auto_generatable":true}'::jsonb),
    ('canada', 'CA_TRV', 'country_specific_evidence', 'Country-specific supporting evidence', '国家或地区特定证明材料', 'Additional evidence requested by the applicant country package or personalized checklist, including China-specific IMM 0104/checklist evidence when applicable.', false, 60, '{"document_type":"country_specific_evidence","accept":[".pdf",".jpg",".jpeg",".png"],"source":"ircc_country_package","applicability":"conditional"}'::jsonb),

    ('turkey', 'TR_E_VISA', 'passport_copy', 'Passport bio page for VIZA verification', '供 VIZA 核对的护照资料页', 'VIZA preparation copy used to verify the entered travel-document details. The official Türkiye e-Visa form itself does not request a file upload.', true, 10, '{"document_type":"passport_copy","accept":[".pdf",".jpg",".jpeg",".png"],"source":"viza_preparation_only","official_portal_upload":false}'::jsonb),

    ('india', 'IN_E_VISA', 'applicant_photo', 'Applicant photograph', '申请人照片', 'Official upload: JPEG, 10 KB to 1 MB, square, and at least 350 × 350 pixels.', true, 10, '{"document_type":"photo","accept":[".jpg",".jpeg"],"min_bytes":10240,"max_bytes":1048576,"min_width":350,"min_height":350,"aspect_ratio":"1:1","source":"india_evisa_official"}'::jsonb),
    ('india', 'IN_E_VISA', 'passport_bio_page', 'Passport bio page', '护照资料页', 'Official upload: PDF containing the passport page with personal particulars, 10 KB to 300 KB.', true, 20, '{"document_type":"passport_copy","accept":[".pdf"],"min_bytes":10240,"max_bytes":307200,"source":"india_evisa_official"}'::jsonb),
    ('india', 'IN_E_VISA', 'short_course_letter', 'Short-course letter', '短期课程证明信', 'Required only when the selected e-Tourist purpose is a short course of no more than six months.', false, 30, '{"document_type":"short_course_letter","accept":[".pdf"],"source":"india_evisa_official","applicability":"conditional","condition_field":"tourist_purpose","condition_values":["SHORT_COURSE"]}'::jsonb),
    ('india', 'IN_E_VISA', 'voluntary_work_letter', 'Voluntary-work letter', '志愿工作证明信', 'Required only when the selected e-Tourist purpose is unpaid voluntary work of no more than one month.', false, 40, '{"document_type":"voluntary_work_letter","accept":[".pdf"],"source":"india_evisa_official","applicability":"conditional","condition_field":"tourist_purpose","condition_values":["VOLUNTARY_WORK"]}'::jsonb),

    ('saudi_arabia', 'SA_E_VISA', 'passport_copy', 'Passport bio page', '护照资料页', 'Clear copy used for the VisitSaudi Tourist eVisa identity and passport details. Passport validity must extend at least six months beyond entry.', true, 10, '{"document_type":"passport_copy","accept":[".pdf",".jpg",".jpeg",".png"],"source":"visitsaudi"}'::jsonb),
    ('saudi_arabia', 'SA_E_VISA', 'personal_photo', 'Personal photograph', '个人证件照', 'Official VisitSaudi upload: 200 × 200 pixels, 5–100 KB, current within six months, white background, with the face occupying about 70–80% of the image.', true, 20, '{"document_type":"photo","accept":[".jpg",".jpeg",".png"],"min_bytes":5120,"max_bytes":102400,"width":200,"height":200,"source":"visitsaudi_photo_specifications"}'::jsonb),

    ('united_arab_emirates', 'AE_TOURIST_VISA', 'passport_copy', 'Passport copy', '护照复印件', 'Passport valid for at least six months, for ICP transaction 783.', true, 10, '{"document_type":"passport_copy","accept":[".pdf",".jpg",".jpeg",".png"],"source":"uae_icp_service_783"}'::jsonb),
    ('united_arab_emirates', 'AE_TOURIST_VISA', 'personal_photo', 'Recent personal photograph', '近期个人证件照', 'Recent photograph meeting the ICP attachment requirements.', true, 20, '{"document_type":"photo","accept":[".jpg",".jpeg",".png"],"source":"uae_icp_service_783"}'::jsonb),
    ('united_arab_emirates', 'AE_TOURIST_VISA', 'six_month_bank_statement', 'Six-month bank statement', '六个月银行对账单', 'Official evidence of a balance of at least USD 4,000 or equivalent during the six months before application.', true, 30, '{"document_type":"bank_statement","accept":[".pdf"],"statement_months":6,"minimum_balance_usd":4000,"source":"uae_icp_service_783"}'::jsonb),
    ('united_arab_emirates', 'AE_TOURIST_VISA', 'uae_health_insurance', 'UAE health insurance', '阿联酋医疗保险', 'Health-insurance coverage issued for the UAE and valid for 180 days.', true, 40, '{"document_type":"travel_insurance","accept":[".pdf"],"minimum_validity_days":180,"source":"uae_icp_service_783"}'::jsonb),
    ('united_arab_emirates', 'AE_TOURIST_VISA', 'return_or_onward_ticket', 'Return or onward ticket', '返程或续程机票', 'Confirmed return or onward travel evidence required by the ICP five-year tourist service.', true, 50, '{"document_type":"return_ticket","accept":[".pdf",".jpg",".jpeg",".png"],"source":"uae_icp_service_783"}'::jsonb),
    ('united_arab_emirates', 'AE_TOURIST_VISA', 'uae_accommodation_proof', 'UAE accommodation proof', '阿联酋住宿证明', 'Hotel booking, tenancy, or other proof of accommodation in the UAE.', true, 60, '{"document_type":"hotel_booking","accept":[".pdf",".jpg",".jpeg",".png"],"source":"uae_icp_service_783"}'::jsonb),
    ('united_arab_emirates', 'AE_TOURIST_VISA', 'national_identity_card', 'National identity card', '本国身份证件', 'Required by the ICP service card only for applicants from Afghanistan, Iran, or Iraq.', false, 70, '{"document_type":"national_identity_card","accept":[".pdf",".jpg",".jpeg",".png"],"source":"uae_icp_service_783","applicability":"conditional","condition_field":"current_nationality","condition_values":["Afghanistan","Iran","Iraq"]}'::jsonb)
), packages AS (
  SELECT id, lower(country) AS country, upper(visa_type) AS visa_type
  FROM visa_packages
  WHERE (lower(country), upper(visa_type)) IN (
    ('canada', 'CA_TRV'),
    ('turkey', 'TR_E_VISA'),
    ('india', 'IN_E_VISA'),
    ('saudi_arabia', 'SA_E_VISA'),
    ('united_arab_emirates', 'AE_TOURIST_VISA')
  )
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
  packages.id,
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
