-- Idempotent metadata-only sync for Taiwan Online Entry Permit form fields.
--
-- Scope:
--   * public.visa_form_fields rows with visa_type = 'TW_ENTRY_PERMIT' only.
--   * Updates field metadata used by the DB-driven long-form renderer.
--   * Inserts household_revoked if it is still missing.
--
-- Safety:
--   * No DELETE statements.
--   * Does not touch application answers, documents, queues, packages, users,
--     payments, runner state, OTP, CAPTCHA, cookies, or uploaded files.
--   * Existing field ids and created_at values are preserved by ON CONFLICT.
--
-- Execute only after an authorized production sync approval and after saving
-- the pre-flight query output documented in docs/taiwan-launch-worklogs/TW-C.md.

WITH target_fields (
  visa_type,
  field_name,
  label,
  field_type,
  required,
  step_number,
  step_name,
  display_order,
  placeholder,
  validation_rules,
  options,
  conditional_logic
) AS (
  VALUES
    ('TW_ENTRY_PERMIT', 'household_revoked', 'Current mainland household registration status', 'radio', true, 1, 'Photo & Basic Status', 5, NULL::text, '{"official_dom_name":"householdRevoked","official_values":{"no":"N","yes":"Y"},"note":"Confirmed live as a required official radio group: 目前戶口登記狀態.","label_en":"Current mainland household registration status","official_label_en":"Current mainland household registration status"}'::jsonb, '[{"value":"no","text":"Not revoked, or revoked but have not yet obtained a Hong Kong/Macau passport","label_zh":"未注销户口登记，或已注销户口登记但尚未取得香港、澳门护照","official_label":"未註銷戶口登記/已註銷戶口登記，但尚未取得香港、澳門護照","label_en":"Not revoked, or revoked but have not yet obtained a Hong Kong/Macau passport"},{"value":"yes","text":"Revoked","label_zh":"已注销户口登记","official_label":"已註銷戶口登記","label_en":"Revoked"}]'::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'eligibility_category', 'Eligibility category', 'radio', true, 1, 'Photo & Basic Status', 6, NULL::text, '{"label_en":"Eligibility category","official_label_en":"Eligibility category"}'::jsonb, '[{"value":"1","text":"Studying abroad or in Hong Kong/Macau","label_zh":"赴国外或香港、澳门留学生","label_en":"Studying abroad or in Hong Kong/Macau","official_label":"Studying abroad or in Hong Kong/Macau"},{"value":"2","text":"Obtained permanent residency abroad or in Hong Kong/Macau","label_zh":"旅居国外或香港、澳门取得当地永久居留权","label_en":"Obtained permanent residency abroad or in Hong Kong/Macau","official_label":"Obtained permanent residency abroad or in Hong Kong/Macau"},{"value":"3","text":"Resided abroad or in Hong Kong/Macau 1+ year with valid work proof","label_zh":"旅居国外或香港、澳门1年以上且领有工作证明","label_en":"Resided abroad or in Hong Kong/Macau 1+ year with valid work proof","official_label":"Resided abroad or in Hong Kong/Macau 1+ year with valid work proof"},{"value":"4","text":"Obtained dependent residency abroad or in Hong Kong/Macau with financial proof","label_zh":"旅居国外或香港、澳门取得当地依亲居留权且有财力证明","label_en":"Obtained dependent residency abroad or in Hong Kong/Macau with financial proof","official_label":"Obtained dependent residency abroad or in Hong Kong/Macau with financial proof"}]'::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'passport_number', 'Passport / HK visa identity document / Macau travel document / mainland travel document number', 'text', true, 2, 'Applicant Identity', 4, NULL::text, '{"label_en":"Passport / HK visa identity document / Macau travel document / mainland travel document number","official_label_en":"Passport / HK visa identity document / Macau travel document / mainland travel document number"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'passport_expiry_date', 'Passport / travel document validity expiry date (Gregorian calendar)', 'date', true, 2, 'Applicant Identity', 5, NULL::text, '{"note":"Must have 6+ months validity remaining at entry.","label_en":"Passport / travel document validity expiry date (Gregorian calendar)","official_label_en":"Passport / travel document validity expiry date (Gregorian calendar)"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'overseas_residency_id_number', 'Overseas Chinese residency identity number (e.g. permanent residence number, residence card number, or visa number)', 'text', true, 2, 'Applicant Identity', 7, NULL::text, '{"label_en":"Overseas Chinese residency identity number (e.g. permanent residence number, residence card number, or visa number)","official_label_en":"Overseas Chinese residency identity number (e.g. permanent residence number, residence card number, or visa number)"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'mainland_id_number', 'Mainland ID number', 'text', true, 2, 'Applicant Identity', 9, NULL::text, '{"note":"Required when shown; exempt only when mainland_id_number_not_applicable is checked.","label_en":"Mainland ID number","official_label_en":"Mainland ID number"}'::jsonb, NULL::jsonb, '{"showIf":"mainland_id_number_not_applicable === false"}'::jsonb),
    ('TW_ENTRY_PERMIT', 'birth_place_is_mainland', 'Place of birth (same as travel document held)', 'radio', true, 2, 'Applicant Identity', 10, NULL::text, '{"label_en":"Place of birth (same as travel document held)","official_label_en":"Place of birth (same as travel document held)"}'::jsonb, '[{"value":"mainland","text":"Mainland China","label_zh":"中国大陆","label_en":"Mainland China","official_label":"Mainland China"},{"value":"other","text":"Other","label_zh":"其他","label_en":"Other","official_label":"Other"}]'::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'occupation_experience', 'Experience', 'textarea', true, 2, 'Applicant Identity', 14, NULL::text, '{"note":"TW-A live DOM/visible text recheck only supports the official retirement prompt: if current occupation is retired, fill prior service unit and job title. Freelance/other/none are no longer treated as triggers without submit-validation evidence.","label_en":"Experience","official_label_en":"Experience"}'::jsonb, NULL::jsonb, '{"showIf":"current_occupation === 62"}'::jsonb),
    ('TW_ENTRY_PERMIT', 'company_name', 'Company name and full organization/unit name or school name', 'text', true, 2, 'Applicant Identity', 15, NULL::text, '{"note":"Confirmed live to carry a required asterisk: 公司名稱及單位全銜或學校名稱.","label_en":"Company name and full organization/unit name or school name","official_label_en":"Company name and full organization/unit name or school name"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'job_title', 'Job title', 'text', true, 2, 'Applicant Identity', 16, NULL::text, '{"note":"Confirmed live to carry a required asterisk: 職稱.","label_en":"Job title","official_label_en":"Job title"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'is_taiwanese_spouse', 'Are you the spouse of a Taiwanese person?', 'select', true, 2, 'Applicant Identity', 17, NULL::text, '{"note":"This permit cannot be used to register a marriage in Taiwan. Confirmed live to carry a required asterisk, unlike traveling_with_parents below.","label_en":"Are you the spouse of a Taiwanese person?","official_label_en":"Are you the spouse of a Taiwanese person?"}'::jsonb, '[{"value":"no","text":"No","label_zh":"否","label_en":"No","official_label":"No"},{"value":"yes","text":"Yes","label_zh":"是","label_en":"Yes","official_label":"Yes"}]'::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'overseas_address', 'Hong Kong, Macau, or overseas address', 'textarea', true, 2, 'Applicant Identity', 19, NULL::text, '{"label_en":"Hong Kong, Macau, or overseas address","official_label_en":"Hong Kong, Macau, or overseas address"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'tw_contact_city', 'City/County', 'select', true, 3, 'Taiwan Contact Address', 1, NULL::text, '{"label_en":"City/County","official_label_en":"City/County"}'::jsonb, '[{"value":"1","text":"臺北市","label_zh":"臺北市","official_label":"臺北市","label_en":"臺北市"},{"value":"2","text":"基隆市","label_zh":"基隆市","official_label":"基隆市","label_en":"基隆市"},{"value":"3","text":"新北市","label_zh":"新北市","official_label":"新北市","label_en":"新北市"},{"value":"4","text":"宜蘭縣","label_zh":"宜蘭縣","official_label":"宜蘭縣","label_en":"宜蘭縣"},{"value":"5","text":"新竹市","label_zh":"新竹市","official_label":"新竹市","label_en":"新竹市"},{"value":"6","text":"新竹縣","label_zh":"新竹縣","official_label":"新竹縣","label_en":"新竹縣"},{"value":"7","text":"桃園市","label_zh":"桃園市","official_label":"桃園市","label_en":"桃園市"},{"value":"8","text":"苗栗縣","label_zh":"苗栗縣","official_label":"苗栗縣","label_en":"苗栗縣"},{"value":"9","text":"臺中市","label_zh":"臺中市","official_label":"臺中市","label_en":"臺中市"},{"value":"10","text":"彰化縣","label_zh":"彰化縣","official_label":"彰化縣","label_en":"彰化縣"},{"value":"11","text":"南投縣","label_zh":"南投縣","official_label":"南投縣","label_en":"南投縣"},{"value":"12","text":"嘉義市","label_zh":"嘉義市","official_label":"嘉義市","label_en":"嘉義市"},{"value":"13","text":"嘉義縣","label_zh":"嘉義縣","official_label":"嘉義縣","label_en":"嘉義縣"},{"value":"14","text":"雲林縣","label_zh":"雲林縣","official_label":"雲林縣","label_en":"雲林縣"},{"value":"15","text":"臺南市","label_zh":"臺南市","official_label":"臺南市","label_en":"臺南市"},{"value":"16","text":"高雄市","label_zh":"高雄市","official_label":"高雄市","label_en":"高雄市"},{"value":"17","text":"澎湖縣","label_zh":"澎湖縣","official_label":"澎湖縣","label_en":"澎湖縣"},{"value":"18","text":"屏東縣","label_zh":"屏東縣","official_label":"屏東縣","label_en":"屏東縣"},{"value":"19","text":"臺東縣","label_zh":"臺東縣","official_label":"臺東縣","label_en":"臺東縣"},{"value":"20","text":"花蓮縣","label_zh":"花蓮縣","official_label":"花蓮縣","label_en":"花蓮縣"},{"value":"21","text":"金門縣","label_zh":"金門縣","official_label":"金門縣","label_en":"金門縣"},{"value":"22","text":"連江縣","label_zh":"連江縣","official_label":"連江縣","label_en":"連江縣"}]'::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'tw_contact_district', 'District/township', 'select', false, 3, 'Taiwan Contact Address', 2, NULL::text, '{"dependent_on":"tw_contact_city","dependent_options_key":"taiwan_districts_by_city","source":"taiwan_official_address_districts","note":"District/township options are constrained by the selected Taiwan city/county. Prior TW-A evidence confirms the city/county, road, and building fields as required; district remains optional until official submit-validation evidence says otherwise.","label_en":"District/township","official_label_en":"District/township"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'tw_contact_village', 'Village (村/里, optional)', 'text', false, 3, 'Taiwan Contact Address', 3, NULL::text, '{"label_en":"Village (村/里, optional)","official_label_en":"Village (村/里, optional)"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'tw_contact_road', 'Street or road section', 'text', true, 3, 'Taiwan Contact Address', 5, NULL::text, '{"label_en":"Street or road section","official_label_en":"Street or road section"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'tw_contact_building_number', 'House number / floor / room number (or hotel name if staying at a hotel)', 'text', true, 3, 'Taiwan Contact Address', 8, NULL::text, '{"label_en":"House number / floor / room number (or hotel name if staying at a hotel)","official_label_en":"House number / floor / room number (or hotel name if staying at a hotel)"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'tw_local_phone', 'Taiwan landline number', 'text', false, 3, 'Taiwan Contact Address', 9, NULL::text, '{"required_when":"tw_contact_mobile_not_applicable === true","note":"Official screenshot confirms landline is required only after the applicant checks no Taiwan contact mobile number.","label_en":"Taiwan landline number","official_label_en":"Taiwan landline number"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'other_passport_number', 'Other country''s passport/document number', 'text', true, 4, 'Other Nationality', 2, NULL::text, '{"label_en":"Other country''s passport/document number","official_label_en":"Other country''s passport/document number"}'::jsonb, NULL::jsonb, '{"showIf":"has_other_nationality_passport === yes"}'::jsonb),
    ('TW_ENTRY_PERMIT', 'other_passport_expiry_date', 'Other country''s passport/document validity expiry date', 'date', true, 4, 'Other Nationality', 3, NULL::text, '{"label_en":"Other country''s passport/document validity expiry date","official_label_en":"Other country''s passport/document validity expiry date"}'::jsonb, NULL::jsonb, '{"showIf":"has_other_nationality_passport === yes"}'::jsonb),
    ('TW_ENTRY_PERMIT', 'kin_father_status', 'Father (父) — Living/deceased/divorced', 'select', true, 5, 'Kinship Information', 1, NULL::text, '{"block_group":"kin_father","note":"TW-A live DOM recheck found father/mother deadMark controls with aria-required and an asterisk; other kinship fields remain optional.","label_en":"Father (父) — Living/deceased/divorced","official_label_en":"Father (父) — Living/deceased/divorced"}'::jsonb, '[{"value":"1","text":"Living","label_zh":"存","label_en":"Living","official_label":"Living"},{"value":"2","text":"Deceased","label_zh":"殁","label_en":"Deceased","official_label":"Deceased"},{"value":"3","text":"Divorced","label_zh":"离婚","label_en":"Divorced","official_label":"Divorced"}]'::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'kin_mother_status', 'Mother (母) — Living/deceased/divorced', 'select', true, 5, 'Kinship Information', 20, NULL::text, '{"block_group":"kin_mother","note":"TW-A live DOM recheck found father/mother deadMark controls with aria-required and an asterisk; other kinship fields remain optional.","label_en":"Mother (母) — Living/deceased/divorced","official_label_en":"Mother (母) — Living/deceased/divorced"}'::jsonb, '[{"value":"1","text":"Living","label_zh":"存","label_en":"Living","official_label":"Living"},{"value":"2","text":"Deceased","label_zh":"殁","label_en":"Deceased","official_label":"Deceased"},{"value":"3","text":"Divorced","label_zh":"离婚","label_en":"Divorced","official_label":"Divorced"}]'::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'past_mainland_political_military_role', 'Applicant previously held a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group', 'checkbox', false, 6, 'Declaration', 1, NULL::text, '{"label_en":"Applicant previously held a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group","official_label_en":"Applicant previously held a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'past_role_detail', 'Previously served at', 'text', true, 6, 'Declaration', 2, NULL::text, '{"label_en":"Previously served at","official_label_en":"Previously served at"}'::jsonb, NULL::jsonb, '{"showIf":"past_mainland_political_military_role === true"}'::jsonb),
    ('TW_ENTRY_PERMIT', 'current_mainland_political_military_role', 'Applicant currently holds a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group', 'checkbox', false, 6, 'Declaration', 3, NULL::text, '{"label_en":"Applicant currently holds a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group","official_label_en":"Applicant currently holds a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'current_role_detail', 'Currently serving at', 'text', true, 6, 'Declaration', 4, NULL::text, '{"label_en":"Currently serving at","official_label_en":"Currently serving at"}'::jsonb, NULL::jsonb, '{"showIf":"current_mainland_political_military_role === true"}'::jsonb),
    ('TW_ENTRY_PERMIT', 'never_held_mainland_political_military_role', 'Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership', 'checkbox', false, 6, 'Declaration', 5, NULL::text, '{"label_en":"Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership","official_label_en":"Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership"}'::jsonb, NULL::jsonb, NULL::jsonb),
    ('TW_ENTRY_PERMIT', 'accepted_terms', 'I have read and accept the following terms and conditions', 'checkbox', true, 6, 'Declaration', 6, NULL::text, '{"mustBeTrue":true,"label_en":"I have read and accept the following terms and conditions","official_label_en":"I have read and accept the following terms and conditions"}'::jsonb, NULL::jsonb, NULL::jsonb)
),
upserted AS (
  INSERT INTO public.visa_form_fields (
    visa_type,
    field_name,
    label,
    field_type,
    required,
    step_number,
    step_name,
    display_order,
    placeholder,
    validation_rules,
    options,
    conditional_logic
  )
  SELECT
    visa_type,
    field_name,
    label,
    field_type,
    required,
    step_number,
    step_name,
    display_order,
    placeholder,
    validation_rules,
    options,
    conditional_logic
  FROM target_fields
  WHERE visa_type = 'TW_ENTRY_PERMIT'
  ON CONFLICT (visa_type, field_name) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    required = EXCLUDED.required,
    step_number = EXCLUDED.step_number,
    step_name = EXCLUDED.step_name,
    display_order = EXCLUDED.display_order,
    placeholder = EXCLUDED.placeholder,
    validation_rules = EXCLUDED.validation_rules,
    options = EXCLUDED.options,
    conditional_logic = EXCLUDED.conditional_logic,
    updated_at = now()
  RETURNING field_name
)
SELECT count(*) AS tw_entry_permit_form_fields_metadata_rows_upserted
FROM upserted;
