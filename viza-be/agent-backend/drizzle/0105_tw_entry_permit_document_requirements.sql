-- Document requirements for the Taiwan Online Entry Permit package.
--
-- Confirmed live against the real coa.immigration.gov.tw "應檢附文件"
-- section (see docs/tw-entry-permit-auto-submit-plan.md): the required
-- supporting-document set is NOT the generic FALLBACK_REQUIREMENTS checklist
-- (passport_copy/photo/travel_itinerary/bank_statement/flight_booking/
-- hotel_booking) — without rows here, Taiwan applicants would otherwise see
-- that unrelated generic checklist in the Documents center
-- (app/client/documents/document-center-client.tsx), since
-- loadDocumentRequirements() only falls back to it when no
-- document_requirements rows exist for the package/country+visa_type.
--
-- `required` is a flat boolean on this table (no conditional-logic column),
-- so the three genuinely conditional documents (hk_macau_id_scan,
-- other_nationality_passport_scan, mainland_id_card_scan) are marked
-- required=false here with the condition spelled out in the description;
-- actual conditional enforcement happens in src/tw/normalize.ts (which
-- throws if the condition is met and the document is missing).
--
-- requirement_key values match the seed contract's field_names in
-- scripts/seed-tw-entry-permit-form-fields.ts 1:1 so the runtime resolver
-- (viza-be/submission-service/src/queue/halt-runners.ts's runTwHalt) can
-- look up each one directly in application_documents by requirement_key.

INSERT INTO document_requirements (visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order)
SELECT
  vp.id,
  'taiwan',
  'TW_ENTRY_PERMIT',
  r.requirement_key,
  r.label_en,
  r.label_zh,
  r.description,
  r.required,
  r.sort_order
FROM visa_packages vp
CROSS JOIN (VALUES
  ('photo', 'Passport-size photo', '照片上傳', 'Recent 2-inch color photo, white background. Do not upload a photo taken with a phone camera.', true, 10),
  ('mainland_travel_document', 'Mainland travel document / HK-Macau non-permanent-resident travel document', '大陸地區所發尚餘6個月以上效期之旅行證件或香港、澳門政府核發之非永久性居民旅行證件', 'Mainland-issued travel document with 6+ months validity remaining, or a Hong Kong/Macau government-issued non-permanent-resident travel document. Required for every eligibility category.', true, 20),
  ('eligibility_supporting_document', 'Supporting document for your eligibility category', '申請資格對應之證明文件', 'Which exact document is required depends on your eligibility category: student visa + enrollment certificate (studying abroad/HK/Macau), permanent residency proof (permanent residency), work visa + employment certificate (1+ year resided with work proof), or dependent residency + financial proof (dependent residency). See docs/tw-entry-permit-auto-submit-plan.md for the verbatim text per category.', true, 30),
  ('hk_macau_id_scan', 'Hong Kong/Macau resident ID (front + back) + valid visa', '香港或澳門居民身分證(正、反面)及有效香港或澳門簽證', 'Required only if you are applying via the Hong Kong or Macau office (not required if under 11 years old).', false, 40),
  ('other_nationality_passport_scan', 'Other-nationality passport/document scan', '具有他國國籍護(證)照文件', 'Required only if you hold a passport of another nationality (answered "yes" to that question earlier in the form).', false, 50),
  ('mainland_id_card_scan', 'Mainland ID card (front + back)', '大陸身分證（正、反面）', 'Required only if you have a mainland ID number (i.e. did not check "no mainland ID number" earlier in the form).', false, 60),
  ('other_supporting_document', 'Other supporting document', '其他相關證明文件', 'Optional unless applicable to your situation — e.g. applicants residing in Japan should upload a juminhyo (住民票) issued within the last 3 months.', false, 70)
) AS r(requirement_key, label_en, label_zh, description, required, sort_order)
WHERE vp.country = 'taiwan' AND vp.visa_type = 'TW_ENTRY_PERMIT'
ON CONFLICT (visa_package_id, requirement_key) WHERE visa_package_id IS NOT NULL DO NOTHING;
