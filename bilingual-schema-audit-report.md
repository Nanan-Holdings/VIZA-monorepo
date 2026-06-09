# Bilingual Schema Clarity Audit

Generated: 2026-06-09T01:20:32.104Z

## Summary

- Schema files scanned: 29
- Countries/forms scanned: 29
- Fields audited: 2665
- Dropdown/radio/checkbox options audited: 2759
- Blocking issues: 0
- Warnings: 0
- Info findings: 294

## Schema Files

| source | country | schema | fields |
| --- | --- | --- | ---: |
| viza-be/agent-backend/scripts/seed-ae-tourist-visa-form-fields.ts | united_arab_emirates | AE_TOURIST_VISA | 76 |
| viza-be/agent-backend/scripts/seed-au-visitor-600-form-fields.ts | australia | AU_VISITOR_600 | 220 |
| viza-be/agent-backend/scripts/seed-ca-trv-form-fields.ts | canada | CA_TRV | 77 |
| viza-be/agent-backend/scripts/seed-ds160-form-fields.ts | us | DS160 | 334 |
| viza-be/agent-backend/scripts/seed-eg-e-visa-form-fields.ts | egypt | EG_E_VISA | 74 |
| viza-be/agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts | schengen | EU_SCHENGEN_C_SHORT_STAY | 174 |
| viza-be/agent-backend/scripts/seed-hk-visit-visa-form-fields.ts | hong_kong | HK_VISIT_VISA | 77 |
| viza-be/agent-backend/scripts/seed-id-c1-tourist-form-fields.ts | indonesia | ID_C1_TOURIST | 83 |
| viza-be/agent-backend/scripts/seed-in-e-visa-form-fields.ts | india | IN_E_VISA | 95 |
| viza-be/agent-backend/scripts/seed-jp-tourist-form-fields.ts | japan | JP_TOURIST | 76 |
| viza-be/agent-backend/scripts/seed-kh-e-visa-form-fields.ts | cambodia | KH_TOURIST_E_VISA | 64 |
| viza-be/agent-backend/scripts/seed-kr-c39-short-term-visit-form-fields.ts | south_korea | KR_C39_SHORT_TERM_VISIT | 101 |
| viza-be/agent-backend/scripts/seed-la-e-visa-form-fields.ts | laos | LA_TOURIST_E_VISA | 62 |
| viza-be/agent-backend/scripts/seed-lk-eta-form-fields.ts | sri_lanka | LK_ETA | 62 |
| viza-be/agent-backend/scripts/seed-mo-visit-visa-form-fields.ts | macau | MO_VISIT_VISA | 73 |
| viza-be/agent-backend/scripts/seed-mv-imuga-form-fields.ts | maldives | MV_IMUGA | 40 |
| viza-be/agent-backend/scripts/seed-my-tourist-e-visa-form-fields.ts | malaysia | MY_TOURIST_E_VISA | 76 |
| viza-be/agent-backend/scripts/seed-nz-visitor-visa-form-fields.ts | new_zealand | NZ_VISITOR_VISA | 76 |
| viza-be/agent-backend/scripts/seed-ph-temporary-visitor-visa-form-fields.ts | philippines | PH_TEMPORARY_VISITOR_VISA | 70 |
| viza-be/agent-backend/scripts/seed-ru-e-visa-form-fields.ts | russia | RU_E_VISA | 69 |
| viza-be/agent-backend/scripts/seed-sg-visitor-visa-form-fields.ts | singapore | SG_VISITOR_VISA | 84 |
| viza-be/agent-backend/scripts/seed-th-tourist-e-visa-form-fields.ts | thailand | TH_TOURIST_E_VISA | 75 |
| viza-be/agent-backend/scripts/seed-tr-e-visa-form-fields.ts | turkey | TR_E_VISA | 68 |
| viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts | uk | UK_STANDARD_VISITOR | 258 |
| viza-be/agent-backend/scripts/seed-vn-e-visa-form-fields.ts | vietnam | VN_E_VISA | 60 |
| viza-be/agent-backend/scripts/seed-za-visitor-visa-form-fields.ts | south_africa | ZA_VISITOR_VISA | 72 |
| knowledge-base/scraped-form-fields.json | indonesia | B211A | 31 |
| viza-fe/internal-website/lib/rag-visitor-intake-form.ts | future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | 21 |
| viza-fe/internal-website/components/application-steps/frequent-traveler-profile-fields.tsx | universal_profile | UNIVERSAL_PROFILE | 17 |

## Issues

| country | schema | section | field_id | field_type | current_label_zh | current_label_en | issue_type | severity | suggested_label_zh | suggested_helper_zh | suggested_label_en | pass_fail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | name_in_arabic | text | Name in Arabic (if applicable) | Name in Arabic (if applicable) | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Name in Arabic (if applicable) | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | religion | select | Religion | Religion | legacy_runtime_label_fixed_by_contract | info | 请填写：Religion |  | Religion | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| united_arab_emirates | AE_TOURIST_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | visited_uae_before | radio | Have you ever visited the UAE before? | Have you ever visited the UAE before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问阿联酋？ |  | Have you ever visited the UAE before? | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the United Arab Emirates. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the United Arab Emirates. | pass |
| australia | AU_VISITOR_600 | ImmiAccount | au_immi_totp_secret | text | ImmiAccount authenticator secret (base32) | ImmiAccount authenticator secret (base32) | legacy_runtime_label_fixed_by_contract | info | 请填写：Au Immi Totp Secret |  | ImmiAccount authenticator secret (base32) | pass |
| australia | AU_VISITOR_600 | Application Context | stream | radio | Select the stream the applicant is applying for | Select the stream the applicant is applying for | legacy_runtime_label_fixed_by_contract | info | 请填写：Stream |  | Select the stream the applicant is applying for | pass |
| australia | AU_VISITOR_600 | Application Context | applying_outside_australia | radio | Is the applicant currently outside Australia? | Is the applicant currently outside Australia? | legacy_runtime_label_fixed_by_contract | info | 请填写：Applying Outside Australia |  | Is the applicant currently outside Australia? | pass |
| australia | AU_VISITOR_600 | Application Context | applying_all_outside_australia | radio | Are all the applicants currently outside Australia? | Are all the applicants currently outside Australia? | legacy_runtime_label_fixed_by_contract | info | 请填写：Applying All Outside Australia |  | Are all the applicants currently outside Australia? | pass |
| australia | AU_VISITOR_600 | Application Context | significant_dates_in_australia | textarea | 详情 | Give details of any significant dates on which the applicant needs to be in Australia | legacy_runtime_label_fixed_by_contract | info | 请填写：Significant Dates In Australia |  | Give details of any significant dates on which the applicant needs to be in Australia | pass |
| australia | AU_VISITOR_600 | Application Context | specialised_non_ongoing_work | radio | Will the applicant undertake highly specialised non-ongoing work? | Will the applicant undertake highly specialised non-ongoing work? | legacy_runtime_label_fixed_by_contract | info | 工作 |  | Will the applicant undertake highly specialised non-ongoing work? | pass |
| australia | AU_VISITOR_600 | Application Context | entertainer_or_supporting_entertainer | radio | Will the applicant be performing as an entertainer in Australia or supporting an entertainer or group of entertainers performing in Australia? | Will the applicant be performing as an entertainer in Australia or supporting an entertainer or group of entertainers performing in Australia? | legacy_runtime_label_fixed_by_contract | info | 请填写：Entertainer Or Supporting Entertainer | 请完整阅读并确认该官方题目含义：请填写：Entertainer Or Supporting Entertainer | Will the applicant be performing as an entertainer in Australia or supporting an entertainer or group of entertainers performing in Australia? | pass |
| australia | AU_VISITOR_600 | Application Context | production_director_or_participant | radio | 其他 | Will the applicant be directing, producing or taking any other part in a production that will be shown in Australia (including theatre, film, television, radio, concert or recording)? | legacy_runtime_label_fixed_by_contract | info | 请填写：Production Director Or Participant | 请完整阅读并确认该官方题目含义：请填写：Production Director Or Participant | Will the applicant be directing, producing or taking any other part in a production that will be shown in Australia (including theatre, film, television, radio, concert or recording)? | pass |
| australia | AU_VISITOR_600 | Personal Details | other_name_full | text | 其他 | Other name | legacy_runtime_label_fixed_by_contract | info | 其他名称完整 |  | Other name | pass |
| australia | AU_VISITOR_600 | Personal Details | other_name_type | select | 其他 | Type of other name | legacy_runtime_label_fixed_by_contract | info | 其他名称类型 |  | Type of other name | pass |
| australia | AU_VISITOR_600 | National Identity Document | has_chinese_household_registration | radio | Do you hold a People's Republic of China household registration (hukou)? | Do you hold a People's Republic of China household registration (hukou)? | legacy_runtime_label_fixed_by_contract | info | 请填写：Has Chinese Household Registration |  | Do you hold a People's Republic of China household registration (hukou)? | pass |
| australia | AU_VISITOR_600 | Family Composition | has_children | radio | Do you have any children (biological, adopted or step-children of any age)? | Do you have any children (biological, adopted or step-children of any age)? | legacy_runtime_label_fixed_by_contract | info | 是否儿童？ |  | Do you have any children (biological, adopted or step-children of any age)? | pass |
| australia | AU_VISITOR_600 | Family Composition | child_full_name | text | Child full name | Child full name | legacy_runtime_label_fixed_by_contract | info | 儿童完整名称 |  | Child full name | pass |
| australia | AU_VISITOR_600 | Family Composition | child_sex | select | Child sex | Child sex | legacy_runtime_label_fixed_by_contract | info | 儿童性别 |  | Child sex | pass |
| australia | AU_VISITOR_600 | Family Composition | father_full_name | text | Father full name | Father full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father full name | pass |
| australia | AU_VISITOR_600 | Family Composition | mother_full_name | text | Mother full name | Mother full name | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother full name | pass |
| australia | AU_VISITOR_600 | Family Composition | has_other_relatives_in_australia | radio | 其他 | Do you have any relatives currently in Australia (other than partner / children listed above)? | legacy_runtime_label_fixed_by_contract | info | 是否其他亲属？ |  | Do you have any relatives currently in Australia (other than partner / children listed above)? | pass |
| australia | AU_VISITOR_600 | Family Composition | relative_in_au_full_name | text | Relative full name | Relative full name | legacy_runtime_label_fixed_by_contract | info | 亲属完整名称 |  | Relative full name | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | has_visited_australia_before | radio | Have you ever travelled to Australia? | Have you ever travelled to Australia? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问？ |  | Have you ever travelled to Australia? | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | overstay_details | textarea | 详情 | Details of overstay or visa breach | legacy_runtime_label_fixed_by_contract | info | 具体情况 |  | Details of overstay or visa breach | pass |
| australia | AU_VISITOR_600 | Visit Details | accompanied_by_other_applicants | radio | 其他 | Are you applying as part of a family group with other people on this application? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Are you applying as part of a family group with other people on this application? | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_code | text | ADS group tour code | ADS group tour code | legacy_runtime_label_fixed_by_contract | info | 请填写：Ads Tour Code |  | ADS group tour code | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_leader_name | text | Tour leader / guide name | Tour leader / guide name | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Tour leader / guide name | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | frequent_residing_in_china | radio | Will you collect biometrics in mainland China? (relevant where in-country biometrics rules differ) | Will you collect biometrics in mainland China? (relevant where in-country biometrics rules differ) | legacy_runtime_label_fixed_by_contract | info | 请填写：Frequent Residing In China |  | Will you collect biometrics in mainland China? (relevant where in-country biometrics rules differ) | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | funds_currency | select | Currency | Currency | legacy_runtime_label_fixed_by_contract | info | 请填写：Funds Currency |  | Currency | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | has_tuberculosis_history | radio | Have you ever had, or been treated for, tuberculosis (TB)? | Have you ever had, or been treated for, tuberculosis (TB)? | legacy_runtime_label_fixed_by_contract | info | 是否记录？ |  | Have you ever had, or been treated for, tuberculosis (TB)? | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | is_pregnant | radio | Are you pregnant? | Are you pregnant? | legacy_runtime_label_fixed_by_contract | info | 请填写：Is Pregnant |  | Are you pregnant? | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | health_insurance_provider | text | Health insurance provider | Health insurance provider | legacy_runtime_label_fixed_by_contract | info | 保险 |  | Health insurance provider | pass |
| australia | AU_VISITOR_600 | Character Declarations | criminal_conviction_details | textarea | 详情 | Details of charges / convictions (offence, country, date, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Details of charges / convictions (offence, country, date, sentence) | pass |
| australia | AU_VISITOR_600 | Character Declarations | has_been_subject_to_court_order | radio | Have you ever been the subject of an arrest warrant, restraining order or court order? | Have you ever been the subject of an arrest warrant, restraining order or court order? | legacy_runtime_label_fixed_by_contract | info | 请填写：Has Been Subject To Court Order | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Have you ever been the subject of an arrest warrant, restraining order or court order? | pass |
| australia | AU_VISITOR_600 | Character Declarations | court_order_details | textarea | 详情 | Details of court order or restraining order | legacy_runtime_label_fixed_by_contract | info | 具体情况 |  | Details of court order or restraining order | pass |
| australia | AU_VISITOR_600 | Character Declarations | has_been_involved_in_war_crimes | radio | Have you ever been involved in war crimes, crimes against humanity, or human rights abuses? | Have you ever been involved in war crimes, crimes against humanity, or human rights abuses? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪、逮捕或定罪记录？ |  | Have you ever been involved in war crimes, crimes against humanity, or human rights abuses? | pass |
| australia | AU_VISITOR_600 | Character Declarations | war_crimes_details | textarea | 详情 | Details | legacy_runtime_label_fixed_by_contract | info | 请提供相关具体情况 |  | Details | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_understands_consequences | checkbox | 声明 | I understand that providing false or misleading information is a serious offence and may result in visa refusal, cancellation, or removal from Australia. | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | I understand that providing false or misleading information is a serious offence and may result in visa refusal, cancellation, or removal from Australia. | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_consent_to_share_data | checkbox | 声明 | I consent to the Department of Home Affairs sharing my personal information with other Australian government agencies and overseas authorities for the purposes of assessing this application. | legacy_runtime_label_fixed_by_contract | info | 声明确认 | 请完整阅读并确认该官方题目含义：声明确认 | I consent to the Department of Home Affairs sharing my personal information with other Australian government agencies and overseas authorities for the purposes of assessing this application. | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_consent_health_examinations | checkbox | 声明 | I consent to undergo any health examinations the Department may require. | legacy_runtime_label_fixed_by_contract | info | 声明确认 | 请完整阅读并确认该官方题目含义：声明确认 | I consent to undergo any health examinations the Department may require. | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_consent_biometrics | checkbox | 声明 | I consent to provide biometric data (photograph and fingerprints) if requested. | legacy_runtime_label_fixed_by_contract | info | 声明确认 | 请完整阅读并确认该官方题目含义：声明确认 | I consent to provide biometric data (photograph and fingerprints) if requested. | pass |
| australia | AU_VISITOR_600 | Declaration | signature_full_name | text | Full name (typed signature) | Full name (typed signature) | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Full name (typed signature) | pass |
| canada | CA_TRV | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| canada | CA_TRV | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| canada | CA_TRV | Passport | has_other_passports | radio | 其他 | Have you ever held any other passport (current or expired)? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Have you ever held any other passport (current or expired)? | pass |
| canada | CA_TRV | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| canada | CA_TRV | Travel & Background | visited_canada_before | radio | Have you ever visited Canada before? | Have you ever visited Canada before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问加拿大？ |  | Have you ever visited Canada before? | pass |
| canada | CA_TRV | Health & Character | has_tb_history | radio | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | legacy_runtime_label_fixed_by_contract | info | 是否记录？ |  | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | pass |
| canada | CA_TRV | Health & Character | tb_history_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请提供本题要求的具体情况 |  | Provide details | pass |
| canada | CA_TRV | Health & Character | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| canada | CA_TRV | Health & Character | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| canada | CA_TRV | Health & Character | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Canada. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Canada. | pass |
| us | DS160 | Previous U.S. Travel | visa_lost_or_stolen_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Previous U.S. Travel | visa_cancelled_or_revoked_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Explain | pass |
| us | DS160 | Previous U.S. Travel | refusal_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Explain | pass |
| us | DS160 | Previous U.S. Travel | immigrant_petition_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Passport Information | lost_passport_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Work/Education/Training: Present | not_employed_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Work/Education/Training: Additional | specialized_skills_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Work/Education/Training: Additional | paramilitary_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Work/Education/Training: Additional | has_countries_visited | radio | Have you traveled to any countries within the last five years? | Have you traveled to any countries within the last five years? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问？ |  | Have you traveled to any countries within the last five years? | pass |
| us | DS160 | Security and Background: Part 1 | has_communicable_disease_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 1 | has_physical_mental_disorder_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 1 | is_drug_abuser_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 2 | has_arrest_conviction_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Explain | pass |
| us | DS160 | Security and Background: Part 2 | has_violated_controlled_substance_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。 | Explain | pass |
| us | DS160 | Security and Background: Part 2 | has_prostitution_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 2 | has_money_laundering_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 2 | has_human_trafficking_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 2 | has_aided_human_trafficking_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 2 | has_trafficking_beneficiary_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 3 | intend_illegal_activity_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 3 | intend_terrorist_activity_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_provided_terrorist_support_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| us | DS160 | Security and Background: Part 3 | is_terrorist_member_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| us | DS160 | Security and Background: Part 3 | is_terrorist_family_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_genocide_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_torture_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_extrajudicial_killings_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_child_soldier_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_religious_freedom_violation_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。 | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_population_control_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 3 | has_coercive_transplant_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 4 | has_immigration_fraud_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 4 | has_removal_order_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Explain | pass |
| us | DS160 | Security and Background: Part 5 | has_withheld_child_custody_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 5 | has_voted_illegally_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| us | DS160 | Security and Background: Part 5 | has_renounced_citizenship_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| egypt | EG_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| egypt | EG_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| egypt | EG_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| egypt | EG_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| egypt | EG_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| egypt | EG_E_VISA | Travel History | visited_egypt_before | radio | Have you ever visited Egypt before? | Have you ever visited Egypt before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问埃及？ |  | Have you ever visited Egypt before? | pass |
| egypt | EG_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| egypt | EG_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| egypt | EG_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Arab Republic of Egypt. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Arab Republic of Egypt. | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | name_in_chinese | text | Name in Chinese characters (if applicable) | Name in Chinese characters (if applicable) | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Name in Chinese characters (if applicable) | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| hong_kong | HK_VISIT_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| hong_kong | HK_VISIT_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| hong_kong | HK_VISIT_VISA | Travel History | visited_hong_kong_before | radio | Have you ever visited Hong Kong before? | Have you ever visited Hong Kong before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问香港？ |  | Have you ever visited Hong Kong before? | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Hong Kong Special Administrative Region of the People's Republic of China. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Hong Kong Special Administrative Region of the People's Republic of China. | pass |
| indonesia | ID_C1_TOURIST | Personal Information | mother_full_name | text | Mother's full name | Mother's full name | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name | pass |
| indonesia | ID_C1_TOURIST | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| indonesia | ID_C1_TOURIST | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | pass |
| indonesia | ID_C1_TOURIST | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| indonesia | ID_C1_TOURIST | Trip Details | carrier_name | text | Name of airline or carrier | Name of airline or carrier | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Name of airline or carrier | pass |
| indonesia | ID_C1_TOURIST | Travel History | visited_indonesia_before | radio | Have you ever stayed in Indonesia before? | Have you ever stayed in Indonesia before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问？ |  | Have you ever stayed in Indonesia before? | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | overstay_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请提供本题要求的具体情况 |  | Provide details | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | has_drug_or_trafficking_history | radio | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | legacy_runtime_label_fixed_by_contract | info | 是否记录？ |  | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa, denial of entry, or deportation from Indonesia. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa, denial of entry, or deportation from Indonesia. | pass |
| india | IN_E_VISA | Personal Information | religion | select | Religion | Religion | legacy_runtime_label_fixed_by_contract | info | 请填写：Religion |  | Religion | pass |
| india | IN_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| india | IN_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| india | IN_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| india | IN_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport (incl. Pakistan / Bangladesh)? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport (incl. Pakistan / Bangladesh)? | pass |
| india | IN_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| india | IN_E_VISA | Travel History | visited_india_before | radio | Have you ever visited India before? | Have you ever visited India before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问印度？ |  | Have you ever visited India before? | pass |
| india | IN_E_VISA | Travel History | countries_visited_last_10_years | textarea | Countries visited in the last 10 years | Countries visited in the last 10 years | legacy_runtime_label_fixed_by_contract | info | 曾访问 |  | Countries visited in the last 10 years | pass |
| india | IN_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| india | IN_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| india | IN_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of India. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of India. | pass |
| japan | JP_TOURIST | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| japan | JP_TOURIST | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | pass |
| japan | JP_TOURIST | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| japan | JP_TOURIST | Trip Details | carrier_name | text | Name of ship or airline | Name of ship or airline | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Name of ship or airline | pass |
| japan | JP_TOURIST | Travel History | visited_japan_before | radio | Have you ever stayed in Japan before? | Have you ever stayed in Japan before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问？ |  | Have you ever stayed in Japan before? | pass |
| japan | JP_TOURIST | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| japan | JP_TOURIST | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| japan | JP_TOURIST | Character & Declaration | overstay_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请提供本题要求的具体情况 |  | Provide details | pass |
| japan | JP_TOURIST | Character & Declaration | has_drug_or_trafficking_history | radio | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | legacy_runtime_label_fixed_by_contract | info | 是否记录？ |  | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | pass |
| japan | JP_TOURIST | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| cambodia | KH_TOURIST_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | visited_cambodia_before | radio | Have you ever visited Cambodia before? | Have you ever visited Cambodia before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问柬埔寨？ |  | Have you ever visited Cambodia before? | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Cambodia. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Cambodia. | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | telephone | text | Telephone (landline) | Telephone (landline) | legacy_runtime_label_fixed_by_contract | info | 电话 |  | Telephone (landline) | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | has_children | radio | Do you have any children? | Do you have any children? | legacy_runtime_label_fixed_by_contract | info | 是否儿童？ |  | Do you have any children? | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education | radio | Highest education completed | Highest education completed | legacy_runtime_label_fixed_by_contract | info | 教育 |  | Highest education completed | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education_other | text | 其他 | Highest education — Other (please specify) | legacy_runtime_label_fixed_by_contract | info | 教育其他 |  | Highest education — Other (please specify) | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelled_to_korea_5y | radio | Have you travelled to Korea in the last 5 years? | Have you travelled to Korea in the last 5 years? | legacy_runtime_label_fixed_by_contract | info | 请填写：Travelled To Korea 5y |  | Have you travelled to Korea in the last 5 years? | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | assistant_full_name | text | Assistant — full name | Assistant — full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Assistant — full name | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | assistant_telephone | text | Assistant — telephone | Assistant — telephone | legacy_runtime_label_fixed_by_contract | info | 电话 |  | Assistant — telephone | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | declaration_consent | checkbox | 声明 | I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea. | legacy_runtime_label_fixed_by_contract | info | 声明确认 | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea. | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| laos | LA_TOURIST_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| laos | LA_TOURIST_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| laos | LA_TOURIST_E_VISA | Travel History | visited_laos_before | radio | Have you ever visited Laos before? | Have you ever visited Laos before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问老挝？ |  | Have you ever visited Laos before? | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Lao People's Democratic Republic. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Lao People's Democratic Republic. | pass |
| sri_lanka | LK_ETA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| sri_lanka | LK_ETA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| sri_lanka | LK_ETA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| sri_lanka | LK_ETA | Travel History | visited_sri_lanka_before | radio | Have you ever visited Sri Lanka before? | Have you ever visited Sri Lanka before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问斯里兰卡？ |  | Have you ever visited Sri Lanka before? | pass |
| sri_lanka | LK_ETA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| sri_lanka | LK_ETA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| sri_lanka | LK_ETA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Democratic Socialist Republic of Sri Lanka. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Democratic Socialist Republic of Sri Lanka. | pass |
| macau | MO_VISIT_VISA | Personal Information | name_in_chinese | text | Name in Chinese characters (if applicable) | Name in Chinese characters (if applicable) | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Name in Chinese characters (if applicable) | pass |
| macau | MO_VISIT_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| macau | MO_VISIT_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| macau | MO_VISIT_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| macau | MO_VISIT_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| macau | MO_VISIT_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| macau | MO_VISIT_VISA | Travel History | visited_macau_before | radio | Have you ever visited Macau before? | Have you ever visited Macau before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问澳门？ |  | Have you ever visited Macau before? | pass |
| macau | MO_VISIT_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| macau | MO_VISIT_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| macau | MO_VISIT_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Macao Special Administrative Region of the People's Republic of China. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Macao Special Administrative Region of the People's Republic of China. | pass |
| maldives | MV_IMUGA | Trip Details | carrier_name | text | Name of airline or carrier | Name of airline or carrier | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Name of airline or carrier | pass |
| maldives | MV_IMUGA | Health Declaration | has_health_symptoms | radio | Do you currently have any of the following symptoms: fever, cough, breathing difficulty, diarrhoea, vomiting, rash, or jaundice? | Do you currently have any of the following symptoms: fever, cough, breathing difficulty, diarrhoea, vomiting, rash, or jaundice? | legacy_runtime_label_fixed_by_contract | info | 请填写：Has Health Symptoms |  | Do you currently have any of the following symptoms: fever, cough, breathing difficulty, diarrhoea, vomiting, rash, or jaundice? | pass |
| maldives | MV_IMUGA | Health Declaration | health_symptoms_details | textarea | 详情 | Provide details of symptoms (when started, severity) | legacy_runtime_label_fixed_by_contract | info | 请提供本题要求的具体情况 |  | Provide details of symptoms (when started, severity) | pass |
| maldives | MV_IMUGA | Customs Declaration | currency_amount_details | textarea | 详情 | Provide currency type and amount | legacy_runtime_label_fixed_by_contract | info | 具体情况 |  | Provide currency type and amount | pass |
| maldives | MV_IMUGA | Customs Declaration | carrying_restricted_items | radio | Are you carrying any restricted or prohibited items (alcohol, pork products, religious materials non-Islamic, narcotics)? | Are you carrying any restricted or prohibited items (alcohol, pork products, religious materials non-Islamic, narcotics)? | legacy_runtime_label_fixed_by_contract | info | 请填写：Carrying Restricted Items |  | Are you carrying any restricted or prohibited items (alcohol, pork products, religious materials non-Islamic, narcotics)? | pass |
| maldives | MV_IMUGA | Customs Declaration | restricted_items_details | textarea | 详情 | Describe the restricted items | legacy_runtime_label_fixed_by_contract | info | 具体情况 |  | Describe the restricted items | pass |
| maldives | MV_IMUGA | Declaration | final_declaration | checkbox | 声明 | I hereby declare that the information provided is true, accurate, and complete. I understand that providing false information may result in denial of entry into the Republic of Maldives. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the information provided is true, accurate, and complete. I understand that providing false information may result in denial of entry into the Republic of Maldives. | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | race_ethnicity | text | Race / Ethnicity (as collected by Malaysian immigration) | Race / Ethnicity (as collected by Malaysian immigration) | legacy_runtime_label_fixed_by_contract | info | 请填写：Race Ethnicity |  | Race / Ethnicity (as collected by Malaysian immigration) | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| malaysia | MY_TOURIST_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | visited_malaysia_before | radio | Have you ever visited Malaysia before? | Have you ever visited Malaysia before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问马来西亚？ |  | Have you ever visited Malaysia before? | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Malaysia. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Malaysia. | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | preferred_name | text | Preferred name (optional) | Preferred name (optional) | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Preferred name (optional) | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| new_zealand | NZ_VISITOR_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | visited_nz_before | radio | Have you ever visited New Zealand before? | Have you ever visited New Zealand before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问新西兰？ |  | Have you ever visited New Zealand before? | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | has_tb_history | radio | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | legacy_runtime_label_fixed_by_contract | info | 是否记录？ |  | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | tb_history_details | textarea | 详情 | Provide details (when, treatment, current status) | legacy_runtime_label_fixed_by_contract | info | 请提供本题要求的具体情况 |  | Provide details (when, treatment, current status) | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into New Zealand. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into New Zealand. | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | visited_philippines_before | radio | Have you ever visited the Philippines before? | Have you ever visited the Philippines before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问菲律宾？ |  | Have you ever visited the Philippines before? | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | pass |
| russia | RU_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| russia | RU_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| russia | RU_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| russia | RU_E_VISA | Travel History | visited_russia_before | radio | Have you ever visited Russia before? | Have you ever visited Russia before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问俄罗斯？ |  | Have you ever visited Russia before? | pass |
| russia | RU_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| russia | RU_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| russia | RU_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Russian Federation. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Russian Federation. | pass |
| singapore | SG_VISITOR_VISA | Personal Information | race | select | Race | Race | legacy_runtime_label_fixed_by_contract | info | 请填写：Race |  | Race | pass |
| singapore | SG_VISITOR_VISA | Personal Information | religion | select | Religion | Religion | legacy_runtime_label_fixed_by_contract | info | 请填写：Religion |  | Religion | pass |
| singapore | SG_VISITOR_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| singapore | SG_VISITOR_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| singapore | SG_VISITOR_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| singapore | SG_VISITOR_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| singapore | SG_VISITOR_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| singapore | SG_VISITOR_VISA | Travel History | visited_singapore_before | radio | Have you ever visited Singapore before? | Have you ever visited Singapore before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问新加坡？ |  | Have you ever visited Singapore before? | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Singapore. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Singapore. | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| thailand | TH_TOURIST_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| thailand | TH_TOURIST_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | visited_thailand_before | radio | Have you ever visited Thailand before? | Have you ever visited Thailand before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问泰国？ |  | Have you ever visited Thailand before? | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Thailand. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Thailand. | pass |
| turkey | TR_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 完整名称 |  | Spouse — Full name | pass |
| turkey | TR_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| turkey | TR_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| turkey | TR_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| turkey | TR_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| turkey | TR_E_VISA | Travel History | visited_turkiye_before | radio | Have you ever visited Türkiye before? | Have you ever visited Türkiye before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问Türkiye？ |  | Have you ever visited Türkiye before? | pass |
| turkey | TR_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| turkey | TR_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| turkey | TR_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Türkiye. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Türkiye. | pass |
| uk | UK_STANDARD_VISITOR | Your Family | has_children | radio | Do you have any children under 18? | Do you have any children under 18? | legacy_runtime_label_fixed_by_contract | info | 是否儿童？ |  | Do you have any children under 18? | pass |
| uk | UK_STANDARD_VISITOR | Your Family | children_travelling_with_you | radio | Are any of your children travelling with you? | Are any of your children travelling with you? | legacy_runtime_label_fixed_by_contract | info | 是否有其他人与您同行？ |  | Are any of your children travelling with you? | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | deported_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Please give details | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_description | textarea | Describe the engagement | Describe the engagement | legacy_runtime_label_fixed_by_contract | info | 请填写：Ppe Engagement Description |  | Describe the engagement | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_fee_amount | text | Fee or payment you will receive | Fee or payment you will receive | legacy_runtime_label_fixed_by_contract | info | 请填写：Ppe Fee Amount |  | Fee or payment you will receive | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | academic_qualifications_held | text | Highest academic qualification held in your field | Highest academic qualification held in your field | legacy_runtime_label_fixed_by_contract | info | 请填写：Academic Qualifications Held |  | Highest academic qualification held in your field | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_consultant_name | text | Name of the lead GMC-registered specialist | Name of the lead GMC-registered specialist | legacy_runtime_label_fixed_by_contract | info | 名称 |  | Name of the lead GMC-registered specialist | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | job_title | text | Job title | Job title | legacy_runtime_label_fixed_by_contract | info | 请填写：Job Title |  | Job title | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | has_savings | radio | Do you have any savings? | Do you have any savings? | legacy_runtime_label_fixed_by_contract | info | 请填写：Has Savings |  | Do you have any savings? | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | savings_amount | text | Total savings (in local currency) | Total savings (in local currency) | legacy_runtime_label_fixed_by_contract | info | 请填写：Savings Amount |  | Total savings (in local currency) | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | criminal_convictions_details | textarea | 详情 | Please give details of any criminal convictions | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Please give details of any criminal convictions | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | terrorism_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 请说明安全或公共秩序相关背景的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Please give details | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | war_crimes | radio | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪、逮捕或定罪记录？ |  | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | war_crimes_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 具体情况 |  | Please give details | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | organisations_concern_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 具体情况 |  | Please give details | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | bad_character_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 具体情况 |  | Please give details | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | planned_spend_currency | select | Planned spend — currency | Planned spend — currency | legacy_runtime_label_fixed_by_contract | info | 请填写：Planned Spend Currency |  | Planned spend — currency | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | job_description | textarea | Describe your job | Describe your job | legacy_runtime_label_fixed_by_contract | info | 请填写：Job Description |  | Describe your job | pass |
| vietnam | VN_E_VISA | Personal Information | religion | text | Religion | Religion | legacy_runtime_label_fixed_by_contract | info | 宗教信仰 |  | Religion | pass |
| vietnam | VN_E_VISA | Personal Information | has_violated_vietnam_laws | radio | Have you violated Vietnamese laws/regulations? | Have you violated Vietnamese laws/regulations? | legacy_runtime_label_fixed_by_contract | info | 是否曾违反越南法律或法规？ | 如曾在越南有违法、处罚、驱逐或类似记录，请选择“是”并说明。 | Have you violated Vietnamese laws/regulations? | pass |
| vietnam | VN_E_VISA | Information About the Trip | visited_vietnam_in_last_year | radio | Have you ever been to Viet Nam in the last 01 year? | Have you ever been to Viet Nam in the last 01 year? | legacy_runtime_label_fixed_by_contract | info | 过去一年是否曾到访越南？ |  | Have you ever been to Viet Nam in the last 01 year? | pass |
| vietnam | VN_E_VISA | Information About the Trip | has_relatives_in_vietnam | radio | Do you have relatives currently residing in Viet Nam? | Do you have relatives currently residing in Viet Nam? | legacy_runtime_label_fixed_by_contract | info | 是否有亲属目前居住在越南 |  | Do you have relatives currently residing in Viet Nam? | pass |
| vietnam | VN_E_VISA | Information About the Trip | relative_full_name_in_vn | text | Relative's full name | Relative's full name | legacy_runtime_label_fixed_by_contract | info | 在越亲属姓名 |  | Relative's full name | pass |
| vietnam | VN_E_VISA | Declaration | violation_of_vietnam_laws_details | textarea | 详情 | Details of Vietnamese law/regulation violation | legacy_runtime_label_fixed_by_contract | info | 请说明违反越南法律或法规的具体情况 | 请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。 | Details of Vietnamese law/regulation violation | pass |
| vietnam | VN_E_VISA | Declaration | final_declaration | checkbox | 声明 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | legacy_runtime_label_fixed_by_contract | info | 确认以上信息真实、准确、完整，并愿意对虚假申报承担责任 | 提交前请确认所有答案与护照、行程和上传材料一致。 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| south_africa | ZA_VISITOR_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否其他？ |  | Do you currently hold or have you previously held any other passport? | pass |
| south_africa | ZA_VISITOR_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 请填写：Position Title |  | Position / Title | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | visited_south_africa_before | radio | Have you ever visited South Africa before? | Have you ever visited South Africa before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问南非？ |  | Have you ever visited South Africa before? | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of South Africa. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of South Africa. | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |

## Field Pass Matrix

| country | schema | section | field_id | field_type | label_zh | label_en | options | pass_fail |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | name_in_arabic | text | 名称 | Name in Arabic (if applicable) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | religion | select | 请填写：Religion | Religion | 8 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 3 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to UAE | 1 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in UAE | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 90) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 13 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in UAE | 5 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or property | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in UAE | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | accommodation_emirate | text | 住宿 | Emirate | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Sponsor | has_sponsor | radio | 是否担保人/资助方？ | Do you have a sponsor for this application? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Sponsor | sponsor_type | select | 担保人/资助方类型 | Sponsor type | 9 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Sponsor | sponsor_name | text | 担保人/资助方名称 | Sponsor — Full name (or company name) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Sponsor | sponsor_emirates_id_or_license | text | 担保人身份证 | Sponsor — Emirates ID or trade-license number | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Sponsor | sponsor_phone | text | 担保人电话 | Sponsor — Telephone | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Sponsor | sponsor_email | text | 担保人邮箱 | Sponsor — Email | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Host in UAE | has_host_in_uae | radio | 是否邀请人/接待方？ | Will you be staying with a host (different from your sponsor)? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Host in UAE | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Host in UAE | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Host in UAE | host_address | text | 接待方地址 | Host — Address in UAE | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Host in UAE | host_phone | text | 邀请人/接待方电话 | Host — Telephone | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | visited_uae_before | radio | 是否曾访问阿联酋？ | Have you ever visited the UAE before? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | prior_uae_visit_arrival_date | date | 访问抵达日期 | Prior UAE visit — Arrival date | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | prior_uae_visit_departure_date | date | 访问离开日期 | Prior UAE visit — Departure date | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | prior_uae_visit_purpose | text | 访问目的 | Prior UAE visit — Purpose | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | refused_visa_or_entry_uae | radio | 是否曾被阿联酋拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, the UAE? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | refused_visa_uae_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from the UAE or any other country? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the United Arab Emirates. | 1 | pass |
| australia | AU_VISITOR_600 | ImmiAccount | au_immi_username | text | 用户名 | ImmiAccount username (email) | 0 | pass |
| australia | AU_VISITOR_600 | ImmiAccount | au_immi_password | password | 密码 | ImmiAccount password | 0 | pass |
| australia | AU_VISITOR_600 | ImmiAccount | au_immi_totp_secret | text | 请填写：Au Immi Totp Secret | ImmiAccount authenticator secret (base32) | 0 | pass |
| australia | AU_VISITOR_600 | ImmiAccount | au_resume_trn | text | 恢复 | Existing draft TRN (optional) | 0 | pass |
| australia | AU_VISITOR_600 | Application Context | stream | radio | 请填写：Stream | Select the stream the applicant is applying for | 4 | pass |
| australia | AU_VISITOR_600 | Application Context | applying_outside_australia | radio | 请填写：Applying Outside Australia | Is the applicant currently outside Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | applying_all_outside_australia | radio | 请填写：Applying All Outside Australia | Are all the applicants currently outside Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | current_location_country | country | 当前国家 | Current location | 0 | pass |
| australia | AU_VISITOR_600 | Application Context | current_location_legal_status | select | 当前法定状态 | Current location legal status | 7 | pass |
| australia | AU_VISITOR_600 | Application Context | purpose_of_stay_initial | select | 目的停留 | Select the applicant's initial purpose of stay | 6 | pass |
| australia | AU_VISITOR_600 | Application Context | significant_dates_in_australia | textarea | 请填写：Significant Dates In Australia | Give details of any significant dates on which the applicant needs to be in Australia | 0 | pass |
| australia | AU_VISITOR_600 | Application Context | event_invited_by_organisation | radio | 活动机构 | Has the applicant been invited to participate in specific event(s) by organisation(s) in Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | event_paid_by_australian_organisation | radio | 活动支付机构 | Will the applicant receive a payment from an organisation in Australia for their participation in the event? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | specialised_non_ongoing_work | radio | 工作 | Will the applicant undertake highly specialised non-ongoing work? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | entertainer_or_supporting_entertainer | radio | 请填写：Entertainer Or Supporting Entertainer | Will the applicant be performing as an entertainer in Australia or supporting an entertainer or group of entertainers performing in Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | production_director_or_participant | radio | 请填写：Production Director Or Participant | Will the applicant be directing, producing or taking any other part in a production that will be shown in Australia (including theatre, film, television, radio, concert or recording)? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | applying_as_part_of_group_of_applications | radio | 申请 | Is this application being lodged as part of a group of applications? | 2 | pass |
| australia | AU_VISITOR_600 | Application Context | representative_of_foreign_government_or_un | radio | 成员 | Is the applicant travelling as a representative of a foreign government, travelling on a United Nations Laissez-Passer or a member of an exempt group? | 2 | pass |
| australia | AU_VISITOR_600 | Personal Details | family_name | text | 姓氏（与护照一致） | Family name (as shown in your passport) | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | given_names | text | 名字（与护照一致） | Given names (as shown in your passport) | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | no_given_names | checkbox | 名字姓名 | I do not have given names (only one name on my passport) | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | has_other_names | radio | 是否其他姓名？ | Have you ever been known by any other names? (maiden, alias, professional, religious, anglicised) | 2 | pass |
| australia | AU_VISITOR_600 | Personal Details | other_name_full | text | 其他名称完整 | Other name | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | other_name_type | select | 其他名称类型 | Type of other name | 7 | pass |
| australia | AU_VISITOR_600 | Personal Details | sex | select | 性别 | Sex | 3 | pass |
| australia | AU_VISITOR_600 | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | town_of_birth | text | 城镇出生 | Town or city of birth | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | state_or_province_of_birth | text | 州省出生 | State or province of birth | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | country_of_nationality | country | 国籍 | Country of passport / current nationality | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other current or previous nationalities or citizenships? | 2 | pass |
| australia | AU_VISITOR_600 | Personal Details | other_nationality_country | country | 是否持有或曾持有其他国籍？ | Other country of nationality / citizenship | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | other_nationality_status | select | 是否持有或曾持有其他国籍？ | Is this nationality current or ceased? | 2 | pass |
| australia | AU_VISITOR_600 | Personal Details | country_of_residence | country | 国家居住 | Country in which you usually live | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | residency_status | select | 状态 | Your residency status in that country | 5 | pass |
| australia | AU_VISITOR_600 | Personal Details | is_applicant_under_18 | radio | 是否申请人？ | Will you be under 18 years of age on the date you plan to travel to Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Personal Details | minor_parental_consent_held | radio | 是否父母/监护人？ | Do you have written consent from both parents or legal guardians for this visa application and the planned travel? | 2 | pass |
| australia | AU_VISITOR_600 | Personal Details | minor_accompanying_adult_full_name | text | 是否有其他人与您同行？ | Full name of the adult travelling with you to Australia | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | minor_accompanying_adult_relationship | text | 是否有其他人与您同行？ | Relationship to the adult travelling with you | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | minor_accompanying_adult_passport_number | text | 同行成年人护照号码 | Passport number of the accompanying adult | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | minor_australian_carer_arranged | radio | 成年人 | Have arrangements been made for an adult to care for you in Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Personal Details | minor_australian_carer_full_name | text | 成年人 | Full name of the adult carer in Australia | 0 | pass |
| australia | AU_VISITOR_600 | Personal Details | minor_australian_carer_relationship | text | 关系 | Relationship to the adult carer | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_number | text | 护照号码 | Passport number | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_country_of_issue | country | 护照国家签发 | Country of issue | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_nationality | country | 护照国籍 | Nationality as shown in passport | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_date_of_issue | date | 签发日期 | Date of issue | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_date_of_expiry | date | 到期日期 | Date of expiry | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_place_of_issue | text | 护照签发地点 | Place of issue (city or town) | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_issuing_authority | text | 护照签发机关/签发地点 | Issuing authority | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | passport_type | select | 护照类型 | Passport type | 6 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | name_in_passport_chinese_chars | text | 护照 | Name in Chinese / Japanese / Korean characters (if applicable) | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | has_other_travel_documents | radio | 是否持有其他有效护照或旅行证件？ | Do you hold any other current passports or travel documents? | 2 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | other_travel_doc_number | text | 其他旅行号码 | Other travel document number | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | other_travel_doc_country | country | 其他旅行国家 | Country of issue | 0 | pass |
| australia | AU_VISITOR_600 | Passport & Travel Document | other_travel_doc_expiry | date | 到期日期 | Date of expiry | 0 | pass |
| australia | AU_VISITOR_600 | National Identity Document | has_national_id | radio | 国民身份证 | Do you hold a national identity card? | 2 | pass |
| australia | AU_VISITOR_600 | National Identity Document | national_id_number | text | 国民身份证号码 | National identity card number | 0 | pass |
| australia | AU_VISITOR_600 | National Identity Document | national_id_country | country | 国民身份证国家 | Country of issue | 0 | pass |
| australia | AU_VISITOR_600 | National Identity Document | national_id_expiry | date | 国民身份证到期 | Date of expiry (if shown on card) | 0 | pass |
| australia | AU_VISITOR_600 | National Identity Document | national_id_reason_for_not_providing | textarea | 国民身份证原因 | Give the reason the applicant cannot provide details of a national identity card issued by their country of passport. | 0 | pass |
| australia | AU_VISITOR_600 | National Identity Document | has_pacific_australia_card | radio | 卡 | Is the applicant a Pacific-Australia Card holder? | 2 | pass |
| australia | AU_VISITOR_600 | National Identity Document | chinese_commercial_code_number | text | 商业号码 | Enter name in Chinese Commercial Code number (if used) | 0 | pass |
| australia | AU_VISITOR_600 | National Identity Document | has_chinese_household_registration | radio | 请填写：Has Chinese Household Registration | Do you hold a People's Republic of China household registration (hukou)? | 2 | pass |
| australia | AU_VISITOR_600 | National Identity Document | chinese_household_registration_number | text | 号码 | Hukou number | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | residential_address_line_1 | text | 地址行 | Residential address — line 1 | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | residential_address_line_2 | text | 地址行 | Residential address — line 2 | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | residential_address_suburb | text | 地址 | Suburb / town / city | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | residential_address_state | text | 地址州 | State / province | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | residential_address_postcode | text | 地址 | Postcode / ZIP | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | residential_address_country | country | 国家 | Country | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | postal_address_same_as_residential | radio | 是否地址居住？ | Is your postal address the same as your residential address? | 2 | pass |
| australia | AU_VISITOR_600 | Contact Details | postal_address_line_1 | text | 地址行 | Postal address — line 1 | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | postal_address_line_2 | text | 地址行 | Postal address — line 2 | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | postal_address_suburb | text | 地址 | Suburb / town / city | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | postal_address_state | text | 地址州 | State / province | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | postal_address_postcode | text | 地址 | Postcode / ZIP | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | postal_address_country | country | 国家 | Country | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | phone_number | text | 电话号码 | Mobile / cell phone number (with country code) | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | alternative_phone_number | text | 电话号码 | Alternative phone number | 0 | pass |
| australia | AU_VISITOR_600 | Contact Details | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | uses_migration_agent | radio | 代理 | Are you using a registered migration agent or legal representative? | 2 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | agent_marn | text | 代理 | Migration Agent Registration Number (MARN) | 0 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | agent_full_name | text | 代理 | Agent full name | 0 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | agent_business_name | text | 代理商务 | Agent business name | 0 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | agent_phone | text | 代理电话 | Agent phone number | 0 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | agent_email | text | 代理邮箱 | Agent email address | 0 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | has_authorised_recipient | radio | 授权 | Do you wish to nominate a different authorised recipient (not the agent above) to receive correspondence? | 2 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | authorised_recipient_full_name | text | 授权 | Authorised recipient full name | 0 | pass |
| australia | AU_VISITOR_600 | Authorised Recipient & Migration Agent | authorised_recipient_email | text | 授权邮箱 | Authorised recipient email | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | relationship_status | select | 关系状态 | Current relationship status | 7 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_family_name | text | 伴侣家庭 | Partner / spouse family name | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_given_names | text | 伴侣名字姓名 | Partner / spouse given names | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_date_of_birth | date | 伴侣日期出生 | Partner date of birth | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_country_of_birth | country | 伴侣国家出生 | Partner country of birth | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_country_of_nationality | country | 伴侣国家国籍 | Partner country of nationality | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_relationship_start_date | date | 伴侣关系开始日期 | Date relationship started | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_accompanying | radio | 伴侣同行 | Will your partner accompany you to Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Family Composition | partner_in_australia | radio | 伴侣 | Is your partner currently in Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Family Composition | has_children | radio | 是否儿童？ | Do you have any children (biological, adopted or step-children of any age)? | 2 | pass |
| australia | AU_VISITOR_600 | Family Composition | child_full_name | text | 儿童完整名称 | Child full name | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | child_sex | select | 儿童性别 | Child sex | 3 | pass |
| australia | AU_VISITOR_600 | Family Composition | child_date_of_birth | date | 日期出生 | Child date of birth | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | child_country_of_residence | country | 国家居住 | Child country of usual residence | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | child_accompanying | radio | 同行 | Will the child accompany you? | 2 | pass |
| australia | AU_VISITOR_600 | Family Composition | father_full_name | text | 父亲完整名称 | Father full name | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | father_date_of_birth | date | 日期出生 | Father date of birth | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | father_country_of_birth | country | 国家出生 | Father country of birth | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | mother_full_name | text | 母亲完整名称 | Mother full name | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | mother_date_of_birth | date | 日期出生 | Mother date of birth | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | mother_country_of_birth | country | 国家出生 | Mother country of birth | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | has_other_relatives_in_australia | radio | 是否其他亲属？ | Do you have any relatives currently in Australia (other than partner / children listed above)? | 2 | pass |
| australia | AU_VISITOR_600 | Family Composition | relative_in_au_full_name | text | 亲属完整名称 | Relative full name | 0 | pass |
| australia | AU_VISITOR_600 | Family Composition | relative_in_au_relationship | select | 关系 | Relationship to you | 7 | pass |
| australia | AU_VISITOR_600 | Family Composition | relative_in_au_visa_status | select | 签证状态 | Their Australian visa or residency status | 4 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | has_visited_australia_before | radio | 是否曾访问？ | Have you ever travelled to Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | previous_au_visit_arrival_date | date | 过往访问抵达日期 | Date of arrival | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | previous_au_visit_departure_date | date | 过往访问离开日期 | Date of departure | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | previous_au_visit_visa_type | text | 过往访问签证 | Type of visa held | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | has_current_au_visa | radio | 是否当前签证？ | Do you currently hold an Australian visa (other than this application)? | 2 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | current_au_visa_type | text | 当前签证 | Current Australian visa subclass | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | current_au_visa_expiry | date | 当前签证到期 | Current visa expiry date | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | has_been_refused_visa | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been refused a visa or had a visa cancelled by Australia or any other country? | 2 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | refusal_country | country | 拒签或签证取消的国家/地区 | Country that refused / cancelled the visa | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | refusal_visa_type | text | 被拒或被取消的签证类型 | Type of visa refused / cancelled | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | refusal_date | date | 拒签或签证取消日期 | Date of refusal / cancellation | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | refusal_reason | textarea | 拒签或签证取消原因 | Reason given for refusal / cancellation | 0 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | has_overstayed_visa | radio | 是否签证？ | Have you ever overstayed a visa or breached any visa conditions in Australia or any other country? | 2 | pass |
| australia | AU_VISITOR_600 | Travel & Visa History | overstay_details | textarea | 具体情况 | Details of overstay or visa breach | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Australia | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from Australia | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | intended_length_of_stay_months | text | 预计停留个月 | Total intended length of stay (months) | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | intended_entries | select | 申请入境次数 | Number of entries requested | 2 | pass |
| australia | AU_VISITOR_600 | Visit Details | first_port_of_arrival | select | 名抵达 | First Australian port of arrival | 11 | pass |
| australia | AU_VISITOR_600 | Visit Details | first_port_other_specify | text | 名其他 | Specify other port | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | intended_states_to_visit | textarea | 预计访问 | States or territories you plan to visit | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | accommodation_type | select | 住宿类型 | Where will you stay during your visit? | 5 | pass |
| australia | AU_VISITOR_600 | Visit Details | accommodation_address | textarea | 住宿地点或接待方地址 | Address of first night's accommodation in Australia (if known) | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | accompanied_by_other_applicants | radio | 是否其他？ | Are you applying as part of a family group with other people on this application? | 2 | pass |
| australia | AU_VISITOR_600 | Visit Details | accompanying_applicant_full_name | text | 同行 | Accompanying applicant full name | 0 | pass |
| australia | AU_VISITOR_600 | Visit Details | accompanying_applicant_relationship | text | 同行关系 | Relationship to you | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | tourist_main_reason | select | 主要原因 | Main reason for visit | 5 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | tourist_visit_family_relationship | text | 访问家庭关系 | Relationship to the family member or friend in Australia | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | tourist_visit_family_name | text | 访问家庭 | Name of family member or friend in Australia | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | tourist_visit_family_address | textarea | 访问家庭地址 | Address of family member / friend | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | tourist_planned_activities | textarea | 访问 | Planned activities during the visit | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_purpose | select | 商务目的 | Type of business activity in Australia | 6 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_purpose_other_specify | text | 商务目的其他 | Specify other business activity | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_organising_org_name | text | 商务 | Name of the Australian organisation you will visit | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_organising_org_address | textarea | 商务地址 | Address of the Australian organisation | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_contact_full_name | text | 商务联系人 | Australian contact full name | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_contact_position | text | 商务联系人 | Australian contact position / title | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_contact_phone | text | 商务联系人电话 | Australian contact phone number | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_contact_email | text | 商务联系人邮箱 | Australian contact email | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_employer_overseas_name | text | 商务雇主 | Your overseas employer / business name | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_employer_overseas_position | text | 商务雇主 | Your position at the overseas employer | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | business_paid_by_australian_entity | radio | 是否商务？ | Will you receive any payment from an Australian source for your activity? | 2 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_full_name | text | 担保人 | Sponsor full name | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_relationship | select | 担保人/资助方与申请人的关系 | Sponsor's relationship to you | 7 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_date_of_birth | date | 担保人日期出生 | Sponsor date of birth | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_au_residency | select | 担保人 | Sponsor Australian residency status | 3 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_address | textarea | 担保人/资助方地址 | Sponsor residential address in Australia | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_phone | text | 担保人电话 | Sponsor phone number | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_email | text | 担保人邮箱 | Sponsor email | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | sponsor_security_bond_aware | radio | 是否知悉担保人可能需要缴纳保证金？ | Do you understand a security bond may be required from your sponsor? | 2 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_operator_name | text | 目的地状态旅行 | Approved Destination Status tour operator (Chinese travel agency) | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_operator_licence | text | 号码 | ADS tour operator licence / registration number | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_code | text | 请填写：Ads Tour Code | ADS group tour code | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_start_date | date | 开始日期 | Tour start date | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_end_date | date | 结束日期 | Tour end date | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | ads_tour_leader_name | text | 名称 | Tour leader / guide name | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | frequent_eligible_passport_country | select | 护照国家 | Passport country (Frequent Traveller stream is restricted to these eligible nationalities) | 11 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | frequent_traveller_purpose | select | 旅行目的 | Primary purpose for the 10-year multiple-entry visa | 3 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | frequent_average_visit_length_days | text | 访问天 | Average length of each visit (days, max 3 months per visit) | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | frequent_estimated_visits_per_year | text | 号码 | Estimated number of visits per year | 0 | pass |
| australia | AU_VISITOR_600 | Stream-Specific Details | frequent_residing_in_china | radio | 请填写：Frequent Residing In China | Will you collect biometrics in mainland China? (relevant where in-country biometrics rules differ) | 2 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | funding_source | select | 谁将支付本次旅行费用？ | Who will fund your stay in Australia? | 7 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | funds_available_amount | text | 旅行同等 | Total funds available for the trip (AUD equivalent) | 0 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | funds_currency | select | 请填写：Funds Currency | Currency | 11 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | funder_full_name | text | 担保人 | Funder / sponsor full name | 0 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | funder_relationship | text | 关系 | Funder relationship to you | 0 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | current_employment_status | select | 当前工作状态 | Your current employment status | 7 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | current_employer_name | text | 当前雇主 | Current employer / business name | 0 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | current_position | text | 当前 | Current position / job title | 0 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | current_employer_address | textarea | 当前雇主地址 | Employer / business address | 0 | pass |
| australia | AU_VISITOR_600 | Funding & Financial Capacity | monthly_income_amount | text | 每月收入 | Monthly income (in your local currency) | 0 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | has_serious_medical_condition | radio | 医疗 | Do you have any disease or condition that requires treatment, medication or hospitalisation? | 2 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | medical_condition_details | textarea | 医疗详情 | Details of medical condition | 0 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | has_tuberculosis_history | radio | 是否记录？ | Have you ever had, or been treated for, tuberculosis (TB)? | 2 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | has_been_in_close_contact_with_tb | radio | 是否联系人？ | Have you been in close contact with a family member with active TB? | 2 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | intends_to_work_in_health_setting | radio | 是否工作？ | Will you work in or visit Australian healthcare or childcare settings? | 2 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | is_pregnant | radio | 请填写：Is Pregnant | Are you pregnant? | 2 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | has_health_insurance | radio | 是否保险？ | Do you have health insurance covering your stay in Australia? | 2 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | health_insurance_provider | text | 保险 | Health insurance provider | 0 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | health_insurance_policy_number | text | 号码 | Policy number | 0 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | needs_special_assistance | radio | 特殊 | Do you require any special assistance (mobility, vision, hearing or other) during your visit? | 2 | pass |
| australia | AU_VISITOR_600 | Health & Health Insurance | special_assistance_details | textarea | 特殊详情 | Details of special assistance required | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | has_criminal_conviction | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been charged with or convicted of any offence in any country? | 2 | pass |
| australia | AU_VISITOR_600 | Character Declarations | criminal_conviction_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Details of charges / convictions (offence, country, date, sentence) | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | has_been_subject_to_court_order | radio | 请填写：Has Been Subject To Court Order | Have you ever been the subject of an arrest warrant, restraining order or court order? | 2 | pass |
| australia | AU_VISITOR_600 | Character Declarations | court_order_details | textarea | 具体情况 | Details of court order or restraining order | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | has_military_service | radio | 公务 | Have you ever served in any military force, militia, intelligence service, security organisation, or police? | 2 | pass |
| australia | AU_VISITOR_600 | Character Declarations | military_service_country | country | 公务国家 | Country in which you served | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | military_service_branch | text | 公务 | Branch / unit | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | military_service_role | text | 公务 | Role / rank | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | military_service_start_date | date | 公务开始日期 | Service start date | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | military_service_end_date | date | 公务结束日期 | Service end date | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | has_been_involved_in_war_crimes | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been involved in war crimes, crimes against humanity, or human rights abuses? | 2 | pass |
| australia | AU_VISITOR_600 | Character Declarations | war_crimes_details | textarea | 请提供相关具体情况 | Details | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | has_outstanding_debts_to_au_gov | radio | 政府 | Do you owe any debts to the Australian Government, or have you owed them in the past? | 2 | pass |
| australia | AU_VISITOR_600 | Character Declarations | au_gov_debt_details | textarea | 政府详情 | Details of debt to Australian Government | 0 | pass |
| australia | AU_VISITOR_600 | Character Declarations | intends_to_engage_in_work | radio | 是否工作？ | Do you intend to engage in work for an Australian employer during your visit? | 2 | pass |
| australia | AU_VISITOR_600 | Character Declarations | intends_to_study_more_than_3_months | radio | 学习个月 | Do you intend to study in Australia for more than 3 months? | 2 | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_information_true | checkbox | 声明信息 | I declare that the information given is complete, correct and up to date. | 0 | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_understands_consequences | checkbox | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | I understand that providing false or misleading information is a serious offence and may result in visa refusal, cancellation, or removal from Australia. | 0 | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_consent_to_share_data | checkbox | 声明确认 | I consent to the Department of Home Affairs sharing my personal information with other Australian government agencies and overseas authorities for the purposes of assessing this application. | 0 | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_consent_health_examinations | checkbox | 声明确认 | I consent to undergo any health examinations the Department may require. | 0 | pass |
| australia | AU_VISITOR_600 | Declaration | declaration_consent_biometrics | checkbox | 声明确认 | I consent to provide biometric data (photograph and fingerprints) if requested. | 0 | pass |
| australia | AU_VISITOR_600 | Declaration | signature_full_name | text | 完整名称 | Full name (typed signature) | 0 | pass |
| australia | AU_VISITOR_600 | Declaration | signature_date | date | 日期 | Date of signature | 0 | pass |
| canada | CA_TRV | Personal Information | surname | text | 姓氏（与护照一致） | Family name (Surname) | 0 | pass |
| canada | CA_TRV | Personal Information | given_names | text | 名字（与护照一致） | Given name(s) | 0 | pass |
| canada | CA_TRV | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever used any other names (incl. nicknames, maiden name, religious names)? | 2 | pass |
| canada | CA_TRV | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| canada | CA_TRV | Personal Information | sex | select | 性别 | Sex | 3 | pass |
| canada | CA_TRV | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| canada | CA_TRV | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| canada | CA_TRV | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| canada | CA_TRV | Personal Information | nationality | country | 国籍 | Country of citizenship | 0 | pass |
| canada | CA_TRV | Personal Information | country_of_residence | country | 国家居住 | Country of current residence (if different from citizenship) | 0 | pass |
| canada | CA_TRV | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| canada | CA_TRV | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| canada | CA_TRV | Personal Information | marital_status | select | 婚姻状况 | Marital status | 7 | pass |
| canada | CA_TRV | Personal Information | spouse_full_name | text | 伴侣 | Spouse / Common-law partner — Full name | 0 | pass |
| canada | CA_TRV | Personal Information | spouse_nationality | country | 国籍 | Spouse / Common-law partner — Nationality | 0 | pass |
| canada | CA_TRV | Personal Information | spouse_dob | date | 伴侣日期出生 | Spouse / Common-law partner — Date of birth | 0 | pass |
| canada | CA_TRV | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| canada | CA_TRV | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| canada | CA_TRV | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| canada | CA_TRV | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| canada | CA_TRV | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| canada | CA_TRV | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| canada | CA_TRV | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| canada | CA_TRV | Passport | has_other_passports | radio | 是否其他？ | Have you ever held any other passport (current or expired)? | 2 | pass |
| canada | CA_TRV | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| canada | CA_TRV | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| canada | CA_TRV | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| canada | CA_TRV | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| canada | CA_TRV | Contact & Home Address | home_address_state | text | 地址州 | Home address — Province / State | 0 | pass |
| canada | CA_TRV | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code / ZIP | 0 | pass |
| canada | CA_TRV | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country | 0 | pass |
| canada | CA_TRV | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| canada | CA_TRV | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| canada | CA_TRV | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| canada | CA_TRV | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| canada | CA_TRV | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| canada | CA_TRV | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| canada | CA_TRV | Occupation | monthly_income_cad | text | 每月收入 | Approximate monthly income (CAD) | 0 | pass |
| canada | CA_TRV | Trip Details | visa_type_requested | radio | 签证 | Visa / authority type requested | 3 | pass |
| canada | CA_TRV | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Canada | 5 | pass |
| canada | CA_TRV | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Canada | 0 | pass |
| canada | CA_TRV | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 180) | 0 | pass |
| canada | CA_TRV | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 15 | pass |
| canada | CA_TRV | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| canada | CA_TRV | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| canada | CA_TRV | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Canada | 5 | pass |
| canada | CA_TRV | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of accommodation / first stop | 0 | pass |
| canada | CA_TRV | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Canada | 0 | pass |
| canada | CA_TRV | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Canada | 0 | pass |
| canada | CA_TRV | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| canada | CA_TRV | Trip Details | available_funds_cad | text | 访问 | Funds available for the visit (CAD) | 0 | pass |
| canada | CA_TRV | Host in Canada | has_host_in_canada | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Canada? | 2 | pass |
| canada | CA_TRV | Host in Canada | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| canada | CA_TRV | Host in Canada | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| canada | CA_TRV | Host in Canada | host_address | text | 接待方地址 | Host — Address in Canada | 0 | pass |
| canada | CA_TRV | Host in Canada | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| canada | CA_TRV | Host in Canada | host_status | text | 接待方状态 | Host — Status in Canada | 0 | pass |
| canada | CA_TRV | Travel & Background | visited_canada_before | radio | 是否曾访问加拿大？ | Have you ever visited Canada before? | 2 | pass |
| canada | CA_TRV | Travel & Background | prior_canada_visit_arrival_date | date | 访问抵达日期 | Prior Canada visit — Arrival date | 0 | pass |
| canada | CA_TRV | Travel & Background | prior_canada_visit_departure_date | date | 访问离开日期 | Prior Canada visit — Departure date | 0 | pass |
| canada | CA_TRV | Travel & Background | prior_canada_visit_purpose | text | 访问目的 | Prior Canada visit — Purpose | 0 | pass |
| canada | CA_TRV | Travel & Background | refused_visa_or_entry_canada | radio | 是否曾被加拿大拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Canada? | 2 | pass |
| canada | CA_TRV | Travel & Background | refused_visa_canada_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| canada | CA_TRV | Travel & Background | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| canada | CA_TRV | Travel & Background | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| canada | CA_TRV | Travel & Background | has_military_service | radio | 公务 | Have you ever served in any military, militia, civil-defence unit, security organisation, or police force? | 2 | pass |
| canada | CA_TRV | Travel & Background | military_service_details | textarea | 请提供本题要求的具体情况 | Provide details (country, branch, rank, dates) | 0 | pass |
| canada | CA_TRV | Health & Character | has_tb_history | radio | 是否记录？ | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | 2 | pass |
| canada | CA_TRV | Health & Character | tb_history_details | textarea | 请提供本题要求的具体情况 | Provide details | 0 | pass |
| canada | CA_TRV | Health & Character | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| canada | CA_TRV | Health & Character | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| canada | CA_TRV | Health & Character | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported, removed, or excluded from any country? | 2 | pass |
| canada | CA_TRV | Health & Character | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| canada | CA_TRV | Health & Character | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, war crimes, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security? | 2 | pass |
| canada | CA_TRV | Health & Character | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| canada | CA_TRV | Health & Character | application_date | date | 申请日期 | Date of application | 0 | pass |
| canada | CA_TRV | Health & Character | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Canada. | 1 | pass |
| us | DS160 | Personal Information 1 | surname | text | 姓氏（与护照一致） | Surnames | 0 | pass |
| us | DS160 | Personal Information 1 | given_names | text | 名字（与护照一致） | Given Names | 0 | pass |
| us | DS160 | Personal Information 1 | full_name_native_alphabet | text | 母语字母全名（如适用） | Full Name in Native Alphabet | 0 | pass |
| us | DS160 | Personal Information 1 | other_names_used | radio | 是否其他姓名？ | Have you ever used other names (i.e., maiden, religious, professional, alias, etc.)? | 2 | pass |
| us | DS160 | Personal Information 1 | other_surname | text | 曾用其他姓氏（婚前姓、宗教名、职业名、别名等） | Other Surnames Used (maiden, religious, professional, aliases, etc.) | 0 | pass |
| us | DS160 | Personal Information 1 | other_given_names | text | 曾用其他名字 | Other Given Names Used | 0 | pass |
| us | DS160 | Personal Information 1 | has_telecode | radio | 您是否有代表您姓名的中文电码？ | Do you have a telecode that represents your name? | 2 | pass |
| us | DS160 | Personal Information 1 | telecode_surname | text | 电码——姓氏 | Telecode Surname | 0 | pass |
| us | DS160 | Personal Information 1 | telecode_given_names | text | 电码——名字 | Telecode Given Names | 0 | pass |
| us | DS160 | Personal Information 1 | sex | radio | 性别 | Sex | 2 | pass |
| us | DS160 | Personal Information 1 | marital_status | select | 婚姻状况 | Marital Status | 8 | pass |
| us | DS160 | Personal Information 1 | marital_status_other_explain | text | 其他——请说明 | Other — Please Explain | 0 | pass |
| us | DS160 | Personal Information 1 | date_of_birth | date | 出生日期 | Date of Birth | 0 | pass |
| us | DS160 | Personal Information 1 | city_of_birth | text | 出生城市 | City of Birth | 0 | pass |
| us | DS160 | Personal Information 1 | state_of_birth | text | 出生州/省（如适用） | State/Province of Birth | 0 | pass |
| us | DS160 | Personal Information 1 | country_of_birth | select | 出生国家/地区 | Country/Region of Birth | 0 | pass |
| us | DS160 | Personal Information 2 | nationality_country | select | 国籍 | Country/Region of Origin (Nationality) | 0 | pass |
| us | DS160 | Personal Information 2 | other_nationality | radio | 其他国籍 | Do you hold or have you held any nationality other than the one indicated above on nationality? | 2 | pass |
| us | DS160 | Personal Information 2 | other_nationality_country | select | 是否持有或曾持有其他国籍？ | Other Country/Region of Nationality | 0 | pass |
| us | DS160 | Personal Information 2 | other_nationality_has_passport | radio | 是否持有或曾持有其他国籍？ | Do you hold a passport for that other nationality? | 2 | pass |
| us | DS160 | Personal Information 2 | other_nationality_passport_number | text | 是否持有或曾持有其他国籍？ | Passport Number | 0 | pass |
| us | DS160 | Personal Information 2 | permanent_resident_other_country | radio | 是否其他国家/地区？ | Are you a permanent resident of a country/region other than your country/region of origin (nationality) indicated above? | 2 | pass |
| us | DS160 | Personal Information 2 | other_permanent_resident_country | select | 其他永久居留国家/地区 | Other Permanent Resident Country/Region | 0 | pass |
| us | DS160 | Personal Information 2 | national_id_number | text | 国民身份证号码（如适用） | National Identification Number | 0 | pass |
| us | DS160 | Personal Information 2 | us_social_security_number | text | 美国社会安全号码（如适用） | U.S. Social Security Number | 0 | pass |
| us | DS160 | Personal Information 2 | us_taxpayer_id | text | 美国纳税人识别号（如适用） | U.S. Taxpayer ID Number | 0 | pass |
| us | DS160 | Travel Information | purpose_of_trip | select | 赴美目的 | Purpose of Trip to the U.S. | 25 | pass |
| us | DS160 | Travel Information | purpose_of_trip_specify | select | 具体说明 | Specify | 3 | pass |
| us | DS160 | Travel Information | has_specific_plans | radio | 是否计划？ | Have you made specific travel plans? | 2 | pass |
| us | DS160 | Travel Information | arrival_date | date | 计划抵达日期 | Date of Arrival in U.S. | 0 | pass |
| us | DS160 | Travel Information | arrival_flight | text | 到达航班（如已知） | Arrival Flight (if known) | 0 | pass |
| us | DS160 | Travel Information | arrival_city | text | 到达城市 | Arrival City | 0 | pass |
| us | DS160 | Travel Information | departure_date | date | 计划离开日期 | Date of Departure from U.S. | 0 | pass |
| us | DS160 | Travel Information | departure_flight | text | 离开航班（如已知） | Departure Flight (if known) | 0 | pass |
| us | DS160 | Travel Information | departure_city | text | 离开城市 | Departure City | 0 | pass |
| us | DS160 | Travel Information | planned_location | text | 地点 | Location | 0 | pass |
| us | DS160 | Travel Information | intended_arrival_date | date | 预计抵达日期 | Intended Date of Arrival in U.S. | 0 | pass |
| us | DS160 | Travel Information | intended_length_of_stay_value | text | 预计停留时间（数值） | Intended Length of Stay in U.S. (Value) | 0 | pass |
| us | DS160 | Travel Information | intended_length_of_stay_unit | select | 预计停留时间单位 | Intended Length of Stay in U.S. (Unit) | 6 | pass |
| us | DS160 | Travel Information | us_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Travel Information | us_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Travel Information | us_address_city | text | 城市 | City | 0 | pass |
| us | DS160 | Travel Information | us_address_state | select | 州 | State | 0 | pass |
| us | DS160 | Travel Information | us_address_zip | text | 邮编 | ZIP Code | 0 | pass |
| us | DS160 | Travel Information | trip_payer_type | select | 为您旅行付费的个人/机构 | Person/Entity Paying for Your Trip | 6 | pass |
| us | DS160 | Travel Information | payer_surname | text | 付费人姓氏 | Surnames of Person Paying for Trip | 0 | pass |
| us | DS160 | Travel Information | payer_given_names | text | 付费人名字 | Given Names of Person Paying for Trip | 0 | pass |
| us | DS160 | Travel Information | payer_phone | text | 电话号码 | Telephone Number | 0 | pass |
| us | DS160 | Travel Information | payer_email | text | 邮箱地址（如适用） | Payer Email (if applicable) | 0 | pass |
| us | DS160 | Travel Information | payer_relationship | select | 与您的关系 | Relationship to You | 6 | pass |
| us | DS160 | Travel Information | payer_address_same_as_home | radio | 付费方地址是否与您的家庭或邮寄地址相同？ | Is the address of the party paying for your trip the same as your Home or Mailing Address? | 2 | pass |
| us | DS160 | Travel Information | payer_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Travel Information | payer_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Travel Information | payer_address_city | text | 城市 | City | 0 | pass |
| us | DS160 | Travel Information | payer_address_state | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Travel Information | payer_address_postal | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Travel Information | payer_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Travel Information | payer_org_name | text | 付费公司/组织名称 | Name of Company/Organization Paying for Trip | 0 | pass |
| us | DS160 | Travel Information | payer_org_phone | text | 电话号码 | Telephone Number | 0 | pass |
| us | DS160 | Travel Information | payer_org_relationship | text | 与您的关系 | Relationship to You | 0 | pass |
| us | DS160 | Travel Information | payer_org_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Travel Information | payer_org_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Travel Information | payer_org_address_city | text | 城市 | City | 0 | pass |
| us | DS160 | Travel Information | payer_org_address_state | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Travel Information | payer_org_address_postal | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Travel Information | payer_org_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Travel Companions | has_companions | radio | 是否有其他人与您同行？ | Are there other persons traveling with you? | 2 | pass |
| us | DS160 | Travel Companions | companion_group_travel | radio | 是否旅行？ | Are you traveling as part of a group or organization? | 2 | pass |
| us | DS160 | Travel Companions | companion_group_name | text | 团体名称 | Group Name | 0 | pass |
| us | DS160 | Travel Companions | companion_surname | text | 姓氏 | Surnames | 0 | pass |
| us | DS160 | Travel Companions | companion_given_names | text | 名字 | Given Names | 0 | pass |
| us | DS160 | Travel Companions | companion_relationship | select | 与您的关系 | Relationship to You | 9 | pass |
| us | DS160 | Previous U.S. Travel | has_been_in_us | radio | 您是否曾经到过美国？ | Have you ever been in the U.S.? | 2 | pass |
| us | DS160 | Previous U.S. Travel | previous_visit_date_arrived | date | 到达日期 | Date Arrived | 0 | pass |
| us | DS160 | Previous U.S. Travel | previous_visit_length_of_stay | text | 停留时间（数值） | Length of Stay (Value) | 0 | pass |
| us | DS160 | Previous U.S. Travel | previous_visit_length_of_stay_unit | select | 停留时间（单位） | Length of Stay (Unit) | 5 | pass |
| us | DS160 | Previous U.S. Travel | has_us_drivers_license | radio | 您是否持有或曾持有美国驾照？ | Do you or did you ever hold a U.S. Driver's License? | 2 | pass |
| us | DS160 | Previous U.S. Travel | us_drivers_license_number | text | 驾照号码 | Driver's License Number | 0 | pass |
| us | DS160 | Previous U.S. Travel | us_drivers_license_state | select | 驾照所在州 | Driver's License State | 0 | pass |
| us | DS160 | Previous U.S. Travel | has_us_visa | radio | 是否签证？ | Have you ever been issued a U.S. Visa? | 2 | pass |
| us | DS160 | Previous U.S. Travel | last_visa_issue_day | select | 签证签发天 | Date Last Visa Was Issued (Day) | 31 | pass |
| us | DS160 | Previous U.S. Travel | last_visa_issue_month | select | 签证签发个月 | Date Last Visa Was Issued (Month) | 12 | pass |
| us | DS160 | Previous U.S. Travel | last_visa_issue_year | text | 签证签发 | Date Last Visa Was Issued (Year) | 0 | pass |
| us | DS160 | Previous U.S. Travel | visa_number | text | 签证号码 | Visa Number | 0 | pass |
| us | DS160 | Previous U.S. Travel | visa_number_unknown | checkbox | 不知道 | Do Not Know | 0 | pass |
| us | DS160 | Previous U.S. Travel | applying_same_visa_type | radio | 是否签证类型？ | Are you applying for the same type of visa? | 2 | pass |
| us | DS160 | Previous U.S. Travel | applying_same_country_of_issue_and_residence | radio | 您是否在上次签证签发的同一国家或地点申请，且该地是您的主要居住地？ | Are you applying in the same country or location where the visa above was issued, and is this country or location your place of principal of residence? | 2 | pass |
| us | DS160 | Previous U.S. Travel | has_been_ten_printed | radio | 您是否曾录过十指指纹？ | Have you been ten-printed? | 2 | pass |
| us | DS160 | Previous U.S. Travel | visa_lost_or_stolen | radio | 是否签证？ | Has your U.S. Visa ever been lost or stolen? | 2 | pass |
| us | DS160 | Previous U.S. Travel | year_visa_lost_or_stolen | text | 输入签证丢失或被盗的年份 | Enter year visa was lost or stolen | 0 | pass |
| us | DS160 | Previous U.S. Travel | visa_lost_or_stolen_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Previous U.S. Travel | visa_cancelled_or_revoked | radio | 是否签证？ | Has your U.S. Visa ever been cancelled or revoked? | 2 | pass |
| us | DS160 | Previous U.S. Travel | visa_cancelled_or_revoked_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Previous U.S. Travel | has_been_refused | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been refused a U.S. Visa, or been refused admission to the United States, or withdrawn your application for admission at the port of entry? | 2 | pass |
| us | DS160 | Previous U.S. Travel | refusal_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Previous U.S. Travel | immigrant_petition_filed | radio | 是否有人曾代您向美国公民及移民服务局提交移民申请？ | Has anyone ever filed an immigrant petition on your behalf with the United States Citizenship and Immigration Services? | 2 | pass |
| us | DS160 | Previous U.S. Travel | immigrant_petition_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Address and Phone | home_address_line1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Address and Phone | home_address_line2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Address and Phone | home_address_city | text | 城市 | City | 0 | pass |
| us | DS160 | Address and Phone | home_address_state_province | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Address and Phone | home_address_postal_code | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Address and Phone | home_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Address and Phone | mailing_same_as_home | radio | 是否家庭住址？ | Is your Mailing Address the same as your Home Address? | 2 | pass |
| us | DS160 | Address and Phone | mailing_address_line1 | text | 邮寄街道地址（第1行） | Mailing Street Address (Line 1) | 0 | pass |
| us | DS160 | Address and Phone | mailing_address_line2 | text | 邮寄街道地址（第2行，如适用） | Mailing Street Address (Line 2) | 0 | pass |
| us | DS160 | Address and Phone | mailing_address_city | text | 邮寄城市 | Mailing City | 0 | pass |
| us | DS160 | Address and Phone | mailing_address_state | text | 邮寄州/省 | Mailing State/Province | 0 | pass |
| us | DS160 | Address and Phone | mailing_address_postal | text | 邮寄邮政编码 | Mailing Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Address and Phone | mailing_address_country | select | 邮寄国家/地区 | Mailing Country/Region | 0 | pass |
| us | DS160 | Address and Phone | primary_phone | text | 主要电话号码 | Primary Phone Number | 0 | pass |
| us | DS160 | Address and Phone | secondary_phone | text | 备用电话号码（如适用） | Secondary Phone Number | 0 | pass |
| us | DS160 | Address and Phone | work_phone | text | 工作电话号码（如适用） | Work Phone Number | 0 | pass |
| us | DS160 | Address and Phone | has_other_phones | radio | 是否其他？ | Have you used any other phone numbers in the last five years? | 2 | pass |
| us | DS160 | Address and Phone | additional_phone | text | 其他电话号码 | Additional Phone Number | 0 | pass |
| us | DS160 | Address and Phone | email_address | text | 电子邮箱地址 | Email Address | 0 | pass |
| us | DS160 | Address and Phone | has_other_emails | radio | 是否其他？ | Have you used any other email addresses in the last five years? | 2 | pass |
| us | DS160 | Address and Phone | additional_email | text | 其他电子邮箱 | Additional Email Address | 0 | pass |
| us | DS160 | Address and Phone | social_media_platform | select | 社交媒体平台 | Social Media Provider/Platform | 21 | pass |
| us | DS160 | Address and Phone | social_media_handle | text | 社交媒体用户名 | Social Media Identifier | 0 | pass |
| us | DS160 | Address and Phone | has_other_social_media | radio | 是否其他？ | Do you wish to provide information about your presence on any other websites or applications you have used within the last five years to create or share content (photos, videos, status updates, etc.)? | 2 | pass |
| us | DS160 | Address and Phone | other_social_media_name | text | 网站/应用名称 | Website/Application Name | 0 | pass |
| us | DS160 | Address and Phone | other_social_media_identifier | text | 用户名 | Identifier | 0 | pass |
| us | DS160 | Passport Information | passport_document_type | select | 护照/旅行证件类型 | Passport/Travel Document Type | 5 | pass |
| us | DS160 | Passport Information | passport_document_type_explain | text | 护照证件 | Please explain | 0 | pass |
| us | DS160 | Passport Information | passport_number | text | 护照号码 | Passport/Travel Document Number | 0 | pass |
| us | DS160 | Passport Information | passport_book_number | text | 护照本号（如适用） | Passport Book Number | 0 | pass |
| us | DS160 | Passport Information | passport_issuing_country | select | 护照签发国家/地区 | Country/Authority That Issued Passport/Travel Document | 0 | pass |
| us | DS160 | Passport Information | passport_issuance_city | text | 签发城市 | City Where Issued | 0 | pass |
| us | DS160 | Passport Information | passport_issuance_state | text | 签发州/省（如适用） | State/Province Where Issued | 0 | pass |
| us | DS160 | Passport Information | passport_issuance_country | select | 签发国家/地区 | Country/Region Where Issued | 0 | pass |
| us | DS160 | Passport Information | passport_issuance_date | date | 护照签发日期 | Issuance Date | 0 | pass |
| us | DS160 | Passport Information | passport_expiration_date | date | 护照到期日期 | Expiration Date | 0 | pass |
| us | DS160 | Passport Information | lost_passport | radio | 是否护照？ | Have you ever lost a passport or had one stolen? | 2 | pass |
| us | DS160 | Passport Information | lost_passport_number | text | 丢失/被盗护照号码 | Lost/Stolen Passport Number | 0 | pass |
| us | DS160 | Passport Information | lost_passport_country | select | 护照/旅行证件签发国家/机构 | Country/Authority That Issued Passport/Travel Document | 0 | pass |
| us | DS160 | Passport Information | lost_passport_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Family Information: Relatives | father_surname | text | 父亲姓氏 | Father's Surnames | 0 | pass |
| us | DS160 | Family Information: Relatives | father_given_names | text | 父亲名字 | Father's Given Names | 0 | pass |
| us | DS160 | Family Information: Relatives | father_date_of_birth | date | 父亲出生日期 | Father's Date of Birth | 0 | pass |
| us | DS160 | Family Information: Relatives | mother_surname | text | 母亲姓氏 | Mother's Surnames | 0 | pass |
| us | DS160 | Family Information: Relatives | mother_given_names | text | 母亲名字 | Mother's Given Names | 0 | pass |
| us | DS160 | Family Information: Relatives | mother_date_of_birth | date | 母亲出生日期 | Mother's Date of Birth | 0 | pass |
| us | DS160 | Family Information: Relatives | has_immediate_us_relatives | radio | 是否亲属？ | Do you have any immediate relatives, not including parents, in the United States? | 2 | pass |
| us | DS160 | Family Information: Relatives | us_relative_surname | text | 姓氏 | Surnames | 0 | pass |
| us | DS160 | Family Information: Relatives | us_relative_given_names | text | 名字 | Given Names | 0 | pass |
| us | DS160 | Family Information: Relatives | us_relative_relationship | select | 与您的关系 | Relationship to You | 4 | pass |
| us | DS160 | Family Information: Relatives | us_relative_status | select | 美国状态 | Relative's Status | 4 | pass |
| us | DS160 | Family Information: Relatives | has_other_us_relatives | radio | 是否其他亲属？ | Do you have any other relatives in the United States? | 2 | pass |
| us | DS160 | Family Information: Spouse | spouse_surname | text | 配偶姓氏 | Spouse's Surnames | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_given_names | text | 配偶名字 | Spouse's Given Names | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_date_of_birth | date | 配偶出生日期 | Spouse's Date of Birth | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_nationality | select | 国籍 | Spouse's Country/Region of Origin (Nationality) | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_city_of_birth | text | 配偶出生城市 | Spouse's City of Birth | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_country_of_birth | select | 配偶出生国家/地区 | Spouse's Country/Region of Birth | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_address_type | select | 配偶地址 | Spouse's Address | 5 | pass |
| us | DS160 | Family Information: Spouse | spouse_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_address_city | text | 城市 | City | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_address_state | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_address_zip | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Family Information: Spouse | spouse_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Family Information: Partner | partner_surname | text | 伴侣姓氏 | Partner's Surnames | 0 | pass |
| us | DS160 | Family Information: Partner | partner_given_names | text | 伴侣名字 | Partner's Given Names | 0 | pass |
| us | DS160 | Family Information: Partner | partner_date_of_birth | date | 伴侣出生日期 | Partner's Date of Birth | 0 | pass |
| us | DS160 | Family Information: Partner | partner_nationality | select | 伴侣国籍 | Partner's Country/Region of Origin (Nationality) | 0 | pass |
| us | DS160 | Family Information: Partner | partner_city_of_birth | text | 伴侣出生城市 | Partner's City of Birth | 0 | pass |
| us | DS160 | Family Information: Partner | partner_country_of_birth | select | 伴侣出生国家/地区 | Partner's Country/Region of Birth | 0 | pass |
| us | DS160 | Family Information: Partner | partner_address_type | select | 伴侣地址 | Partner's Address | 5 | pass |
| us | DS160 | Family Information: Partner | partner_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Family Information: Partner | partner_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Family Information: Partner | partner_address_city | text | 城市 | City | 0 | pass |
| us | DS160 | Family Information: Partner | partner_address_state | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Family Information: Partner | partner_address_zip | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Family Information: Partner | partner_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Family Information: Deceased Spouse | deceased_spouse_surname | text | 已故配偶姓氏 | Deceased Spouse's Surnames | 0 | pass |
| us | DS160 | Family Information: Deceased Spouse | deceased_spouse_given_names | text | 已故配偶名字 | Deceased Spouse's Given Names | 0 | pass |
| us | DS160 | Family Information: Deceased Spouse | deceased_spouse_date_of_birth | date | 已故配偶出生日期 | Deceased Spouse's Date of Birth | 0 | pass |
| us | DS160 | Family Information: Deceased Spouse | deceased_spouse_nationality | select | 已故配偶国籍 | Deceased Spouse's Country/Region of Origin (Nationality) | 0 | pass |
| us | DS160 | Family Information: Deceased Spouse | deceased_spouse_city_of_birth | text | 已故配偶出生城市 | Deceased Spouse's City of Birth | 0 | pass |
| us | DS160 | Family Information: Deceased Spouse | deceased_spouse_country_of_birth | select | 已故配偶出生国家/地区 | Deceased Spouse's Country/Region of Birth | 0 | pass |
| us | DS160 | Family Information: Former Spouse | number_of_former_spouses | select | 前配偶人数 | Number of Former Spouses | 5 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_surname | text | 前配偶姓氏 | Former Spouse's Surnames | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_given_names | text | 前配偶名字 | Former Spouse's Given Names | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_date_of_birth | date | 前配偶出生日期 | Former Spouse's Date of Birth | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_nationality | select | 前配偶国籍 | Former Spouse's Country/Region of Origin (Nationality) | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_city_of_birth | text | 前配偶出生城市 | Former Spouse's City of Birth | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_country_of_birth | select | 前配偶出生国家/地区 | Former Spouse's Country/Region of Birth | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_date_of_marriage | date | 结婚日期 | Date of Marriage | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_date_marriage_ended | date | 婚姻结束日期 | Date Marriage Ended | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_how_marriage_ended | text | 婚姻结束方式 | How the Marriage Ended | 0 | pass |
| us | DS160 | Family Information: Former Spouse | former_spouse_country_marriage_terminated | select | 婚姻终止国家/地区 | Country/Region Marriage was Terminated | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_surname | text | 美国联系人——姓氏 | U.S. Contact — Surname | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_given_names | text | 美国联系人——名字 | U.S. Contact — Given Names | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_organization | text | 美国联系人——组织（如非个人，如适用） | U.S. Contact — Organization (if not a person) | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_relationship | select | 美国联系人——关系 | U.S. Contact — Relationship | 7 | pass |
| us | DS160 | US Point of Contact | us_contact_address_street1 | text | 美国联系人——街道地址 | U.S. Contact — Street Address | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_city | text | 美国联系人——城市 | U.S. Contact — City | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_state | select | 美国联系人——州 | U.S. Contact — State | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_zip | text | 美国联系人——邮编 | U.S. Contact — ZIP Code | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_phone | text | 美国联系人——电话 | U.S. Contact — Phone | 0 | pass |
| us | DS160 | US Point of Contact | us_contact_email | text | 美国联系人——邮箱 | U.S. Contact — Email | 0 | pass |
| us | DS160 | Work/Education/Training: Present | primary_occupation | select | 主要职业 | Primary Occupation | 22 | pass |
| us | DS160 | Work/Education/Training: Present | occupation_other_explain | text | 请具体说明 | Specify Other | 0 | pass |
| us | DS160 | Work/Education/Training: Present | not_employed_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_name | text | 雇主名称 | Present Employer or School Name | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_address_line1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_address_line2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_city | text | 城市 | City | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_state_province | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_postal_code | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employer_phone | text | 电话号码 | Phone Number | 0 | pass |
| us | DS160 | Work/Education/Training: Present | job_title | text | 职位 | Job Title | 0 | pass |
| us | DS160 | Work/Education/Training: Present | employment_start_date | date | 开始日期 | Start Date | 0 | pass |
| us | DS160 | Work/Education/Training: Present | monthly_salary | text | 月收入（当地货币，如受雇） | Monthly Income in Local Currency (if employed) | 0 | pass |
| us | DS160 | Work/Education/Training: Present | job_duties | textarea | 简要描述您的职责（如适用） | Briefly Describe Your Duties | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | has_previous_employer | radio | 您以前是否有工作？ | Were you previously employed? | 2 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_name | text | 雇主名称 | Employer Name | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_city | text | 城市 | City | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_state | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_postal | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employer_phone | text | 电话号码 | Telephone Number | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_job_title | text | 职位 | Job Title | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_supervisor_surname | text | 主管姓氏 | Supervisor's Surnames | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_supervisor_given_names | text | 主管名字 | Supervisor's Given Names | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employment_start_date | date | 工作起始日期 | Employment Date From | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_employment_end_date | date | 工作结束日期 | Employment Date To | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | prev_job_duties | textarea | 简要描述您的职责（如适用） | Briefly Describe Your Duties | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | has_attended_education | radio | 是否教育？ | Have you attended any educational institutions at a secondary level or above? | 2 | pass |
| us | DS160 | Work/Education/Training: Previous | education_institution_name | text | 学校名称 | Name of Institution | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_address_line1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_address_line2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_city | text | 城市 | City | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_state_province | text | 州/省 | State/Province | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_postal_code | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_course_of_study | text | 学习专业 | Course of Study | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_start_date | date | 就读起始日期 | Date of Attendance From | 0 | pass |
| us | DS160 | Work/Education/Training: Previous | education_end_date | date | 就读结束日期 | Date of Attendance To | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | has_clan_tribe | radio | 您是否属于某个宗族或部落？ | Do you belong to a clan or tribe? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | clan_tribe_name | text | 宗族/部落名称 | Clan/Tribe Name | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | language_name | text | 语言名称 | Language Name | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | has_traveled_last_five_years | radio | 您在过去五年内是否前往过任何国家/地区？ | Have you traveled to any countries/regions within the last five years? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | traveled_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | has_belonged_to_organization | radio | 您是否曾加入、资助或为任何专业、社会或慈善组织工作？ | Have you belonged to, contributed to, or worked for any professional, social, or charitable organization? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | organization_name | text | 组织名称 | Organization Name | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | has_specialized_skills | radio | 您是否具备任何专门技能或受过训练，例如枪械、爆炸物、核、生物或化学方面的经验？ | Do you have any specialized skills or training, such as firearms, explosives, nuclear, biological, or chemical experience? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | specialized_skills_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | has_served_military | radio | 您是否曾在军队中服役？ | Have you ever served in the military? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | military_country | select | 国家/地区 | Country/Region | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | military_branch | text | 服役军种 | Branch of Service | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | military_rank | text | 军衔/职位 | Rank/Position | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | military_specialty | text | 军事专长 | Military Specialty | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | military_date_from | date | 服役起始日期 | Date of Service From | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | military_date_to | date | 服役结束日期 | Date of Service To | 0 | pass |
| us | DS160 | Work/Education/Training: Additional | has_served_paramilitary | radio | 您是否曾在准军事组织、自卫组织、叛乱团体、游击队或暴动组织中服役、成为成员或参与其中？ | Have you ever served in, been a member of, or been involved with a paramilitary unit, vigilante unit, rebel group, guerrilla group, or insurgent organization? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | paramilitary_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Personal Information 1 | has_other_names | radio | 是否其他姓名？ | Have you ever used other names (i.e. maiden, religious, professional, alias, etc.)? | 2 | pass |
| us | DS160 | Travel Information | has_specific_travel_plans | radio | 是否旅行计划？ | Have you made specific travel plans? | 2 | pass |
| us | DS160 | Travel Information | who_is_paying | select | 谁将承担本次旅行和停留费用？ | Who is paying for your trip? | 5 | pass |
| us | DS160 | Previous U.S. Travel | vwp_denial | radio | 签证豁免 | Have you ever been denied a U.S. Visa Waiver Program (ESTA) authorization? | 2 | pass |
| us | DS160 | Address and Phone | mobile_phone | text | 手机号码 | Mobile (Cellular) Phone Number | 0 | pass |
| us | DS160 | Address and Phone | has_other_phone | radio | 是否其他电话？ | Have you used any other phone numbers in the last five years? | 2 | pass |
| us | DS160 | Address and Phone | has_other_email | radio | 是否其他电子邮箱？ | Have you used any other email addresses in the last five years? | 2 | pass |
| us | DS160 | Address and Phone | has_social_media | radio | 社交媒体 | Have you used any social media platforms in the last five years? | 2 | pass |
| us | DS160 | Address and Phone | social_media_provider | select | 社交媒体 | Social Media Platform | 8 | pass |
| us | DS160 | Address and Phone | social_media_identifier | text | 社交媒体 | Social Media Identifier (handle / username) | 0 | pass |
| us | DS160 | Passport Information | passport_has_expiry | radio | 护照到期 | Does your passport have an expiration date? | 2 | pass |
| us | DS160 | Passport Information | passport_lost_or_stolen | radio | 是否护照？ | Have you ever lost a passport or had one stolen? | 2 | pass |
| us | DS160 | Family Information: Relatives | father_in_us | radio | 是否父亲？ | Is your father in the U.S.? | 2 | pass |
| us | DS160 | Family Information: Relatives | mother_in_us | radio | 是否母亲？ | Is your mother in the U.S.? | 2 | pass |
| us | DS160 | Work/Education/Training: Previous | has_other_education | radio | 是否其他教育？ | Have you attended any educational institutions at a secondary level or above? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | has_countries_visited | radio | 是否曾访问？ | Have you traveled to any countries within the last five years? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | has_organization | radio | 您是否曾加入、资助或为任何专业、社会或慈善组织工作？ | Have you belonged to, contributed to, or worked for any professional, social, or charitable organization? | 2 | pass |
| us | DS160 | Work/Education/Training: Additional | has_served_insurgent | radio | 成员机构 | Have you ever served in, been a member of, or been involved with a paramilitary, vigilante, rebel, guerrilla, or insurgent organization? | 2 | pass |
| us | DS160 | Security and Background: Part 1 | has_communicable_disease | radio | 您是否患有具有公共卫生意义的传染病？（具有公共卫生意义的传染病包括软下疳、淋病、腹股沟肉芽肿、传染性麻风病、性病性淋巴肉芽肿、传染期梅毒、活动性结核病以及卫生与公众服务部确定的其他疾病。） | Do you have a communicable disease of public health significance? (Communicable diseases of public significance include chancroid, gonorrhea, granuloma inguinale, infectious leprosy, lymphogranuloma venereum, infectious stage syphilis, active tuberculosis, and other diseases as determined by the Department of Health and Human Services.) | 2 | pass |
| us | DS160 | Security and Background: Part 1 | has_communicable_disease_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 1 | has_physical_mental_disorder | radio | 您是否有对自己或他人的安全或福祉构成或可能构成威胁的精神或身体障碍？ | Do you have a mental or physical disorder that poses or is likely to pose a threat to the safety or welfare of yourself or others? | 2 | pass |
| us | DS160 | Security and Background: Part 1 | has_physical_mental_disorder_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 1 | is_drug_abuser | radio | 您是否是或曾经是吸毒者或有毒瘾？ | Are you or have you ever been a drug abuser or addict? | 2 | pass |
| us | DS160 | Security and Background: Part 1 | is_drug_abuser_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 2 | has_arrest_conviction | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been arrested or convicted for any offense or crime, even though subject of a pardon, amnesty, or other similar action? | 2 | pass |
| us | DS160 | Security and Background: Part 2 | has_arrest_conviction_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 2 | has_violated_controlled_substance | radio | 您是否曾违反或参与违反有关管制物质的法律？ | Have you ever violated, or engaged in a conspiracy to violate, any law relating to controlled substances? | 2 | pass |
| us | DS160 | Security and Background: Part 2 | has_violated_controlled_substance_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 2 | has_prostitution | radio | 您是否来美国从事卖淫或非法商业化色情活动，或在过去10年内是否曾从事卖淫或招揽卖淫？ | Are you coming to the United States to engage in prostitution or unlawful commercialized vice or have you been engaged in prostitution or procuring prostitutes within the past 10 years? | 2 | pass |
| us | DS160 | Security and Background: Part 2 | has_prostitution_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 2 | has_money_laundering | radio | 您是否曾参与或试图参与洗钱活动？ | Have you ever been involved in, or do you seek to engage in, money laundering? | 2 | pass |
| us | DS160 | Security and Background: Part 2 | has_money_laundering_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 2 | has_human_trafficking | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever committed or conspired to commit a human trafficking offense in the United States or outside the United States? | 2 | pass |
| us | DS160 | Security and Background: Part 2 | has_human_trafficking_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 2 | has_aided_human_trafficking | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever knowingly aided, abetted, assisted or colluded with an individual who has committed, or conspired to commit a severe human trafficking offense in the United States or outside the United States? | 2 | pass |
| us | DS160 | Security and Background: Part 2 | has_aided_human_trafficking_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 2 | has_trafficking_beneficiary | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Are you the spouse, son, or daughter of an individual who has committed or conspired to commit a human trafficking offense in the United States or outside the United States and have you within the last five years, knowingly benefited from the trafficking activities? | 2 | pass |
| us | DS160 | Security and Background: Part 2 | has_trafficking_beneficiary_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | intend_illegal_activity | radio | 您是否试图在美国从事间谍、破坏、出口管制违规或其他非法活动？ | Do you seek to engage in espionage, sabotage, export control violations, or any other illegal activity while in the United States? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | intend_illegal_activity_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | intend_terrorist_activity | radio | 您是否试图在美国从事恐怖活动，或曾经从事过恐怖活动？ | Do you seek to engage in terrorist activities while in the United States or have you ever engaged in terrorist activities? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | intend_terrorist_activity_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_provided_terrorist_support | radio | 您是否曾经或打算向恐怖分子或恐怖组织提供财务援助或其他支持？ | Have you ever or do you intend to provide financial assistance or other support to terrorists or terrorist organizations? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_provided_terrorist_support_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | is_terrorist_member | radio | 是否成员？ | Are you a member or representative of a terrorist organization? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | is_terrorist_member_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | is_terrorist_family | radio | 是否家庭？ | Are you the spouse, son, or daughter of an individual who has engaged in terrorist activity, including providing financial assistance or other support to terrorists or terrorist organizations, in the last five years? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | is_terrorist_family_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_genocide | radio | 您是否曾下令、煽动、实施、协助或以其他方式参与种族灭绝？ | Have you ever ordered, incited, committed, assisted, or otherwise participated in genocide? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_genocide_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_torture | radio | 您是否曾实施、下令、煽动、协助或以其他方式参与酷刑？ | Have you ever committed, ordered, incited, assisted, or otherwise participated in torture? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_torture_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_extrajudicial_killings | radio | 您是否曾实施、下令、煽动、协助或以其他方式参与法外杀戮、政治杀戮或其他暴力行为？ | Have you committed, ordered, incited, assisted, or otherwise participated in extrajudicial killings, political killings, or other acts of violence? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_extrajudicial_killings_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_child_soldier | radio | 是否儿童？ | Have you ever engaged in the recruitment or the use of child soldiers? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_child_soldier_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_religious_freedom_violation | radio | 您在担任政府官员期间，是否曾负责或直接实施过特别严重的宗教自由侵犯行为？ | Have you, while serving as a government official, been responsible for or directly carried out, at any time, particularly severe violations of religious freedom? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_religious_freedom_violation_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_population_control | radio | 您是否曾直接参与建立或执行强迫妇女违背自由意愿接受堕胎或强迫男女违背自由意愿接受绝育的人口控制措施？ | Have you ever been directly involved in the establishment or enforcement of population controls forcing a woman to undergo an abortion against her free choice or a man or a woman to undergo sterilization against his or her free will? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_population_control_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 3 | has_coercive_transplant | radio | 您是否曾直接参与强制摘取人体器官或身体组织？ | Have you ever been directly involved in the coercive transplantation of human organs or bodily tissue? | 2 | pass |
| us | DS160 | Security and Background: Part 3 | has_coercive_transplant_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 4 | has_immigration_fraud | radio | 您是否曾通过欺诈、故意虚假陈述或其他非法手段试图获取或协助他人获取签证、入境美国或其他移民福利？ | Have you ever sought to obtain or assist others to obtain a visa, entry into the United States, or any other United States immigration benefit by fraud or willful misrepresentation or other unlawful means? | 2 | pass |
| us | DS160 | Security and Background: Part 4 | has_immigration_fraud_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 4 | has_removal_order | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been removed or deported from any country? | 2 | pass |
| us | DS160 | Security and Background: Part 4 | has_removal_order_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 5 | has_withheld_child_custody | radio | 是否儿童？ | Have you ever withheld custody of a U.S. citizen child outside the United States from a person granted legal custody by a U.S. court? | 2 | pass |
| us | DS160 | Security and Background: Part 5 | has_withheld_child_custody_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 5 | has_voted_illegally | radio | 您是否曾违反任何法律法规在美国投票？ | Have you voted in the United States in violation of any law or regulation? | 2 | pass |
| us | DS160 | Security and Background: Part 5 | has_voted_illegally_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| us | DS160 | Security and Background: Part 5 | has_renounced_citizenship | radio | 您是否曾为避税目的而放弃美国国籍？ | Have you ever renounced United States citizenship for the purposes of avoiding taxation? | 2 | pass |
| us | DS160 | Security and Background: Part 5 | has_renounced_citizenship_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| egypt | EG_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| egypt | EG_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| egypt | EG_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| egypt | EG_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| egypt | EG_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| egypt | EG_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| egypt | EG_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| egypt | EG_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| egypt | EG_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| egypt | EG_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| egypt | EG_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| egypt | EG_E_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| egypt | EG_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| egypt | EG_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| egypt | EG_E_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| egypt | EG_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| egypt | EG_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| egypt | EG_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| egypt | EG_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| egypt | EG_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| egypt | EG_E_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| egypt | EG_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| egypt | EG_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| egypt | EG_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| egypt | EG_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| egypt | EG_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| egypt | EG_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| egypt | EG_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| egypt | EG_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| egypt | EG_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| egypt | EG_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| egypt | EG_E_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| egypt | EG_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 2 | pass |
| egypt | EG_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Egypt | 1 | pass |
| egypt | EG_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Egypt | 0 | pass |
| egypt | EG_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per visit) | 0 | pass |
| egypt | EG_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 11 | pass |
| egypt | EG_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| egypt | EG_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| egypt | EG_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Egypt | 6 | pass |
| egypt | EG_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| egypt | EG_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Egypt | 0 | pass |
| egypt | EG_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City in Egypt | 0 | pass |
| egypt | EG_E_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| egypt | EG_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| egypt | EG_E_VISA | Host in Egypt | has_host_in_egypt | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Egypt? | 2 | pass |
| egypt | EG_E_VISA | Host in Egypt | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| egypt | EG_E_VISA | Host in Egypt | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| egypt | EG_E_VISA | Host in Egypt | host_address | text | 接待方地址 | Host — Address in Egypt | 0 | pass |
| egypt | EG_E_VISA | Host in Egypt | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| egypt | EG_E_VISA | Host in Egypt | host_nationality | country | 接待方国籍 | Host — Nationality | 0 | pass |
| egypt | EG_E_VISA | Travel History | visited_egypt_before | radio | 是否曾访问埃及？ | Have you ever visited Egypt before? | 2 | pass |
| egypt | EG_E_VISA | Travel History | prior_egypt_visit_arrival_date | date | 访问抵达日期 | Prior Egypt visit — Arrival date | 0 | pass |
| egypt | EG_E_VISA | Travel History | prior_egypt_visit_departure_date | date | 访问离开日期 | Prior Egypt visit — Departure date | 0 | pass |
| egypt | EG_E_VISA | Travel History | prior_egypt_visit_purpose | text | 访问目的 | Prior Egypt visit — Purpose | 0 | pass |
| egypt | EG_E_VISA | Travel History | refused_visa_or_entry_egypt | radio | 是否曾被埃及拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Egypt? | 2 | pass |
| egypt | EG_E_VISA | Travel History | refused_visa_egypt_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| egypt | EG_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| egypt | EG_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| egypt | EG_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| egypt | EG_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| egypt | EG_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Egypt or any other country? | 2 | pass |
| egypt | EG_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| egypt | EG_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, or any activity that might endanger public order or national security? | 2 | pass |
| egypt | EG_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| egypt | EG_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| egypt | EG_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Arab Republic of Egypt. | 1 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname | text | 姓氏（与护照一致） | Surname (family name) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth_different | radio | 是否姓氏出生？ | Is your surname at birth different from your current surname? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth | text | 姓氏出生 | Surname at birth (former family name(s)) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | given_names | text | 名字（与护照一致） | First name(s) (given name(s)) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | place_of_birth | text | 出生地点（城市/地区） | Place of birth (city or town) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | current_nationality | country | 当前国籍 | Current nationality | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth_different | radio | 出生时国籍是否与当前国籍不同？ | Is your nationality at birth different from your current nationality? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth | country | 出生时国籍 | Nationality at birth | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationalities? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | sex | select | 性别 | Sex | 3 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status | select | 婚姻/民事伴侣状态 | Civil status | 7 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status_other | text | 请说明您的婚姻状况 | Please specify your civil status | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Personal Details | is_applicant_minor | radio | 是否申请人？ | Will you be under 18 on the date you plan to travel to the Schengen Area? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_surname | text | 父母机构姓氏 | Surname of parental authority / legal guardian | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_given_names | text | 父母机构名字姓名 | First name(s) of parental authority / legal guardian | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_line_1 | text | 父母机构地址行 | Address — line 1 (if different from applicant's) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_city | text | 城市 | City | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_country | country | 国家 | Country | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_phone | text | 父母机构电话 | Telephone number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_email | text | 父母机构邮箱 | E-mail address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_nationality | country | 父母机构国籍 | Nationality | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | has_national_id | radio | 国民身份证 | Do you have a national identity number? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | national_id_number | text | 国民身份证号码 | National identity number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type | select | 旅行证件类型 | Type of travel document | 6 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type_other | text | 旅行证件其他 | Please specify the travel document type | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_number | text | 旅行证件号码 | Travel document number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issue_date | date | 旅行证件签发日期 | Date of issue | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_expiry_date | date | 旅行证件有效期至 | Valid until | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issuing_country | country | 旅行证件签发国家/地区 | Issued by (country) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | has_eu_family_member | radio | 是否家庭成员？ | Are you a family member of an EU, EEA or Swiss citizen, or of a UK national who is a beneficiary of the EU-UK Withdrawal Agreement? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_surname | text | 欧盟家庭姓氏 | Surname of the EU/EEA/CH family member | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_given_names | text | 欧盟家庭名字姓名 | First name(s) of the EU/EEA/CH family member | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_nationality | country | 欧盟家庭国籍 | Nationality | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_type | select | 欧盟家庭旅行证件 | Type of travel document or ID card | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_number | text | 欧盟家庭旅行证件号码 | Travel document / ID card number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_relationship | select | 欧盟家庭关系 | Family relationship | 6 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 家庭成员欧盟欧洲经济区瑞士公民英国国民申请签证 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_city | text | 城镇或城市 | Town or city | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_postcode | text | 邮政编码 | Postcode / ZIP code | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_country | country | 国家 | Country | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | email_address | text | 电子邮箱地址 | E-mail address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | phone_number | text | 电话号码 | Telephone number (including country code) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country_different | radio | 是否居住国家/地区？ | Do you reside in a country other than your country of current nationality? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country | country | 居住国家 | Country of residence | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_number | text | 居留许可或同等证件号码 | Residence permit or equivalent number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_expiry_date | date | 居留许可有效期至 | Residence permit valid until | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | is_student | radio | 您是否是学生？ | Are you a student? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_name | text | 雇主名称 | Employer name | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_address_line_1 | text | 雇主地址行 | Employer address — line 1 | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_city | text | 雇主城市 | Employer city | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_country | country | 雇主国家 | Employer country | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_phone | text | 雇主电话 | Employer telephone number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | school_name | text | 学校名称 | Name of educational establishment | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | school_address | text | 学校地址 | Address of educational establishment | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Occupation | school_phone | text | 学校电话 | Telephone number of educational establishment | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_of_journey | select | 本次旅行目的 | Main purpose of the journey | 10 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_additional_info | textarea | 停留目的补充信息 | Additional information on the purpose of stay | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | main_destination_country | country | 主要目的地成员国 | Member State of main destination | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | first_entry_country | country | 首次入境成员国 | Member State of first entry | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | number_of_entries_requested | select | 申请入境次数 | Number of entries requested | 3 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_duration_days | text | 预计停留或过境时长（天数） | Duration of the intended stay or transit (number of days) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in the Schengen Area | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from the Schengen Area | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_surname | text | 邀请人/接待方姓氏 | Host's surname | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_given_names | text | 邀请人/接待方名字 | Host's first name(s) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_relationship | text | 邀请人/接待方与申请人的关系 | Relationship to the host | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_address_line_1 | text | 邀请人/接待方地址第一行 | Host's address — line 1 | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_city | text | 邀请人/接待方所在城市 | Host's city | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_country | country | 邀请人/接待方所在国家 | Host's country (Schengen Member State) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_phone | text | 邀请人/接待方电话 | Host's telephone number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_email | text | 邀请人/接待方电子邮箱 | Host's e-mail address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_nationality | country | 接待方国籍 | Host's nationality | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_legal_status_schengen | select | 接待方法定状态申根 | Host's legal status in the Schengen Area | 4 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_name | text | 商务公司 | Inviting company / organisation name | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_address_line_1 | text | 商务公司地址行 | Company address — line 1 | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_city | text | 商务公司城市 | Company city | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_country | country | 商务公司国家 | Company country (Schengen Member State) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_phone | text | 商务公司电话 | Company telephone number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_surname | text | 商务联系人姓氏 | Company contact surname | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_given_names | text | 商务联系人名字姓名 | Company contact first name(s) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_email | text | 商务联系人邮箱 | Company contact e-mail | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_address | text | 商务联系人地址 | Company contact address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_phone | text | 商务联系人电话 | Company contact telephone number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_invitation_letter_held | radio | 是否商务？ | Do you have a formal invitation letter from the company? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_name | text | 学习机构 | Name of the educational institution | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_address | text | 学习机构地址 | Institution address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_country | country | 学习机构国家 | Institution country (Schengen Member State) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_name | text | 学习 | Course or programme name | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_start_date | date | 学习开始日期 | Course start date | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_duration | text | 学习 | Course duration | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_acceptance_letter_held | radio | 学习 | Do you have an acceptance letter from the institution? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_name | text | 医疗 | Name of the hospital or clinic | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_address | text | 医疗地址 | Hospital or clinic address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_country | country | 医疗国家 | Hospital or clinic country (Schengen Member State) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_type | text | 医疗 | Type of treatment | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_start_date | date | 医疗开始日期 | Treatment start date | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_duration | text | 医疗 | Treatment duration | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_costs_prepaid | radio | 医疗预付 | Have treatment costs been prepaid or confirmed by the facility? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_name | text | 活动 | Name of the event | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_organizer | text | 活动 | Event organiser | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_location | text | 活动 | Event location (city and venue) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_country | country | 活动国家 | Event country (Schengen Member State) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_start_date | date | 活动开始日期 | Event start date | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_end_date | date | 活动结束日期 | Event end date | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_invitation_letter_held | radio | 活动 | Do you have an invitation letter from the organiser? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_country | country | 过境目的地国家 | Final destination country (outside Schengen) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_onward_ticket_held | radio | 过境 | Do you hold a confirmed onward flight ticket? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_visa_held | radio | 是否签证？ | Do you hold an entry visa for the final destination (if required)? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | other_purpose_explain | textarea | 其他目的 | Please describe the purpose of your journey | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | tourism_itinerary_summary | textarea | 旅游 | Brief summary of your planned itinerary | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_airside_only | radio | 过境区域申根机场 | Will you remain in the international transit area of the Schengen airport(s) without passing through immigration? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 签证国籍机场过境签证过境申根 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_type | select | 住宿类型 | Type of accommodation in the Schengen Area | 4 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_name | text | 住宿地点或接待方名称 | Hotel name or accommodation label | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_address_line_1 | text | 住宿地址——第1行 | Accommodation address — line 1 | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_city | text | 城市 | City | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_country | country | 住宿国家 | Country (Schengen Member State) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_phone | text | 住宿联系电话 | Accommodation telephone number | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_email | text | 住宿电子邮箱 | Accommodation e-mail address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | hotel_confirmation_number | text | 酒店/预订确认号（如有） | Hotel / booking confirmation number (if available) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_other_explain | textarea | 住宿其他 | Please describe your accommodation arrangements | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | prior_schengen_visa_5y | radio | 是否签证？ | Have you held a Schengen visa in the last 5 years? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | prior_schengen_visa_valid_from | date | 申根签证有效 | Last Schengen visa — valid from | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | prior_schengen_visa_valid_to | date | 申根签证有效 | Last Schengen visa — valid until | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_schengen_fingerprints_given | radio | 是否名字？ | Have your fingerprints been collected previously for the purpose of applying for a Schengen visa? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_date | date | 日期 | Date fingerprints were collected (if known) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_visa_sticker | text | 签证 | Number of the visa (if known) | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | has_entry_permit_final_destination | radio | 是否入境许可最终？ | Do you hold an entry permit for the final country of destination (where applicable)? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_issuing_authority | text | 入境许可签发机构 | Entry permit — issued by | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_from | date | 入境许可有效 | Entry permit — valid from | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_until | date | 入境许可有效至 | Entry permit — valid until | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa | radio | 是否曾被拒发申根签证？ | Have you ever been refused a Schengen visa? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please provide details of the refusal | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | cost_covered_by | select | 谁将承担本次旅行和停留费用？ | Who will cover the cost of travelling and living during your stay? | 3 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_cash | radio | 方式现金 | Self: cash | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_travellers_cheques | radio | 方式旅行支票 | Self: traveller's cheques | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_credit_card | radio | 方式信用卡 | Self: credit card | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_accommodation | radio | 方式预付住宿 | Self: pre-paid accommodation | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_transport | radio | 方式预付交通 | Self: pre-paid transport | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other | radio | 方式其他 | Self: other means of support | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other_explain | text | 方式其他 | Please describe the other means of support | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_type | select | 担保人/资助方类型 | Type of sponsor | 4 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_name | text | 担保人/资助方名称 | Sponsor name | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_relationship | text | 担保人/资助方与申请人的关系 | Relationship to sponsor | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_address | text | 担保人/资助方地址 | Sponsor address | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_cash | radio | 担保人方式现金 | Sponsor: cash | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_accommodation_provided | radio | 担保人方式住宿 | Sponsor: accommodation provided | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_all_expenses_covered | radio | 担保人方式 | Sponsor: all expenses covered during the stay | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_prepaid_transport | radio | 担保人方式预付交通 | Sponsor: pre-paid transport | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other | radio | 担保人方式其他 | Sponsor: other means of support | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other_explain | text | 担保人方式其他 | Please describe the other sponsor means of support | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | has_different_filler | radio | 本申请是否由申请人本人以外的其他人填写？ | Is the application being filled in by someone other than the applicant? | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_surname | text | 填表人姓氏 | Surname of the person filling in the application form | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_given_names | text | 填表人名字 | First name(s) of the person filling in the application form | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_address | text | 填表人地址 | Address of the person filling in the application form | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_email | text | 填表人电子邮箱 | E-mail address of the person filling in the application form | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_phone | text | 填表人电话号码 | Telephone number of the person filling in the application form | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | place_of_application | text | 申请提交地点 / 当前申请所在地 | Place of application | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | 0 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_fee_not_refunded_awareness | radio | 我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。 | I am aware that the visa fee is not refunded if the visa is refused. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_insurance_multi_entry_awareness | radio | 我已知悉：如获发多次入境签证，每次进入成员国领土时均需持有足够的旅行医疗保险。 | Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_vis_consent | radio | 我已知悉并同意签证申请数据、照片和指纹的收集、处理与保存 | I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_data_rights_awareness | radio | 我已知悉我对 VIS 中个人数据的查询、更正和依法删除权利 | I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_truthfulness | radio | 我声明本申请所填信息真实、正确且完整 | I declare that to the best of my knowledge all particulars supplied by me are correct and complete. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_awareness_refusal | radio | 我已知悉虚假陈述可能导致拒签、已发签证被撤销并承担法律责任 | I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_undertaking_to_leave | radio | 我承诺在获发签证的有效期届满前离开成员国领土 | I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States. | 2 | pass |
| schengen | EU_SCHENGEN_C_SHORT_STAY | Declaration | additional_information | textarea | 补充说明 / 其他可能影响本次申请的信息 | Is there anything else you would like to tell us about your application? | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) — in English | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names — in English | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | name_in_chinese | text | 名称 | Name in Chinese characters (if applicable) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| hong_kong | HK_VISIT_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| hong_kong | HK_VISIT_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| hong_kong | HK_VISIT_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| hong_kong | HK_VISIT_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| hong_kong | HK_VISIT_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| hong_kong | HK_VISIT_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| hong_kong | HK_VISIT_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| hong_kong | HK_VISIT_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| hong_kong | HK_VISIT_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| hong_kong | HK_VISIT_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| hong_kong | HK_VISIT_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| hong_kong | HK_VISIT_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| hong_kong | HK_VISIT_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 3 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Hong Kong | 1 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Hong Kong | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 11 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | flight_number | text | 号码 | Flight or train number (if known) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Hong Kong | 5 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or property | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Hong Kong | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | accommodation_district | text | 住宿 | District in Hong Kong | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| hong_kong | HK_VISIT_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| hong_kong | HK_VISIT_VISA | Host in Hong Kong | has_host_in_hong_kong | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Hong Kong? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Host in Hong Kong | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| hong_kong | HK_VISIT_VISA | Host in Hong Kong | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| hong_kong | HK_VISIT_VISA | Host in Hong Kong | host_address | text | 接待方地址 | Host — Address in Hong Kong | 0 | pass |
| hong_kong | HK_VISIT_VISA | Host in Hong Kong | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Host in Hong Kong | host_hkid_or_passport | text | 接待方护照 | Host — HKID number or passport number | 0 | pass |
| hong_kong | HK_VISIT_VISA | Host in Hong Kong | host_nationality | country | 接待方国籍 | Host — Nationality / Status in HK | 0 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | visited_hong_kong_before | radio | 是否曾访问香港？ | Have you ever visited Hong Kong before? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | prior_hk_visit_arrival_date | date | 访问抵达日期 | Prior Hong Kong visit — Arrival date | 0 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | prior_hk_visit_departure_date | date | 访问离开日期 | Prior Hong Kong visit — Departure date | 0 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | prior_hk_visit_purpose | text | 访问目的 | Prior Hong Kong visit — Purpose | 0 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | refused_visa_or_entry_hong_kong | radio | 是否曾被香港拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Hong Kong? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | refused_visa_hk_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Hong Kong or any other country? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| hong_kong | HK_VISIT_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Hong Kong Special Administrative Region of the People's Republic of China. | 1 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, aliases)? | 2 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | id_card_number | text | 身份证卡号码 | National ID number (if your country issues one) | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | spouse_date_of_birth | date | 日期出生 | Spouse — Date of birth | 0 | pass |
| indonesia | ID_C1_TOURIST | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | passport_number | text | 护照号码 | Passport / travel document number | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | passport_type | select | 护照类型 | Document type | 5 | pass |
| indonesia | ID_C1_TOURIST | Passport | passport_country | country | 护照国家 | Passport / document — Issuing country | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | passport_place_of_issue | text | 签发地点 | Place of issue | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | passport_issuing_authority | text | 护照签发机关/签发地点 | Issuing authority | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | 2 | pass |
| indonesia | ID_C1_TOURIST | Passport | other_passport_number | text | 其他护照号码 | Other passport — Number | 0 | pass |
| indonesia | ID_C1_TOURIST | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postcode | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| indonesia | ID_C1_TOURIST | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| indonesia | ID_C1_TOURIST | Occupation | current_profession | select | 当前 | Current profession or occupation | 7 | pass |
| indonesia | ID_C1_TOURIST | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| indonesia | ID_C1_TOURIST | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| indonesia | ID_C1_TOURIST | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| indonesia | ID_C1_TOURIST | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Indonesia | 1 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Indonesia | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay in Indonesia (days, max 60) | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | port_of_entry | text | 入境 | Port of entry into Indonesia | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | carrier_name | text | 名称 | Name of airline or carrier | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | flight_or_voyage_number | text | 号码 | Flight or voyage number | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Indonesia | 4 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel / villa / host | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address of accommodation in Indonesia | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | accommodation_city_or_district | text | 住宿城市 | City or district in Indonesia | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of hotel or host | 0 | pass |
| indonesia | ID_C1_TOURIST | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | has_sponsor_in_indonesia | radio | 是否担保人/资助方？ | Do you have a sponsor or guarantor in Indonesia? | 2 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_type | select | 担保人/资助方类型 | Sponsor — Type | 2 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_individual_full_name | text | 担保人 | Sponsor — Full name (individual) | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_individual_nik | text | 担保人 | Sponsor — Indonesian NIK (KTP number) | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_individual_relationship | text | 担保人关系 | Sponsor — Relationship to applicant | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_corporate_name | text | 担保人 | Sponsor — Company / institution name | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_corporate_nib | text | 担保人 | Sponsor — Indonesian Business Registration (NIB) | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_corporate_npwp | text | 担保人 | Sponsor — Indonesian Tax ID (NPWP) | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_corporate_pic_name | text | 担保人 | Sponsor — Person in charge (PIC) name | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_address | text | 担保人/资助方地址 | Sponsor — Address in Indonesia | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_phone | text | 担保人电话 | Sponsor — Telephone (incl. country/area code) | 0 | pass |
| indonesia | ID_C1_TOURIST | Sponsor in Indonesia | sponsor_email | text | 担保人邮箱 | Sponsor — Email | 0 | pass |
| indonesia | ID_C1_TOURIST | Travel History | visited_indonesia_before | radio | 是否曾访问？ | Have you ever stayed in Indonesia before? | 2 | pass |
| indonesia | ID_C1_TOURIST | Travel History | prior_indonesia_visit_arrival_date | date | 访问抵达日期 | Prior Indonesia visit — Arrival date | 0 | pass |
| indonesia | ID_C1_TOURIST | Travel History | prior_indonesia_visit_departure_date | date | 访问离开日期 | Prior Indonesia visit — Departure date | 0 | pass |
| indonesia | ID_C1_TOURIST | Travel History | prior_indonesia_visit_purpose | text | 访问目的 | Prior Indonesia visit — Purpose | 0 | pass |
| indonesia | ID_C1_TOURIST | Travel History | prior_indonesia_visit_visa_type | text | 访问签证 | Prior Indonesia visit — Visa type used | 0 | pass |
| indonesia | ID_C1_TOURIST | Travel History | refused_visa_or_entry_indonesia | radio | 是否曾被印度尼西亚拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Indonesia? | 2 | pass |
| indonesia | ID_C1_TOURIST | Travel History | refused_visa_indonesia_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| indonesia | ID_C1_TOURIST | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| indonesia | ID_C1_TOURIST | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Indonesia or any other country? | 2 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | has_overstayed_indonesia | radio | 签证 | Have you ever overstayed a visa or stayed in Indonesia illegally? | 2 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | overstay_details | textarea | 请提供本题要求的具体情况 | Provide details | 0 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | has_drug_or_trafficking_history | radio | 是否记录？ | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | 2 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| indonesia | ID_C1_TOURIST | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa, denial of entry, or deportation from Indonesia. | 1 | pass |
| india | IN_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| india | IN_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| india | IN_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| india | IN_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| india | IN_E_VISA | Personal Information | sex | select | 性别 | Sex | 3 | pass |
| india | IN_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| india | IN_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town / Village | 0 | pass |
| india | IN_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| india | IN_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| india | IN_E_VISA | Personal Information | religion | select | 请填写：Religion | Religion | 10 | pass |
| india | IN_E_VISA | Personal Information | saarc_nationality | radio | 是否国籍？ | Are you a SAARC national or were you ever a citizen of a SAARC country (Bangladesh, Bhutan, Nepal, Pakistan, Sri Lanka, Maldives, Afghanistan)? | 2 | pass |
| india | IN_E_VISA | Personal Information | saarc_country_visit_history | textarea | 国家访问 | Provide details of SAARC-country residence / citizenship history | 0 | pass |
| india | IN_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| india | IN_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| india | IN_E_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| india | IN_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| india | IN_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| india | IN_E_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| india | IN_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| india | IN_E_VISA | Personal Information | father_nationality | country | 国籍 | Father's nationality | 0 | pass |
| india | IN_E_VISA | Personal Information | father_place_of_birth | text | 地点出生 | Father's place of birth (city, country) | 0 | pass |
| india | IN_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| india | IN_E_VISA | Personal Information | mother_nationality | country | 是否持有或曾持有其他国籍？ | Mother's nationality | 0 | pass |
| india | IN_E_VISA | Personal Information | mother_place_of_birth | text | 地点出生 | Mother's place of birth (city, country) | 0 | pass |
| india | IN_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| india | IN_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| india | IN_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| india | IN_E_VISA | Passport | passport_place_of_issue | text | 签发地点 | Place of issue | 0 | pass |
| india | IN_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| india | IN_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| india | IN_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport (incl. Pakistan / Bangladesh)? | 2 | pass |
| india | IN_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| india | IN_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| india | IN_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — House / Street | 0 | pass |
| india | IN_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| india | IN_E_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| india | IN_E_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code / ZIP | 0 | pass |
| india | IN_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| india | IN_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| india | IN_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| india | IN_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 10 | pass |
| india | IN_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| india | IN_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| india | IN_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| india | IN_E_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| india | IN_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 7 | pass |
| india | IN_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to India | 5 | pass |
| india | IN_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in India | 0 | pass |
| india | IN_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 180) | 0 | pass |
| india | IN_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 19 | pass |
| india | IN_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| india | IN_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| india | IN_E_VISA | Trip Details | cities_to_visit | textarea | 访问 | Cities / Places intended to visit in India | 0 | pass |
| india | IN_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in India | 8 | pass |
| india | IN_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or property (first stop) | 0 | pass |
| india | IN_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in India (first stop) | 0 | pass |
| india | IN_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / State in India (first stop) | 0 | pass |
| india | IN_E_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| india | IN_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 7 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_business_company_name | text | 商务公司 | Indian business invitee — Company name | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_business_address | text | 商务地址 | Indian business invitee — Address | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_business_phone | text | 商务电话 | Indian business invitee — Phone | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_business_purpose | textarea | 商务目的 | Nature of business activity | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_medical_hospital_name | text | 医疗医院 | Indian hospital — Name | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_medical_hospital_address | text | 医疗医院地址 | Indian hospital — Address | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_medical_hospital_phone | text | 医疗医院电话 | Indian hospital — Phone | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_medical_treatment_purpose | textarea | 医疗目的 | Nature of medical treatment | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_conference_name | text | 大会 | Conference — Name | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_conference_dates | text | 大会 | Conference — Dates | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_conference_organiser | text | 大会 | Conference — Organiser | 0 | pass |
| india | IN_E_VISA | Purpose-Specific Details | in_conference_mea_clearance_number | text | 大会号码 | Conference — MEA political clearance number | 0 | pass |
| india | IN_E_VISA | Host in India | has_host_in_india | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in India? | 2 | pass |
| india | IN_E_VISA | Host in India | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| india | IN_E_VISA | Host in India | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| india | IN_E_VISA | Host in India | host_address | text | 接待方地址 | Host — Address in India | 0 | pass |
| india | IN_E_VISA | Host in India | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| india | IN_E_VISA | Host in India | host_aadhaar_or_passport | text | 接待方护照 | Host — Aadhaar / PAN / passport number | 0 | pass |
| india | IN_E_VISA | Travel History | visited_india_before | radio | 是否曾访问印度？ | Have you ever visited India before? | 2 | pass |
| india | IN_E_VISA | Travel History | prior_in_visit_arrival_date | date | 访问抵达日期 | Prior India visit — Arrival date | 0 | pass |
| india | IN_E_VISA | Travel History | prior_in_visit_departure_date | date | 访问离开日期 | Prior India visit — Departure date | 0 | pass |
| india | IN_E_VISA | Travel History | prior_in_visit_purpose | text | 访问目的 | Prior India visit — Purpose | 0 | pass |
| india | IN_E_VISA | Travel History | prior_in_visa_number | text | 签证号码 | Prior India visit — Visa number (if known) | 0 | pass |
| india | IN_E_VISA | Travel History | refused_visa_or_entry_india | radio | 是否曾被印度拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, India? | 2 | pass |
| india | IN_E_VISA | Travel History | refused_visa_in_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| india | IN_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| india | IN_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| india | IN_E_VISA | Travel History | countries_visited_last_10_years | textarea | 曾访问 | Countries visited in the last 10 years | 0 | pass |
| india | IN_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| india | IN_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| india | IN_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from India or any other country? | 2 | pass |
| india | IN_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| india | IN_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| india | IN_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| india | IN_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| india | IN_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of India. | 1 | pass |
| japan | JP_TOURIST | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| japan | JP_TOURIST | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| japan | JP_TOURIST | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, pen names, aliases)? | 2 | pass |
| japan | JP_TOURIST | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| japan | JP_TOURIST | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| japan | JP_TOURIST | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| japan | JP_TOURIST | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| japan | JP_TOURIST | Personal Information | place_of_birth_state | text | 地点出生州 | Place of birth — State / Province | 0 | pass |
| japan | JP_TOURIST | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| japan | JP_TOURIST | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| japan | JP_TOURIST | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| japan | JP_TOURIST | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| japan | JP_TOURIST | Personal Information | id_card_number | text | 身份证卡号码 | ID number issued to you (if your country requires one) | 0 | pass |
| japan | JP_TOURIST | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| japan | JP_TOURIST | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| japan | JP_TOURIST | Personal Information | spouse_date_of_birth | date | 日期出生 | Spouse — Date of birth | 0 | pass |
| japan | JP_TOURIST | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| japan | JP_TOURIST | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| japan | JP_TOURIST | Passport | passport_type | select | 护照类型 | Passport type | 4 | pass |
| japan | JP_TOURIST | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| japan | JP_TOURIST | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| japan | JP_TOURIST | Passport | passport_place_of_issue | text | 签发地点 | Place of issue | 0 | pass |
| japan | JP_TOURIST | Passport | passport_issuing_authority | text | 护照签发机关/签发地点 | Issuing authority | 0 | pass |
| japan | JP_TOURIST | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | 2 | pass |
| japan | JP_TOURIST | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| japan | JP_TOURIST | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| japan | JP_TOURIST | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| japan | JP_TOURIST | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| japan | JP_TOURIST | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country | 0 | pass |
| japan | JP_TOURIST | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| japan | JP_TOURIST | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| japan | JP_TOURIST | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| japan | JP_TOURIST | Occupation | current_profession | select | 当前 | Current profession or occupation | 7 | pass |
| japan | JP_TOURIST | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| japan | JP_TOURIST | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| japan | JP_TOURIST | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| japan | JP_TOURIST | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| japan | JP_TOURIST | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Japan | 1 | pass |
| japan | JP_TOURIST | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Japan | 0 | pass |
| japan | JP_TOURIST | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay in Japan (days) | 0 | pass |
| japan | JP_TOURIST | Trip Details | port_of_entry | text | 入境 | Port of entry into Japan | 0 | pass |
| japan | JP_TOURIST | Trip Details | carrier_name | text | 名称 | Name of ship or airline | 0 | pass |
| japan | JP_TOURIST | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Japan | 4 | pass |
| japan | JP_TOURIST | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or person hosting you | 0 | pass |
| japan | JP_TOURIST | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address of hotel or host in Japan | 0 | pass |
| japan | JP_TOURIST | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of hotel or host | 0 | pass |
| japan | JP_TOURIST | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| japan | JP_TOURIST | Inviter in Japan | has_inviter_in_japan | radio | 邀请人 | Do you have an inviter or guarantor in Japan? | 2 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_full_name | text | 邀请人 | Inviter — Full name | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_address | text | 邀请人地址 | Inviter — Address in Japan | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_phone | text | 邀请人电话 | Inviter — Telephone (incl. country/area code) | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_date_of_birth | date | 邀请人日期出生 | Inviter — Date of birth | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_sex | select | 邀请人 | Inviter — Sex | 2 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_nationality | country | 邀请人国籍 | Inviter — Nationality | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_occupation | text | 邀请人职业 | Inviter — Occupation | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_employer | text | 邀请人雇主 | Inviter — Name & address of employer in Japan | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_relationship_to_applicant | text | 邀请人关系 | Inviter — Relationship to applicant | 0 | pass |
| japan | JP_TOURIST | Inviter in Japan | inviter_immigration_status | text | 邀请人状态 | Inviter — Immigration status in Japan (foreign nationals only) | 0 | pass |
| japan | JP_TOURIST | Travel History | visited_japan_before | radio | 是否曾访问？ | Have you ever stayed in Japan before? | 2 | pass |
| japan | JP_TOURIST | Travel History | prior_japan_visit_arrival_date | date | 访问抵达日期 | Prior Japan visit — Arrival date | 0 | pass |
| japan | JP_TOURIST | Travel History | prior_japan_visit_departure_date | date | 访问离开日期 | Prior Japan visit — Departure date | 0 | pass |
| japan | JP_TOURIST | Travel History | prior_japan_visit_purpose | text | 访问目的 | Prior Japan visit — Purpose | 0 | pass |
| japan | JP_TOURIST | Travel History | refused_visa_or_entry_japan | radio | 是否曾被日本拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Japan? | 2 | pass |
| japan | JP_TOURIST | Travel History | refused_visa_japan_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| japan | JP_TOURIST | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| japan | JP_TOURIST | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| japan | JP_TOURIST | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| japan | JP_TOURIST | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| japan | JP_TOURIST | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Japan or any other country? | 2 | pass |
| japan | JP_TOURIST | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| japan | JP_TOURIST | Character & Declaration | has_overstayed_japan | radio | 签证 | Have you ever overstayed a visa or stayed in Japan illegally? | 2 | pass |
| japan | JP_TOURIST | Character & Declaration | overstay_details | textarea | 请提供本题要求的具体情况 | Provide details | 0 | pass |
| japan | JP_TOURIST | Character & Declaration | has_drug_or_trafficking_history | radio | 是否记录？ | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | 2 | pass |
| japan | JP_TOURIST | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| japan | JP_TOURIST | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| japan | JP_TOURIST | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | 1 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| cambodia | KH_TOURIST_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 1 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Cambodia | 1 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Cambodia | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30) | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 10 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Cambodia | 6 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Cambodia | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Cambodia | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| cambodia | KH_TOURIST_E_VISA | Host in Cambodia | has_host_in_cambodia | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Cambodia? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Host in Cambodia | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Host in Cambodia | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Host in Cambodia | host_address | text | 接待方地址 | Host — Address in Cambodia | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Host in Cambodia | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | visited_cambodia_before | radio | 是否曾访问柬埔寨？ | Have you ever visited Cambodia before? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | prior_kh_visit_arrival_date | date | 访问抵达日期 | Prior Cambodia visit — Arrival date | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | prior_kh_visit_departure_date | date | 访问离开日期 | Prior Cambodia visit — Departure date | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | prior_kh_visit_purpose | text | 访问目的 | Prior Cambodia visit — Purpose | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | refused_visa_or_entry_cambodia | radio | 是否曾被柬埔寨拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Cambodia? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | refused_visa_kh_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Cambodia or any other country? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| cambodia | KH_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Cambodia. | 1 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | family_name_en | text | 家庭 | Family name (in passport, block letters) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | given_names_en | text | 名字姓名 | Given names (in passport, block letters) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | name_in_chinese_characters | text | Name in Chinese characters / 漢字姓名 | Name In Chinese Characters | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | sex | radio | 性别 | Sex | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | nationality | country | 国籍 | Nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | national_identity_no | text | 国民身份 | National Identity No. | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | has_used_other_names | radio | 是否其他姓名？ | Have you ever used other names to enter or depart Korea? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | other_family_name | text | 其他家庭 | Other family name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | other_given_name | text | 其他名字 | Other given name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | is_dual_national | radio | 国民 | Are you a citizen of more than one country? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Personal Details | other_nationalities | text | 是否持有或曾持有其他国籍？ | List the other countries of citizenship | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | period_of_stay | radio | 停留 | Period of Stay | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | status_of_stay | select | 状态停留 | Status of Stay | 1 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | passport_type | radio | 护照类型 | Passport type | 4 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | passport_type_other | text | 护照其他 | Passport type — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | passport_no | text | 护照号码 | Passport number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | passport_country | country | 护照国家 | Country of passport | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | passport_place_of_issue | text | 签发地点 | Place of issue | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | passport_date_of_issue | date | 签发日期 | Date of issue | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | passport_date_of_expiry | date | 到期日期 | Date of expiry | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | has_other_passport | radio | 是否其他护照？ | Do you currently hold any other valid passport? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | other_passport_type | radio | 其他护照 | Other passport — type | 4 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | other_passport_type_other | text | 其他护照其他 | Other passport — type other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | other_passport_no | text | 其他护照 | Other passport — number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | other_passport_country | country | 其他护照国家 | Other passport — country of passport | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Visa Category & Passport | other_passport_expiry | date | 其他护照到期 | Other passport — date of expiry | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | home_country_address | textarea | 国家地址 | Home country address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | current_address_same_as_home | radio | 是否当前地址家庭住址？ | Is your current residential address the same as your home country address? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | current_residential_address | textarea | 当前地址 | Current residential address (if different from home) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | cell_phone | text | 电话 | Cell phone (mobile) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | telephone | text | 电话 | Telephone (landline) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | email | text | 电子邮箱 | Email address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | emergency_full_name | text | 联系人 | Emergency contact — full name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | emergency_country_of_residence | country | 国家居住 | Emergency contact — country of residence | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | emergency_telephone | text | 联系人 | Emergency contact — telephone | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Contact & Emergency Contact | emergency_relationship | text | 关系 | Emergency contact — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | marital_status | radio | 婚姻状况 | Current marital status | 3 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_family_name_en | text | 家庭 | Spouse — family name (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_given_names_en | text | 名字姓名 | Spouse — given names (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_dob | date | 日期出生 | Spouse — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_nationality | country | 国籍 | Spouse — nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_address | textarea | 地址 | Spouse — residential address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_contact_no | text | 联系人 | Spouse — contact number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | has_children | radio | 是否儿童？ | Do you have any children? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Marital & Family | number_of_children | text | 号码 | Number of children | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education | radio | 教育 | Highest education completed | 4 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education_other | text | 教育其他 | Highest education — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | school_name | text | 学校名称 | Name of school (most recent) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | school_location | text | 学校 | School location (city / province / country) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | employment_status | radio | 工作状态 | Current occupation / employment status | 8 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | employment_status_other | text | 工作状态其他 | Employment status — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_name | text | 雇主名称 | Company / institution / school name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_position | text | 雇主 | Position / course | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_address | textarea | 雇主地址 | Company / institution / school address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_telephone | text | 雇主 | Company / institution / school telephone | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Trip & Visit | purpose_of_visit | select | 目的访问 | Purpose of visit to Korea | 11 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Trip & Visit | purpose_of_visit_other | text | 目的访问其他 | Purpose of visit — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Trip & Visit | intended_period_of_stay | text | 预计停留 | Intended period of stay (days) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Trip & Visit | intended_date_of_entry | date | 预计日期入境 | Intended date of entry into Korea | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Trip & Visit | address_in_korea | textarea | 地址 | Address in Korea (incl. hotels) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Trip & Visit | contact_in_korea | text | 联系人 | Contact number in Korea | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelled_to_korea_5y | radio | 请填写：Travelled To Korea 5y | Have you travelled to Korea in the last 5 years? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | korea_visit_count | text | 访问 | Number of times visited Korea (last 5 years) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | korea_visit_purpose | text | 访问目的 | Prior Korea visit — purpose | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | korea_visit_start_date | date | 访问开始日期 | Prior Korea visit — period start | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | korea_visit_end_date | date | 访问结束日期 | Prior Korea visit — period end | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelled_outside_5y | radio | 国家居住 | Have you travelled outside your country of residence (excl. Korea) in the last 5 years? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_country | country | 旅行国家 | Foreign trip — country | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_purpose | text | 旅行目的 | Foreign trip — purpose | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_start_date | date | 旅行开始日期 | Foreign trip — period start | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_end_date | date | 旅行结束日期 | Foreign trip — period end | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | has_family_in_korea | radio | 是否家庭？ | Do you have any family members currently staying in Korea? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_full_name | text | 家庭 | Family in Korea — full name (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_dob | date | 家庭 | Family in Korea — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_nationality | country | 家庭国籍 | Family in Korea — nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_relationship | text | 家庭关系 | Family in Korea — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelling_with_family | radio | 是否家庭？ | Are you travelling to Korea with any family members? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_full_name | text | 家庭 | Travelling-with family — full name (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_dob | date | 家庭 | Travelling-with family — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_nationality | country | 家庭国籍 | Travelling-with family — nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_relationship | text | 家庭关系 | Travelling-with family — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | has_inviter | radio | 邀请人 | Is anyone inviting you to Korea? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | inviter_name | text | 邀请人 | Inviter — name (person or organisation) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | inviter_dob_or_brn | text | 邀请人 | Inviter — date of birth or business registration number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | inviter_relationship | text | 邀请人关系 | Inviter — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | inviter_address | textarea | 邀请人地址 | Inviter — address in Korea | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | inviter_phone | text | 邀请人电话 | Inviter — phone number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | estimated_travel_costs_usd | text | 旅行 | Estimated travel costs (USD) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | payer_name | text | 人员机构 | Payer — name (person or organisation) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | payer_relationship | text | 关系 | Payer — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | payer_support_type | text | 支持 | Payer — type of support | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | payer_contact | text | 联系人 | Payer — contact number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | received_form_assistance | radio | 申请 | Did you receive assistance completing this application? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | assistant_full_name | text | 完整名称 | Assistant — full name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | assistant_dob | date | 日期出生 | Assistant — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | assistant_telephone | text | 电话 | Assistant — telephone | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | assistant_relationship | text | 关系 | Assistant — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT | Invitation, Funding & Declaration | declaration_consent | checkbox | 声明确认 | I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea. | 1 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| laos | LA_TOURIST_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| laos | LA_TOURIST_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| laos | LA_TOURIST_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| laos | LA_TOURIST_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| laos | LA_TOURIST_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| laos | LA_TOURIST_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| laos | LA_TOURIST_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| laos | LA_TOURIST_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| laos | LA_TOURIST_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| laos | LA_TOURIST_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| laos | LA_TOURIST_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| laos | LA_TOURIST_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| laos | LA_TOURIST_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| laos | LA_TOURIST_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| laos | LA_TOURIST_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| laos | LA_TOURIST_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 2 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Laos | 1 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Laos | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30) | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 13 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Laos | 4 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, guesthouse, or property | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Laos | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Laos | 0 | pass |
| laos | LA_TOURIST_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| laos | LA_TOURIST_E_VISA | Host in Laos | has_host_in_laos | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Laos? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Host in Laos | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| laos | LA_TOURIST_E_VISA | Host in Laos | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| laos | LA_TOURIST_E_VISA | Host in Laos | host_address | text | 接待方地址 | Host — Address in Laos | 0 | pass |
| laos | LA_TOURIST_E_VISA | Host in Laos | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | visited_laos_before | radio | 是否曾访问老挝？ | Have you ever visited Laos before? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | prior_la_visit_arrival_date | date | 访问抵达日期 | Prior Laos visit — Arrival date | 0 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | prior_la_visit_departure_date | date | 访问离开日期 | Prior Laos visit — Departure date | 0 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | prior_la_visit_purpose | text | 访问目的 | Prior Laos visit — Purpose | 0 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | refused_visa_or_entry_laos | radio | 是否曾被老挝拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Laos? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | refused_visa_la_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Laos or any other country? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security? | 2 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| laos | LA_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Lao People's Democratic Republic. | 1 | pass |
| sri_lanka | LK_ETA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| sri_lanka | LK_ETA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| sri_lanka | LK_ETA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| sri_lanka | LK_ETA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| sri_lanka | LK_ETA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| sri_lanka | LK_ETA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| sri_lanka | LK_ETA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| sri_lanka | LK_ETA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| sri_lanka | LK_ETA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| sri_lanka | LK_ETA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| sri_lanka | LK_ETA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| sri_lanka | LK_ETA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| sri_lanka | LK_ETA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| sri_lanka | LK_ETA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| sri_lanka | LK_ETA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| sri_lanka | LK_ETA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| sri_lanka | LK_ETA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| sri_lanka | LK_ETA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| sri_lanka | LK_ETA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| sri_lanka | LK_ETA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| sri_lanka | LK_ETA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| sri_lanka | LK_ETA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | visa_type_requested | radio | 签证 | ETA type requested | 4 | pass |
| sri_lanka | LK_ETA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Sri Lanka | 3 | pass |
| sri_lanka | LK_ETA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Sri Lanka | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per entry) | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 8 | pass |
| sri_lanka | LK_ETA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Sri Lanka | 6 | pass |
| sri_lanka | LK_ETA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of accommodation / first stop | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Sri Lanka | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | accommodation_city | text | 住宿城市 | City / District in Sri Lanka | 0 | pass |
| sri_lanka | LK_ETA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| sri_lanka | LK_ETA | Host in Sri Lanka | has_host_in_sri_lanka | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Sri Lanka? | 2 | pass |
| sri_lanka | LK_ETA | Host in Sri Lanka | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| sri_lanka | LK_ETA | Host in Sri Lanka | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| sri_lanka | LK_ETA | Host in Sri Lanka | host_address | text | 接待方地址 | Host — Address in Sri Lanka | 0 | pass |
| sri_lanka | LK_ETA | Host in Sri Lanka | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| sri_lanka | LK_ETA | Travel History | visited_sri_lanka_before | radio | 是否曾访问斯里兰卡？ | Have you ever visited Sri Lanka before? | 2 | pass |
| sri_lanka | LK_ETA | Travel History | prior_lk_visit_arrival_date | date | 访问抵达日期 | Prior Sri Lanka visit — Arrival date | 0 | pass |
| sri_lanka | LK_ETA | Travel History | prior_lk_visit_departure_date | date | 访问离开日期 | Prior Sri Lanka visit — Departure date | 0 | pass |
| sri_lanka | LK_ETA | Travel History | prior_lk_visit_purpose | text | 访问目的 | Prior Sri Lanka visit — Purpose | 0 | pass |
| sri_lanka | LK_ETA | Travel History | refused_visa_or_entry_sri_lanka | radio | 是否曾被斯里兰卡拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Sri Lanka? | 2 | pass |
| sri_lanka | LK_ETA | Travel History | refused_visa_lk_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| sri_lanka | LK_ETA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| sri_lanka | LK_ETA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| sri_lanka | LK_ETA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| sri_lanka | LK_ETA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| sri_lanka | LK_ETA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Sri Lanka or any other country? | 2 | pass |
| sri_lanka | LK_ETA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| sri_lanka | LK_ETA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security? | 2 | pass |
| sri_lanka | LK_ETA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| sri_lanka | LK_ETA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| sri_lanka | LK_ETA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Democratic Socialist Republic of Sri Lanka. | 1 | pass |
| macau | MO_VISIT_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) — in English / Portuguese | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names — in English / Portuguese | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | name_in_chinese | text | 名称 | Name in Chinese characters (if applicable) | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| macau | MO_VISIT_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| macau | MO_VISIT_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| macau | MO_VISIT_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| macau | MO_VISIT_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| macau | MO_VISIT_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| macau | MO_VISIT_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| macau | MO_VISIT_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| macau | MO_VISIT_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| macau | MO_VISIT_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| macau | MO_VISIT_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| macau | MO_VISIT_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| macau | MO_VISIT_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| macau | MO_VISIT_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| macau | MO_VISIT_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| macau | MO_VISIT_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| macau | MO_VISIT_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| macau | MO_VISIT_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| macau | MO_VISIT_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| macau | MO_VISIT_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 3 | pass |
| macau | MO_VISIT_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Macau | 1 | pass |
| macau | MO_VISIT_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Macau | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per entry) | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 9 | pass |
| macau | MO_VISIT_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ferry, or transport carrier | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Macau | 6 | pass |
| macau | MO_VISIT_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Macau | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| macau | MO_VISIT_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| macau | MO_VISIT_VISA | Host in Macau | has_host_in_macau | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Macau? | 2 | pass |
| macau | MO_VISIT_VISA | Host in Macau | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| macau | MO_VISIT_VISA | Host in Macau | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| macau | MO_VISIT_VISA | Host in Macau | host_address | text | 接待方地址 | Host — Address in Macau | 0 | pass |
| macau | MO_VISIT_VISA | Host in Macau | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| macau | MO_VISIT_VISA | Host in Macau | host_id_number | text | 接待方身份证号码 | Host — Macau Resident ID (BIR / BIRH) or passport number | 0 | pass |
| macau | MO_VISIT_VISA | Travel History | visited_macau_before | radio | 是否曾访问澳门？ | Have you ever visited Macau before? | 2 | pass |
| macau | MO_VISIT_VISA | Travel History | prior_macau_visit_arrival_date | date | 访问抵达日期 | Prior Macau visit — Arrival date | 0 | pass |
| macau | MO_VISIT_VISA | Travel History | prior_macau_visit_departure_date | date | 访问离开日期 | Prior Macau visit — Departure date | 0 | pass |
| macau | MO_VISIT_VISA | Travel History | prior_macau_visit_purpose | text | 访问目的 | Prior Macau visit — Purpose | 0 | pass |
| macau | MO_VISIT_VISA | Travel History | refused_visa_or_entry_macau | radio | 是否曾被澳门拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Macau? | 2 | pass |
| macau | MO_VISIT_VISA | Travel History | refused_visa_macau_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| macau | MO_VISIT_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| macau | MO_VISIT_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Macau or any other country? | 2 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| macau | MO_VISIT_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Macao Special Administrative Region of the People's Republic of China. | 1 | pass |
| maldives | MV_IMUGA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| maldives | MV_IMUGA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| maldives | MV_IMUGA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| maldives | MV_IMUGA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| maldives | MV_IMUGA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| maldives | MV_IMUGA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality? | 2 | pass |
| maldives | MV_IMUGA | Personal Information | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| maldives | MV_IMUGA | Personal Information | country_of_residence | country | 国家居住 | Country of current residence | 0 | pass |
| maldives | MV_IMUGA | Personal Information | mobile_number | text | 号码 | Mobile number | 0 | pass |
| maldives | MV_IMUGA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| maldives | MV_IMUGA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| maldives | MV_IMUGA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| maldives | MV_IMUGA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| maldives | MV_IMUGA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| maldives | MV_IMUGA | Trip Details | visa_type_requested | radio | 签证 | Declaration type | 1 | pass |
| maldives | MV_IMUGA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Maldives | 5 | pass |
| maldives | MV_IMUGA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Maldives | 0 | pass |
| maldives | MV_IMUGA | Trip Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from Maldives | 0 | pass |
| maldives | MV_IMUGA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30) | 0 | pass |
| maldives | MV_IMUGA | Trip Details | port_of_entry | select | 入境 | Port of arrival in Maldives | 7 | pass |
| maldives | MV_IMUGA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| maldives | MV_IMUGA | Trip Details | carrier_name | text | 名称 | Name of airline or carrier | 0 | pass |
| maldives | MV_IMUGA | Trip Details | flight_number | text | 号码 | Flight number | 0 | pass |
| maldives | MV_IMUGA | Trip Details | country_of_origin_for_trip | country | 国家旅行 | Country of origin for this trip (last departure country) | 0 | pass |
| maldives | MV_IMUGA | Accommodation | accommodation_type | select | 住宿类型 | Type of accommodation in Maldives | 6 | pass |
| maldives | MV_IMUGA | Accommodation | accommodation_name | text | 住宿地点或接待方名称 | Name of resort, hotel, guesthouse, or vessel | 0 | pass |
| maldives | MV_IMUGA | Accommodation | accommodation_atoll | text | 住宿 | Atoll | 0 | pass |
| maldives | MV_IMUGA | Accommodation | accommodation_island | text | 住宿 | Island name | 0 | pass |
| maldives | MV_IMUGA | Accommodation | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| maldives | MV_IMUGA | Health Declaration | has_health_symptoms | radio | 请填写：Has Health Symptoms | Do you currently have any of the following symptoms: fever, cough, breathing difficulty, diarrhoea, vomiting, rash, or jaundice? | 2 | pass |
| maldives | MV_IMUGA | Health Declaration | health_symptoms_details | textarea | 请提供本题要求的具体情况 | Provide details of symptoms (when started, severity) | 0 | pass |
| maldives | MV_IMUGA | Health Declaration | visited_outbreak_country_recent | radio | 是否曾访问国家/地区？ | Have you visited any country with an active disease outbreak in the past 14 days? | 2 | pass |
| maldives | MV_IMUGA | Health Declaration | outbreak_country_details | textarea | 国家详情 | Country / countries visited and dates | 0 | pass |
| maldives | MV_IMUGA | Customs Declaration | carrying_currency_over_threshold | radio | 同等 | Are you carrying currency / monetary instruments equivalent to USD 30,000 or more? | 2 | pass |
| maldives | MV_IMUGA | Customs Declaration | currency_amount_details | textarea | 具体情况 | Provide currency type and amount | 0 | pass |
| maldives | MV_IMUGA | Customs Declaration | carrying_restricted_items | radio | 请填写：Carrying Restricted Items | Are you carrying any restricted or prohibited items (alcohol, pork products, religious materials non-Islamic, narcotics)? | 2 | pass |
| maldives | MV_IMUGA | Customs Declaration | restricted_items_details | textarea | 具体情况 | Describe the restricted items | 0 | pass |
| maldives | MV_IMUGA | Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks (optional) | 0 | pass |
| maldives | MV_IMUGA | Declaration | application_date | date | 申请日期 | Date of submission | 0 | pass |
| maldives | MV_IMUGA | Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the information provided is true, accurate, and complete. I understand that providing false information may result in denial of entry into the Republic of Maldives. | 1 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | race_ethnicity | text | 请填写：Race Ethnicity | Race / Ethnicity (as collected by Malaysian immigration) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| malaysia | MY_TOURIST_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Malaysia | 1 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per entry) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 17 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | flight_number | text | 号码 | Flight number (if known) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Malaysia | 6 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / State in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| malaysia | MY_TOURIST_E_VISA | Host in Malaysia | has_host_in_malaysia | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Malaysia? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Host in Malaysia | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Host in Malaysia | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Host in Malaysia | host_address | text | 接待方地址 | Host — Address in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Host in Malaysia | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Host in Malaysia | host_nationality | country | 接待方国籍 | Host — Nationality | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | visited_malaysia_before | radio | 是否曾访问马来西亚？ | Have you ever visited Malaysia before? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | prior_malaysia_visit_arrival_date | date | 访问抵达日期 | Prior Malaysia visit — Arrival date | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | prior_malaysia_visit_departure_date | date | 访问离开日期 | Prior Malaysia visit — Departure date | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | prior_malaysia_visit_purpose | text | 访问目的 | Prior Malaysia visit — Purpose | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | refused_visa_or_entry_malaysia | radio | 是否曾被马来西亚拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Malaysia? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | refused_visa_malaysia_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Malaysia or any other country? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| malaysia | MY_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Malaysia. | 1 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Family name (Surname) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given names | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | preferred_name | text | 名称 | Preferred name (optional) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | sex | select | 性别 | Gender | 3 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | marital_status | select | 婚姻状况 | Relationship status | 6 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | spouse_full_name | text | 伴侣 | Spouse / Partner — Full name | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | spouse_nationality | country | 国籍 | Spouse / Partner — Nationality | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | spouse_dob | date | 伴侣日期出生 | Spouse / Partner — Date of birth | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province / Region | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| new_zealand | NZ_VISITOR_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa / authority type requested | 3 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to New Zealand | 5 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in New Zealand | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 270) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 11 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | flight_number | text | 号码 | Flight number (if known) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in New Zealand | 7 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of accommodation / first stop | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in New Zealand | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Region in New Zealand | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| new_zealand | NZ_VISITOR_VISA | Trip Details | available_funds_nzd | text | 访问同等 | Available funds for the visit (NZD equivalent) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Host in New Zealand | has_host_in_nz | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in New Zealand? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Host in New Zealand | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Host in New Zealand | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Host in New Zealand | host_address | text | 接待方地址 | Host — Address in New Zealand | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Host in New Zealand | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Host in New Zealand | host_immigration_status | text | 接待方状态 | Host — Immigration status in NZ | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | visited_nz_before | radio | 是否曾访问新西兰？ | Have you ever visited New Zealand before? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | prior_nz_visit_arrival_date | date | 访问抵达日期 | Prior NZ visit — Arrival date | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | prior_nz_visit_departure_date | date | 访问离开日期 | Prior NZ visit — Departure date | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | prior_nz_visit_purpose | text | 访问目的 | Prior NZ visit — Purpose | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | refused_visa_or_entry_nz | radio | 是否曾被新西兰拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, New Zealand? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | refused_visa_nz_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | has_tb_history | radio | 是否记录？ | Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | tb_history_details | textarea | 请提供本题要求的具体情况 | Provide details (when, treatment, current status) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported, removed, or excluded from any country? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, war crimes, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | application_date | date | 申请日期 | Date of application | 0 | pass |
| new_zealand | NZ_VISITOR_VISA | Health & Character | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into New Zealand. | 1 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa / declaration type requested | 4 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Philippines | 4 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 59 for 9(a)) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 11 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | flight_number | text | 号码 | Flight number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | country_of_origin_for_trip | country | 国家旅行 | Country of origin for this trip (last departure country) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Philippines | 6 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Host in Philippines | has_host_in_philippines | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in the Philippines? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_address | text | 接待方地址 | Host — Address in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_status | text | 接待方状态 | Host — Status / Citizenship | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | visited_philippines_before | radio | 是否曾访问菲律宾？ | Have you ever visited the Philippines before? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_arrival_date | date | 访问抵达日期 | Prior PH visit — Arrival date | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_departure_date | date | 访问离开日期 | Prior PH visit — Departure date | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_purpose | text | 访问目的 | Prior PH visit — Purpose | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_or_entry_philippines | radio | 是否曾被菲律宾拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, the Philippines? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_ph_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from the Philippines or any other country? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | 1 | pass |
| russia | RU_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname / Family name (Latin / Cyrillic transliteration as in passport) | 0 | pass |
| russia | RU_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names (Latin / Cyrillic transliteration) | 0 | pass |
| russia | RU_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| russia | RU_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| russia | RU_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| russia | RU_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| russia | RU_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| russia | RU_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country (current name) | 0 | pass |
| russia | RU_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| russia | RU_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| russia | RU_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| russia | RU_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| russia | RU_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| russia | RU_E_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| russia | RU_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| russia | RU_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| russia | RU_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| russia | RU_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| russia | RU_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be >6 months beyond intended exit) | 0 | pass |
| russia | RU_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| russia | RU_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| russia | RU_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| russia | RU_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| russia | RU_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| russia | RU_E_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province / Region | 0 | pass |
| russia | RU_E_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| russia | RU_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| russia | RU_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| russia | RU_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| russia | RU_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| russia | RU_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| russia | RU_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| russia | RU_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| russia | RU_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 1 | pass |
| russia | RU_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Russia | 4 | pass |
| russia | RU_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Russia | 0 | pass |
| russia | RU_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 16) | 0 | pass |
| russia | RU_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry (must be on MID-designated list) | 18 | pass |
| russia | RU_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| russia | RU_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| russia | RU_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Russia | 5 | pass |
| russia | RU_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or property | 0 | pass |
| russia | RU_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Russia | 0 | pass |
| russia | RU_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Region in Russia | 0 | pass |
| russia | RU_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| russia | RU_E_VISA | Trip Details | medical_insurance_company | text | 医疗公司 | Medical insurance company name (mandatory) | 0 | pass |
| russia | RU_E_VISA | Trip Details | medical_insurance_policy_number | text | 医疗号码 | Medical insurance policy number | 0 | pass |
| russia | RU_E_VISA | Trip Details | medical_insurance_coverage_amount | text | 医疗 | Insurance coverage amount (EUR or USD) | 0 | pass |
| russia | RU_E_VISA | Host in Russia | has_host_in_russia | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Russia? | 2 | pass |
| russia | RU_E_VISA | Host in Russia | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| russia | RU_E_VISA | Host in Russia | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| russia | RU_E_VISA | Host in Russia | host_address | text | 接待方地址 | Host — Address in Russia | 0 | pass |
| russia | RU_E_VISA | Host in Russia | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| russia | RU_E_VISA | Travel History | visited_russia_before | radio | 是否曾访问俄罗斯？ | Have you ever visited Russia before? | 2 | pass |
| russia | RU_E_VISA | Travel History | prior_russia_visit_arrival_date | date | 访问抵达日期 | Prior Russia visit — Arrival date | 0 | pass |
| russia | RU_E_VISA | Travel History | prior_russia_visit_departure_date | date | 访问离开日期 | Prior Russia visit — Departure date | 0 | pass |
| russia | RU_E_VISA | Travel History | prior_russia_visit_purpose | text | 访问目的 | Prior Russia visit — Purpose | 0 | pass |
| russia | RU_E_VISA | Travel History | refused_visa_or_entry_russia | radio | 是否曾被俄罗斯拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Russia? | 2 | pass |
| russia | RU_E_VISA | Travel History | refused_visa_russia_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| russia | RU_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| russia | RU_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| russia | RU_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| russia | RU_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| russia | RU_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Russia or any other country? | 2 | pass |
| russia | RU_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| russia | RU_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security? | 2 | pass |
| russia | RU_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| russia | RU_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| russia | RU_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Russian Federation. | 1 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | race | select | 请填写：Race | Race | 6 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | religion | select | 请填写：Religion | Religion | 7 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| singapore | SG_VISITOR_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| singapore | SG_VISITOR_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| singapore | SG_VISITOR_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| singapore | SG_VISITOR_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| singapore | SG_VISITOR_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| singapore | SG_VISITOR_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| singapore | SG_VISITOR_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| singapore | SG_VISITOR_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| singapore | SG_VISITOR_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| singapore | SG_VISITOR_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| singapore | SG_VISITOR_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| singapore | SG_VISITOR_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| singapore | SG_VISITOR_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| singapore | SG_VISITOR_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| singapore | SG_VISITOR_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| singapore | SG_VISITOR_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 2 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Singapore | 1 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per entry) | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 9 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | flight_number | text | 号码 | Flight number (if known) | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Singapore | 5 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or property | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | accommodation_postcode | text | 住宿 | Postal code (Singapore 6 digits) | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| singapore | SG_VISITOR_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | has_local_sponsor | radio | 是否担保人/资助方？ | Do you have a local sponsor in Singapore for this application? | 2 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | local_sponsor_type | select | 担保人 | Local sponsor type | 4 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | local_sponsor_name | text | 担保人 | Local sponsor — Full name (or company name) | 0 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | local_sponsor_nric_or_uen | text | 担保人 | Local sponsor — NRIC / FIN / UEN | 0 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | local_sponsor_address | text | 担保人地址 | Local sponsor — Address in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | local_sponsor_phone | text | 担保人电话 | Local sponsor — Telephone | 0 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | local_sponsor_email | text | 担保人邮箱 | Local sponsor — Email | 0 | pass |
| singapore | SG_VISITOR_VISA | Local Sponsor | local_sponsor_relationship | text | 担保人关系 | Local sponsor — Relationship to applicant | 0 | pass |
| singapore | SG_VISITOR_VISA | Host in Singapore | has_host_in_singapore | radio | 是否邀请人/接待方？ | Will you be staying with a host (different from your local sponsor)? | 2 | pass |
| singapore | SG_VISITOR_VISA | Host in Singapore | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| singapore | SG_VISITOR_VISA | Host in Singapore | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| singapore | SG_VISITOR_VISA | Host in Singapore | host_address | text | 接待方地址 | Host — Address in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA | Host in Singapore | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| singapore | SG_VISITOR_VISA | Travel History | visited_singapore_before | radio | 是否曾访问新加坡？ | Have you ever visited Singapore before? | 2 | pass |
| singapore | SG_VISITOR_VISA | Travel History | prior_singapore_visit_arrival_date | date | 访问抵达日期 | Prior Singapore visit — Arrival date | 0 | pass |
| singapore | SG_VISITOR_VISA | Travel History | prior_singapore_visit_departure_date | date | 访问离开日期 | Prior Singapore visit — Departure date | 0 | pass |
| singapore | SG_VISITOR_VISA | Travel History | prior_singapore_visit_purpose | text | 访问目的 | Prior Singapore visit — Purpose | 0 | pass |
| singapore | SG_VISITOR_VISA | Travel History | refused_visa_or_entry_singapore | radio | 是否曾被新加坡拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Singapore? | 2 | pass |
| singapore | SG_VISITOR_VISA | Travel History | refused_visa_singapore_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| singapore | SG_VISITOR_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| singapore | SG_VISITOR_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Singapore or any other country? | 2 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| singapore | SG_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Singapore. | 1 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| thailand | TH_TOURIST_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Thailand | 1 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 60 per entry) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 14 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | flight_number | text | 号码 | Flight or train number (if known) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Thailand | 6 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| thailand | TH_TOURIST_E_VISA | Host in Thailand | has_host_in_thailand | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Thailand? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Host in Thailand | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Host in Thailand | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Host in Thailand | host_address | text | 接待方地址 | Host — Address in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Host in Thailand | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Host in Thailand | host_nationality | country | 接待方国籍 | Host — Nationality | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | visited_thailand_before | radio | 是否曾访问泰国？ | Have you ever visited Thailand before? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | prior_thailand_visit_arrival_date | date | 访问抵达日期 | Prior Thailand visit — Arrival date | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | prior_thailand_visit_departure_date | date | 访问离开日期 | Prior Thailand visit — Departure date | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | prior_thailand_visit_purpose | text | 访问目的 | Prior Thailand visit — Purpose | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | refused_visa_or_entry_thailand | radio | 是否曾被泰国拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Thailand? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | refused_visa_thailand_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Thailand or any other country? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| thailand | TH_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Thailand. | 1 | pass |
| turkey | TR_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| turkey | TR_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| turkey | TR_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| turkey | TR_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| turkey | TR_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| turkey | TR_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| turkey | TR_E_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| turkey | TR_E_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| turkey | TR_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| turkey | TR_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| turkey | TR_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| turkey | TR_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| turkey | TR_E_VISA | Personal Information | spouse_full_name | text | 完整名称 | Spouse — Full name | 0 | pass |
| turkey | TR_E_VISA | Personal Information | spouse_nationality | country | 配偶——国籍 | Spouse — Nationality | 0 | pass |
| turkey | TR_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| turkey | TR_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| turkey | TR_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| turkey | TR_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| turkey | TR_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| turkey | TR_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| turkey | TR_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 60+ days beyond intended departure from Türkiye) | 0 | pass |
| turkey | TR_E_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| turkey | TR_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| turkey | TR_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| turkey | TR_E_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| turkey | TR_E_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| turkey | TR_E_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — State / Province | 0 | pass |
| turkey | TR_E_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| turkey | TR_E_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| turkey | TR_E_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| turkey | TR_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| turkey | TR_E_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| turkey | TR_E_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| turkey | TR_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| turkey | TR_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| turkey | TR_E_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 2 | pass |
| turkey | TR_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Türkiye | 2 | pass |
| turkey | TR_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Türkiye | 0 | pass |
| turkey | TR_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 90) | 0 | pass |
| turkey | TR_E_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 16 | pass |
| turkey | TR_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| turkey | TR_E_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| turkey | TR_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Türkiye | 6 | pass |
| turkey | TR_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or property | 0 | pass |
| turkey | TR_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Türkiye | 0 | pass |
| turkey | TR_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Türkiye | 0 | pass |
| turkey | TR_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| turkey | TR_E_VISA | Host in Türkiye | has_host_in_turkiye | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Türkiye? | 2 | pass |
| turkey | TR_E_VISA | Host in Türkiye | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| turkey | TR_E_VISA | Host in Türkiye | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| turkey | TR_E_VISA | Host in Türkiye | host_address | text | 接待方地址 | Host — Address in Türkiye | 0 | pass |
| turkey | TR_E_VISA | Host in Türkiye | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| turkey | TR_E_VISA | Travel History | visited_turkiye_before | radio | 是否曾访问Türkiye？ | Have you ever visited Türkiye before? | 2 | pass |
| turkey | TR_E_VISA | Travel History | prior_tr_visit_arrival_date | date | 访问抵达日期 | Prior Türkiye visit — Arrival date | 0 | pass |
| turkey | TR_E_VISA | Travel History | prior_tr_visit_departure_date | date | 访问离开日期 | Prior Türkiye visit — Departure date | 0 | pass |
| turkey | TR_E_VISA | Travel History | prior_tr_visit_purpose | text | 访问目的 | Prior Türkiye visit — Purpose | 0 | pass |
| turkey | TR_E_VISA | Travel History | refused_visa_or_entry_turkiye | radio | 是否曾被Türkiye拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Türkiye? | 2 | pass |
| turkey | TR_E_VISA | Travel History | refused_visa_tr_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| turkey | TR_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| turkey | TR_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| turkey | TR_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| turkey | TR_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| turkey | TR_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Türkiye or any other country? | 2 | pass |
| turkey | TR_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| turkey | TR_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security? | 2 | pass |
| turkey | TR_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| turkey | TR_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| turkey | TR_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Türkiye. | 1 | pass |
| uk | UK_STANDARD_VISITOR | UKVI Account | uk_account_email | text | UKVI 账号邮箱 | UKVI account email | 0 | pass |
| uk | UK_STANDARD_VISITOR | UKVI Account | uk_account_password | password | UKVI 账号密码 | UKVI account password | 0 | pass |
| uk | UK_STANDARD_VISITOR | UKVI Account | uk_resume_url | text | UKVI 恢复链接 | UKVI Resume URL | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | given_names | text | 名字（与护照一致） | Given names (as shown in your passport) | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | surname | text | 姓氏（与护照一致） | Family name / surname (as shown in your passport) | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | other_names_used | radio | 是否其他姓名？ | Have you been known by any other names? | 2 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | previous_given_names | text | 曾用名字 | Previous given names | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | previous_surname | text | 曾用姓氏 | Previous family name / surname | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | previous_name_change_date | date | 姓名变更日期 | Date name was changed | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | previous_name_change_reason | text | 姓名变更原因 | Reason for name change | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | sex | select | 性别 | Sex | 3 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | country_of_nationality | country | 您的国籍是什么？ | What is your nationality? | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you have any other nationalities? | 2 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | place_of_birth | text | 出生地点（城市/地区） | Place of birth (city or town) | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | is_applicant_under_18 | radio | 是否申请人？ | Will you be under 18 on the date you plan to travel to the UK? | 2 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | parent_consent_letter_held | radio | 您是否有父母双方或法定监护人签署的同意书？ | Do you have a signed letter of consent from both parents or legal guardians? | 2 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | accompanying_adult_name | text | 是否有其他人与您同行？ | Name of the adult travelling with you | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | accompanying_adult_relationship | text | 是否有其他人与您同行？ | Relationship to the adult travelling with you | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Personal Details | accompanying_adult_passport_number | text | 同行成年人护照号码 | Passport number of the accompanying adult | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_number | text | 护照号码 | Passport number | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_issuing_authority | text | 护照签发机关/签发地点 | Issuing authority | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_place_of_issue | text | 签发地点 | Place of issue | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | has_other_passports | radio | 是否持有其他有效护照或旅行证件？ | Do you have any other valid passports or travel documents? | 2 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_nationality | country | 其他护照国籍 | Nationality shown on other passport | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_issue_date | date | 其他护照签发日期 | Other passport date of issue | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_expiry_date | date | 其他护照到期日期 | Other passport date of expiry | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | has_national_id_card | radio | 是否卡？ | Do you have a national identity card? | 2 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_number | text | 国民身份证号码 | National identity card number | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_issuing_country | country | 国民身份证签发国家 | Country that issued the national identity card | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | has_held_brp | radio | 英国居住许可 | Have you ever held a UK Biometric Residence Permit (BRP)? | 2 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | brp_number | text | 号码 | BRP number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | phone_number | text | 电话号码 | Phone number (including country code) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | has_alternative_phone | radio | 是否电话？ | Do you have an alternative phone number? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | alternative_phone_number | text | 电话号码 | Alternative phone number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_address_city | text | 城镇或城市 | Town or city | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_address_state | text | 县/州/省 | County / state / province | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_address_postcode | text | 邮政编码 | Postcode / ZIP code | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_address_country | country | 国家 | Country | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | how_long_at_address | text | 您在此地址居住了多久？ | How long have you lived at this address? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | owns_home | radio | 是否家庭住址？ | Do you own your home? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_different | radio | 是否地址？ | Is your correspondence address different from your home address? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_line_1 | text | 地址行 | Correspondence address — line 1 | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_city | text | 地址城市 | Correspondence address — town or city | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_country | country | 地址国家 | Correspondence address — country | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | marital_status | select | 婚姻状况 | What is your current marital or civil partnership status? | 7 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | partner_given_names | text | 伴侣名字姓名 | Partner's given names | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | partner_surname | text | 伴侣姓氏 | Partner's family name / surname | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | partner_date_of_birth | date | 伴侣日期出生 | Partner's date of birth | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | partner_nationality | country | 伴侣国籍 | Partner's nationality | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | partner_travelling_with_you | radio | 伴侣 | Is your partner travelling to the UK with you? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | has_children | radio | 是否儿童？ | Do you have any children under 18? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | number_of_children | text | 号码 | How many children under 18 do you have? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | children_travelling_with_you | radio | 是否有其他人与您同行？ | Are any of your children travelling with you? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | father_given_names | text | 名字姓名 | Father's given names | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | father_surname | text | 姓氏 | Father's family name / surname | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | father_date_of_birth | date | 日期出生 | Father's date of birth | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | father_nationality | country | 国籍 | Father's nationality | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | mother_given_names | text | 名字姓名 | Mother's given names | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | mother_surname | text | 姓氏 | Mother's family name / surname | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | mother_date_of_birth | date | 日期出生 | Mother's date of birth | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Family | mother_nationality | country | 是否持有或曾持有其他国籍？ | Mother's nationality | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_type | select | 您将在英国住在哪里？ | Where will you be staying in the UK? | 5 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_address_line_1 | text | 英国住宿地址行 | UK accommodation address — line 1 | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_address_line_2 | text | 英国住宿地址行 | UK accommodation address — line 2 | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_city | text | 城镇或城市 | Town or city | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_postcode | text | 英国住宿 | Postcode | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_host_name | text | 英国接待方 | Name of the person you are staying with | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_host_relationship | text | 英国接待方关系 | What is your relationship to this person? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_host_email | text | 英国接待方邮箱 | Host's email address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_host_phone | text | 英国接待方电话 | Host's phone number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_other_explain | textarea | 英国住宿其他 | Please describe your accommodation arrangements | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | travelled_to_uk_before | radio | 您是否曾前往英国？ | Have you ever travelled to the UK before? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | prev_uk_visit_date | date | 英国访问日期 | Date of arrival in the UK | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | prev_uk_visit_duration | text | 英国访问 | How long did you stay? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | prev_uk_visit_reason | text | 英国访问原因 | Reason for the visit | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | prev_uk_visa_type | text | 英国签证 | Type of UK visa held (if any) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | prev_uk_visa_reference | text | 英国签证 | UK visa reference number (if known) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | uk_national_insurance_number | radio | 是否保险号码？ | Do you have a UK National Insurance number? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | uk_national_insurance_number_value | text | 英国国民号码 | UK National Insurance number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | visa_refused_uk | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been refused a visa for the UK? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | visa_refused_uk_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please give details of the refusal | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | visa_refused_other_country | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been refused a visa for any other country? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | visa_refused_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please give details of the refusal | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | deported_removed_refused_entry | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported, removed, or refused entry to any country including the UK? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | deported_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please give details | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | has_schengen_visits | radio | 申根 | Have you visited any Schengen country in the last 10 years? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | schengen_visit_country | country | 申根访问国家 | Schengen country visited | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | schengen_visit_arrival | date | 申根访问抵达 | Date of arrival | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | schengen_visit_departure | date | 申根访问离开 | Date of departure | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | schengen_visit_purpose | text | 申根访问目的 | Purpose of visit | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | has_us_canada_anz_visits | radio | 美国 | Have you visited the USA, Canada, Australia, or New Zealand in the last 10 years? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_country | country | 美国访问国家 | Country visited | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_arrival | date | 美国访问抵达 | Date of arrival | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_departure | date | 美国访问离开 | Date of departure | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_purpose | text | 美国访问目的 | Purpose of visit | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | has_other_country_visits | radio | 是否其他国家/地区？ | Have you visited any other countries in the last 10 years? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | other_country_visit_country | country | 其他国家访问国家 | Country visited | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | other_country_visit_arrival | date | 其他国家访问抵达 | Date of arrival | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Travel History | other_country_visit_departure | date | 其他国家访问离开 | Date of departure | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | purpose_of_visit | select | 您访问英国的主要原因是什么？ | What is the main reason for your visit to the UK? | 8 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | uk_arrival_date | date | 您计划何时抵达英国？ | When do you plan to arrive in the UK? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | uk_departure_date | date | 您计划何时离开英国？ | When do you plan to leave the UK? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | visiting_family_in_uk | radio | 是否家庭？ | Will you be visiting family while in the UK? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_name | text | 英国家庭成员 | Family member's full name | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_relationship | text | 英国家庭成员关系 | What is your relationship to this person? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_immigration_status | select | 英国家庭成员状态 | What is their UK immigration status? | 5 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_address | textarea | 英国家庭成员地址 | Family member's UK address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_contact_name | text | 英国商务联系人 | Name of your UK business contact | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_company_name | text | 英国商务公司 | UK company name | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_company_address | textarea | 英国商务公司地址 | UK company address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_activity_description | textarea | 英国商务活动 | Describe the nature of your business activity in the UK | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_paid_by_uk | radio | 是否商务？ | Will you be paid by a UK company or individual during your visit? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | study_institution_name | text | 学习机构 | Name of the school, college, or university | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | study_institution_address | textarea | 学习机构地址 | Institution address in the UK | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | study_course_title | text | 学习 | Title of the course | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | study_course_start_date | date | 学习开始日期 | Course start date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | study_course_end_date | date | 学习结束日期 | Course end date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | study_institution_accredited | radio | 学习机构 | Is the institution accredited by a UK-recognised body? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | study_who_pays | select | 谁将承担本次旅行和停留费用？ | Who is paying for your course? | 5 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | medical_treatment_type | textarea | 医疗 | What kind of medical treatment will you be receiving? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | medical_facility_name | text | 医疗 | Name of the hospital or clinic | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | medical_facility_address | textarea | 医疗地址 | Hospital or clinic address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | medical_doctor_name | text | 医疗 | Name of the doctor or consultant | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | medical_estimated_cost | text | 医疗 | Estimated cost of treatment | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | medical_payment_arrangement | textarea | 医疗 | How will you pay for your treatment? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | transit_destination_country | country | 过境目的地国家 | Which country are you travelling on to? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | transit_onward_journey_date | date | 过境行程日期 | Date and time of onward journey | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | transit_onward_booking_reference | text | 过境 | Onward travel booking reference | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | transit_destination_visa_status | radio | 是否签证？ | Do you hold a valid visa or residence permit for the destination country? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | transit_destination_visa_details | textarea | 过境目的地签证详情 | Destination visa / residence permit details | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_ceremony_date | date | 婚姻日期 | Date of the ceremony | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_registrar_office_name | text | 婚姻 | Name of the register office | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_registrar_office_address | textarea | 婚姻地址 | Register office address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_partner_full_name | text | 婚姻伴侣 | Full name of your intended spouse or civil partner | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_partner_nationality | country | 婚姻伴侣国籍 | Nationality of your intended spouse or civil partner | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_freedom_to_marry_document | radio | 是否证件？ | Do you have a document proving you are free to marry (e.g. decree absolute, death certificate of previous spouse)? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_host_organisation_name | text | 接待方机构 | Name of the UK organisation that has invited you | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_host_organisation_address | textarea | 接待方机构地址 | Host organisation address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_description | textarea | 请填写：Ppe Engagement Description | Describe the engagement | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_start_date | date | 开始日期 | Engagement start date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_end_date | date | 结束日期 | Engagement end date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_fee_amount | text | 请填写：Ppe Fee Amount | Fee or payment you will receive | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | academic_institution_name | text | 机构 | Name of the UK host institution | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | academic_institution_address | textarea | 机构地址 | UK host institution address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | academic_research_topic | textarea | 活动 | Describe your research or academic activity | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | academic_duration_months | text | 个月 | Duration of the visit (in months) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | academic_qualifications_held | text | 请填写：Academic Qualifications Held | Highest academic qualification held in your field | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | academic_employer_letter_held | radio | 是否雇主？ | Do you have a letter from your employer in your home country confirming this research? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_recipient_name | text | 预计 | Full name of the intended organ recipient | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_relationship_to_recipient | text | 关系 | Relationship to the recipient | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_recipient_legal_uk_status | radio | 法定英国状态 | Is the recipient legally resident in the UK? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_transplant_hospital | text | 医院 | Hospital where the transplant will take place | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_transplant_date | date | 日期 | Intended transplant or testing date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_consultant_name | text | 名称 | Name of the lead GMC-registered specialist | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_consultant_letter_date | date | 日期 | Date of the consultant's letter (must be within 3 months) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_training_type | select | 临床 | What kind of clinical activity are you attending? | 4 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_institution_name | text | 临床机构 | Name of the UK institution or Royal College | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_institution_address | textarea | 临床机构地址 | UK institution address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_start_date | date | 临床开始日期 | Start date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_end_date | date | 临床结束日期 | End date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_no_patient_treatment_confirm | radio | 临床 | Confirm you will not provide treatment to UK patients | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employment_status | select | 工作状态 | What is your current employment status? | 5 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_name | text | 雇主名称 | Employer's name | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_address | textarea | 雇主地址 | Employer's address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_phone | text | 雇主电话 | Employer's phone number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | job_title | text | 请填写：Job Title | Job title | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | job_start_date | date | 开始日期 | When did you start this job? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | annual_income | text | 收入 | What is your annual income (in local currency)? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | self_employed_business_name | text | 商务 | Business name | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | self_employed_business_address | textarea | 商务地址 | Business address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | student_institution_name | text | 学生机构 | Name of school, college, or university | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | student_institution_address | textarea | 学生机构地址 | Institution address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | student_course_name | text | 学生 | Course of study | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employment_other_explain | textarea | 工作其他 | Please describe your situation | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | who_is_paying | select | 谁将承担本次旅行和停留费用？ | Who is paying for your visit to the UK? | 4 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | monthly_spending_money | text | 每月 | How much money will you have available to spend each month in the UK? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | total_cost_of_trip | text | 旅行 | What is the total estimated cost of your trip (including flights)? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | sponsor_name | text | 担保人/资助方名称 | Sponsor's full name | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | sponsor_relationship | text | 担保人/资助方与申请人的关系 | What is your relationship to the sponsor? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | sponsor_address | textarea | 担保人/资助方地址 | Sponsor's address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | sponsor_email | text | 担保人邮箱 | Sponsor's email address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | sponsor_phone | text | 担保人电话 | Sponsor's phone number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | finances_other_explain | textarea | 财务其他 | Please describe your financial arrangements | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | has_savings | radio | 请填写：Has Savings | Do you have any savings? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | savings_amount | text | 请填写：Savings Amount | Total savings (in local currency) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | has_other_income | radio | 是否其他？ | Do you have any other income or financial support? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | other_income_details | textarea | 其他收入详情 | Please describe your other income or financial support | 0 | pass |
| uk | UK_STANDARD_VISITOR | Dependants Travelling With You | applying_with_dependants | radio | 受抚养人 | Is anyone else applying for a UK visa together with you (spouse, children, or other dependants)? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_relationship | select | 关系 | Relationship to you | 4 | pass |
| uk | UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_given_names | text | 名字姓名 | Given names | 0 | pass |
| uk | UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_surname | text | 姓氏 | Family name / surname | 0 | pass |
| uk | UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| uk | UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_nationality | country | 国籍 | Nationality | 0 | pass |
| uk | UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_passport_number | text | 护照号码 | Passport number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | has_medical_condition_affecting_travel | radio | 是否旅行？ | Do you have any medical conditions that might affect your ability to travel? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | medical_condition_affecting_travel_details | textarea | 医疗旅行详情 | Please describe your medical condition | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | tb_test_required_acknowledged | radio | 考试需要 | Do you need a tuberculosis (TB) test certificate? (Required if you are from a listed country and staying in the UK for more than 6 months) | 3 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | tb_test_certificate_date | date | 考试日期 | Date of TB test certificate | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | tb_test_clinic_name | text | 考试诊所 | Name of the UK Home Office approved clinic | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | criminal_convictions | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a criminal offence in any country (including traffic offences)? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | criminal_convictions_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Please give details of any criminal convictions | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | breach_uk_immigration_laws | radio | 是否法律法规？ | Have you ever breached UK immigration laws (e.g. overstayed a visa, entered illegally, worked illegally)? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | breach_uk_immigration_laws_details | textarea | 英国详情 | Please give details of the immigration breach | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | civil_penalty_uk | radio | 民事英国 | Have you ever received a civil penalty from the UK Home Office (e.g. unpaid NHS fees)? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | civil_penalty_uk_details | textarea | 民事英国详情 | Please give details of the civil penalty | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | public_funds_used_uk | radio | 英国 | Have you ever received UK public funds that you were not entitled to? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | public_funds_used_uk_details | textarea | 英国详情 | Please give details | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | terrorism_related | radio | 国家 | Have you ever been involved in, supported, or encouraged terrorist activities in any country? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | terrorism_details | textarea | 请说明安全或公共秩序相关背景的具体情况 | Please give details | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | war_crimes | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | war_crimes_details | textarea | 具体情况 | Please give details | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | organisations_concern | radio | 成员名字支持机构 | Have you ever been a member of, or given support to, an organisation which has been concerned in terrorism? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | organisations_concern_details | textarea | 具体情况 | Please give details | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | bad_character | radio | 订婚其他人员 | Have you engaged in any other activities that might indicate you may not be considered a person of good character? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | bad_character_details | textarea | 具体情况 | Please give details | 0 | pass |
| uk | UK_STANDARD_VISITOR | Additional Information | additional_information | textarea | 补充说明 / 其他可能影响本次申请的信息 | Is there anything else you would like to tell us about your application? | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_issuing_authority | text | 国民身份证签发机构 | National identity card issuing authority | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_issue_date | date | 国民身份证签发日期 | National identity card issue date (if applicable) | 0 | pass |
| uk | UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_expiry_date | date | 国民身份证到期日期 | National identity card expiry date (if applicable) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | years_at_address | text | 地址 | Years at this address | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | months_at_address | text | 个月地址 | Additional months | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_ownership | select | 状态 | Ownership status of your home | 3 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | home_ownership_other_details | textarea | 其他详情 | Tell us more about your living situation | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | immigration_status_in_residence_country | radio | 状态居住国家 | Your immigration status in your country of residence | 3 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | immigration_status_visa_expiry | date | 状态签证到期 | Visa expiry date | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | immigration_status_pr_year | text | 状态 | Year you became a permanent resident | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Contact Details | immigration_status_other_details | textarea | 状态其他详情 | Tell us about your immigration situation | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | planned_spend_currency | select | 请填写：Planned Spend Currency | Planned spend — currency | 4 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | planned_spend_amount | text | 访问 | How much do you plan to spend on this visit? | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | someone_paying_for_visit | radio | 支付访问 | Will anyone be paying towards the cost of your visit? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | spoken_language_preference | radio | 申请 | Which language would you prefer if we need to discuss your application? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK | spoken_language_other_details | text | 其他详情 | Specify the language | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Trip to the UK — Purpose | tourism_sub_purpose | radio | 旅游目的 | Main reason for your holiday visit | 3 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_address_line_1 | text | 雇主地址行 | Employer address — line 1 | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_address_line_2 | text | 雇主地址行 | Employer address — line 2 | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_address_city | text | 雇主地址城市 | Employer town/city | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_address_state | text | 雇主地址州 | Employer province/state | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_address_postcode | text | 雇主地址 | Employer postal code | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_address_country | country | 雇主地址国家 | Employer country | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_phone_code | text | 雇主电话 | Employer phone — international code | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | employer_phone_number | text | 雇主电话号码 | Employer phone — number | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | job_start_month | text | 开始个月 | Job start month | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | job_start_year | text | 开始 | Job start year | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | monthly_earnings_currency | select | 每月 | Monthly earnings — currency | 4 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | monthly_earnings_amount | text | 每月 | Monthly earnings (after tax) | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Employment | job_description | textarea | 请填写：Job Description | Describe your job | 0 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | has_other_income_or_savings | radio | 是否其他？ | Do you have any other income or savings? | 2 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | monthly_outgoings_currency | select | 每月 | Monthly outgoings — currency | 4 | pass |
| uk | UK_STANDARD_VISITOR | Your Finances | monthly_outgoings_amount | text | 每月 | Total amount you spend each month | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | surname | text | 护照姓氏 | Surname (Last name) | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | given_name | text | 护照名字及中间名 | Middle and given name (First name) | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| vietnam | VN_E_VISA | Personal Information | nationality | country | 国籍 | Nationality | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | identity_card_number | text | 身份证或本国身份号码（如有） | Identity card number | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | email_address | text | 用于接收越南电子签证通知的邮箱 | Email | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | re_enter_email_address | text | 再次输入邮箱 | Re-enter Email | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | religion | text | 宗教信仰 | Religion | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | place_of_birth | text | 出生地 | Place of birth | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | has_multiple_nationalities | radio | 是否还拥有或曾拥有其他国籍？ | Have you ever held any other nationalities? | 2 | pass |
| vietnam | VN_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| vietnam | VN_E_VISA | Personal Information | has_violated_vietnam_laws | radio | 是否曾违反越南法律或法规？ | Have you violated Vietnamese laws/regulations? | 2 | pass |
| vietnam | VN_E_VISA | Requested Information | visa_type_requested | radio | 申请单次或多次入境电子签证 | Type of visa requested | 2 | pass |
| vietnam | VN_E_VISA | Requested Information | visa_valid_from | date | 希望电子签证从哪一天开始生效？ | Grant e-Visa valid from | 0 | pass |
| vietnam | VN_E_VISA | Requested Information | visa_valid_to | date | 希望电子签证有效期到哪一天结束？ | Grant e-Visa valid to | 0 | pass |
| vietnam | VN_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| vietnam | VN_E_VISA | Passport Information | passport_issuing_authority | text | 签发机关/签发地点 | Issuing Authority/Place of issue | 0 | pass |
| vietnam | VN_E_VISA | Passport Information | passport_type | select | 护照种类 | Passport type | 4 | pass |
| vietnam | VN_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| vietnam | VN_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Expiry date | 0 | pass |
| vietnam | VN_E_VISA | Contact Information | permanent_residential_address | text | 永久居住地址 | Permanent residential address | 0 | pass |
| vietnam | VN_E_VISA | Contact Information | contact_address | text | 联系地址 | Contact address | 0 | pass |
| vietnam | VN_E_VISA | Contact Information | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| vietnam | VN_E_VISA | Contact Information | emergency_contact_full_name | text | 紧急联系人姓名 | Emergency contact full name | 0 | pass |
| vietnam | VN_E_VISA | Contact Information | emergency_contact_current_address | text | 紧急联系人当前居住地址 | Emergency contact current residential address | 0 | pass |
| vietnam | VN_E_VISA | Contact Information | emergency_contact_telephone | text | 紧急联系人电话 | Emergency contact telephone number | 0 | pass |
| vietnam | VN_E_VISA | Contact Information | emergency_contact_relationship | text | 紧急联系人关系 | Emergency contact relationship | 0 | pass |
| vietnam | VN_E_VISA | Occupation | occupation | select | 职业 | Occupation | 7 | pass |
| vietnam | VN_E_VISA | Occupation | occupation_info | text | 当前职业说明 | Current occupation details | 0 | pass |
| vietnam | VN_E_VISA | Occupation | company_or_school_name | text | 公司/机构/学校名称 | Name of Company/Agency/School | 0 | pass |
| vietnam | VN_E_VISA | Occupation | position_course | text | 职位/课程 | Position or course of study | 0 | pass |
| vietnam | VN_E_VISA | Occupation | company_address | text | 公司/机构/学校地址 | Address of Company/Agency/School | 0 | pass |
| vietnam | VN_E_VISA | Occupation | company_phone | text | 公司/机构/学校电话 | Company/agency/school telephone number | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | purpose_of_entry | select | 本次入境越南目的 | Purpose of entry | 5 | pass |
| vietnam | VN_E_VISA | Information About the Trip | intended_date_of_entry | date | 预计入境日期 | Intended date of entry | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | intended_length_of_stay | text | 预计在越南停留天数 | Intended length of stay in Viet Nam (days) | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | phone_in_vietnam | text | 越南境内电话号码 | Phone number (in Viet Nam) | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | residential_address_in_vietnam | text | 在越南拟停留地址 | Residential address in Viet Nam | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | intended_province_city | select | 在越南拟停留省/市 | Intended province/city in Viet Nam | 34 | pass |
| vietnam | VN_E_VISA | Information About the Trip | intended_ward_commune | select | 在越南拟停留坊/社 | Intended ward/commune in Viet Nam | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | intended_border_gate_of_entry | select | 预计入境口岸 | Intended border gate of entry | 79 | pass |
| vietnam | VN_E_VISA | Information About the Trip | intended_border_gate_of_exit | select | 预计出境口岸 | Intended border gate of exit | 79 | pass |
| vietnam | VN_E_VISA | Information About the Trip | declaration_temporary_residence | checkbox | 是否承诺抵达后按越南法律申报临时居住？ | I commit to declare temporary residence according to Vietnamese law | 1 | pass |
| vietnam | VN_E_VISA | Information About the Trip | visited_vietnam_in_last_year | radio | 过去一年是否曾到访越南？ | Have you ever been to Viet Nam in the last 01 year? | 2 | pass |
| vietnam | VN_E_VISA | Information About the Trip | visited_vietnam_purpose_detail | textarea | 上次访问越南的目的和入境日期 | Purpose of the last visit and date of arrival | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | has_relatives_in_vietnam | radio | 是否有亲属目前居住在越南 | Do you have relatives currently residing in Viet Nam? | 2 | pass |
| vietnam | VN_E_VISA | Information About the Trip | relative_full_name_in_vn | text | 在越亲属姓名 | Relative's full name | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | relative_date_of_birth | date | 在越亲属出生日期 | Relative's date of birth | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | relative_nationality | country | 在越亲属国籍 | Relative's nationality | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | relative_relationship | text | 与在越亲属的关系 | Relationship to the relative in Viet Nam | 0 | pass |
| vietnam | VN_E_VISA | Information About the Trip | relative_address_in_vn | text | 在越亲属地址 | Relative's address in Vietnam | 0 | pass |
| vietnam | VN_E_VISA | Accompanying Children Under 14 | child_full_name | text | 同一本护照上同行的14岁以下儿童姓名 | Full name (child under 14 on same passport) | 0 | pass |
| vietnam | VN_E_VISA | Accompanying Children Under 14 | child_sex | select | 同行儿童性别 | Sex | 2 | pass |
| vietnam | VN_E_VISA | Accompanying Children Under 14 | child_date_of_birth | date | 同行儿童出生日期 | Date of birth | 0 | pass |
| vietnam | VN_E_VISA | Trip Expenses & Insurance | intended_expenses_usd | text | 预计费用（美元） | Intended expenses (in USD) | 0 | pass |
| vietnam | VN_E_VISA | Trip Expenses & Insurance | bought_travel_insurance | select | 是否已购买本次旅行保险？ | Have you bought travel insurance? | 2 | pass |
| vietnam | VN_E_VISA | Trip Expenses & Insurance | expense_coverage | select | 谁承担申请人的旅行费用？ | Who will cover the applicant's trip expenses? | 2 | pass |
| vietnam | VN_E_VISA | Declaration | violation_of_vietnam_laws_details | textarea | 请说明违反越南法律或法规的具体情况 | Details of Vietnamese law/regulation violation | 0 | pass |
| vietnam | VN_E_VISA | Declaration | final_declaration | checkbox | 确认以上信息真实、准确、完整，并愿意对虚假申报承担责任 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | 1 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | place_of_birth_city | text | 地点出生城市 | Place of birth — City / Town | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | place_of_birth_country | country | 地点出生国家 | Place of birth — Country | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 5 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | spouse_full_name | text | 伴侣 | Spouse / Life partner — Full name | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | spouse_nationality | country | 国籍 | Spouse / Life partner — Nationality | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 30+ days beyond intended departure) | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | has_other_passports | radio | 是否其他？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Contact & Home Address | home_address_line1 | text | 地址 | Home address — Street / Apartment | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Contact & Home Address | home_address_city | text | 地址城市 | Home address — City / Town | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Contact & Home Address | home_address_state | text | 地址州 | Home address — Province / State | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Contact & Home Address | home_address_postcode | text | 地址 | Home address — Postal code | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Contact & Home Address | home_address_country | country | 地址国家 | Home address — Country of residence | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Contact & Home Address | mobile_number | text | 号码 | Mobile number | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Occupation | current_profession | select | 当前 | Current profession or occupation | 8 | pass |
| south_africa | ZA_VISITOR_VISA | Occupation | position_title | text | 请填写：Position Title | Position / Title | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | visa_type_requested | radio | 签证 | Visa type requested | 3 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to South Africa | 6 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in South Africa | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 90 per entry) | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | port_of_entry | select | 入境 | Intended port of entry | 15 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | carrier_name | text | 交通 | Name of airline, ship, or transport carrier | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in South Africa | 6 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of accommodation / first stop | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in South Africa | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in South Africa | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| south_africa | ZA_VISITOR_VISA | Trip Details | available_funds_zar | text | 访问同等 | Funds available for the visit (ZAR equivalent) | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Host in South Africa | has_host_in_south_africa | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in South Africa? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Host in South Africa | host_full_name | text | 接待方 | Host — Full name | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Host in South Africa | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Host in South Africa | host_address | text | 接待方地址 | Host — Address in South Africa | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Host in South Africa | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Host in South Africa | host_id_or_passport | text | 接待方身份证护照 | Host — South African ID or passport number | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | visited_south_africa_before | radio | 是否曾访问南非？ | Have you ever visited South Africa before? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | prior_za_visit_arrival_date | date | 访问抵达日期 | Prior SA visit — Arrival date | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | prior_za_visit_departure_date | date | 访问离开日期 | Prior SA visit — Departure date | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | prior_za_visit_purpose | text | 访问目的 | Prior SA visit — Purpose | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | yellow_fever_country_recent | radio | 是否国家/地区？ | Have you travelled through any yellow-fever-endemic country in the past 6 days? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | yellow_fever_certificate_held | radio | 有效 | Do you hold a valid Yellow Fever Vaccination Certificate? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | refused_visa_or_entry_south_africa | radio | 是否曾被南非拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, South Africa? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | refused_visa_za_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from South Africa or any other country? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| south_africa | ZA_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of South Africa. | 1 | pass |
| indonesia | B211A | Visa Selection | selectCountry | select | 护照国家 | Passport / Country / Region | 221 | pass |
| indonesia | B211A | Visa Selection | selectParentActivity | select | 签证 | Visa Category | 12 | pass |
| indonesia | B211A | Visa Selection | selectActivity | select | 目的访问 | Purpose of Visit | 5 | pass |
| indonesia | B211A | Visa Selection | selectVisa | select | 签证 | Visa Type | 6 | pass |
| indonesia | B211A | Visa Selection | selectStay | select | 停留 | Duration of Stay | 1 | pass |
| indonesia | B211A | Visa Selection | decisionLetterNumber | text | 号码 | Decision Letter Number | 0 | pass |
| indonesia | B211A | Personal Information | fullName | text | 护照 | Full name (as on passport) | 0 | pass |
| indonesia | B211A | Personal Information | dateOfBirth | date | 出生日期 | Date of birth | 0 | pass |
| indonesia | B211A | Personal Information | placeOfBirth | text | 地点出生 | Place of birth | 0 | pass |
| indonesia | B211A | Personal Information | gender | select | 性别 | Gender | 3 | pass |
| indonesia | B211A | Personal Information | nationality | text | 国籍 | Nationality | 0 | pass |
| indonesia | B211A | Personal Information | occupation | text | 职业 | Occupation | 0 | pass |
| indonesia | B211A | Personal Information | address | text | 地址 | Current address | 0 | pass |
| indonesia | B211A | Passport Details | passportNumber | text | 护照号码 | Passport number | 0 | pass |
| indonesia | B211A | Passport Details | passportIssueDate | date | 护照签发日期 | Passport issue date | 0 | pass |
| indonesia | B211A | Passport Details | passportExpiryDate | date | 护照到期日期 | Passport expiry date | 0 | pass |
| indonesia | B211A | Passport Details | issuingCountry | text | 签发国家 | Issuing country | 0 | pass |
| indonesia | B211A | Passport Details | issuingAuthority | text | 签发机构 | Issuing authority | 0 | pass |
| indonesia | B211A | Travel Details | arrivalDate | date | 预计抵达日期 | Intended arrival date | 0 | pass |
| indonesia | B211A | Travel Details | departureDate | date | 预计离开日期 | Intended departure date | 0 | pass |
| indonesia | B211A | Travel Details | portOfEntry | text | 预计入境 | Intended port of entry | 0 | pass |
| indonesia | B211A | Travel Details | purposeOfVisit | select | 目的访问 | Purpose of visit | 4 | pass |
| indonesia | B211A | Travel Details | accommodationName | text | 住宿 | Accommodation name | 0 | pass |
| indonesia | B211A | Travel Details | accommodationAddress | text | 住宿地址 | Accommodation address in Indonesia | 0 | pass |
| indonesia | B211A | Document Upload | passport_copy | file | 护照 | Passport bio page (scan or clear photo) | 0 | pass |
| indonesia | B211A | Document Upload | photo | file | 照片 | Recent passport-size photo | 0 | pass |
| indonesia | B211A | Document Upload | flight_booking | file | 确认 | Flight booking confirmation | 0 | pass |
| indonesia | B211A | Document Upload | hotel_booking | file | 住宿 | Hotel / accommodation booking | 0 | pass |
| indonesia | B211A | Document Upload | travel_itinerary | file | 旅行 | Travel itinerary | 0 | pass |
| indonesia | B211A | Document Upload | bank_statement | file | 个月 | Bank statement (last 3 months) | 0 | pass |
| indonesia | B211A | Review & Submit | review_confirmation | checkbox | 我确认以上信息准确无误，并与旅行证件一致 | I confirm all details are accurate and match my travel documents | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| future_country_registry_fallback | RAG_VISITOR_INTAKE_FALLBACK | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | surname | text | 姓氏（与护照一致） | Surname | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | given_names | text | 名字（与护照一致） | Given names | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | birth_country | country | 出生国家 | Country of birth | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | birth_province_or_state | text | 出生省州 | State/province of birth | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | birth_city | text | 出生城市 | City of birth | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | gender | select | 性别 | Gender | 2 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | nationality | country | 国籍 | Nationality | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | occupation | text | 职业 | Occupation | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | passport_number | text | 护照号码 | Passport number | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | passport_issuing_authority | text | 护照签发机关/签发地点 | Passport issuing authority | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | email | text | 电子邮箱 | Email address | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | phone | text | 电话 | Phone number | 0 | pass |
| universal_profile | UNIVERSAL_PROFILE | Universal Profile | address | textarea | 地址 | Residential address | 0 | pass |

