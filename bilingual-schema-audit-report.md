# Bilingual Schema Clarity Audit

Generated: 2026-08-07T15:17:30.053Z

## Summary

- Schema files scanned: 84
- Field schema sources scanned: 44
- Adjacent schema/rendering files listed: 40
- Countries/forms scanned: 44
- Fields audited: 2986
- Dropdown/radio/checkbox options audited: 18663
- Blocking issues: 0
- Warnings: 47
- Info findings: 286

## Schema Files

| source | country | schema | fields |
| --- | --- | --- | ---: |
| production visa_packages: Cambodia Tourist e-Visa | cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | 21 |
| production visa_packages: Cambodia Tourist eVisa | cambodia | tourist_evisa -> tourist_evisa | 21 |
| production visa_packages: Canada Temporary Resident Visa (TRV) + eTA | canada | CA_TRV -> CA_TRV | 21 |
| production visa_packages: Egypt e-Visa (Tourist) | egypt | EG_E_VISA -> EG_E_VISA | 74 |
| production visa_packages: France Schengen Short-Stay Visa | france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | 175 |
| production visa_packages: Germany Schengen Short-Stay Visa | germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | 175 |
| production visa_packages: Greece Schengen Short-Stay Visa | greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | 175 |
| production visa_packages: Hong Kong Visit Visa | hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | 21 |
| production visa_packages: India e-Visa (Tourist / Business / Medical / Conference) | india | IN_E_VISA -> IN_E_VISA | 21 |
| production visa_packages: Indonesia B211A Tourist Visa | indonesia | B211A -> ID_C1_TOURIST | 24 |
| production visa_packages: Indonesia B1 e-VoA | indonesia | ID_B1_EVOA -> ID_B1_EVOA | 18 |
| production visa_packages: Indonesia C1 Tourist Single Entry eVisa | indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | 24 |
| production visa_packages: Japan Tourist Visa (Short-Term Stay) | japan | JP_TOURIST -> JP_TOURIST | 76 |
| production visa_packages: Japan Short-Term eVisa / Visit Japan Web | japan | short_term_tourism_evisa -> short_term_tourism_evisa | 21 |
| production visa_packages: Laos Tourist e-Visa | laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | 21 |
| production visa_packages: Macau Visit Visa | macau | MO_VISIT_VISA -> MO_VISIT_VISA | 21 |
| production visa_packages: Malaysia Digital Arrival Card (MDAC) | malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | 21 |
| production visa_packages: Malaysia Tourist eVISA | malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | 76 |
| production visa_packages: Maldives IMUGA Traveller Declaration | maldives | MV_IMUGA -> MV_IMUGA | 21 |
| production visa_packages: Morocco Visitor Entry / eVisa | morocco | visa_free_or_evisa -> visa_free_or_evisa | 21 |
| production visa_packages: Netherlands Schengen Short-Stay Visa | netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | 175 |
| production visa_packages: New Zealand Visitor Visa | new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | 21 |
| production visa_packages: Philippines Philippines eTravel Arrival Card | philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | 69 |
| production visa_packages: Philippines Philippines eTravel Departure Card | philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | 60 |
| production visa_packages: Philippines 9(a) Temporary Visitor Visa + eTravel Declaration | philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | 70 |
| production visa_packages: Philippines Visitor Entry / eVisa | philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | 70 |
| production visa_packages: Portugal Schengen Short-Stay Visa | portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | 175 |
| production visa_packages: Russia Unified e-Visa | russia | RU_E_VISA -> RU_E_VISA | 21 |
| production visa_packages: Singapore Entry Visa / SG Arrival Card | singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | 21 |
| production visa_packages: Singapore SG Arrival Card | singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | 39 |
| production visa_packages: Singapore Visit Visa (Tourist / Social) | singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | 84 |
| production visa_packages: South Africa Visitor's Visa + eVisa | south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | 21 |
| production visa_packages: Korea C-3-9 Short-Term General Visa | south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | 105 |
| production visa_packages: Sri Lanka ETA (Electronic Travel Authorization) | sri_lanka | LK_ETA -> LK_ETA | 21 |
| production visa_packages: Taiwan Taiwan Online Entry Permit | taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | 93 |
| production visa_packages: Thailand Digital Arrival Card (TDAC) | thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 40 |
| production visa_packages: Thailand Tourist e-Visa | thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | 75 |
| production visa_packages: Türkiye Tourist e-Visa | turkey | TR_E_VISA -> TR_E_VISA | 21 |
| production visa_packages: UAE Tourist Visa | united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | 21 |
| production visa_packages: United Kingdom Standard Visitor Visa | united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | 253 |
| production visa_packages: US DS-160 B1/B2 Visitor Visa | united_states | DS160 -> DS160 | 325 |
| production visa_packages: Vietnam Tourist eVisa | vietnam | evisa_tourism -> VN_E_VISA | 61 |
| production visa_packages: Vietnam E-Visa | vietnam | VN_E_VISA -> VN_E_VISA | 61 |
| production visa_packages: Vietnam Pre-Arrival Information Declaration | vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 36 |

## Adjacent Schema And Rendering Sources

| source | purpose | coverage |
| --- | --- | --- |
| knowledge-base/scraped-form-fields.json | scraped_schema_fragment | Indonesia B211A scraped form fields |
| vietnam-visa-helper-v1/content-v2-1.js | vietnam_helper_artifact | Vietnam helper extension alternate content script |
| vietnam-visa-helper-v1/content.js | vietnam_helper_artifact | Vietnam helper extension source used as historical schema evidence |
| viza-fe/internal-website/app/actions/question-sets.ts | question_set_loader | question_field DB loader for future registry question sets |
| viza-fe/internal-website/app/actions/visa-form-fields.ts | schema_loader | Supabase visa_form_fields loader and bilingual normalization boundary |
| viza-fe/internal-website/app/api/field-guidance/route.ts | ai_help_text | field guidance labels, examples, option labels, and local fallback text |
| viza-fe/internal-website/components/application-steps/bilingual-review-panel.tsx | dynamic_review_panel | review column rendering for Chinese and English sides |
| viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx | dynamic_review_renderer | bilingual review labels and enum value display |
| viza-fe/internal-website/components/application-steps/review-step.tsx | legacy_review_renderer | legacy validation and review rows |
| viza-fe/internal-website/components/client/wizards/ae/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/au/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/ca/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/eg/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/id/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/in/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/jp/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/my/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/sa/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/schengen/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/th/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/tr/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/tw/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/uk/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/us/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/client/wizards/vn/config.ts | simplified_wizard_config | country simplified-form fields, options, declaration items, payload keys, and review rows |
| viza-fe/internal-website/components/dynamic-form-field.tsx | dynamic_field_renderer | date/country/select/radio/input display for localized labels and options |
| viza-fe/internal-website/components/dynamic-step-form.tsx | dynamic_form_renderer | two-column form labels, options, validation hints, and Ask AI trigger payloads |
| viza-fe/internal-website/lib/bilingual-schema-contract.ts | bilingual_contract | curated labels, helpers, placeholders, option labels, and resolver functions |
| viza-fe/internal-website/lib/client/visa-journeys/au-visitor-600.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/client/visa-journeys/id-tourist-b211a.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/client/visa-journeys/index.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/client/visa-journeys/schengen-c-short-stay.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/client/visa-journeys/types.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/client/visa-journeys/uk-standard-visitor.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/client/visa-journeys/us-ds160.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/client/visa-journeys/vn-e-visa.ts | country_registry | country/visa journey registry metadata |
| viza-fe/internal-website/lib/ds160-translations.ts | legacy_translation_map | legacy DS-160 label/option/placeholder fallback translations |
| viza-fe/internal-website/lib/rag-visitor-intake-form.ts | future_country_registry_fallback | RAG visitor intake fallback schema |
| viza-fe/internal-website/messages/en.json | locale_messages_en | simplified wizard English labels and review copy |
| viza-fe/internal-website/messages/zh.json | locale_messages_zh | simplified wizard Chinese labels and review copy |

## Issues

| country | schema | section | field_id | field_type | current_label_zh | current_label_en | issue_type | severity | suggested_label_zh | suggested_helper_zh | suggested_label_en | pass_fail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| cambodia | tourist_evisa -> tourist_evisa | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| cambodia | tourist_evisa -> tourist_evisa | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| cambodia | tourist_evisa -> tourist_evisa | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| canada | CA_TRV -> CA_TRV | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| canada | CA_TRV -> CA_TRV | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| canada | CA_TRV -> CA_TRV | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 配偶/伴侣完整姓名 |  | Spouse — Full name | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否目前持有或曾经持有其他护照？ |  | Do you currently hold or have you previously held any other passport? | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 职位/职称 |  | Position / Title | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | visited_egypt_before | radio | Have you ever visited Egypt before? | Have you ever visited Egypt before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问埃及？ |  | Have you ever visited Egypt before? | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Arab Republic of Egypt. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Arab Republic of Egypt. | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | complex_field_missing_helper_zh | warning | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 |  | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | Are you going to French overseas territories? | Are you going to French overseas territories? | legacy_runtime_label_fixed_by_contract | info | 您是否计划前往法国海外领地？ |  | Are you going to French overseas territories? | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | complex_field_missing_helper_zh | warning | 我已了解机场过境签证（ATV）及申根区过境规定 |  | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | complex_field_missing_helper_zh | warning | 签署日期 |  | Date of signing | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | complex_field_missing_helper_zh | warning | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 |  | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | Are you going to French overseas territories? | Are you going to French overseas territories? | legacy_runtime_label_fixed_by_contract | info | 您是否计划前往法国海外领地？ |  | Are you going to French overseas territories? | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | complex_field_missing_helper_zh | warning | 我已了解机场过境签证（ATV）及申根区过境规定 |  | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | complex_field_missing_helper_zh | warning | 签署日期 |  | Date of signing | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | complex_field_missing_helper_zh | warning | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 |  | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | Are you going to French overseas territories? | Are you going to French overseas territories? | legacy_runtime_label_fixed_by_contract | info | 您是否计划前往法国海外领地？ |  | Are you going to French overseas territories? | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | complex_field_missing_helper_zh | warning | 我已了解机场过境签证（ATV）及申根区过境规定 |  | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | complex_field_missing_helper_zh | warning | 签署日期 |  | Date of signing | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| india | IN_E_VISA -> IN_E_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| india | IN_E_VISA -> IN_E_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| india | IN_E_VISA -> IN_E_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | payment_method | radio | Payment Method | Payment Method | legacy_runtime_label_fixed_by_contract | info | 付款方式 |  | Payment Method | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | full_name | text | Full Name | Full Name | legacy_runtime_label_fixed_by_contract | info | 姓名 | 姓名须符合 ICAO 标准，并以拉丁字母填写。 | Full Name | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | mother_name | text | Mothers Name | Mothers Name | legacy_runtime_label_fixed_by_contract | info | 母亲姓名 |  | Mothers Name | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | postal_code | text | Postal Code | Postal Code | legacy_runtime_label_fixed_by_contract | info | 邮政编码 |  | Postal Code | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | district_name | text | District | District | legacy_runtime_label_fixed_by_contract | info | 区/县 |  | District | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | village_name | text | Village | Village | legacy_runtime_label_fixed_by_contract | info | 村/街区 |  | Village | pass |
| indonesia | B211A -> ID_C1_TOURIST | Review and submit | information_true_declaration | checkbox | 我声明本签证申请中提供的信息真实无误。 | I declare that the information I have provided in this visa application is true. | complex_field_missing_helper_zh | warning | 我声明本签证申请中提供的信息真实无误。 |  | I declare that the information I have provided in this visa application is true. | pass |
| indonesia | B211A -> ID_C1_TOURIST | Review and submit | billing_responsibility_declaration | checkbox | 声明 | I understand that the billing code/payment must be completed before the application can be processed. | legacy_runtime_label_fixed_by_contract | info | 我理解必须完成官方付款后申请才会继续处理。 |  | I understand that the billing code/payment must be completed before the application can be processed. | pass |
| indonesia | B211A -> ID_C1_TOURIST | Review and submit | billing_responsibility_declaration | checkbox | 我理解必须完成官方付款后申请才会继续处理。 | I understand that the billing code/payment must be completed before the application can be processed. | complex_field_missing_helper_zh | warning | 我理解必须完成官方付款后申请才会继续处理。 |  | I understand that the billing code/payment must be completed before the application can be processed. | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | payment_method | radio | Payment Method | Payment Method | legacy_runtime_label_fixed_by_contract | info | 付款方式 |  | Payment Method | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | full_name | text | Full Name | Full Name | legacy_runtime_label_fixed_by_contract | info | 姓名 | 姓名须符合 ICAO 标准，并以拉丁字母填写。 | Full Name | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | mother_name | text | Mothers Name | Mothers Name | legacy_runtime_label_fixed_by_contract | info | 母亲姓名 |  | Mothers Name | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | postal_code | text | Postal Code | Postal Code | legacy_runtime_label_fixed_by_contract | info | 邮政编码 |  | Postal Code | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Review and submit | information_true_declaration | checkbox | 我声明本签证申请中提供的信息真实无误。 | I declare that the information I have provided in this visa application is true. | complex_field_missing_helper_zh | warning | 我声明本签证申请中提供的信息真实无误。 |  | I declare that the information I have provided in this visa application is true. | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Review and submit | billing_responsibility_declaration | checkbox | 声明 | I understand that the billing code/payment must be completed before the application can be processed. | legacy_runtime_label_fixed_by_contract | info | 我理解必须完成官方付款后申请才会继续处理。 |  | I understand that the billing code/payment must be completed before the application can be processed. | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Review and submit | billing_responsibility_declaration | checkbox | 我理解必须完成官方付款后申请才会继续处理。 | I understand that the billing code/payment must be completed before the application can be processed. | complex_field_missing_helper_zh | warning | 我理解必须完成官方付款后申请才会继续处理。 |  | I understand that the billing code/payment must be completed before the application can be processed. | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | payment_method | radio | Payment Method | Payment Method | legacy_runtime_label_fixed_by_contract | info | 付款方式 |  | Payment Method | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | full_name | text | Full Name | Full Name | legacy_runtime_label_fixed_by_contract | info | 姓名 | 姓名须符合 ICAO 标准，并以拉丁字母填写。 | Full Name | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | mother_name | text | Mothers Name | Mothers Name | legacy_runtime_label_fixed_by_contract | info | 母亲姓名 |  | Mothers Name | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | postal_code | text | Postal Code | Postal Code | legacy_runtime_label_fixed_by_contract | info | 邮政编码 |  | Postal Code | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | district_name | text | District | District | legacy_runtime_label_fixed_by_contract | info | 区/县 |  | District | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | village_name | text | Village | Village | legacy_runtime_label_fixed_by_contract | info | 村/街区 |  | Village | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Review and submit | information_true_declaration | checkbox | 我声明本签证申请中提供的信息真实无误。 | I declare that the information I have provided in this visa application is true. | complex_field_missing_helper_zh | warning | 我声明本签证申请中提供的信息真实无误。 |  | I declare that the information I have provided in this visa application is true. | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Review and submit | billing_responsibility_declaration | checkbox | 声明 | I understand that the billing code/payment must be completed before the application can be processed. | legacy_runtime_label_fixed_by_contract | info | 我理解必须完成官方付款后申请才会继续处理。 |  | I understand that the billing code/payment must be completed before the application can be processed. | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Review and submit | billing_responsibility_declaration | checkbox | 我理解必须完成官方付款后申请才会继续处理。 | I understand that the billing code/payment must be completed before the application can be processed. | complex_field_missing_helper_zh | warning | 我理解必须完成官方付款后申请才会继续处理。 |  | I understand that the billing code/payment must be completed before the application can be processed. | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 配偶/伴侣完整姓名 |  | Spouse — Full name | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | legacy_runtime_label_fixed_by_contract | info | 是否目前持有或曾经持有其他护照？ |  | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | pass |
| japan | JP_TOURIST -> JP_TOURIST | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 职位/职称 |  | Position / Title | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | carrier_name | text | Name of ship or airline | Name of ship or airline | legacy_runtime_label_fixed_by_contract | info | 航空公司、船舶或交通承运人名称 |  | Name of ship or airline | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | visited_japan_before | radio | Have you ever stayed in Japan before? | Have you ever stayed in Japan before? | legacy_runtime_label_fixed_by_contract | info | 您以前是否曾在日本停留？ |  | Have you ever stayed in Japan before? | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | complex_field_missing_helper_zh | warning | 是否有需要申报的犯罪、逮捕或定罪记录？ |  | Have you ever been convicted of a crime in any country? | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 |  | Provide details (country, date, charge, sentence) | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | complex_field_missing_helper_zh | warning | 请说明犯罪、逮捕、指控或定罪记录的具体情况 |  | Provide details (country, date, charge, sentence) | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 |  | Provide details (country, date, reason) | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | overstay_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明逾期停留或违反签证条件的具体情况 |  | Provide details | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | has_drug_or_trafficking_history | radio | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | legacy_runtime_label_fixed_by_contract | info | 是否曾涉及吸毒、卖淫、人口贩运、走私或非法武器持有？ |  | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 |  | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | complex_field_missing_helper_zh | warning | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 |  | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Stay in Malaysia | postcode | text | Postcode | Postcode | legacy_runtime_label_fixed_by_contract | info | 邮政编码 |  | Postcode | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | race_ethnicity | text | Race / Ethnicity (as collected by Malaysian immigration) | Race / Ethnicity (as collected by Malaysian immigration) | legacy_runtime_label_fixed_by_contract | info | 种族/族群（按马来西亚移民要求填写） |  | Race / Ethnicity (as collected by Malaysian immigration) | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 配偶/伴侣完整姓名 |  | Spouse — Full name | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否目前持有或曾经持有其他护照？ |  | Do you currently hold or have you previously held any other passport? | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 职位/职称 |  | Position / Title | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | visited_malaysia_before | radio | Have you ever visited Malaysia before? | Have you ever visited Malaysia before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问马来西亚？ |  | Have you ever visited Malaysia before? | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Malaysia. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Malaysia. | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | complex_field_missing_helper_zh | warning | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 |  | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | Are you going to French overseas territories? | Are you going to French overseas territories? | legacy_runtime_label_fixed_by_contract | info | 您是否计划前往法国海外领地？ |  | Are you going to French overseas territories? | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | complex_field_missing_helper_zh | warning | 我已了解机场过境签证（ATV）及申根区过境规定 |  | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | complex_field_missing_helper_zh | warning | 签署日期 |  | Date of signing | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Registration | data_privacy_agreement | checkbox | By clicking Continue, you agree to our Data Privacy and Affidavit of Undertaking. | By clicking Continue, you agree to our Data Privacy and Affidavit of Undertaking. | legacy_runtime_label_fixed_by_contract | info | 点击继续即表示您同意数据隐私政策与承诺书 |  | By clicking Continue, you agree to our Data Privacy and Affidavit of Undertaking. | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | middle_name | text | Middle Name | Middle Name | legacy_runtime_label_fixed_by_contract | info | 中间名 |  | Middle Name | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | last_name | text | Last Name | Last Name | legacy_runtime_label_fixed_by_contract | info | 姓 |  | Last Name | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | suffix | select | Suffix | Suffix | legacy_runtime_label_fixed_by_contract | info | 姓名后缀 |  | Suffix | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | airline_name | select | Name of Airline | Name of Airline | legacy_runtime_label_fixed_by_contract | info | 航空公司名称 |  | Name of Airline | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | flight_number | select | 航班号 | Flight Number | option_list_missing | warning | 航班号 |  | Flight Number | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Health Declaration | has_exposure_to_sick_person_30d | radio | 出行前 30 天是否接触过患病或已知患有传染性 / 感染性疾病的人？ | Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel? | complex_field_missing_helper_zh | warning | 出行前 30 天是否接触过患病或已知患有传染性 / 感染性疾病的人？ |  | Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel? | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Health Declaration | sickness_symptom | select | Symptoms | Symptoms | legacy_runtime_label_fixed_by_contract | info | 症状 |  | Symptoms | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | accompanied_under_18_count | text | Below 18 yrs. old | Below 18 yrs. old | legacy_runtime_label_fixed_by_contract | info | 18 岁以下同行家人人数 |  | Below 18 yrs. old | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | accompanied_18_plus_count | text | 18 yrs. old and above | 18 yrs. old and above | legacy_runtime_label_fixed_by_contract | info | 18 岁及以上同行家人人数 |  | 18 yrs. old and above | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | checked_baggage_count | text | Checked-in (pcs) | Checked-in (pcs) | legacy_runtime_label_fixed_by_contract | info | 托运行李件数 |  | Checked-in (pcs) | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | handcarry_baggage_count | text | Hand-carried (pcs) | Hand-carried (pcs) | legacy_runtime_label_fixed_by_contract | info | 手提行李件数 |  | Hand-carried (pcs) | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_information_acknowledgement | checkbox | 信息 | I confirm that I have read and understood the customs and currency declaration information above. | legacy_runtime_label_fixed_by_contract | info | 我确认已阅读并理解海关及货币申报说明 |  | I confirm that I have read and understood the customs and currency declaration information above. | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | has_baggage_or_currency_to_declare | radio | Do you have baggage or currency to declare? | Do you have baggage or currency to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有行李或货币需要申报？ |  | Do you have baggage or currency to declare? | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_1 | radio | Philippine Currency and/or any Philippine Monetary Instrument in excess of PhP 50,000.00; (i.e. Check, Bank, Draft , etc); | Philippine Currency and/or any Philippine Monetary Instrument in excess of PhP 50,000.00; (i.e. Check, Bank, Draft , etc); | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 1 |  | Philippine Currency and/or any Philippine Monetary Instrument in excess of PhP 50,000.00; (i.e. Check, Bank, Draft , etc); | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_2 | radio | Foreign Currency and/or Foreign Monetary Instrument in excess of USD 10,000.00 or its equivalent; | Foreign Currency and/or Foreign Monetary Instrument in excess of USD 10,000.00 or its equivalent; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 2 |  | Foreign Currency and/or Foreign Monetary Instrument in excess of USD 10,000.00 or its equivalent; | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_3 | radio | Gambling Paraphernalia; | Gambling Paraphernalia; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 3 |  | Gambling Paraphernalia; | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_5 | radio | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 5 |  | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_6 | radio | Firearms, ammunitions and explosives; | Firearms, ammunitions and explosives; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 6 |  | Firearms, ammunitions and explosives; | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_8 | radio | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 8 |  | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_8 | radio | 海关申报项目 8 | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | complex_field_missing_helper_zh | warning | 海关申报项目 8 |  | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_10 | radio | Cremains (human ashes), human organs or tissues; | Cremains (human ashes), human organs or tissues; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 10 |  | Cremains (human ashes), human organs or tissues; | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_11 | radio | Jewelry, gold, precious metals or gems | Jewelry, gold, precious metals or gems | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 11 |  | Jewelry, gold, precious metals or gems | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_12 | radio | 其他 | Other goods, not mentioned above; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 12 |  | Other goods, not mentioned above; | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Declaration Signature | customs_signature_declaration | checkbox | 声明 | By clicking Next, I certify under pain of falsification that this declaration is true and correct to the best of my knowledge. | legacy_runtime_label_fixed_by_contract | info | 我确认本申报真实、正确，且已知虚假申报后果 |  | By clicking Next, I certify under pain of falsification that this declaration is true and correct to the best of my knowledge. | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Declaration Signature | customs_signature_declaration | checkbox | 我确认本申报真实、正确，且已知虚假申报后果 | By clicking Next, I certify under pain of falsification that this declaration is true and correct to the best of my knowledge. | complex_field_missing_helper_zh | warning | 我确认本申报真实、正确，且已知虚假申报后果 |  | By clicking Next, I certify under pain of falsification that this declaration is true and correct to the best of my knowledge. | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Declaration Signature | final_declaration | checkbox | 声明 | I certify that the information provided is true and correct. | legacy_runtime_label_fixed_by_contract | info | 我确认所填信息真实准确 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I certify that the information provided is true and correct. | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Travel Registration | data_privacy_agreement | checkbox | By clicking Continue, you agree to the Data Privacy and Affidavit of Undertaking. | By clicking Continue, you agree to the Data Privacy and Affidavit of Undertaking. | legacy_runtime_label_fixed_by_contract | info | 我同意数据隐私政策与承诺书 |  | By clicking Continue, you agree to the Data Privacy and Affidavit of Undertaking. | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | middle_name | text | Middle Name | Middle Name | legacy_runtime_label_fixed_by_contract | info | 中间名 |  | Middle Name | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | last_name | text | Last Name | Last Name | legacy_runtime_label_fixed_by_contract | info | 姓 |  | Last Name | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | suffix | select | Suffix | Suffix | legacy_runtime_label_fixed_by_contract | info | 姓名后缀 |  | Suffix | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | airline_name | select | Name of Airline | Name of Airline | legacy_runtime_label_fixed_by_contract | info | 航空公司名称 |  | Name of Airline | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | flight_number | select | 航班号 | Flight Number | option_list_missing | warning | 航班号 |  | Flight Number | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | vessel_name | text | Name of Vessel | Name of Vessel | legacy_runtime_label_fixed_by_contract | info | 船舶名称 |  | Name of Vessel | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_information_acknowledgement | checkbox | 信息 | I have read and understood the customs and currency declaration information. | legacy_runtime_label_fixed_by_contract | info | 我已阅读并理解海关及货币申报说明 |  | I have read and understood the customs and currency declaration information. | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_3 | radio | Gambling Paraphernalia; | Gambling Paraphernalia; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 3 |  | Gambling Paraphernalia; | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_5 | radio | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 5 |  | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_6 | radio | Firearms, ammunitions and explosives; | Firearms, ammunitions and explosives; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 6 |  | Firearms, ammunitions and explosives; | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_8 | radio | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 8 |  | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_8 | radio | 海关申报项目 8 | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | complex_field_missing_helper_zh | warning | 海关申报项目 8 |  | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_10 | radio | Cremains (human ashes), human organs or tissues; | Cremains (human ashes), human organs or tissues; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 10 |  | Cremains (human ashes), human organs or tissues; | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_11 | radio | Jewelry, gold, precious metals or gems | Jewelry, gold, precious metals or gems | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 11 |  | Jewelry, gold, precious metals or gems | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_12 | radio | 其他 | Other goods, not mentioned above; | legacy_runtime_label_fixed_by_contract | info | 海关申报项目 12 |  | Other goods, not mentioned above; | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | has_currency_to_declare | radio | Are you taking currency or monetary instruments above the permitted threshold out of the Philippines? | Are you taking currency or monetary instruments above the permitted threshold out of the Philippines? | legacy_runtime_label_fixed_by_contract | info | 携带出境的货币或货币工具是否超过允许限额？ |  | Are you taking currency or monetary instruments above the permitted threshold out of the Philippines? | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | currency_type | select | 声明 | Currency Declaration Type | legacy_runtime_label_fixed_by_contract | info | 货币申报类型 |  | Currency Declaration Type | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | currency_amount | text | Total Amount | Total Amount | legacy_runtime_label_fixed_by_contract | info | 申报总额 |  | Total Amount | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | currency_source | text | Source of Currency | Source of Currency | legacy_runtime_label_fixed_by_contract | info | 货币来源 |  | Source of Currency | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Declaration Signature | customs_signature_declaration | checkbox | 声明 | I certify that this customs and currency declaration is true and correct. | legacy_runtime_label_fixed_by_contract | info | 我确认海关及货币申报真实准确 |  | I certify that this customs and currency declaration is true and correct. | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Declaration Signature | customs_signature_declaration | checkbox | 我确认海关及货币申报真实准确 | I certify that this customs and currency declaration is true and correct. | complex_field_missing_helper_zh | warning | 我确认海关及货币申报真实准确 |  | I certify that this customs and currency declaration is true and correct. | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Declaration Signature | final_declaration | checkbox | 声明 | I certify that all information provided is true and correct. | legacy_runtime_label_fixed_by_contract | info | 我确认全部信息真实准确 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I certify that all information provided is true and correct. | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 配偶/伴侣完整姓名 |  | Spouse — Full name | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否目前持有或曾经持有其他护照？ |  | Do you currently hold or have you previously held any other passport? | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 职位/职称 |  | Position / Title | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | visited_philippines_before | radio | Have you ever visited the Philippines before? | Have you ever visited the Philippines before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问菲律宾？ |  | Have you ever visited the Philippines before? | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 配偶/伴侣完整姓名 |  | Spouse — Full name | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否目前持有或曾经持有其他护照？ |  | Do you currently hold or have you previously held any other passport? | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 职位/职称 |  | Position / Title | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | visited_philippines_before | radio | Have you ever visited the Philippines before? | Have you ever visited the Philippines before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问菲律宾？ |  | Have you ever visited the Philippines before? | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | complex_field_missing_helper_zh | warning | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 |  | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | Are you going to French overseas territories? | Are you going to French overseas territories? | legacy_runtime_label_fixed_by_contract | info | 您是否计划前往法国海外领地？ |  | Are you going to French overseas territories? | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | complex_field_missing_helper_zh | warning | 我已了解机场过境签证（ATV）及申根区过境规定 |  | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | complex_field_missing_helper_zh | warning | 签署日期 |  | Date of signing | pass |
| russia | RU_E_VISA -> RU_E_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| russia | RU_E_VISA -> RU_E_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| russia | RU_E_VISA -> RU_E_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | has_health_symptoms | radio | Do you currently have fever, cough, shortness of breath, headache, vomiting, dizziness or rash? | Do you currently have fever, cough, shortness of breath, headache, vomiting, dizziness or rash? | legacy_runtime_label_fixed_by_contract | info | 目前是否有发热、咳嗽、呼吸急促、头痛、呕吐、头晕或皮疹？ |  | Do you currently have fever, cough, shortness of breath, headache, vomiting, dizziness or rash? | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | carrier_code | select | Carrier Code | Carrier Code | legacy_runtime_label_fixed_by_contract | info | 航空公司代码 |  | Carrier Code | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | cruise_name | select | Cruise Name | Cruise Name | legacy_runtime_label_fixed_by_contract | info | 邮轮名称 |  | Cruise Name | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | vessel_name | text | Vessel Name | Vessel Name | legacy_runtime_label_fixed_by_contract | info | 船舶名称 |  | Vessel Name | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | race | select | Race | Race | legacy_runtime_label_fixed_by_contract | info | 种族/族群 |  | Race | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | religion | select | Religion | Religion | legacy_runtime_label_fixed_by_contract | info | 宗教信仰 |  | Religion | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 配偶/伴侣完整姓名 |  | Spouse — Full name | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否目前持有或曾经持有其他护照？ |  | Do you currently hold or have you previously held any other passport? | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 职位/职称 |  | Position / Title | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | visited_singapore_before | radio | Have you ever visited Singapore before? | Have you ever visited Singapore before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问新加坡？ |  | Have you ever visited Singapore before? | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Singapore. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Singapore. | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Official e-Form Route | applying_consulate | select | Consular office / overseas mission | Consular office / overseas mission | legacy_runtime_label_fixed_by_contract | info | 选择使领馆 |  | Consular office / overseas mission | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | telephone | text | Telephone (landline) | Telephone (landline) | legacy_runtime_label_fixed_by_contract | info | 固定电话 |  | Telephone (landline) | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education | radio | Highest education completed | Highest education completed | legacy_runtime_label_fixed_by_contract | info | 最高学历 |  | Highest education completed | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education_other | text | 其他 | Highest education — Other (please specify) | legacy_runtime_label_fixed_by_contract | info | 其他最高学历（请说明） |  | Highest education — Other (please specify) | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelled_to_korea_5y | radio | Have you travelled to Korea in the last 5 years? | Have you travelled to Korea in the last 5 years? | legacy_runtime_label_fixed_by_contract | info | 过去5年内是否访问过韩国？ |  | Have you travelled to Korea in the last 5 years? | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | assistant_full_name | text | Assistant — English full name | Assistant — English full name | legacy_runtime_label_fixed_by_contract | info | 协助填写人姓名 |  | Assistant — English full name | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | declaration_consent | checkbox | 声明 | I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea. | legacy_runtime_label_fixed_by_contract | info | 本人声明本申请表所填内容真实、正确，并知悉任何虚假陈述可能导致拒签或被拒绝入境韩国。 | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea. | pass |
| sri_lanka | LK_ETA -> LK_ETA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| sri_lanka | LK_ETA -> LK_ETA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| sri_lanka | LK_ETA -> LK_ETA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Delivery Location | continent | select | Continent | Continent | legacy_runtime_label_fixed_by_contract | info | 所在大洲 |  | Continent | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Delivery Location | embassy_office | select | Receiving embassy/office | Receiving embassy/office | legacy_runtime_label_fixed_by_contract | info | 受理驻外馆处/办事处 |  | Receiving embassy/office | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Photo & Basic Status | eligibility_category | radio | Eligibility category | Eligibility category | legacy_runtime_label_fixed_by_contract | info | 申请资格类别 |  | Eligibility category | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | name_chinese | text | Name in Chinese (traditional characters) | Name in Chinese (traditional characters) | legacy_runtime_label_fixed_by_contract | info | 中文姓名（繁体字） |  | Name in Chinese (traditional characters) | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | name_english | text | Name in English (as shown in passport, uppercase) | Name in English (as shown in passport, uppercase) | legacy_runtime_label_fixed_by_contract | info | 英文姓名（按护照填写大写字母） |  | Name in English (as shown in passport, uppercase) | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | job_title | text | Job title | Job title | legacy_runtime_label_fixed_by_contract | info | 职位名称 |  | Job title | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | traveling_with_parents | select | Are your parents traveling with you? | Are your parents traveling with you? | legacy_runtime_label_fixed_by_contract | info | 您的父母是否与您一同赴台？ |  | Are your parents traveling with you? | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_occupation | select | 父亲—职业 | Kin Father Occupation | option_list_missing | warning | 父亲—职业 |  | Kin Father Occupation | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_occupation | select | 母亲—职业 | Kin Mother Occupation | option_list_missing | warning | 母亲—职业 |  | Kin Mother Occupation | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | past_mainland_political_military_role | checkbox | 您过去是否曾在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？ | Applicant previously held a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group | complex_field_missing_helper_zh | warning | 您过去是否曾在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？ |  | Applicant previously held a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | past_role_detail | text | Previously served at | Previously served at | legacy_runtime_label_fixed_by_contract | info | 过去任职的机关、组织或团体全称 |  | Previously served at | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | current_mainland_political_military_role | checkbox | 您目前是否在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？ | Applicant currently holds a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group | complex_field_missing_helper_zh | warning | 您目前是否在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？ |  | Applicant currently holds a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | never_held_mainland_political_military_role | checkbox | Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership | Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership | legacy_runtime_label_fixed_by_contract | info | 本人从未在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份 |  | Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | accepted_terms | checkbox | I have read and accept the following terms and conditions | I have read and accept the following terms and conditions | legacy_runtime_label_fixed_by_contract | info | 我已阅读并同意以下条款与声明 |  | I have read and accept the following terms and conditions | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | middle_name | text | Middle Name | Middle Name | legacy_runtime_label_fixed_by_contract | info | 中间名 |  | Middle Name | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | sub_district | select | Sub-District, Sub-Area | Sub-District, Sub-Area | legacy_runtime_label_fixed_by_contract | info | 分区/乡（Tambon） |  | Sub-District, Sub-Area | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | postcode | text | Post Code | Post Code | legacy_runtime_label_fixed_by_contract | info | 邮政编码 |  | Post Code | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 健康申报 | yellow_fever_vaccination_certificate | radio | Do you have a Yellow Fever Vaccination Certificate? | Do you have a Yellow Fever Vaccination Certificate? | legacy_runtime_label_fixed_by_contract | info | 您是否持有黄热病疫苗接种证书？ |  | Do you have a Yellow Fever Vaccination Certificate? | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 健康申报 | health_symptoms_other | text | 其他 | Other Symptom - Please Specify | legacy_runtime_label_fixed_by_contract | info | 请说明其他症状 |  | Other Symptom - Please Specify | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | spouse_full_name | text | Spouse — Full name | Spouse — Full name | legacy_runtime_label_fixed_by_contract | info | 配偶/伴侣完整姓名 |  | Spouse — Full name | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | father_full_name | text | Father's full name | Father's full name | legacy_runtime_label_fixed_by_contract | info | 父亲完整名称 |  | Father's full name | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | mother_full_name | text | Mother's full name (including maiden name) | Mother's full name (including maiden name) | legacy_runtime_label_fixed_by_contract | info | 母亲完整名称 |  | Mother's full name (including maiden name) | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | has_other_passports | radio | 其他 | Do you currently hold or have you previously held any other passport? | legacy_runtime_label_fixed_by_contract | info | 是否目前持有或曾经持有其他护照？ |  | Do you currently hold or have you previously held any other passport? | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Occupation | position_title | text | Position / Title | Position / Title | legacy_runtime_label_fixed_by_contract | info | 职位/职称 |  | Position / Title | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | visited_thailand_before | radio | Have you ever visited Thailand before? | Have you ever visited Thailand before? | legacy_runtime_label_fixed_by_contract | info | 是否曾访问泰国？ |  | Have you ever visited Thailand before? | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 详情 | Provide details (country, date, charge, sentence) | legacy_runtime_label_fixed_by_contract | info | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Provide details (country, date, charge, sentence) | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 详情 | Provide details (country, date, reason) | legacy_runtime_label_fixed_by_contract | info | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Provide details (country, date, reason) | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 声明 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Thailand. | legacy_runtime_label_fixed_by_contract | info | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Thailand. | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Security and Background | has_previous_refusal | radio | 过往 | Have you ever been refused a visa or entry? | legacy_runtime_label_fixed_by_contract | info | 是否曾被拒签、被拒绝入境或被要求离境？ | 请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。 | Have you ever been refused a visa or entry? | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Security and Background | has_criminal_history | radio | Do you have any criminal history to declare? | Do you have any criminal history to declare? | legacy_runtime_label_fixed_by_contract | info | 是否有需要申报的犯罪记录？ | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Do you have any criminal history to declare? | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Security and Background | additional_notes | textarea | 补充 | Additional notes for review | legacy_runtime_label_fixed_by_contract | info | 补充说明 / 其他可能影响本次申请的信息 |  | Additional notes for review | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | parent_consent_letter_held | radio | 您是否持有父母双方或法定监护人签署的同意书？ | Do you have a signed letter of consent from both parents or legal guardians? | complex_field_missing_helper_zh | warning | 您是否持有父母双方或法定监护人签署的同意书？ |  | Do you have a signed letter of consent from both parents or legal guardians? | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | has_children | radio | Do you have any children under 18? | Do you have any children under 18? | legacy_runtime_label_fixed_by_contract | info | 您是否有未满18岁的子女？ |  | Do you have any children under 18? | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | children_travelling_with_you | radio | Are any of your children travelling with you? | Are any of your children travelling with you? | legacy_runtime_label_fixed_by_contract | info | 您的子女中是否有人与您同行？ |  | Are any of your children travelling with you? | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | deported_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 请说明具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Please give details | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | planned_spend_currency | select | Planned spend — currency | Planned spend — currency | legacy_runtime_label_fixed_by_contract | info | 计划花费——币种 |  | Planned spend — currency | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_description | textarea | Describe the engagement | Describe the engagement | legacy_runtime_label_fixed_by_contract | info | 请说明受邀从事的付费许可活动 |  | Describe the engagement | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_fee_amount | text | Fee or payment you will receive | Fee or payment you will receive | legacy_runtime_label_fixed_by_contract | info | 您将获得的费用或报酬金额 |  | Fee or payment you will receive | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | academic_qualifications_held | text | Highest academic qualification held in your field | Highest academic qualification held in your field | legacy_runtime_label_fixed_by_contract | info | 您在所在领域已获得的最高学历/学术资格 |  | Highest academic qualification held in your field | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_consultant_name | text | Name of the lead GMC-registered specialist | Name of the lead GMC-registered specialist | legacy_runtime_label_fixed_by_contract | info | 负责治疗的 GMC 注册专科医生姓名 |  | Name of the lead GMC-registered specialist | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | job_title | text | Job title | Job title | legacy_runtime_label_fixed_by_contract | info | 职位名称 |  | Job title | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | job_description | textarea | Describe your job | Describe your job | legacy_runtime_label_fixed_by_contract | info | 请描述您的工作 |  | Describe your job | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | has_savings | radio | Do you have any savings? | Do you have any savings? | legacy_runtime_label_fixed_by_contract | info | 您是否有储蓄？ |  | Do you have any savings? | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | savings_amount | text | Total savings (in local currency) | Total savings (in local currency) | legacy_runtime_label_fixed_by_contract | info | 储蓄总额（以当地货币计） |  | Total savings (in local currency) | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | criminal_convictions_details | textarea | 详情 | Please give details of any criminal convictions | legacy_runtime_label_fixed_by_contract | info | 请说明任何犯罪定罪的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Please give details of any criminal convictions | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | terrorism_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 请说明具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Please give details | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | war_crimes | radio | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | legacy_runtime_label_fixed_by_contract | info | 您是否曾参与或被怀疑参与战争罪、反人类罪或种族灭绝？ |  | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | war_crimes_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 请说明具体情况 |  | Please give details | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | organisations_concern_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 请说明具体情况 |  | Please give details | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | bad_character_details | textarea | 详情 | Please give details | legacy_runtime_label_fixed_by_contract | info | 请说明具体情况 |  | Please give details | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | applying_same_country_of_issue_and_residence | radio | 您是否在上述签证签发的同一国家或地点申请，且该国家或地点是否为您的主要居住地？ | Are you applying in the same country or location where the visa above was issued, and is this country or location your place of principal of residence? | complex_field_missing_helper_zh | warning | 您是否在上述签证签发的同一国家或地点申请，且该国家或地点是否为您的主要居住地？ |  | Are you applying in the same country or location where the visa above was issued, and is this country or location your place of principal of residence? | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_lost_or_stolen_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_cancelled_or_revoked_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | refusal_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | immigrant_petition_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Address and Phone | has_other_social_media | radio | 您是否愿意提供过去五年中使用的其他网站或应用程序的信息（用于创建或分享照片、视频、状态更新等内容）？ | Do you wish to provide information about your presence on any other websites or applications you have used within the last five years to create or share content (photos, videos, status updates, etc.)? | complex_field_missing_helper_zh | warning | 您是否愿意提供过去五年中使用的其他网站或应用程序的信息（用于创建或分享照片、视频、状态更新等内容）？ |  | Do you wish to provide information about your presence on any other websites or applications you have used within the last five years to create or share content (photos, videos, status updates, etc.)? | pass |
| united_states | DS160 -> DS160 | Passport Information | lost_passport_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | not_employed_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | specialized_skills_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | has_served_paramilitary | radio | 您是否曾在准军事组织、自卫组织、叛乱团体、游击队或暴动组织中服役、成为成员或参与其中？ | Have you ever served in, been a member of, or been involved with a paramilitary unit, vigilante unit, rebel group, guerrilla group, or insurgent organization? | complex_field_missing_helper_zh | warning | 您是否曾在准军事组织、自卫组织、叛乱团体、游击队或暴动组织中服役、成为成员或参与其中？ |  | Have you ever served in, been a member of, or been involved with a paramilitary unit, vigilante unit, rebel group, guerrilla group, or insurgent organization? | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | paramilitary_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | has_communicable_disease | radio | 您是否患有具有公共卫生意义的传染病？（具有公共卫生意义的传染病包括软下疳、淋病、腹股沟肉芽肿、传染性麻风病、性病性淋巴肉芽肿、传染期梅毒、活动性结核病以及卫生与公众服务部确定的其他疾病。） | Do you have a communicable disease of public health significance? (Communicable diseases of public significance include chancroid, gonorrhea, granuloma inguinale, infectious leprosy, lymphogranuloma venereum, infectious stage syphilis, active tuberculosis, and other diseases as determined by the Department of Health and Human Services.) | complex_field_missing_helper_zh | warning | 您是否患有具有公共卫生意义的传染病？（具有公共卫生意义的传染病包括软下疳、淋病、腹股沟肉芽肿、传染性麻风病、性病性淋巴肉芽肿、传染期梅毒、活动性结核病以及卫生与公众服务部确定的其他疾病。） |  | Do you have a communicable disease of public health significance? (Communicable diseases of public significance include chancroid, gonorrhea, granuloma inguinale, infectious leprosy, lymphogranuloma venereum, infectious stage syphilis, active tuberculosis, and other diseases as determined by the Department of Health and Human Services.) | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | has_communicable_disease_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | has_physical_mental_disorder_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | is_drug_abuser_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_arrest_conviction_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_violated_controlled_substance_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_prostitution_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_money_laundering_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_human_trafficking_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_aided_human_trafficking_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_trafficking_beneficiary_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | intend_illegal_activity_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | intend_terrorist_activity_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_provided_terrorist_support_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | is_terrorist_member_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | is_terrorist_family_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_genocide_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_torture_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_extrajudicial_killings | radio | 您是否曾实施、下令、煽动、协助或以其他方式参与法外杀戮、政治杀戮或其他暴力行为？ | Have you committed, ordered, incited, assisted, or otherwise participated in extrajudicial killings, political killings, or other acts of violence? | complex_field_missing_helper_zh | warning | 您是否曾实施、下令、煽动、协助或以其他方式参与法外杀戮、政治杀戮或其他暴力行为？ |  | Have you committed, ordered, incited, assisted, or otherwise participated in extrajudicial killings, political killings, or other acts of violence? | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_extrajudicial_killings_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_child_soldier_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_religious_freedom_violation_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_population_control | radio | 您是否曾直接参与建立或执行强迫妇女违背自由意愿接受堕胎或强迫男女违背自由意愿接受绝育的人口控制措施？ | Have you ever been directly involved in the establishment or enforcement of population controls forcing a woman to undergo an abortion against her free choice or a man or a woman to undergo sterilization against his or her free will? | complex_field_missing_helper_zh | warning | 您是否曾直接参与建立或执行强迫妇女违背自由意愿接受堕胎或强迫男女违背自由意愿接受绝育的人口控制措施？ |  | Have you ever been directly involved in the establishment or enforcement of population controls forcing a woman to undergo an abortion against her free choice or a man or a woman to undergo sterilization against his or her free will? | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_population_control_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_coercive_transplant_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 4 | has_immigration_fraud_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 4 | has_removal_order_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 | 请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。 | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_withheld_child_custody_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_voted_illegally_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_renounced_citizenship_explain | textarea | 说明 | Explain | legacy_runtime_label_fixed_by_contract | info | 请说明该问题回答为“是”的具体情况 |  | Explain | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | religion | text | Religion | Religion | legacy_runtime_label_fixed_by_contract | info | 宗教信仰 |  | Religion | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | has_violated_vietnam_laws | radio | Have you violated Vietnamese laws/regulations? | Have you violated Vietnamese laws/regulations? | legacy_runtime_label_fixed_by_contract | info | 是否曾违反越南法律或法规？ | 如曾在越南有违法、处罚、驱逐或类似记录，请选择“是”并说明。 | Have you violated Vietnamese laws/regulations? | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | visited_vietnam_in_last_year | radio | Have you ever been to Viet Nam in the last 01 year? | Have you ever been to Viet Nam in the last 01 year? | legacy_runtime_label_fixed_by_contract | info | 过去一年是否曾到访越南？ |  | Have you ever been to Viet Nam in the last 01 year? | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | has_relatives_in_vietnam | radio | Do you have relatives currently residing in Viet Nam? | Do you have relatives currently residing in Viet Nam? | legacy_runtime_label_fixed_by_contract | info | 您是否有亲属目前居住在越南？ |  | Do you have relatives currently residing in Viet Nam? | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | relative_full_name_in_vn | text | Relative's full name | Relative's full name | legacy_runtime_label_fixed_by_contract | info | 在越亲属姓名 |  | Relative's full name | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Trip Expenses & Insurance | expense_payment_method | select | Payment method | Payment method | legacy_runtime_label_fixed_by_contract | info | 付款方式 |  | Payment method | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Declaration | violation_of_vietnam_laws_details | textarea | 详情 | Details of Vietnamese law/regulation violation | legacy_runtime_label_fixed_by_contract | info | 请说明违反越南法律或法规的具体情况 | 请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。 | Details of Vietnamese law/regulation violation | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Declaration | final_declaration | checkbox | 声明 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | legacy_runtime_label_fixed_by_contract | info | 确认以上信息真实、准确、完整，并愿意对虚假申报承担责任 | 提交前请确认所有答案与护照、行程和上传材料一致。 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | religion | text | Religion | Religion | legacy_runtime_label_fixed_by_contract | info | 宗教信仰 |  | Religion | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | has_violated_vietnam_laws | radio | Have you violated Vietnamese laws/regulations? | Have you violated Vietnamese laws/regulations? | legacy_runtime_label_fixed_by_contract | info | 是否曾违反越南法律或法规？ | 如曾在越南有违法、处罚、驱逐或类似记录，请选择“是”并说明。 | Have you violated Vietnamese laws/regulations? | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | visited_vietnam_in_last_year | radio | Have you ever been to Viet Nam in the last 01 year? | Have you ever been to Viet Nam in the last 01 year? | legacy_runtime_label_fixed_by_contract | info | 过去一年是否曾到访越南？ |  | Have you ever been to Viet Nam in the last 01 year? | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | has_relatives_in_vietnam | radio | Do you have relatives currently residing in Viet Nam? | Do you have relatives currently residing in Viet Nam? | legacy_runtime_label_fixed_by_contract | info | 您是否有亲属目前居住在越南？ |  | Do you have relatives currently residing in Viet Nam? | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | relative_full_name_in_vn | text | Relative's full name | Relative's full name | legacy_runtime_label_fixed_by_contract | info | 在越亲属姓名 |  | Relative's full name | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Trip Expenses & Insurance | expense_payment_method | select | Payment method | Payment method | legacy_runtime_label_fixed_by_contract | info | 付款方式 |  | Payment method | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Declaration | violation_of_vietnam_laws_details | textarea | 详情 | Details of Vietnamese law/regulation violation | legacy_runtime_label_fixed_by_contract | info | 请说明违反越南法律或法规的具体情况 | 请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。 | Details of Vietnamese law/regulation violation | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Declaration | final_declaration | checkbox | 声明 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | legacy_runtime_label_fixed_by_contract | info | 确认以上信息真实、准确、完整，并愿意对虚假申报承担责任 | 提交前请确认所有答案与护照、行程和上传材料一致。 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | phone_country_code | select | 电话国家 / 地区代码 | Country Code | option_list_missing | warning | 电话国家 / 地区代码 |  | Country Code | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | visa_issued_place | select | 签发地点 | Issued Place | option_list_missing | warning | 签发地点 |  | Issued Place | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | land_border_gate | select | Border Gate | Border Gate | legacy_runtime_label_fixed_by_contract | info | 陆路口岸 |  | Border Gate | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | sea_port | select | Border Gate | Border Gate | legacy_runtime_label_fixed_by_contract | info | 海港口岸 |  | Border Gate | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | province_city_of_hotel | select | 酒店所在省 / 市 | Province / City of Hotel | option_list_missing | warning | 酒店所在省 / 市 |  | Province / City of Hotel | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | ward_commune_of_hotel | select | Ward / Commune of Hotel | Ward / Commune of Hotel | legacy_runtime_label_fixed_by_contract | info | 酒店所在坊 / 社 |  | Ward / Commune of Hotel | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | ward_commune_of_hotel | select | 酒店所在坊 / 社 | Ward / Commune of Hotel | option_list_missing | warning | 酒店所在坊 / 社 |  | Ward / Commune of Hotel | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | hotel_accommodation_address | select | 住宿地址 | Accommodation Address | option_list_missing | warning | 住宿地址 |  | Accommodation Address | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | workplace_information | textarea | 信息 | Workplace Information | legacy_runtime_label_fixed_by_contract | info | 工作单位信息 |  | Workplace Information | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 确认申报 | final_declaration | checkbox | 声明 | I confirm that the information is correct. | legacy_runtime_label_fixed_by_contract | info | 我确认以上信息真实、准确且完整 | 请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。 | I confirm that the information is correct. | pass |

## Field Pass Matrix

| country | schema | section | field_id | field_type | label_zh | label_en | options | pass_fail |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| cambodia | KH_TOURIST_E_VISA -> KH_TOURIST_E_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| cambodia | tourist_evisa -> tourist_evisa | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| canada | CA_TRV -> CA_TRV | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| canada | CA_TRV -> CA_TRV | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| canada | CA_TRV -> CA_TRV | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| canada | CA_TRV -> CA_TRV | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| canada | CA_TRV -> CA_TRV | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| canada | CA_TRV -> CA_TRV | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| canada | CA_TRV -> CA_TRV | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| canada | CA_TRV -> CA_TRV | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| canada | CA_TRV -> CA_TRV | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| canada | CA_TRV -> CA_TRV | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| canada | CA_TRV -> CA_TRV | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| canada | CA_TRV -> CA_TRV | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| canada | CA_TRV -> CA_TRV | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| canada | CA_TRV -> CA_TRV | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| canada | CA_TRV -> CA_TRV | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| canada | CA_TRV -> CA_TRV | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| canada | CA_TRV -> CA_TRV | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| canada | CA_TRV -> CA_TRV | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| canada | CA_TRV -> CA_TRV | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| canada | CA_TRV -> CA_TRV | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| canada | CA_TRV -> CA_TRV | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | place_of_birth_city | text | 出生城市 | Place of birth — City / Town | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | place_of_birth_country | country | 出生国家/地区 | Place of birth — Country | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | spouse_full_name | text | 配偶/伴侣完整姓名 | Spouse — Full name | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | spouse_nationality | country | 配偶/伴侣国籍 | Spouse — Nationality | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | has_other_passports | radio | 是否目前持有或曾经持有其他护照？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | home_address_line1 | text | 家庭住址街道/门牌/公寓信息 | Home address — Street / Apartment | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | home_address_city | text | 家庭住址城市 | Home address — City / Town | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | home_address_state | text | 家庭住址州/省 | Home address — State / Province | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | home_address_postcode | text | 家庭住址邮政编码 | Home address — Postal code | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | home_address_country | country | 家庭住址国家/地区 | Home address — Country | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | mobile_number | text | 手机号码 | Mobile number | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Occupation | current_profession | select | 当前职业/职业类别 | Current profession or occupation | 8 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Occupation | position_title | text | 职位/职称 | Position / Title | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | visa_type_requested | radio | 申请单次或多次入境电子签证 | Visa type requested | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Egypt | 1 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Egypt | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per visit) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | port_of_entry | select | 预计入境口岸 | Intended port of entry | 11 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | carrier_name | text | 航空公司、船舶或交通承运人名称 | Name of airline, ship, or transport carrier | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Egypt | 6 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Egypt | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City in Egypt | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Host in Egypt | has_host_in_egypt | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Egypt? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Host in Egypt | host_full_name | text | 邀请人/接待方完整姓名 | Host — Full name | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Host in Egypt | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Host in Egypt | host_address | text | 接待方地址 | Host — Address in Egypt | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Host in Egypt | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Host in Egypt | host_nationality | country | 接待方国籍 | Host — Nationality | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | visited_egypt_before | radio | 是否曾访问埃及？ | Have you ever visited Egypt before? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | prior_egypt_visit_arrival_date | date | 访问抵达日期 | Prior Egypt visit — Arrival date | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | prior_egypt_visit_departure_date | date | 访问离开日期 | Prior Egypt visit — Departure date | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | prior_egypt_visit_purpose | text | 访问目的 | Prior Egypt visit — Purpose | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | refused_visa_or_entry_egypt | radio | 是否曾被埃及拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Egypt? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | refused_visa_egypt_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Egypt or any other country? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, or any activity that might endanger public order or national security? | 2 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| egypt | EG_E_VISA -> EG_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Arab Republic of Egypt. | 1 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname | text | 姓氏（与护照一致） | Surname (family name) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth_different | radio | 出生时姓氏是否与当前姓氏不同？ | Is your surname at birth different from your current surname? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth | text | 出生时姓氏/曾用姓氏 | Surname at birth (former family name(s)) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | given_names | text | 名字（与护照一致） | First name(s) (given name(s)) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | place_of_birth | text | 出生地点（城市/地区） | Place of birth (city or town) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | current_nationality | country | 当前国籍 | Current nationality | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth_different | radio | 出生时国籍是否与当前国籍不同？ | Is your nationality at birth different from your current nationality? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth | country | 出生时国籍 | Nationality at birth | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationalities? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | sex | select | 性别 | Sex | 3 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status | select | 婚姻/民事伴侣状态 | Civil status | 7 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status_other | text | 请说明您的婚姻状况 | Please specify your civil status | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | is_applicant_minor | radio | 是否申请人？ | Will you be under 18 on the date you plan to travel to the Schengen Area? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_surname | text | 父母机构姓氏 | Surname of parental authority / legal guardian | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_given_names | text | 父母机构名字姓名 | First name(s) of parental authority / legal guardian | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_line_1 | text | 父母机构地址行 | Address — line 1 (if different from applicant's) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_city | text | 城市 | City | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_country | country | 国家 | Country | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_phone | text | 父母机构电话 | Telephone number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_email | text | 父母机构邮箱 | E-mail address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_nationality | country | 父母机构国籍 | Nationality | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | has_national_id | radio | 您是否有国民身份证号码？ | Do you have a national identity number? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | national_id_number | text | 国民身份证号码 | National identity number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type | select | 旅行证件类型 | Type of travel document | 6 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type_other | text | 旅行证件其他 | Please specify the travel document type | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_number | text | 旅行证件号码 | Travel document number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issue_date | date | 旅行证件签发日期 | Date of issue | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_expiry_date | date | 旅行证件有效期至 | Valid until | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issuing_country | country | 旅行证件签发国家/地区 | Issued by (country) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | has_eu_family_member | radio | 是否家庭成员？ | Are you a family member of an EU, EEA or Swiss citizen, or of a UK national who is a beneficiary of the EU-UK Withdrawal Agreement? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_surname | text | 欧盟家庭姓氏 | Surname of the EU/EEA/CH family member | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_given_names | text | 欧盟家庭名字姓名 | First name(s) of the EU/EEA/CH family member | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_nationality | country | 欧盟家庭国籍 | Nationality | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_type | select | 欧盟家庭旅行证件 | Type of travel document or ID card | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_number | text | 欧盟家庭旅行证件号码 | Travel document / ID card number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_relationship | select | 欧盟家庭关系 | Family relationship | 6 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_city | text | 家庭住址城市 | Town or city | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_postcode | text | 家庭住址邮政编码 | Postcode / ZIP code | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_country | country | 家庭住址国家/地区 | Country | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | email_address | text | 电子邮箱地址 | E-mail address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | phone_number | text | 电话号码（含国家代码） | Telephone number (including country code) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country_different | radio | 是否居住国家/地区？ | Do you reside in a country other than your country of current nationality? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country | country | 居住国家 | Country of residence | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_number | text | 居留许可或同等证件号码 | Residence permit or equivalent number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_expiry_date | date | 居留许可有效期至 | Residence permit valid until | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | is_student | radio | 您是否是学生？ | Are you a student? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_name | text | 雇主名称 | Employer name | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | fv_business_segment | select | 商务 | France-Visas sector | 6 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_address_line_1 | text | 雇主地址行 | Employer address — line 1 | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_city | text | 雇主城市 | Employer city | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_country | country | 雇主国家 | Employer country | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_phone | text | 雇主电话 | Employer telephone number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_name | text | 学校名称 | Name of educational establishment | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_email | text | 雇主邮箱 | Employer email address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_address | text | 学校地址 | Address of educational establishment | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_phone | text | 学校电话 | Telephone number of educational establishment | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_of_journey | select | 本次旅行目的 | Main purpose of the journey | 10 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_additional_info | textarea | 停留目的补充信息 | Additional information on the purpose of stay | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | main_destination_country | country | 主要目的地成员国 | Member State of main destination | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | first_entry_country | country | 首次入境成员国 | Member State of first entry | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | number_of_entries_requested | select | 申请入境次数 | Number of entries requested | 3 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_duration_days | text | 预计停留或过境时长（天数） | Duration of the intended stay or transit (number of days) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | departure_from_origin_date | date | 从居住国出发日期 | Date of departure from your country of residence | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in the Schengen Area | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from the Schengen Area | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | 您是否计划前往法国海外领地？ | Are you going to French overseas territories? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_surname | text | 邀请人/接待方姓氏 | Host's surname | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_given_names | text | 邀请人/接待方名字 | Host's first name(s) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_relationship | text | 邀请人/接待方与申请人的关系 | Relationship to the host | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_address_line_1 | text | 邀请人/接待方地址第一行 | Host's address — line 1 | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_city | text | 邀请人/接待方所在城市 | Host's city | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_country | country | 邀请人/接待方所在国家 | Host's country (Schengen Member State) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_phone | text | 邀请人/接待方电话 | Host's telephone number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_email | text | 邀请人/接待方电子邮箱 | Host's e-mail address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_nationality | country | 接待方国籍 | Host's nationality | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_legal_status_schengen | select | 接待方法定状态申根 | Host's legal status in the Schengen Area | 4 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_name | text | 商务公司 | Inviting company / organisation name | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_address_line_1 | text | 商务公司地址行 | Company address — line 1 | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_city | text | 商务公司城市 | Company city | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_country | country | 商务公司国家 | Company country (Schengen Member State) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_phone | text | 商务公司电话 | Company telephone number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_surname | text | 商务联系人姓氏 | Company contact surname | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_given_names | text | 商务联系人名字姓名 | Company contact first name(s) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_email | text | 商务联系人邮箱 | Company contact e-mail | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_address | text | 商务联系人地址 | Company contact address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_phone | text | 商务联系人电话 | Company contact telephone number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_invitation_letter_held | radio | 是否商务？ | Do you have a formal invitation letter from the company? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_name | text | 学习机构 | Name of the educational institution | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_address | text | 学习机构地址 | Institution address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_country | country | 学习机构国家 | Institution country (Schengen Member State) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_name | text | 学习 | Course or programme name | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_start_date | date | 学习开始日期 | Course start date | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_duration | text | 学习 | Course duration | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_acceptance_letter_held | radio | 您是否持有学校或教育机构出具的录取/接收证明？ | Do you have an acceptance letter from the institution? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_name | text | 医疗 | Name of the hospital or clinic | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_address | text | 医疗地址 | Hospital or clinic address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_country | country | 医疗国家 | Hospital or clinic country (Schengen Member State) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_type | text | 医疗 | Type of treatment | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_start_date | date | 医疗开始日期 | Treatment start date | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_duration | text | 医疗 | Treatment duration | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_costs_prepaid | radio | 医疗费用是否已经预付，或已由医疗机构确认付款安排？ | Have treatment costs been prepaid or confirmed by the facility? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_name | text | 活动 | Name of the event | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_organizer | text | 活动 | Event organiser | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_location | text | 活动 | Event location (city and venue) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_country | country | 活动国家 | Event country (Schengen Member State) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_start_date | date | 活动开始日期 | Event start date | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_end_date | date | 活动结束日期 | Event end date | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_invitation_letter_held | radio | 您是否持有活动主办方出具的邀请函？ | Do you have an invitation letter from the organiser? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_country | country | 过境目的地国家 | Final destination country (outside Schengen) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_onward_ticket_held | radio | 您是否持有已确认的续程机票？ | Do you hold a confirmed onward flight ticket? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_visa_held | radio | 是否签证？ | Do you hold an entry visa for the final destination (if required)? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | other_purpose_explain | textarea | 其他目的 | Please describe the purpose of your journey | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | tourism_itinerary_summary | textarea | 旅游 | Brief summary of your planned itinerary | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_airside_only | radio | 您是否会一直停留在申根机场的国际中转区内，不办理入境手续？ | Will you remain in the international transit area of the Schengen airport(s) without passing through immigration? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_type | select | 住宿类型 | Type of accommodation in the Schengen Area | 4 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_name | text | 住宿地点或接待方名称 | Hotel name or accommodation label | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_address_line_1 | text | 住宿地址——第1行 | Accommodation address — line 1 | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_city | text | 城市 | City | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_country | country | 住宿国家 | Country (Schengen Member State) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_phone | text | 住宿联系电话 | Accommodation telephone number | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_email | text | 住宿电子邮箱 | Accommodation e-mail address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | hotel_confirmation_number | text | 酒店/预订确认号（如有） | Hotel / booking confirmation number (if available) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_other_explain | textarea | 住宿其他 | Please describe your accommodation arrangements | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_schengen_fingerprints_given | radio | 是否名字？ | Have your fingerprints been collected previously for the purpose of applying for a Schengen visa? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_date | date | 日期 | Date fingerprints were collected (if known) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_visa_sticker | text | 签证 | Number of the visa (if known) | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | has_entry_permit_final_destination | radio | 是否入境许可最终？ | Do you hold an entry permit for the final country of destination (where applicable)? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_issuing_authority | text | 入境许可签发机构 | Entry permit — issued by | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_from | date | 入境许可有效 | Entry permit — valid from | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_until | date | 入境许可有效至 | Entry permit — valid until | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa | radio | 是否曾被拒发申根签证？ | Have you ever been refused a Schengen visa? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please provide details of the refusal | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | cost_covered_by | select | 谁将承担本次旅行和停留费用？ | Who will cover the cost of travelling and living during your stay? | 3 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_cash | radio | 方式现金 | Self: cash | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_travellers_cheques | radio | 方式旅行支票 | Self: traveller's cheques | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_credit_card | radio | 方式信用卡 | Self: credit card | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_accommodation | radio | 方式预付住宿 | Self: pre-paid accommodation | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_transport | radio | 方式预付交通 | Self: pre-paid transport | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other | radio | 方式其他 | Self: other means of support | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other_explain | text | 方式其他 | Please describe the other means of support | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_type | select | 担保人/资助方类型 | Type of sponsor | 4 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_name | text | 担保人/资助方名称 | Sponsor name | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_relationship | text | 担保人/资助方与申请人的关系 | Relationship to sponsor | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_address | text | 担保人/资助方地址 | Sponsor address | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_cash | radio | 担保人方式现金 | Sponsor: cash | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_accommodation_provided | radio | 担保人方式住宿 | Sponsor: accommodation provided | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_all_expenses_covered | radio | 担保人方式 | Sponsor: all expenses covered during the stay | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_prepaid_transport | radio | 担保人方式预付交通 | Sponsor: pre-paid transport | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other | radio | 担保人方式其他 | Sponsor: other means of support | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other_explain | text | 担保人方式其他 | Please describe the other sponsor means of support | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | has_different_filler | radio | 本申请是否由申请人本人以外的其他人填写？ | Is the application being filled in by someone other than the applicant? | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_surname | text | 填表人姓氏 | Surname of the person filling in the application form | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_given_names | text | 填表人名字 | First name(s) of the person filling in the application form | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_address | text | 填表人地址 | Address of the person filling in the application form | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_email | text | 填表人电子邮箱 | E-mail address of the person filling in the application form | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_phone | text | 填表人电话号码 | Telephone number of the person filling in the application form | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | place_of_application | text | 申请提交地点 / 当前申请所在地 | Place of application | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | 0 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_fee_not_refunded_awareness | radio | 我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。 | I am aware that the visa fee is not refunded if the visa is refused. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_insurance_multi_entry_awareness | radio | 我已知悉：如获发多次入境签证，每次进入成员国领土时均需持有足够的旅行医疗保险。 | Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_vis_consent | radio | 我已知悉并同意签证申请数据、照片和指纹的收集、处理与保存 | I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_data_rights_awareness | radio | 我已知悉我对 VIS 中个人数据的查询、更正和依法删除权利 | I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_truthfulness | radio | 我声明本申请所填信息真实、正确且完整 | I declare that to the best of my knowledge all particulars supplied by me are correct and complete. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_awareness_refusal | radio | 我已知悉虚假陈述可能导致拒签、已发签证被撤销并承担法律责任 | I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_undertaking_to_leave | radio | 我承诺在获发签证的有效期届满前离开成员国领土 | I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States. | 2 | pass |
| france | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | additional_information | textarea | 补充说明 / 其他可能影响本次申请的信息 | Is there anything else you would like to tell us about your application? | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname | text | 姓氏（与护照一致） | Surname (family name) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth_different | radio | 出生时姓氏是否与当前姓氏不同？ | Is your surname at birth different from your current surname? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth | text | 出生时姓氏/曾用姓氏 | Surname at birth (former family name(s)) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | given_names | text | 名字（与护照一致） | First name(s) (given name(s)) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | place_of_birth | text | 出生地点（城市/地区） | Place of birth (city or town) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | current_nationality | country | 当前国籍 | Current nationality | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth_different | radio | 出生时国籍是否与当前国籍不同？ | Is your nationality at birth different from your current nationality? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth | country | 出生时国籍 | Nationality at birth | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationalities? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | sex | select | 性别 | Sex | 3 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status | select | 婚姻/民事伴侣状态 | Civil status | 7 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status_other | text | 请说明您的婚姻状况 | Please specify your civil status | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | is_applicant_minor | radio | 是否申请人？ | Will you be under 18 on the date you plan to travel to the Schengen Area? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_surname | text | 父母机构姓氏 | Surname of parental authority / legal guardian | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_given_names | text | 父母机构名字姓名 | First name(s) of parental authority / legal guardian | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_line_1 | text | 父母机构地址行 | Address — line 1 (if different from applicant's) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_city | text | 城市 | City | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_country | country | 国家 | Country | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_phone | text | 父母机构电话 | Telephone number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_email | text | 父母机构邮箱 | E-mail address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_nationality | country | 父母机构国籍 | Nationality | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | has_national_id | radio | 您是否有国民身份证号码？ | Do you have a national identity number? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | national_id_number | text | 国民身份证号码 | National identity number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type | select | 旅行证件类型 | Type of travel document | 6 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type_other | text | 旅行证件其他 | Please specify the travel document type | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_number | text | 旅行证件号码 | Travel document number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issue_date | date | 旅行证件签发日期 | Date of issue | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_expiry_date | date | 旅行证件有效期至 | Valid until | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issuing_country | country | 旅行证件签发国家/地区 | Issued by (country) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | has_eu_family_member | radio | 是否家庭成员？ | Are you a family member of an EU, EEA or Swiss citizen, or of a UK national who is a beneficiary of the EU-UK Withdrawal Agreement? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_surname | text | 欧盟家庭姓氏 | Surname of the EU/EEA/CH family member | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_given_names | text | 欧盟家庭名字姓名 | First name(s) of the EU/EEA/CH family member | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_nationality | country | 欧盟家庭国籍 | Nationality | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_type | select | 欧盟家庭旅行证件 | Type of travel document or ID card | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_number | text | 欧盟家庭旅行证件号码 | Travel document / ID card number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_relationship | select | 欧盟家庭关系 | Family relationship | 6 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_city | text | 家庭住址城市 | Town or city | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_postcode | text | 家庭住址邮政编码 | Postcode / ZIP code | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_country | country | 家庭住址国家/地区 | Country | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | email_address | text | 电子邮箱地址 | E-mail address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | phone_number | text | 电话号码（含国家代码） | Telephone number (including country code) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country_different | radio | 是否居住国家/地区？ | Do you reside in a country other than your country of current nationality? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country | country | 居住国家 | Country of residence | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_number | text | 居留许可或同等证件号码 | Residence permit or equivalent number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_expiry_date | date | 居留许可有效期至 | Residence permit valid until | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | is_student | radio | 您是否是学生？ | Are you a student? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_name | text | 雇主名称 | Employer name | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | fv_business_segment | select | 商务 | France-Visas sector | 6 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_address_line_1 | text | 雇主地址行 | Employer address — line 1 | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_city | text | 雇主城市 | Employer city | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_country | country | 雇主国家 | Employer country | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_phone | text | 雇主电话 | Employer telephone number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_name | text | 学校名称 | Name of educational establishment | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_email | text | 雇主邮箱 | Employer email address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_address | text | 学校地址 | Address of educational establishment | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_phone | text | 学校电话 | Telephone number of educational establishment | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_of_journey | select | 本次旅行目的 | Main purpose of the journey | 10 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_additional_info | textarea | 停留目的补充信息 | Additional information on the purpose of stay | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | main_destination_country | country | 主要目的地成员国 | Member State of main destination | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | first_entry_country | country | 首次入境成员国 | Member State of first entry | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | number_of_entries_requested | select | 申请入境次数 | Number of entries requested | 3 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_duration_days | text | 预计停留或过境时长（天数） | Duration of the intended stay or transit (number of days) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | departure_from_origin_date | date | 从居住国出发日期 | Date of departure from your country of residence | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in the Schengen Area | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from the Schengen Area | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | 您是否计划前往法国海外领地？ | Are you going to French overseas territories? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_surname | text | 邀请人/接待方姓氏 | Host's surname | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_given_names | text | 邀请人/接待方名字 | Host's first name(s) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_relationship | text | 邀请人/接待方与申请人的关系 | Relationship to the host | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_address_line_1 | text | 邀请人/接待方地址第一行 | Host's address — line 1 | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_city | text | 邀请人/接待方所在城市 | Host's city | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_country | country | 邀请人/接待方所在国家 | Host's country (Schengen Member State) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_phone | text | 邀请人/接待方电话 | Host's telephone number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_email | text | 邀请人/接待方电子邮箱 | Host's e-mail address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_nationality | country | 接待方国籍 | Host's nationality | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_legal_status_schengen | select | 接待方法定状态申根 | Host's legal status in the Schengen Area | 4 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_name | text | 商务公司 | Inviting company / organisation name | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_address_line_1 | text | 商务公司地址行 | Company address — line 1 | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_city | text | 商务公司城市 | Company city | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_country | country | 商务公司国家 | Company country (Schengen Member State) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_phone | text | 商务公司电话 | Company telephone number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_surname | text | 商务联系人姓氏 | Company contact surname | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_given_names | text | 商务联系人名字姓名 | Company contact first name(s) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_email | text | 商务联系人邮箱 | Company contact e-mail | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_address | text | 商务联系人地址 | Company contact address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_phone | text | 商务联系人电话 | Company contact telephone number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_invitation_letter_held | radio | 是否商务？ | Do you have a formal invitation letter from the company? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_name | text | 学习机构 | Name of the educational institution | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_address | text | 学习机构地址 | Institution address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_country | country | 学习机构国家 | Institution country (Schengen Member State) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_name | text | 学习 | Course or programme name | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_start_date | date | 学习开始日期 | Course start date | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_duration | text | 学习 | Course duration | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_acceptance_letter_held | radio | 您是否持有学校或教育机构出具的录取/接收证明？ | Do you have an acceptance letter from the institution? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_name | text | 医疗 | Name of the hospital or clinic | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_address | text | 医疗地址 | Hospital or clinic address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_country | country | 医疗国家 | Hospital or clinic country (Schengen Member State) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_type | text | 医疗 | Type of treatment | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_start_date | date | 医疗开始日期 | Treatment start date | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_duration | text | 医疗 | Treatment duration | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_costs_prepaid | radio | 医疗费用是否已经预付，或已由医疗机构确认付款安排？ | Have treatment costs been prepaid or confirmed by the facility? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_name | text | 活动 | Name of the event | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_organizer | text | 活动 | Event organiser | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_location | text | 活动 | Event location (city and venue) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_country | country | 活动国家 | Event country (Schengen Member State) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_start_date | date | 活动开始日期 | Event start date | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_end_date | date | 活动结束日期 | Event end date | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_invitation_letter_held | radio | 您是否持有活动主办方出具的邀请函？ | Do you have an invitation letter from the organiser? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_country | country | 过境目的地国家 | Final destination country (outside Schengen) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_onward_ticket_held | radio | 您是否持有已确认的续程机票？ | Do you hold a confirmed onward flight ticket? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_visa_held | radio | 是否签证？ | Do you hold an entry visa for the final destination (if required)? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | other_purpose_explain | textarea | 其他目的 | Please describe the purpose of your journey | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | tourism_itinerary_summary | textarea | 旅游 | Brief summary of your planned itinerary | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_airside_only | radio | 您是否会一直停留在申根机场的国际中转区内，不办理入境手续？ | Will you remain in the international transit area of the Schengen airport(s) without passing through immigration? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_type | select | 住宿类型 | Type of accommodation in the Schengen Area | 4 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_name | text | 住宿地点或接待方名称 | Hotel name or accommodation label | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_address_line_1 | text | 住宿地址——第1行 | Accommodation address — line 1 | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_city | text | 城市 | City | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_country | country | 住宿国家 | Country (Schengen Member State) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_phone | text | 住宿联系电话 | Accommodation telephone number | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_email | text | 住宿电子邮箱 | Accommodation e-mail address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | hotel_confirmation_number | text | 酒店/预订确认号（如有） | Hotel / booking confirmation number (if available) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_other_explain | textarea | 住宿其他 | Please describe your accommodation arrangements | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_schengen_fingerprints_given | radio | 是否名字？ | Have your fingerprints been collected previously for the purpose of applying for a Schengen visa? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_date | date | 日期 | Date fingerprints were collected (if known) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_visa_sticker | text | 签证 | Number of the visa (if known) | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | has_entry_permit_final_destination | radio | 是否入境许可最终？ | Do you hold an entry permit for the final country of destination (where applicable)? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_issuing_authority | text | 入境许可签发机构 | Entry permit — issued by | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_from | date | 入境许可有效 | Entry permit — valid from | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_until | date | 入境许可有效至 | Entry permit — valid until | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa | radio | 是否曾被拒发申根签证？ | Have you ever been refused a Schengen visa? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please provide details of the refusal | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | cost_covered_by | select | 谁将承担本次旅行和停留费用？ | Who will cover the cost of travelling and living during your stay? | 3 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_cash | radio | 方式现金 | Self: cash | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_travellers_cheques | radio | 方式旅行支票 | Self: traveller's cheques | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_credit_card | radio | 方式信用卡 | Self: credit card | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_accommodation | radio | 方式预付住宿 | Self: pre-paid accommodation | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_transport | radio | 方式预付交通 | Self: pre-paid transport | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other | radio | 方式其他 | Self: other means of support | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other_explain | text | 方式其他 | Please describe the other means of support | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_type | select | 担保人/资助方类型 | Type of sponsor | 4 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_name | text | 担保人/资助方名称 | Sponsor name | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_relationship | text | 担保人/资助方与申请人的关系 | Relationship to sponsor | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_address | text | 担保人/资助方地址 | Sponsor address | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_cash | radio | 担保人方式现金 | Sponsor: cash | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_accommodation_provided | radio | 担保人方式住宿 | Sponsor: accommodation provided | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_all_expenses_covered | radio | 担保人方式 | Sponsor: all expenses covered during the stay | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_prepaid_transport | radio | 担保人方式预付交通 | Sponsor: pre-paid transport | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other | radio | 担保人方式其他 | Sponsor: other means of support | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other_explain | text | 担保人方式其他 | Please describe the other sponsor means of support | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | has_different_filler | radio | 本申请是否由申请人本人以外的其他人填写？ | Is the application being filled in by someone other than the applicant? | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_surname | text | 填表人姓氏 | Surname of the person filling in the application form | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_given_names | text | 填表人名字 | First name(s) of the person filling in the application form | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_address | text | 填表人地址 | Address of the person filling in the application form | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_email | text | 填表人电子邮箱 | E-mail address of the person filling in the application form | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_phone | text | 填表人电话号码 | Telephone number of the person filling in the application form | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | place_of_application | text | 申请提交地点 / 当前申请所在地 | Place of application | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | 0 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_fee_not_refunded_awareness | radio | 我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。 | I am aware that the visa fee is not refunded if the visa is refused. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_insurance_multi_entry_awareness | radio | 我已知悉：如获发多次入境签证，每次进入成员国领土时均需持有足够的旅行医疗保险。 | Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_vis_consent | radio | 我已知悉并同意签证申请数据、照片和指纹的收集、处理与保存 | I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_data_rights_awareness | radio | 我已知悉我对 VIS 中个人数据的查询、更正和依法删除权利 | I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_truthfulness | radio | 我声明本申请所填信息真实、正确且完整 | I declare that to the best of my knowledge all particulars supplied by me are correct and complete. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_awareness_refusal | radio | 我已知悉虚假陈述可能导致拒签、已发签证被撤销并承担法律责任 | I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_undertaking_to_leave | radio | 我承诺在获发签证的有效期届满前离开成员国领土 | I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States. | 2 | pass |
| germany | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | additional_information | textarea | 补充说明 / 其他可能影响本次申请的信息 | Is there anything else you would like to tell us about your application? | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname | text | 姓氏（与护照一致） | Surname (family name) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth_different | radio | 出生时姓氏是否与当前姓氏不同？ | Is your surname at birth different from your current surname? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth | text | 出生时姓氏/曾用姓氏 | Surname at birth (former family name(s)) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | given_names | text | 名字（与护照一致） | First name(s) (given name(s)) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | place_of_birth | text | 出生地点（城市/地区） | Place of birth (city or town) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | current_nationality | country | 当前国籍 | Current nationality | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth_different | radio | 出生时国籍是否与当前国籍不同？ | Is your nationality at birth different from your current nationality? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth | country | 出生时国籍 | Nationality at birth | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationalities? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | sex | select | 性别 | Sex | 3 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status | select | 婚姻/民事伴侣状态 | Civil status | 7 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status_other | text | 请说明您的婚姻状况 | Please specify your civil status | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | is_applicant_minor | radio | 是否申请人？ | Will you be under 18 on the date you plan to travel to the Schengen Area? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_surname | text | 父母机构姓氏 | Surname of parental authority / legal guardian | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_given_names | text | 父母机构名字姓名 | First name(s) of parental authority / legal guardian | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_line_1 | text | 父母机构地址行 | Address — line 1 (if different from applicant's) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_city | text | 城市 | City | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_country | country | 国家 | Country | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_phone | text | 父母机构电话 | Telephone number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_email | text | 父母机构邮箱 | E-mail address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_nationality | country | 父母机构国籍 | Nationality | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | has_national_id | radio | 您是否有国民身份证号码？ | Do you have a national identity number? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | national_id_number | text | 国民身份证号码 | National identity number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type | select | 旅行证件类型 | Type of travel document | 6 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type_other | text | 旅行证件其他 | Please specify the travel document type | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_number | text | 旅行证件号码 | Travel document number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issue_date | date | 旅行证件签发日期 | Date of issue | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_expiry_date | date | 旅行证件有效期至 | Valid until | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issuing_country | country | 旅行证件签发国家/地区 | Issued by (country) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | has_eu_family_member | radio | 是否家庭成员？ | Are you a family member of an EU, EEA or Swiss citizen, or of a UK national who is a beneficiary of the EU-UK Withdrawal Agreement? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_surname | text | 欧盟家庭姓氏 | Surname of the EU/EEA/CH family member | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_given_names | text | 欧盟家庭名字姓名 | First name(s) of the EU/EEA/CH family member | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_nationality | country | 欧盟家庭国籍 | Nationality | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_type | select | 欧盟家庭旅行证件 | Type of travel document or ID card | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_number | text | 欧盟家庭旅行证件号码 | Travel document / ID card number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_relationship | select | 欧盟家庭关系 | Family relationship | 6 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_city | text | 家庭住址城市 | Town or city | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_postcode | text | 家庭住址邮政编码 | Postcode / ZIP code | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_country | country | 家庭住址国家/地区 | Country | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | email_address | text | 电子邮箱地址 | E-mail address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | phone_number | text | 电话号码（含国家代码） | Telephone number (including country code) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country_different | radio | 是否居住国家/地区？ | Do you reside in a country other than your country of current nationality? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country | country | 居住国家 | Country of residence | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_number | text | 居留许可或同等证件号码 | Residence permit or equivalent number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_expiry_date | date | 居留许可有效期至 | Residence permit valid until | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | is_student | radio | 您是否是学生？ | Are you a student? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_name | text | 雇主名称 | Employer name | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | fv_business_segment | select | 商务 | France-Visas sector | 6 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_address_line_1 | text | 雇主地址行 | Employer address — line 1 | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_city | text | 雇主城市 | Employer city | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_country | country | 雇主国家 | Employer country | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_phone | text | 雇主电话 | Employer telephone number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_name | text | 学校名称 | Name of educational establishment | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_email | text | 雇主邮箱 | Employer email address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_address | text | 学校地址 | Address of educational establishment | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_phone | text | 学校电话 | Telephone number of educational establishment | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_of_journey | select | 本次旅行目的 | Main purpose of the journey | 10 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_additional_info | textarea | 停留目的补充信息 | Additional information on the purpose of stay | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | main_destination_country | country | 主要目的地成员国 | Member State of main destination | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | first_entry_country | country | 首次入境成员国 | Member State of first entry | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | number_of_entries_requested | select | 申请入境次数 | Number of entries requested | 3 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_duration_days | text | 预计停留或过境时长（天数） | Duration of the intended stay or transit (number of days) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | departure_from_origin_date | date | 从居住国出发日期 | Date of departure from your country of residence | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in the Schengen Area | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from the Schengen Area | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | 您是否计划前往法国海外领地？ | Are you going to French overseas territories? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_surname | text | 邀请人/接待方姓氏 | Host's surname | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_given_names | text | 邀请人/接待方名字 | Host's first name(s) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_relationship | text | 邀请人/接待方与申请人的关系 | Relationship to the host | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_address_line_1 | text | 邀请人/接待方地址第一行 | Host's address — line 1 | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_city | text | 邀请人/接待方所在城市 | Host's city | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_country | country | 邀请人/接待方所在国家 | Host's country (Schengen Member State) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_phone | text | 邀请人/接待方电话 | Host's telephone number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_email | text | 邀请人/接待方电子邮箱 | Host's e-mail address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_nationality | country | 接待方国籍 | Host's nationality | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_legal_status_schengen | select | 接待方法定状态申根 | Host's legal status in the Schengen Area | 4 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_name | text | 商务公司 | Inviting company / organisation name | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_address_line_1 | text | 商务公司地址行 | Company address — line 1 | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_city | text | 商务公司城市 | Company city | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_country | country | 商务公司国家 | Company country (Schengen Member State) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_phone | text | 商务公司电话 | Company telephone number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_surname | text | 商务联系人姓氏 | Company contact surname | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_given_names | text | 商务联系人名字姓名 | Company contact first name(s) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_email | text | 商务联系人邮箱 | Company contact e-mail | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_address | text | 商务联系人地址 | Company contact address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_phone | text | 商务联系人电话 | Company contact telephone number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_invitation_letter_held | radio | 是否商务？ | Do you have a formal invitation letter from the company? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_name | text | 学习机构 | Name of the educational institution | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_address | text | 学习机构地址 | Institution address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_country | country | 学习机构国家 | Institution country (Schengen Member State) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_name | text | 学习 | Course or programme name | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_start_date | date | 学习开始日期 | Course start date | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_duration | text | 学习 | Course duration | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_acceptance_letter_held | radio | 您是否持有学校或教育机构出具的录取/接收证明？ | Do you have an acceptance letter from the institution? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_name | text | 医疗 | Name of the hospital or clinic | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_address | text | 医疗地址 | Hospital or clinic address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_country | country | 医疗国家 | Hospital or clinic country (Schengen Member State) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_type | text | 医疗 | Type of treatment | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_start_date | date | 医疗开始日期 | Treatment start date | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_duration | text | 医疗 | Treatment duration | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_costs_prepaid | radio | 医疗费用是否已经预付，或已由医疗机构确认付款安排？ | Have treatment costs been prepaid or confirmed by the facility? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_name | text | 活动 | Name of the event | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_organizer | text | 活动 | Event organiser | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_location | text | 活动 | Event location (city and venue) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_country | country | 活动国家 | Event country (Schengen Member State) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_start_date | date | 活动开始日期 | Event start date | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_end_date | date | 活动结束日期 | Event end date | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_invitation_letter_held | radio | 您是否持有活动主办方出具的邀请函？ | Do you have an invitation letter from the organiser? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_country | country | 过境目的地国家 | Final destination country (outside Schengen) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_onward_ticket_held | radio | 您是否持有已确认的续程机票？ | Do you hold a confirmed onward flight ticket? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_visa_held | radio | 是否签证？ | Do you hold an entry visa for the final destination (if required)? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | other_purpose_explain | textarea | 其他目的 | Please describe the purpose of your journey | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | tourism_itinerary_summary | textarea | 旅游 | Brief summary of your planned itinerary | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_airside_only | radio | 您是否会一直停留在申根机场的国际中转区内，不办理入境手续？ | Will you remain in the international transit area of the Schengen airport(s) without passing through immigration? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_type | select | 住宿类型 | Type of accommodation in the Schengen Area | 4 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_name | text | 住宿地点或接待方名称 | Hotel name or accommodation label | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_address_line_1 | text | 住宿地址——第1行 | Accommodation address — line 1 | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_city | text | 城市 | City | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_country | country | 住宿国家 | Country (Schengen Member State) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_phone | text | 住宿联系电话 | Accommodation telephone number | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_email | text | 住宿电子邮箱 | Accommodation e-mail address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | hotel_confirmation_number | text | 酒店/预订确认号（如有） | Hotel / booking confirmation number (if available) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_other_explain | textarea | 住宿其他 | Please describe your accommodation arrangements | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_schengen_fingerprints_given | radio | 是否名字？ | Have your fingerprints been collected previously for the purpose of applying for a Schengen visa? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_date | date | 日期 | Date fingerprints were collected (if known) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_visa_sticker | text | 签证 | Number of the visa (if known) | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | has_entry_permit_final_destination | radio | 是否入境许可最终？ | Do you hold an entry permit for the final country of destination (where applicable)? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_issuing_authority | text | 入境许可签发机构 | Entry permit — issued by | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_from | date | 入境许可有效 | Entry permit — valid from | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_until | date | 入境许可有效至 | Entry permit — valid until | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa | radio | 是否曾被拒发申根签证？ | Have you ever been refused a Schengen visa? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please provide details of the refusal | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | cost_covered_by | select | 谁将承担本次旅行和停留费用？ | Who will cover the cost of travelling and living during your stay? | 3 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_cash | radio | 方式现金 | Self: cash | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_travellers_cheques | radio | 方式旅行支票 | Self: traveller's cheques | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_credit_card | radio | 方式信用卡 | Self: credit card | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_accommodation | radio | 方式预付住宿 | Self: pre-paid accommodation | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_transport | radio | 方式预付交通 | Self: pre-paid transport | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other | radio | 方式其他 | Self: other means of support | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other_explain | text | 方式其他 | Please describe the other means of support | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_type | select | 担保人/资助方类型 | Type of sponsor | 4 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_name | text | 担保人/资助方名称 | Sponsor name | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_relationship | text | 担保人/资助方与申请人的关系 | Relationship to sponsor | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_address | text | 担保人/资助方地址 | Sponsor address | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_cash | radio | 担保人方式现金 | Sponsor: cash | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_accommodation_provided | radio | 担保人方式住宿 | Sponsor: accommodation provided | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_all_expenses_covered | radio | 担保人方式 | Sponsor: all expenses covered during the stay | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_prepaid_transport | radio | 担保人方式预付交通 | Sponsor: pre-paid transport | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other | radio | 担保人方式其他 | Sponsor: other means of support | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other_explain | text | 担保人方式其他 | Please describe the other sponsor means of support | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | has_different_filler | radio | 本申请是否由申请人本人以外的其他人填写？ | Is the application being filled in by someone other than the applicant? | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_surname | text | 填表人姓氏 | Surname of the person filling in the application form | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_given_names | text | 填表人名字 | First name(s) of the person filling in the application form | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_address | text | 填表人地址 | Address of the person filling in the application form | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_email | text | 填表人电子邮箱 | E-mail address of the person filling in the application form | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_phone | text | 填表人电话号码 | Telephone number of the person filling in the application form | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | place_of_application | text | 申请提交地点 / 当前申请所在地 | Place of application | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | 0 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_fee_not_refunded_awareness | radio | 我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。 | I am aware that the visa fee is not refunded if the visa is refused. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_insurance_multi_entry_awareness | radio | 我已知悉：如获发多次入境签证，每次进入成员国领土时均需持有足够的旅行医疗保险。 | Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_vis_consent | radio | 我已知悉并同意签证申请数据、照片和指纹的收集、处理与保存 | I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_data_rights_awareness | radio | 我已知悉我对 VIS 中个人数据的查询、更正和依法删除权利 | I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_truthfulness | radio | 我声明本申请所填信息真实、正确且完整 | I declare that to the best of my knowledge all particulars supplied by me are correct and complete. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_awareness_refusal | radio | 我已知悉虚假陈述可能导致拒签、已发签证被撤销并承担法律责任 | I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_undertaking_to_leave | radio | 我承诺在获发签证的有效期届满前离开成员国领土 | I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States. | 2 | pass |
| greece | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | additional_information | textarea | 补充说明 / 其他可能影响本次申请的信息 | Is there anything else you would like to tell us about your application? | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| hong_kong | HK_VISIT_VISA -> HK_VISIT_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| india | IN_E_VISA -> IN_E_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| india | IN_E_VISA -> IN_E_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| india | IN_E_VISA -> IN_E_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| india | IN_E_VISA -> IN_E_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| india | IN_E_VISA -> IN_E_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| india | IN_E_VISA -> IN_E_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | payment_method | radio | 付款方式 | Payment Method | 2 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | full_name | text | 姓名 | Full Name | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | gender | radio | 性别 | Gender | 2 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | birth_place | text | 出生地 | Birth Place | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | birthday | date | 出生日期 | Date of Birth | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | phone_country_code | select | 国际区号 | Phone Country Code | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | mobile_phone | text | 手机号码 | Phone Number | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | mother_name | text | 母亲姓名 | Mothers Name | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | document_travel_id | select | 旅行证件类型 | Document Type | 13 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | passport_number | text | 证件号码 | Document Number | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | passport_country | country | 护照所属国家/地区 | Passport/Country/Region | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | passport_issue_date | date | 签发日期 | Date of Issue | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | passport_expiry_date | date | 有效期至 | Date of Expiry | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | passport_place_of_issue | country | 签发国家 | Issuing Country | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | residence_type | select | 在印尼住宿类型 | Residence Type | 5 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | address_in_indonesia | textarea | 在印尼地址 | Address | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | postal_code | text | 邮政编码 | Postal Code | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | province_name | text | 省 | Province | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | city_name | text | 城市 | City | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | district_name | text | 区/县 | District | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | village_name | text | 村/街区 | Village | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Application form | email | text | 邮箱 | Email | 0 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Review and submit | information_true_declaration | checkbox | 我声明本签证申请中提供的信息真实无误。 | I declare that the information I have provided in this visa application is true. | 1 | pass |
| indonesia | B211A -> ID_C1_TOURIST | Review and submit | billing_responsibility_declaration | checkbox | 我理解必须完成官方付款后申请才会继续处理。 | I understand that the billing code/payment must be completed before the application can be processed. | 1 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | payment_method | radio | 付款方式 | Payment Method | 2 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | full_name | text | 姓名 | Full Name | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | gender | radio | 性别 | Gender | 2 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | birth_place | text | 出生地 | Birth Place | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | birthday | date | 出生日期 | Date of Birth | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | phone_country_code | select | 国际区号 | Phone Country Code | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | mobile_phone | text | 手机号码 | Phone Number | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | mother_name | text | 母亲姓名 | Mothers Name | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | passport_number | text | 证件号码 | Document Number | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | passport_country | country | 护照所属国家/地区 | Passport/Country/Region | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | passport_expiry_date | date | 有效期至 | Date of Expiry | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | passport_place_of_issue | text | 签发国家 | Issuing Country | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | residence_type | select | 在印尼住宿类型 | Residence Type | 5 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | address_in_indonesia | textarea | 在印尼地址 | Address | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | postal_code | text | 邮政编码 | Postal Code | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Application form | email | text | 邮箱 | Email | 0 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Review and submit | information_true_declaration | checkbox | 我声明本签证申请中提供的信息真实无误。 | I declare that the information I have provided in this visa application is true. | 1 | pass |
| indonesia | ID_B1_EVOA -> ID_B1_EVOA | Review and submit | billing_responsibility_declaration | checkbox | 我理解必须完成官方付款后申请才会继续处理。 | I understand that the billing code/payment must be completed before the application can be processed. | 1 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | payment_method | radio | 付款方式 | Payment Method | 2 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | full_name | text | 姓名 | Full Name | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | gender | radio | 性别 | Gender | 2 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | birth_place | text | 出生地 | Birth Place | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | birthday | date | 出生日期 | Date of Birth | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | phone_country_code | select | 国际区号 | Phone Country Code | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | mobile_phone | text | 手机号码 | Phone Number | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | mother_name | text | 母亲姓名 | Mothers Name | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | document_travel_id | select | 旅行证件类型 | Document Type | 13 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | passport_number | text | 证件号码 | Document Number | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | passport_country | country | 护照所属国家/地区 | Passport/Country/Region | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | passport_issue_date | date | 签发日期 | Date of Issue | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | passport_expiry_date | date | 有效期至 | Date of Expiry | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | passport_place_of_issue | country | 签发国家 | Issuing Country | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | residence_type | select | 在印尼住宿类型 | Residence Type | 5 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | address_in_indonesia | textarea | 在印尼地址 | Address | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | postal_code | text | 邮政编码 | Postal Code | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | province_name | text | 省 | Province | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | city_name | text | 城市 | City | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | district_name | text | 区/县 | District | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | village_name | text | 村/街区 | Village | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Application form | email | text | 邮箱 | Email | 0 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Review and submit | information_true_declaration | checkbox | 我声明本签证申请中提供的信息真实无误。 | I declare that the information I have provided in this visa application is true. | 1 | pass |
| indonesia | ID_C1_TOURIST -> ID_C1_TOURIST | Review and submit | billing_responsibility_declaration | checkbox | 我理解必须完成官方付款后申请才会继续处理。 | I understand that the billing code/payment must be completed before the application can be processed. | 1 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | has_other_names_used | radio | 您是否曾使用过其他姓名（如曾用名、笔名或别名）？ | Have you ever been known by any other names (former names, pen names, aliases)? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | place_of_birth_city | text | 出生城市 | Place of birth — City / Town | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | place_of_birth_state | text | 出生州/省 | Place of birth — State / Province | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | place_of_birth_country | country | 出生国家/地区 | Place of birth — Country | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | id_card_number | text | 本国身份证件号码（如适用） | ID number issued to you (if your country requires one) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | spouse_full_name | text | 配偶/伴侣完整姓名 | Spouse — Full name | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | spouse_date_of_birth | date | 配偶出生日期 | Spouse — Date of birth | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Personal Information | spouse_nationality | country | 配偶/伴侣国籍 | Spouse — Nationality | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | passport_type | select | 护照类型 | Passport type | 4 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | passport_place_of_issue | text | 签发地点 | Place of issue | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | passport_issuing_authority | text | 护照签发机关/签发地点 | Issuing authority | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | has_other_passports | radio | 是否目前持有或曾经持有其他护照？ | Do you currently hold or have you previously held any other passport (including a different passport from the same country)? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Passport | other_passport_country | country | 其他护照的签发国家/地区 | Other passport — Issuing country | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Contact & Home Address | home_address_line1 | text | 家庭住址街道/门牌/公寓信息 | Home address — Street / Apartment | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Contact & Home Address | home_address_city | text | 家庭住址城市 | Home address — City / Town | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Contact & Home Address | home_address_country | country | 家庭住址国家/地区 | Home address — Country | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Contact & Home Address | mobile_number | text | 手机号码 | Mobile number | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Occupation | current_profession | select | 当前职业/职业类别 | Current profession or occupation | 7 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Occupation | position_title | text | 职位/职称 | Position / Title | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Occupation | employer_or_school_name | text | 雇主或学校名称 | Name of employer or school | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Occupation | employer_or_school_address | text | 雇主或学校地址 | Address of employer or school | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Occupation | employer_or_school_phone | text | 雇主或学校联系电话 | Telephone of employer or school | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | purpose_of_visit | select | 本次赴日目的 | Purpose of visit to Japan | 1 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Japan | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay in Japan (days) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | port_of_entry | text | 预计入境口岸 | Port of entry into Japan | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | carrier_name | text | 航空公司、船舶或交通承运人名称 | Name of ship or airline | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Japan | 4 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or person hosting you | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address of hotel or host in Japan | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | accommodation_phone | text | 住宿地点/接待方联系电话 | Telephone of hotel or host | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | has_inviter_in_japan | radio | 您在日本是否有邀请人或担保人？ | Do you have an inviter or guarantor in Japan? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_full_name | text | 邀请人完整姓名 | Inviter — Full name | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_address | text | 邀请人地址 | Inviter — Address in Japan | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_phone | text | 邀请人电话 | Inviter — Telephone (incl. country/area code) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_date_of_birth | date | 邀请人出生日期 | Inviter — Date of birth | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_sex | select | 邀请人性别 | Inviter — Sex | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_nationality | country | 邀请人国籍 | Inviter — Nationality | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_occupation | text | 邀请人职业 | Inviter — Occupation | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_employer | text | 邀请人在日本的雇主名称及地址 | Inviter — Name & address of employer in Japan | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_relationship_to_applicant | text | 邀请人与申请人的关系 | Inviter — Relationship to applicant | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Inviter in Japan | inviter_immigration_status | text | 邀请人在日本的居留身份（仅外国籍邀请人填写） | Inviter — Immigration status in Japan (foreign nationals only) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | visited_japan_before | radio | 您以前是否曾在日本停留？ | Have you ever stayed in Japan before? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | prior_japan_visit_arrival_date | date | 上次赴日抵达日期 | Prior Japan visit — Arrival date | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | prior_japan_visit_departure_date | date | 上次赴日离境日期 | Prior Japan visit — Departure date | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | prior_japan_visit_purpose | text | 上次赴日目的 | Prior Japan visit — Purpose | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | refused_visa_or_entry_japan | radio | 是否曾被日本拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Japan? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | refused_visa_japan_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Japan or any other country? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | has_overstayed_japan | radio | 您是否曾逾期停留，或曾在日本非法居留？ | Have you ever overstayed a visa or stayed in Japan illegally? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | overstay_details | textarea | 请说明逾期停留或违反签证条件的具体情况 | Provide details | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | has_drug_or_trafficking_history | radio | 是否曾涉及吸毒、卖淫、人口贩运、走私或非法武器持有？ | Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons? | 2 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | remarks_special_circumstances | textarea | 备注或特殊情况（选填） | Remarks / Special Circumstances (optional) | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| japan | JP_TOURIST -> JP_TOURIST | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan. | 1 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| japan | short_term_tourism_evisa -> short_term_tourism_evisa | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| laos | LA_TOURIST_E_VISA -> LA_TOURIST_E_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| macau | MO_VISIT_VISA -> MO_VISIT_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | full_name | text | 护照上的姓名 | Full Name as per Passport | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | passport_number | text | 护照号码 | Passport Number | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | passport_expiry_date | date | 护照有效期至 | Passport Expiry Date | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | nationality | select | 国籍 / 公民身份 | Nationality/Citizenship | 250 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | place_of_birth | select | 出生地 | Place of Birth | 250 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | date_of_birth | date | 出生日期 | Date of Birth | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | sex | select | 性别 | Sex | 2 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | email_address | text | 电子邮箱地址 | Email Address | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | mobile_country_code | text | 手机国家 / 地区代码 | Mobile Country Code | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Traveller Information | mobile_number | text | 手机号码 | Mobile Number | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Trip Information | arrival_date | date | 抵达马来西亚日期 | Date of Arrival in Malaysia | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Trip Information | departure_date | date | 离开马来西亚日期 | Date of Departure from Malaysia | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Trip Information | mode_of_travel | select | 入境马来西亚交通方式 | Mode of Travel | 3 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Trip Information | transport_number | text | 航班号/车辆或船舶编号 | Flight / Vehicle / Vessel Number | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Trip Information | last_embarkation_country | select | 抵达马来西亚前最后出发的国家/地区 | Country/Region of Last Embarkation Before Malaysia | 250 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Trip Information | purpose_of_visit | select | 访问目的 | Purpose of Visit | 7 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Stay in Malaysia | accommodation_type | select | 住宿类型 | Accommodation of Stay | 3 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Stay in Malaysia | address_in_malaysia | textarea | 马来西亚地址 | Address (In Malaysia) | 0 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Stay in Malaysia | state | select | 州/联邦直辖区 | State | 16 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Stay in Malaysia | city | select | 城市 | City | 509 | pass |
| malaysia | MY_MDAC_ARRIVAL_CARD -> MY_MDAC_ARRIVAL_CARD | Stay in Malaysia | postcode | text | 邮政编码 | Postcode | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | place_of_birth_city | text | 出生城市 | Place of birth — City / Town | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | place_of_birth_country | country | 出生国家/地区 | Place of birth — Country | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | race_ethnicity | text | 种族/族群（按马来西亚移民要求填写） | Race / Ethnicity (as collected by Malaysian immigration) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | spouse_full_name | text | 配偶/伴侣完整姓名 | Spouse — Full name | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | spouse_nationality | country | 配偶/伴侣国籍 | Spouse — Nationality | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | has_other_passports | radio | 是否目前持有或曾经持有其他护照？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | home_address_line1 | text | 家庭住址街道/门牌/公寓信息 | Home address — Street / Apartment | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | home_address_city | text | 家庭住址城市 | Home address — City / Town | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | home_address_state | text | 家庭住址州/省 | Home address — State / Province | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | home_address_postcode | text | 家庭住址邮政编码 | Home address — Postal code | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | home_address_country | country | 家庭住址国家/地区 | Home address — Country of residence | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | mobile_number | text | 手机号码 | Mobile number | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Occupation | current_profession | select | 当前职业/职业类别 | Current profession or occupation | 8 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Occupation | position_title | text | 职位/职称 | Position / Title | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | visa_type_requested | radio | 申请单次或多次入境电子签证 | Visa type requested | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Malaysia | 1 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per entry) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | port_of_entry | select | 预计入境口岸 | Intended port of entry | 17 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | carrier_name | text | 航空公司、船舶或交通承运人名称 | Name of airline, ship, or transport carrier | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | flight_number | text | 航班或列车号码（如已知） | Flight number (if known) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Malaysia | 6 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / State in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Host in Malaysia | has_host_in_malaysia | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Malaysia? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Host in Malaysia | host_full_name | text | 邀请人/接待方完整姓名 | Host — Full name | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Host in Malaysia | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Host in Malaysia | host_address | text | 接待方地址 | Host — Address in Malaysia | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Host in Malaysia | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Host in Malaysia | host_nationality | country | 接待方国籍 | Host — Nationality | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | visited_malaysia_before | radio | 是否曾访问马来西亚？ | Have you ever visited Malaysia before? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | prior_malaysia_visit_arrival_date | date | 访问抵达日期 | Prior Malaysia visit — Arrival date | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | prior_malaysia_visit_departure_date | date | 访问离开日期 | Prior Malaysia visit — Departure date | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | prior_malaysia_visit_purpose | text | 访问目的 | Prior Malaysia visit — Purpose | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | refused_visa_or_entry_malaysia | radio | 是否曾被马来西亚拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Malaysia? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | refused_visa_malaysia_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Malaysia or any other country? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| malaysia | MY_TOURIST_E_VISA -> MY_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Malaysia. | 1 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| maldives | MV_IMUGA -> MV_IMUGA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| morocco | visa_free_or_evisa -> visa_free_or_evisa | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname | text | 姓氏（与护照一致） | Surname (family name) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth_different | radio | 出生时姓氏是否与当前姓氏不同？ | Is your surname at birth different from your current surname? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth | text | 出生时姓氏/曾用姓氏 | Surname at birth (former family name(s)) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | given_names | text | 名字（与护照一致） | First name(s) (given name(s)) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | place_of_birth | text | 出生地点（城市/地区） | Place of birth (city or town) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | current_nationality | country | 当前国籍 | Current nationality | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth_different | radio | 出生时国籍是否与当前国籍不同？ | Is your nationality at birth different from your current nationality? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth | country | 出生时国籍 | Nationality at birth | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationalities? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | sex | select | 性别 | Sex | 3 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status | select | 婚姻/民事伴侣状态 | Civil status | 7 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status_other | text | 请说明您的婚姻状况 | Please specify your civil status | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | is_applicant_minor | radio | 是否申请人？ | Will you be under 18 on the date you plan to travel to the Schengen Area? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_surname | text | 父母机构姓氏 | Surname of parental authority / legal guardian | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_given_names | text | 父母机构名字姓名 | First name(s) of parental authority / legal guardian | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_line_1 | text | 父母机构地址行 | Address — line 1 (if different from applicant's) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_city | text | 城市 | City | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_country | country | 国家 | Country | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_phone | text | 父母机构电话 | Telephone number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_email | text | 父母机构邮箱 | E-mail address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_nationality | country | 父母机构国籍 | Nationality | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | has_national_id | radio | 您是否有国民身份证号码？ | Do you have a national identity number? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | national_id_number | text | 国民身份证号码 | National identity number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type | select | 旅行证件类型 | Type of travel document | 6 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type_other | text | 旅行证件其他 | Please specify the travel document type | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_number | text | 旅行证件号码 | Travel document number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issue_date | date | 旅行证件签发日期 | Date of issue | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_expiry_date | date | 旅行证件有效期至 | Valid until | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issuing_country | country | 旅行证件签发国家/地区 | Issued by (country) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | has_eu_family_member | radio | 是否家庭成员？ | Are you a family member of an EU, EEA or Swiss citizen, or of a UK national who is a beneficiary of the EU-UK Withdrawal Agreement? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_surname | text | 欧盟家庭姓氏 | Surname of the EU/EEA/CH family member | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_given_names | text | 欧盟家庭名字姓名 | First name(s) of the EU/EEA/CH family member | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_nationality | country | 欧盟家庭国籍 | Nationality | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_type | select | 欧盟家庭旅行证件 | Type of travel document or ID card | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_number | text | 欧盟家庭旅行证件号码 | Travel document / ID card number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_relationship | select | 欧盟家庭关系 | Family relationship | 6 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_city | text | 家庭住址城市 | Town or city | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_postcode | text | 家庭住址邮政编码 | Postcode / ZIP code | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_country | country | 家庭住址国家/地区 | Country | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | email_address | text | 电子邮箱地址 | E-mail address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | phone_number | text | 电话号码（含国家代码） | Telephone number (including country code) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country_different | radio | 是否居住国家/地区？ | Do you reside in a country other than your country of current nationality? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country | country | 居住国家 | Country of residence | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_number | text | 居留许可或同等证件号码 | Residence permit or equivalent number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_expiry_date | date | 居留许可有效期至 | Residence permit valid until | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | is_student | radio | 您是否是学生？ | Are you a student? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_name | text | 雇主名称 | Employer name | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | fv_business_segment | select | 商务 | France-Visas sector | 6 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_address_line_1 | text | 雇主地址行 | Employer address — line 1 | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_city | text | 雇主城市 | Employer city | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_country | country | 雇主国家 | Employer country | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_phone | text | 雇主电话 | Employer telephone number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_name | text | 学校名称 | Name of educational establishment | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_email | text | 雇主邮箱 | Employer email address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_address | text | 学校地址 | Address of educational establishment | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_phone | text | 学校电话 | Telephone number of educational establishment | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_of_journey | select | 本次旅行目的 | Main purpose of the journey | 10 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_additional_info | textarea | 停留目的补充信息 | Additional information on the purpose of stay | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | main_destination_country | country | 主要目的地成员国 | Member State of main destination | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | first_entry_country | country | 首次入境成员国 | Member State of first entry | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | number_of_entries_requested | select | 申请入境次数 | Number of entries requested | 3 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_duration_days | text | 预计停留或过境时长（天数） | Duration of the intended stay or transit (number of days) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | departure_from_origin_date | date | 从居住国出发日期 | Date of departure from your country of residence | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in the Schengen Area | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from the Schengen Area | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | 您是否计划前往法国海外领地？ | Are you going to French overseas territories? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_surname | text | 邀请人/接待方姓氏 | Host's surname | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_given_names | text | 邀请人/接待方名字 | Host's first name(s) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_relationship | text | 邀请人/接待方与申请人的关系 | Relationship to the host | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_address_line_1 | text | 邀请人/接待方地址第一行 | Host's address — line 1 | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_city | text | 邀请人/接待方所在城市 | Host's city | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_country | country | 邀请人/接待方所在国家 | Host's country (Schengen Member State) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_phone | text | 邀请人/接待方电话 | Host's telephone number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_email | text | 邀请人/接待方电子邮箱 | Host's e-mail address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_nationality | country | 接待方国籍 | Host's nationality | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_legal_status_schengen | select | 接待方法定状态申根 | Host's legal status in the Schengen Area | 4 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_name | text | 商务公司 | Inviting company / organisation name | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_address_line_1 | text | 商务公司地址行 | Company address — line 1 | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_city | text | 商务公司城市 | Company city | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_country | country | 商务公司国家 | Company country (Schengen Member State) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_phone | text | 商务公司电话 | Company telephone number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_surname | text | 商务联系人姓氏 | Company contact surname | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_given_names | text | 商务联系人名字姓名 | Company contact first name(s) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_email | text | 商务联系人邮箱 | Company contact e-mail | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_address | text | 商务联系人地址 | Company contact address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_phone | text | 商务联系人电话 | Company contact telephone number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_invitation_letter_held | radio | 是否商务？ | Do you have a formal invitation letter from the company? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_name | text | 学习机构 | Name of the educational institution | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_address | text | 学习机构地址 | Institution address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_country | country | 学习机构国家 | Institution country (Schengen Member State) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_name | text | 学习 | Course or programme name | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_start_date | date | 学习开始日期 | Course start date | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_duration | text | 学习 | Course duration | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_acceptance_letter_held | radio | 您是否持有学校或教育机构出具的录取/接收证明？ | Do you have an acceptance letter from the institution? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_name | text | 医疗 | Name of the hospital or clinic | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_address | text | 医疗地址 | Hospital or clinic address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_country | country | 医疗国家 | Hospital or clinic country (Schengen Member State) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_type | text | 医疗 | Type of treatment | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_start_date | date | 医疗开始日期 | Treatment start date | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_duration | text | 医疗 | Treatment duration | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_costs_prepaid | radio | 医疗费用是否已经预付，或已由医疗机构确认付款安排？ | Have treatment costs been prepaid or confirmed by the facility? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_name | text | 活动 | Name of the event | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_organizer | text | 活动 | Event organiser | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_location | text | 活动 | Event location (city and venue) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_country | country | 活动国家 | Event country (Schengen Member State) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_start_date | date | 活动开始日期 | Event start date | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_end_date | date | 活动结束日期 | Event end date | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_invitation_letter_held | radio | 您是否持有活动主办方出具的邀请函？ | Do you have an invitation letter from the organiser? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_country | country | 过境目的地国家 | Final destination country (outside Schengen) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_onward_ticket_held | radio | 您是否持有已确认的续程机票？ | Do you hold a confirmed onward flight ticket? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_visa_held | radio | 是否签证？ | Do you hold an entry visa for the final destination (if required)? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | other_purpose_explain | textarea | 其他目的 | Please describe the purpose of your journey | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | tourism_itinerary_summary | textarea | 旅游 | Brief summary of your planned itinerary | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_airside_only | radio | 您是否会一直停留在申根机场的国际中转区内，不办理入境手续？ | Will you remain in the international transit area of the Schengen airport(s) without passing through immigration? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_type | select | 住宿类型 | Type of accommodation in the Schengen Area | 4 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_name | text | 住宿地点或接待方名称 | Hotel name or accommodation label | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_address_line_1 | text | 住宿地址——第1行 | Accommodation address — line 1 | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_city | text | 城市 | City | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_country | country | 住宿国家 | Country (Schengen Member State) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_phone | text | 住宿联系电话 | Accommodation telephone number | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_email | text | 住宿电子邮箱 | Accommodation e-mail address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | hotel_confirmation_number | text | 酒店/预订确认号（如有） | Hotel / booking confirmation number (if available) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_other_explain | textarea | 住宿其他 | Please describe your accommodation arrangements | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_schengen_fingerprints_given | radio | 是否名字？ | Have your fingerprints been collected previously for the purpose of applying for a Schengen visa? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_date | date | 日期 | Date fingerprints were collected (if known) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_visa_sticker | text | 签证 | Number of the visa (if known) | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | has_entry_permit_final_destination | radio | 是否入境许可最终？ | Do you hold an entry permit for the final country of destination (where applicable)? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_issuing_authority | text | 入境许可签发机构 | Entry permit — issued by | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_from | date | 入境许可有效 | Entry permit — valid from | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_until | date | 入境许可有效至 | Entry permit — valid until | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa | radio | 是否曾被拒发申根签证？ | Have you ever been refused a Schengen visa? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please provide details of the refusal | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | cost_covered_by | select | 谁将承担本次旅行和停留费用？ | Who will cover the cost of travelling and living during your stay? | 3 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_cash | radio | 方式现金 | Self: cash | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_travellers_cheques | radio | 方式旅行支票 | Self: traveller's cheques | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_credit_card | radio | 方式信用卡 | Self: credit card | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_accommodation | radio | 方式预付住宿 | Self: pre-paid accommodation | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_transport | radio | 方式预付交通 | Self: pre-paid transport | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other | radio | 方式其他 | Self: other means of support | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other_explain | text | 方式其他 | Please describe the other means of support | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_type | select | 担保人/资助方类型 | Type of sponsor | 4 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_name | text | 担保人/资助方名称 | Sponsor name | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_relationship | text | 担保人/资助方与申请人的关系 | Relationship to sponsor | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_address | text | 担保人/资助方地址 | Sponsor address | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_cash | radio | 担保人方式现金 | Sponsor: cash | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_accommodation_provided | radio | 担保人方式住宿 | Sponsor: accommodation provided | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_all_expenses_covered | radio | 担保人方式 | Sponsor: all expenses covered during the stay | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_prepaid_transport | radio | 担保人方式预付交通 | Sponsor: pre-paid transport | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other | radio | 担保人方式其他 | Sponsor: other means of support | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other_explain | text | 担保人方式其他 | Please describe the other sponsor means of support | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | has_different_filler | radio | 本申请是否由申请人本人以外的其他人填写？ | Is the application being filled in by someone other than the applicant? | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_surname | text | 填表人姓氏 | Surname of the person filling in the application form | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_given_names | text | 填表人名字 | First name(s) of the person filling in the application form | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_address | text | 填表人地址 | Address of the person filling in the application form | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_email | text | 填表人电子邮箱 | E-mail address of the person filling in the application form | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_phone | text | 填表人电话号码 | Telephone number of the person filling in the application form | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | place_of_application | text | 申请提交地点 / 当前申请所在地 | Place of application | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | 0 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_fee_not_refunded_awareness | radio | 我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。 | I am aware that the visa fee is not refunded if the visa is refused. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_insurance_multi_entry_awareness | radio | 我已知悉：如获发多次入境签证，每次进入成员国领土时均需持有足够的旅行医疗保险。 | Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_vis_consent | radio | 我已知悉并同意签证申请数据、照片和指纹的收集、处理与保存 | I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_data_rights_awareness | radio | 我已知悉我对 VIS 中个人数据的查询、更正和依法删除权利 | I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_truthfulness | radio | 我声明本申请所填信息真实、正确且完整 | I declare that to the best of my knowledge all particulars supplied by me are correct and complete. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_awareness_refusal | radio | 我已知悉虚假陈述可能导致拒签、已发签证被撤销并承担法律责任 | I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_undertaking_to_leave | radio | 我承诺在获发签证的有效期届满前离开成员国领土 | I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States. | 2 | pass |
| netherlands | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | additional_information | textarea | 补充说明 / 其他可能影响本次申请的信息 | Is there anything else you would like to tell us about your application? | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| new_zealand | NZ_VISITOR_VISA -> NZ_VISITOR_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Registration | registration_for | radio | 登记对象 | Travel Registration | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Registration | transport_type | radio | 交通方式 | Mode of Travel | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Registration | is_special_flight | checkbox | 特殊航班 | Special Flight | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Registration | data_privacy_agreement | checkbox | 点击继续即表示您同意数据隐私政策与承诺书 | By clicking Continue, you agree to our Data Privacy and Affidavit of Undertaking. | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | first_name | text | 名 | First Name | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | middle_name | text | 中间名 | Middle Name | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | last_name | text | 姓 | Last Name | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | suffix | select | 姓名后缀 | Suffix | 5 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | date_of_birth | date | 出生日期 | Date of Birth | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | sex | select | 性别 | Sex | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | passport_holder_type | radio | 护照持有人类型 | Nationality | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | nationality | select | 公民身份 | Citizenship | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | country_of_birth | select | 出生国家 / 地区 | Country of Birth | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | occupation | select | 职业 | Occupation | 15 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | passport_number | text | 护照号码 | Passport Number | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | passport_issuing_authority | select | 护照签发机关 / 国家 | Passport Issuing Authority | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | passport_issue_date | date | 护照签发日期 | Passport Issued Date | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | passport_expiry_date | date | 护照有效期至 | Passport Expiry Date | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | mobile_country_code | text | 手机国家 / 地区代码 | Mobile Country Code | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | mobile_number | text | 手机号码 | Mobile Number | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | country_of_residence | select | 永久居住国家 / 地区 | Permanent Country of Residence | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | residence_address_line1 | text | 门牌 / 楼宇 / 城市 / 州省 | No./Bldg./City/State/Province | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Traveller Information | residence_address_line2 | text | 地址第二行 | Address Line 2 | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | purpose_of_travel | select | 旅行目的 | Purpose of Travel | 16 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | traveller_type | select | 旅客类型 | Traveller Type | 6 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | airline_name | select | 航空公司名称 | Name of Airline | 103 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | flight_number | select | 航班号 | Flight Number | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | origin_country | select | 出发国家 / 地区 | Country of Origin | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | airport_of_origin | text | 出发机场 | Airport of Origin | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | flight_departure_date | date | 入境航班起飞日期 | Date of Departure of Flight | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | flight_arrival_date | date | 入境航班抵达日期 | Date of Arrival of Flight | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | port_of_entry | select | 菲律宾目的机场 / 入境口岸 | Airport/Port of Destination in the Philippines | 20 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | with_transit | checkbox | 是否有中转 / 联程航班 | With Transit (Connecting Flight)? | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | transit_country | select | 中转国家 / 地区 | Country of Transit | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | transit_airport | text | 中转机场 | Airport of Transit | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Travel Details - Philippine Arrival | transit_date | date | 中转日期 | Date of Transit | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Destination in the Philippines | destination_type | radio | 抵达菲律宾后的目的地类型 | Destination upon arrival in the Philippines | 4 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Destination in the Philippines | destination_same_as_residence | checkbox | 与永久居住地址相同 | Same as Permanent Country of Residence | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Destination in the Philippines | destination_residence_address | textarea | 菲律宾居住地址 | Residence Address | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Destination in the Philippines | destination_hotel_name | text | 酒店 / 度假村 / 民宿 / 旅游目的地名称 | Hotel, Resorts, AirBnB, Tourist destinations, etc. | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Destination in the Philippines | destination_hotel_address | textarea | 酒店 / 度假村地址 | Hotel/Resort Address | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Destination in the Philippines | destination_transit_airport | select | 菲律宾过境机场 | Airport | 20 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Destination in the Philippines | destination_country | select | 最终目的国家 / 地区 | Country of Destination | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Health Declaration | has_recent_travel_history_30d | radio | 过去 30 天是否有近期旅行史？ | Do you have any recent travel history in the last 30 days? | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Health Declaration | visited_country_30d | select | 过去 30 天工作、访问或过境的国家 / 地区 | Country(ies) worked, visited and transited in the last 30 days | 250 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Health Declaration | has_exposure_to_sick_person_30d | radio | 出行前 30 天是否接触过患病或已知患有传染性 / 感染性疾病的人？ | Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel? | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Health Declaration | has_been_sick_30d | radio | 过去 30 天是否生病？ | Have you been sick in the past 30 days? | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Health Declaration | sickness_symptom | select | 症状 | Symptoms | 17 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | accompanied_under_18_count | text | 18 岁以下同行家人人数 | Below 18 yrs. old | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | accompanied_18_plus_count | text | 18 岁及以上同行家人人数 | 18 yrs. old and above | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | checked_baggage_count | text | 托运行李件数 | Checked-in (pcs) | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | handcarry_baggage_count | text | 手提行李件数 | Hand-carried (pcs) | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Other Travel Details | first_time_visiting_philippines | radio | 是否第一次访问菲律宾？ | First time visiting Philippines? | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_information_acknowledgement | checkbox | 我确认已阅读并理解海关及货币申报说明 | I confirm that I have read and understood the customs and currency declaration information above. | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | has_baggage_or_currency_to_declare | radio | 是否有行李或货币需要申报？ | Do you have baggage or currency to declare? | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_1 | radio | 海关申报项目 1 | Philippine Currency and/or any Philippine Monetary Instrument in excess of PhP 50,000.00; (i.e. Check, Bank, Draft , etc); | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_2 | radio | 海关申报项目 2 | Foreign Currency and/or Foreign Monetary Instrument in excess of USD 10,000.00 or its equivalent; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_3 | radio | 海关申报项目 3 | Gambling Paraphernalia; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_4 | radio | 海关申报项目 4 | Cosmetics, skin care products, food supplements and medicines in excess of quantities for personal use; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_5 | radio | 海关申报项目 5 | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_6 | radio | 海关申报项目 6 | Firearms, ammunitions and explosives; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_7 | radio | 海关申报项目 7 | Alcohol and/or tobacco products in commercial quantities; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_8 | radio | 海关申报项目 8 | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_9 | radio | 海关申报项目 9 | Mobile phones, hand-held radios and similar gadgets in excess of quantities for personal use, and radio commumication equipments; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_10 | radio | 海关申报项目 10 | Cremains (human ashes), human organs or tissues; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_11 | radio | 海关申报项目 11 | Jewelry, gold, precious metals or gems | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Customs Declaration | customs_checklist_12 | radio | 海关申报项目 12 | Other goods, not mentioned above; | 2 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Declaration Signature | customs_signature_declaration | checkbox | 我确认本申报真实、正确，且已知虚假申报后果 | By clicking Next, I certify under pain of falsification that this declaration is true and correct to the best of my knowledge. | 0 | pass |
| philippines | PH_ETRAVEL_ARRIVAL_CARD -> PH_ETRAVEL_ARRIVAL_CARD | Declaration Signature | final_declaration | checkbox | 我确认所填信息真实准确 | I certify that the information provided is true and correct. | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Travel Registration | registration_for | radio | 登记对象 | Travel Registration | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Travel Registration | transport_type | radio | 离境交通方式 | Mode of Travel | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Travel Registration | travel_type | radio | 旅行类型 | Travel Type | 1 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Travel Registration | data_privacy_agreement | checkbox | 我同意数据隐私政策与承诺书 | By clicking Continue, you agree to the Data Privacy and Affidavit of Undertaking. | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | profile_photo | file | 个人照片 | Profile Photo | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | first_name | text | 名 | First Name | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | middle_name | text | 中间名 | Middle Name | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | last_name | text | 姓 | Last Name | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | suffix | select | 姓名后缀 | Suffix | 5 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | date_of_birth | date | 出生日期 | Date of Birth | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | sex | select | 性别 | Sex | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | passport_holder_type | radio | 旅行证件持有人类型 | Travel Document Holder | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | nationality | select | 公民身份 | Citizenship | 250 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | country_of_birth | select | 出生国家 / 地区 | Country of Birth | 250 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | occupation | select | 职业 | Occupation | 15 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | country_of_residence | select | 永久居住国家 / 地区 | Permanent Country of Residence | 250 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | residence_address_line1 | text | 永久居住地址 | Permanent Address | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | passport_number | text | 护照号码 | Passport Number | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | passport_issuing_authority | select | 护照签发国家 | Passport Issuing Authority | 250 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | passport_issue_date | date | 护照签发日期 | Passport Issued Date | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | passport_expiry_date | date | 护照有效期至 | Passport Expiry Date | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | email | text | 电子邮箱 | Email Address | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | mobile_country_code | text | 手机国家 / 地区代码 | Mobile Country Code | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Traveller Information | mobile_number | text | 手机号码 | Mobile Number | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | purpose_of_travel | select | 离境目的 | Purpose of Travel | 18 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | traveller_type | select | 旅客类型 | Traveller Type | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | airline_name | select | 航空公司名称 | Name of Airline | 103 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | flight_number | select | 航班号 | Flight Number | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | vessel_name | text | 船舶名称 | Name of Vessel | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | departure_airport | select | 菲律宾出境机场 | Airport of Origin in the Philippines | 20 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | departure_seaport | select | 菲律宾出境港口 | Seaport of Origin in the Philippines | 53 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | flight_departure_date | date | 离开菲律宾日期 | Date of Departure | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | destination_country | select | 目的国家 / 地区 | Country of Destination | 250 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | destination_port | text | 目的机场 / 港口 | Airport/Seaport of Destination | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | flight_arrival_date | date | 抵达目的地日期 | Date of Arrival at Destination | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Departure Details | return_date | date | 预计返回菲律宾日期 | Expected Return Date to the Philippines | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Traveller Declarations | travel_tax_payment_type | radio | 旅行税缴纳方式 | Travel Tax Details | 3 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Traveller Declarations | travel_tax_reference_number | text | 旅行税参考编号 | Travel Tax Reference Number | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Traveller Declarations | travel_tax_ticket_number | text | 机票号码 | Ticket Number | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Philippine Traveller Declarations | cfo_registration_number | text | 菲律宾海外委员会登记编号 | Commission on Filipinos Overseas Registration Number | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_information_acknowledgement | checkbox | 我已阅读并理解海关及货币申报说明 | I have read and understood the customs and currency declaration information. | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | has_goods_to_declare | radio | 是否有受限制、受监管、禁止、应税或商业货物需要申报？ | Do you have restricted, regulated, prohibited, dutiable, or commercial goods to declare? | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_3 | radio | 海关申报项目 3 | Gambling Paraphernalia; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_4 | radio | 海关申报项目 4 | Cosmetics, skin care products, food supplements and medicines in excess of quantities for personal use; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_5 | radio | 海关申报项目 5 | Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_6 | radio | 海关申报项目 6 | Firearms, ammunitions and explosives; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_7 | radio | 海关申报项目 7 | Alcohol and/or tobacco products in commercial quantities; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_8 | radio | 海关申报项目 8 | Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s); | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_9 | radio | 海关申报项目 9 | Mobile phones, hand-held radios and similar gadgets in excess of quantities for personal use, and radio commumication equipments; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_10 | radio | 海关申报项目 10 | Cremains (human ashes), human organs or tissues; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_11 | radio | 海关申报项目 11 | Jewelry, gold, precious metals or gems | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | customs_checklist_12 | radio | 海关申报项目 12 | Other goods, not mentioned above; | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | has_currency_to_declare | radio | 携带出境的货币或货币工具是否超过允许限额？ | Are you taking currency or monetary instruments above the permitted threshold out of the Philippines? | 2 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | currency_type | select | 货币申报类型 | Currency Declaration Type | 3 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | currency_amount | text | 申报总额 | Total Amount | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | currency_source | text | 货币来源 | Source of Currency | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | bsp_authorization_number | text | 菲律宾中央银行事先授权编号 | BSP Prior Authorization Number | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Customs and Currency Declaration | bsp_authorization_date | date | 菲律宾中央银行授权日期 | BSP Authorization Date | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Declaration Signature | customs_signature_declaration | checkbox | 我确认海关及货币申报真实准确 | I certify that this customs and currency declaration is true and correct. | 0 | pass |
| philippines | PH_ETRAVEL_DEPARTURE_CARD -> PH_ETRAVEL_DEPARTURE_CARD | Declaration Signature | final_declaration | checkbox | 我确认全部信息真实准确 | I certify that all information provided is true and correct. | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | place_of_birth_city | text | 出生城市 | Place of birth — City / Town | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | place_of_birth_country | country | 出生国家/地区 | Place of birth — Country | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_full_name | text | 配偶/伴侣完整姓名 | Spouse — Full name | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_nationality | country | 配偶/伴侣国籍 | Spouse — Nationality | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | has_other_passports | radio | 是否目前持有或曾经持有其他护照？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_line1 | text | 家庭住址街道/门牌/公寓信息 | Home address — Street / Apartment | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_city | text | 家庭住址城市 | Home address — City / Town | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_postcode | text | 家庭住址邮政编码 | Home address — Postal code | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_country | country | 家庭住址国家/地区 | Home address — Country of residence | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | mobile_number | text | 手机号码 | Mobile number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Occupation | current_profession | select | 当前职业/职业类别 | Current profession or occupation | 8 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Occupation | position_title | text | 职位/职称 | Position / Title | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | visa_type_requested | radio | 申请单次或多次入境电子签证 | Visa / declaration type requested | 4 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Philippines | 4 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 59 for 9(a)) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | port_of_entry | select | 预计入境口岸 | Intended port of entry | 11 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | carrier_name | text | 航空公司、船舶或交通承运人名称 | Name of airline, ship, or transport carrier | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | flight_number | text | 航班或列车号码（如已知） | Flight number | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | country_of_origin_for_trip | country | 国家旅行 | Country of origin for this trip (last departure country) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Philippines | 6 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | has_host_in_philippines | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in the Philippines? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_full_name | text | 邀请人/接待方完整姓名 | Host — Full name | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_address | text | 接待方地址 | Host — Address in Philippines | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_status | text | 接待方状态 | Host — Status / Citizenship | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | visited_philippines_before | radio | 是否曾访问菲律宾？ | Have you ever visited the Philippines before? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_arrival_date | date | 访问抵达日期 | Prior PH visit — Arrival date | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_departure_date | date | 访问离开日期 | Prior PH visit — Departure date | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_purpose | text | 访问目的 | Prior PH visit — Purpose | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_or_entry_philippines | radio | 是否曾被菲律宾拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, the Philippines? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_ph_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from the Philippines or any other country? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| philippines | PH_TEMPORARY_VISITOR_VISA -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | 1 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | place_of_birth_city | text | 出生城市 | Place of birth — City / Town | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | place_of_birth_country | country | 出生国家/地区 | Place of birth — Country | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_full_name | text | 配偶/伴侣完整姓名 | Spouse — Full name | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | spouse_nationality | country | 配偶/伴侣国籍 | Spouse — Nationality | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry (must be valid 6+ months beyond intended departure) | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | has_other_passports | radio | 是否目前持有或曾经持有其他护照？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_line1 | text | 家庭住址街道/门牌/公寓信息 | Home address — Street / Apartment | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_city | text | 家庭住址城市 | Home address — City / Town | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_postcode | text | 家庭住址邮政编码 | Home address — Postal code | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | home_address_country | country | 家庭住址国家/地区 | Home address — Country of residence | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | mobile_number | text | 手机号码 | Mobile number | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Occupation | current_profession | select | 当前职业/职业类别 | Current profession or occupation | 8 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Occupation | position_title | text | 职位/职称 | Position / Title | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | visa_type_requested | radio | 申请单次或多次入境电子签证 | Visa / declaration type requested | 4 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Philippines | 4 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Philippines | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 59 for 9(a)) | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | port_of_entry | select | 预计入境口岸 | Intended port of entry | 11 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | carrier_name | text | 航空公司、船舶或交通承运人名称 | Name of airline, ship, or transport carrier | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | flight_number | text | 航班或列车号码（如已知） | Flight number | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | country_of_origin_for_trip | country | 国家旅行 | Country of origin for this trip (last departure country) | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Philippines | 6 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Philippines | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Philippines | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | has_host_in_philippines | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in the Philippines? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_full_name | text | 邀请人/接待方完整姓名 | Host — Full name | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_address | text | 接待方地址 | Host — Address in Philippines | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Host in Philippines | host_status | text | 接待方状态 | Host — Status / Citizenship | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | visited_philippines_before | radio | 是否曾访问菲律宾？ | Have you ever visited the Philippines before? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_arrival_date | date | 访问抵达日期 | Prior PH visit — Arrival date | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_departure_date | date | 访问离开日期 | Prior PH visit — Departure date | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | prior_ph_visit_purpose | text | 访问目的 | Prior PH visit — Purpose | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_or_entry_philippines | radio | 是否曾被菲律宾拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, the Philippines? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_ph_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from the Philippines or any other country? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| philippines | visa_free_14_days_or_evisa -> PH_TEMPORARY_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines. | 1 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname | text | 姓氏（与护照一致） | Surname (family name) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth_different | radio | 出生时姓氏是否与当前姓氏不同？ | Is your surname at birth different from your current surname? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | surname_at_birth | text | 出生时姓氏/曾用姓氏 | Surname at birth (former family name(s)) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | given_names | text | 名字（与护照一致） | First name(s) (given name(s)) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | place_of_birth | text | 出生地点（城市/地区） | Place of birth (city or town) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | current_nationality | country | 当前国籍 | Current nationality | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth_different | radio | 出生时国籍是否与当前国籍不同？ | Is your nationality at birth different from your current nationality? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | nationality_at_birth | country | 出生时国籍 | Nationality at birth | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationalities? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | sex | select | 性别 | Sex | 3 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status | select | 婚姻/民事伴侣状态 | Civil status | 7 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | civil_status_other | text | 请说明您的婚姻状况 | Please specify your civil status | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Personal Details | is_applicant_minor | radio | 是否申请人？ | Will you be under 18 on the date you plan to travel to the Schengen Area? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_surname | text | 父母机构姓氏 | Surname of parental authority / legal guardian | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_given_names | text | 父母机构名字姓名 | First name(s) of parental authority / legal guardian | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_line_1 | text | 父母机构地址行 | Address — line 1 (if different from applicant's) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_city | text | 城市 | City | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_address_country | country | 国家 | Country | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_phone | text | 父母机构电话 | Telephone number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_email | text | 父母机构邮箱 | E-mail address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Parental Authority (for minors) | parental_authority_nationality | country | 父母机构国籍 | Nationality | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | has_national_id | radio | 您是否有国民身份证号码？ | Do you have a national identity number? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | national_id_number | text | 国民身份证号码 | National identity number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type | select | 旅行证件类型 | Type of travel document | 6 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_type_other | text | 旅行证件其他 | Please specify the travel document type | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_number | text | 旅行证件号码 | Travel document number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issue_date | date | 旅行证件签发日期 | Date of issue | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_expiry_date | date | 旅行证件有效期至 | Valid until | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel Document & Identity | travel_document_issuing_country | country | 旅行证件签发国家/地区 | Issued by (country) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | has_eu_family_member | radio | 是否家庭成员？ | Are you a family member of an EU, EEA or Swiss citizen, or of a UK national who is a beneficiary of the EU-UK Withdrawal Agreement? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_surname | text | 欧盟家庭姓氏 | Surname of the EU/EEA/CH family member | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_given_names | text | 欧盟家庭名字姓名 | First name(s) of the EU/EEA/CH family member | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_nationality | country | 欧盟家庭国籍 | Nationality | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_type | select | 欧盟家庭旅行证件 | Type of travel document or ID card | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_travel_document_number | text | 欧盟家庭旅行证件号码 | Travel document / ID card number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | eu_family_relationship | select | 欧盟家庭关系 | Family relationship | 6 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | EU/EEA/CH Family Member | directive_2004_38_acknowledged | radio | 我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则 | As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_city | text | 家庭住址城市 | Town or city | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_postcode | text | 家庭住址邮政编码 | Postcode / ZIP code | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | home_address_country | country | 家庭住址国家/地区 | Country | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | email_address | text | 电子邮箱地址 | E-mail address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | phone_number | text | 电话号码（含国家代码） | Telephone number (including country code) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country_different | radio | 是否居住国家/地区？ | Do you reside in a country other than your country of current nationality? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_country | country | 居住国家 | Country of residence | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_number | text | 居留许可或同等证件号码 | Residence permit or equivalent number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Contact Details & Residence | residence_permit_expiry_date | date | 居留许可有效期至 | Residence permit valid until | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | is_student | radio | 您是否是学生？ | Are you a student? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_name | text | 雇主名称 | Employer name | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | fv_business_segment | select | 商务 | France-Visas sector | 6 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_address_line_1 | text | 雇主地址行 | Employer address — line 1 | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_city | text | 雇主城市 | Employer city | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_country | country | 雇主国家 | Employer country | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_phone | text | 雇主电话 | Employer telephone number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_name | text | 学校名称 | Name of educational establishment | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | employer_email | text | 雇主邮箱 | Employer email address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_address | text | 学校地址 | Address of educational establishment | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Occupation | school_phone | text | 学校电话 | Telephone number of educational establishment | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_of_journey | select | 本次旅行目的 | Main purpose of the journey | 10 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | purpose_additional_info | textarea | 停留目的补充信息 | Additional information on the purpose of stay | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | main_destination_country | country | 主要目的地成员国 | Member State of main destination | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | first_entry_country | country | 首次入境成员国 | Member State of first entry | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | number_of_entries_requested | select | 申请入境次数 | Number of entries requested | 3 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_duration_days | text | 预计停留或过境时长（天数） | Duration of the intended stay or transit (number of days) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | departure_from_origin_date | date | 从居住国出发日期 | Date of departure from your country of residence | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in the Schengen Area | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | intended_departure_date | date | 预计离开日期 | Intended date of departure from the Schengen Area | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Trip Details | visits_french_overseas_territories | radio | 您是否计划前往法国海外领地？ | Are you going to French overseas territories? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_surname | text | 邀请人/接待方姓氏 | Host's surname | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_given_names | text | 邀请人/接待方名字 | Host's first name(s) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_relationship | text | 邀请人/接待方与申请人的关系 | Relationship to the host | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_address_line_1 | text | 邀请人/接待方地址第一行 | Host's address — line 1 | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_city | text | 邀请人/接待方所在城市 | Host's city | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_country | country | 邀请人/接待方所在国家 | Host's country (Schengen Member State) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_phone | text | 邀请人/接待方电话 | Host's telephone number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_email | text | 邀请人/接待方电子邮箱 | Host's e-mail address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_nationality | country | 接待方国籍 | Host's nationality | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | host_legal_status_schengen | select | 接待方法定状态申根 | Host's legal status in the Schengen Area | 4 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_name | text | 商务公司 | Inviting company / organisation name | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_address_line_1 | text | 商务公司地址行 | Company address — line 1 | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_city | text | 商务公司城市 | Company city | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_country | country | 商务公司国家 | Company country (Schengen Member State) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_company_phone | text | 商务公司电话 | Company telephone number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_surname | text | 商务联系人姓氏 | Company contact surname | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_given_names | text | 商务联系人名字姓名 | Company contact first name(s) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_email | text | 商务联系人邮箱 | Company contact e-mail | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_address | text | 商务联系人地址 | Company contact address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_contact_phone | text | 商务联系人电话 | Company contact telephone number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | business_invitation_letter_held | radio | 是否商务？ | Do you have a formal invitation letter from the company? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_name | text | 学习机构 | Name of the educational institution | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_address | text | 学习机构地址 | Institution address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_institution_country | country | 学习机构国家 | Institution country (Schengen Member State) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_name | text | 学习 | Course or programme name | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_start_date | date | 学习开始日期 | Course start date | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_course_duration | text | 学习 | Course duration | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | study_acceptance_letter_held | radio | 您是否持有学校或教育机构出具的录取/接收证明？ | Do you have an acceptance letter from the institution? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_name | text | 医疗 | Name of the hospital or clinic | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_address | text | 医疗地址 | Hospital or clinic address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_facility_country | country | 医疗国家 | Hospital or clinic country (Schengen Member State) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_type | text | 医疗 | Type of treatment | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_start_date | date | 医疗开始日期 | Treatment start date | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_treatment_duration | text | 医疗 | Treatment duration | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | medical_costs_prepaid | radio | 医疗费用是否已经预付，或已由医疗机构确认付款安排？ | Have treatment costs been prepaid or confirmed by the facility? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_name | text | 活动 | Name of the event | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_organizer | text | 活动 | Event organiser | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_location | text | 活动 | Event location (city and venue) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_country | country | 活动国家 | Event country (Schengen Member State) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_start_date | date | 活动开始日期 | Event start date | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_end_date | date | 活动结束日期 | Event end date | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | event_invitation_letter_held | radio | 您是否持有活动主办方出具的邀请函？ | Do you have an invitation letter from the organiser? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_country | country | 过境目的地国家 | Final destination country (outside Schengen) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_onward_ticket_held | radio | 您是否持有已确认的续程机票？ | Do you hold a confirmed onward flight ticket? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | transit_destination_visa_held | radio | 是否签证？ | Do you hold an entry visa for the final destination (if required)? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | other_purpose_explain | textarea | 其他目的 | Please describe the purpose of your journey | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | tourism_itinerary_summary | textarea | 旅游 | Brief summary of your planned itinerary | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_airside_only | radio | 您是否会一直停留在申根机场的国际中转区内，不办理入境手续？ | Will you remain in the international transit area of the Schengen airport(s) without passing through immigration? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Purpose-Specific Details | atv_annex_iv_acknowledged | radio | 我已了解机场过境签证（ATV）及申根区过境规定 | I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_type | select | 住宿类型 | Type of accommodation in the Schengen Area | 4 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_name | text | 住宿地点或接待方名称 | Hotel name or accommodation label | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_address_line_1 | text | 住宿地址——第1行 | Accommodation address — line 1 | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_city | text | 城市 | City | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_country | country | 住宿国家 | Country (Schengen Member State) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_phone | text | 住宿联系电话 | Accommodation telephone number | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_email | text | 住宿电子邮箱 | Accommodation e-mail address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | hotel_confirmation_number | text | 酒店/预订确认号（如有） | Hotel / booking confirmation number (if available) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Accommodation in Schengen | accommodation_other_explain | textarea | 住宿其他 | Please describe your accommodation arrangements | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_schengen_fingerprints_given | radio | 是否名字？ | Have your fingerprints been collected previously for the purpose of applying for a Schengen visa? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_date | date | 日期 | Date fingerprints were collected (if known) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | prev_fingerprints_visa_sticker | text | 签证 | Number of the visa (if known) | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | has_entry_permit_final_destination | radio | 是否入境许可最终？ | Do you hold an entry permit for the final country of destination (where applicable)? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_issuing_authority | text | 入境许可签发机构 | Entry permit — issued by | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_from | date | 入境许可有效 | Entry permit — valid from | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | entry_permit_valid_until | date | 入境许可有效至 | Entry permit — valid until | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa | radio | 是否曾被拒发申根签证？ | Have you ever been refused a Schengen visa? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Travel History | ever_refused_schengen_visa_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Please provide details of the refusal | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | cost_covered_by | select | 谁将承担本次旅行和停留费用？ | Who will cover the cost of travelling and living during your stay? | 3 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_cash | radio | 方式现金 | Self: cash | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_travellers_cheques | radio | 方式旅行支票 | Self: traveller's cheques | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_credit_card | radio | 方式信用卡 | Self: credit card | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_accommodation | radio | 方式预付住宿 | Self: pre-paid accommodation | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_prepaid_transport | radio | 方式预付交通 | Self: pre-paid transport | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other | radio | 方式其他 | Self: other means of support | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | self_means_other_explain | text | 方式其他 | Please describe the other means of support | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_type | select | 担保人/资助方类型 | Type of sponsor | 4 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_name | text | 担保人/资助方名称 | Sponsor name | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_relationship | text | 担保人/资助方与申请人的关系 | Relationship to sponsor | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_address | text | 担保人/资助方地址 | Sponsor address | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_cash | radio | 担保人方式现金 | Sponsor: cash | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_accommodation_provided | radio | 担保人方式住宿 | Sponsor: accommodation provided | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_all_expenses_covered | radio | 担保人方式 | Sponsor: all expenses covered during the stay | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_prepaid_transport | radio | 担保人方式预付交通 | Sponsor: pre-paid transport | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other | radio | 担保人方式其他 | Sponsor: other means of support | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Financial Support | sponsor_means_other_explain | text | 担保人方式其他 | Please describe the other sponsor means of support | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | has_different_filler | radio | 本申请是否由申请人本人以外的其他人填写？ | Is the application being filled in by someone other than the applicant? | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_surname | text | 填表人姓氏 | Surname of the person filling in the application form | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_given_names | text | 填表人名字 | First name(s) of the person filling in the application form | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_address | text | 填表人地址 | Address of the person filling in the application form | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_email | text | 填表人电子邮箱 | E-mail address of the person filling in the application form | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | filler_phone | text | 填表人电话号码 | Telephone number of the person filling in the application form | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | place_of_application | text | 申请提交地点 / 当前申请所在地 | Place of application | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_date | date | 签署日期 | Date of signing | 0 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_fee_not_refunded_awareness | radio | 我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。 | I am aware that the visa fee is not refunded if the visa is refused. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_insurance_multi_entry_awareness | radio | 我已知悉：如获发多次入境签证，每次进入成员国领土时均需持有足够的旅行医疗保险。 | Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_vis_consent | radio | 我已知悉并同意签证申请数据、照片和指纹的收集、处理与保存 | I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_data_rights_awareness | radio | 我已知悉我对 VIS 中个人数据的查询、更正和依法删除权利 | I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_truthfulness | radio | 我声明本申请所填信息真实、正确且完整 | I declare that to the best of my knowledge all particulars supplied by me are correct and complete. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_awareness_refusal | radio | 我已知悉虚假陈述可能导致拒签、已发签证被撤销并承担法律责任 | I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | declaration_undertaking_to_leave | radio | 我承诺在获发签证的有效期届满前离开成员国领土 | I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States. | 2 | pass |
| portugal | EU_SCHENGEN_C_SHORT_STAY -> EU_SCHENGEN_C_SHORT_STAY | Declaration | additional_information | textarea | 补充说明 / 其他可能影响本次申请的信息 | Is there anything else you would like to tell us about your application? | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| russia | RU_E_VISA -> RU_E_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| singapore | entry_visa_or_visit_pass -> entry_visa_or_visit_pass | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | full_name | text | 护照上的完整姓名 | Full Name (In Passport) | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | passport_number | text | 护照号码 | Passport Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | passport_expiry_date | date | 护照到期日期 | Date of Passport Expiry | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | sex | select | 护照所示性别 | Sex as indicated in passport | 3 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | date_of_birth | date | 出生日期 | Date of Birth | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | nationality | select | 国籍 / 公民身份 | Nationality/Citizenship | 206 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | place_of_birth_country | select | 出生国家 / 地区 | Country/Place of Birth | 207 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | place_of_residence | select | 居住地 | Place of Residence | 2267 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | email_address | text | 电子邮箱地址 | Email Address | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | mobile_country_code | text | 手机国家 / 地区代码 | Country/Region Code | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | mobile_number | text | 手机号码 | Mobile Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | has_used_different_name_to_enter_singapore | radio | 是否曾使用不同姓名的护照入境新加坡？ | Have you ever used a passport under a different name to enter Singapore? | 2 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | has_health_symptoms | radio | 目前是否有发热、咳嗽、呼吸急促、头痛、呕吐、头晕或皮疹？ | Do you currently have fever, cough, shortness of breath, headache, vomiting, dizziness or rash? | 2 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | recent_country_visit_history | radio | 抵达前六天内是否到访黄热病风险国家或地区？ | Have you visited countries/places in Africa or Latin America identified for Yellow Fever risk in the six days before arrival? | 2 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Traveller Information | recent_high_risk_region_visit_history | radio | 抵达新加坡前 21 天内是否到访孟加拉国、印度、非洲、中东或拉丁美洲？ | Have you visited Bangladesh, India, Africa, the Middle East or Latin America in the past 21 days prior to your arrival in Singapore? | 2 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | arrival_date | date | 抵达日期 | Date of Arrival (DD/MM/YYYY) | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | departure_date | date | 离开新加坡日期 | Date of Departure from Singapore | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | last_city_or_port_before_singapore | select | 抵达新加坡前最后出发的城市/港口 | Last City/Port of Embarkation Before Singapore | 2267 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | purpose_of_travel | select | 旅行目的 | Purpose of Travel | 12 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | mode_of_travel | select | 交通方式 | Mode of Travel | 3 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | air_transport_type | select | 航空交通方式 | Mode of Transport | 2 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | carrier_code | select | 航空公司代码 | Carrier Code | 124 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | transport_number | text | 航班号 | Flight Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | carrier_name | text | 承运人名称 / 航班号 | Carrier Name/Flight Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | land_transport_type | select | 陆路交通方式 | Mode of Transport | 6 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | vehicle_number | text | 车辆号码 | Vehicle Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | sea_transport_type | select | 海路交通方式 | Mode of Transport | 4 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | cruise_name | select | 邮轮名称 | Cruise Name | 28 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | vessel_name | text | 船舶名称 | Vessel Name | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_type | select | 在新加坡的住宿类型 | Type of Accommodation in Singapore | 3 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_name | select | 酒店名称 | Hotel Name | 469 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_other_type | select | 其他住宿类型 | Accommodation (Others) | 2 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_postcode | text | 邮政编码 | Postal Code | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_block_number | text | 楼号 / 门牌号 | Block Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_street_name | text | 街道名称 | Street Name | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_building_name | text | 建筑名称 | Building Name | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_floor_number | text | 楼层 | Floor Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | accommodation_unit_number | text | 单元号 | Unit Number | 0 | pass |
| singapore | SG_ARRIVAL_CARD -> SG_ARRIVAL_CARD | Trip Information | next_city_or_port_after_singapore | select | 离开新加坡后下船/抵达的下一城市/港口 | Next City/Port of Disembarkation After Singapore | 2267 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | place_of_birth_city | text | 出生城市 | Place of birth — City / Town | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | place_of_birth_country | country | 出生国家/地区 | Place of birth — Country | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | race | select | 种族/族群 | Race | 6 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | religion | select | 宗教信仰 | Religion | 7 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | spouse_full_name | text | 配偶/伴侣完整姓名 | Spouse — Full name | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | spouse_nationality | country | 配偶/伴侣国籍 | Spouse — Nationality | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | has_other_passports | radio | 是否目前持有或曾经持有其他护照？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | home_address_line1 | text | 家庭住址街道/门牌/公寓信息 | Home address — Street / Apartment | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | home_address_city | text | 家庭住址城市 | Home address — City / Town | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | home_address_state | text | 家庭住址州/省 | Home address — State / Province | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | home_address_postcode | text | 家庭住址邮政编码 | Home address — Postal code | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | home_address_country | country | 家庭住址国家/地区 | Home address — Country of residence | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | mobile_number | text | 手机号码 | Mobile number | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Occupation | current_profession | select | 当前职业/职业类别 | Current profession or occupation | 8 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Occupation | position_title | text | 职位/职称 | Position / Title | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | visa_type_requested | radio | 申请单次或多次入境电子签证 | Visa type requested | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Singapore | 1 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 30 per entry) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | port_of_entry | select | 预计入境口岸 | Intended port of entry | 9 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | carrier_name | text | 航空公司、船舶或交通承运人名称 | Name of airline, ship, or transport carrier | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | flight_number | text | 航班或列车号码（如已知） | Flight number (if known) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Singapore | 5 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel or property | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | accommodation_postcode | text | 住宿 | Postal code (Singapore 6 digits) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | has_local_sponsor | radio | 是否担保人/资助方？ | Do you have a local sponsor in Singapore for this application? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | local_sponsor_type | select | 担保人 | Local sponsor type | 4 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | local_sponsor_name | text | 担保人 | Local sponsor — Full name (or company name) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | local_sponsor_nric_or_uen | text | 担保人 | Local sponsor — NRIC / FIN / UEN | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | local_sponsor_address | text | 担保人地址 | Local sponsor — Address in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | local_sponsor_phone | text | 担保人电话 | Local sponsor — Telephone | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | local_sponsor_email | text | 担保人邮箱 | Local sponsor — Email | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Local Sponsor | local_sponsor_relationship | text | 担保人关系 | Local sponsor — Relationship to applicant | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Host in Singapore | has_host_in_singapore | radio | 是否邀请人/接待方？ | Will you be staying with a host (different from your local sponsor)? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Host in Singapore | host_full_name | text | 邀请人/接待方完整姓名 | Host — Full name | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Host in Singapore | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Host in Singapore | host_address | text | 接待方地址 | Host — Address in Singapore | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Host in Singapore | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | visited_singapore_before | radio | 是否曾访问新加坡？ | Have you ever visited Singapore before? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | prior_singapore_visit_arrival_date | date | 访问抵达日期 | Prior Singapore visit — Arrival date | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | prior_singapore_visit_departure_date | date | 访问离开日期 | Prior Singapore visit — Departure date | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | prior_singapore_visit_purpose | text | 访问目的 | Prior Singapore visit — Purpose | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | refused_visa_or_entry_singapore | radio | 是否曾被新加坡拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Singapore? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | refused_visa_singapore_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Singapore or any other country? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| singapore | SG_VISITOR_VISA -> SG_VISITOR_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Singapore. | 1 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| south_africa | ZA_VISITOR_VISA -> ZA_VISITOR_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Official e-Form Route | applying_consulate | select | 选择使领馆 | Consular office / overseas mission | 8 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Official e-Form Route | period_of_stay | radio | 停留期限类别 | Period of Stay | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Official e-Form Route | status_of_stay | select | 拟申请停留资格 | Status of Stay | 1 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | family_name_en | text | 姓（按护照英文大写） | Family name (in passport, block letters) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | given_names_en | text | 名（按护照英文大写） | Given names (in passport, block letters) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | sex | radio | 性别 | Sex | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | nationality | country | 国籍 | Nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | national_identity_no | text | 国家身份证号码 | National Identity No. | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | has_used_other_names | radio | 是否有曾用名？ | Have you ever used any other names? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | other_family_name | text | 曾用姓 | Other family name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | other_given_name | text | 曾用名 | Other given name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | is_dual_national | radio | 是否双重国籍？ | Are you a citizen of more than one country? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Personal Details | other_nationalities | country | 双重国籍的国籍 | Other nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | passport_type | radio | 护照类型 | Passport type | 4 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | passport_type_other | text | 其他护照类型（请说明） | Passport type — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | passport_no | text | 护照号码 | Passport number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | passport_country | country | 护照签发国家/地区 | Country of passport | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | passport_date_of_issue | date | 护照签发日期 | Date of issue | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | passport_date_of_expiry | date | 护照有效期至 | Date of expiry | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | has_other_passport | radio | 是否持有两种护照？ | Do you hold more than one passport? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | other_passport_type | radio | 其他护照类型 | Other passport — type | 4 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | other_passport_type_other | text | 其他护照类型说明 | Other passport — type other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | other_passport_no | text | 其他护照号码 | Other passport — number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | other_passport_country | country | 其他护照签发国家/地区 | Other passport — issuing country | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Passport | other_passport_expiry | date | 其他护照有效期至 | Other passport — date of expiry | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | home_address_street | text | 家庭地址 - 街道 | Home address — street | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | home_address_city | text | 家庭地址 - 城市 | Home address — city | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | home_address_state | text | 家庭地址 - 省/州 | Home address — state / province | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | home_address_country | country | 家庭地址 - 国家 | Home address — country | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | telephone | text | 固定电话 | Telephone (landline) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | cell_phone | text | 手机号码 | Cell phone (mobile) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | email | text | 电子邮箱 | Email address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | applying_country_same_as_residence | radio | 申请签证时所在国家是否与现居住国相同？ | Is the country where you are applying for the visa the same as your current country of residence? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | applying_country | country | 申请签证时申请人所在国家 | Country where applicant is applying for visa | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | emergency_full_name | text | 紧急联系人姓名 | Emergency contact — full name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | emergency_country_of_residence | country | 紧急联系人居住国家/地区 | Emergency contact — country of residence | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | emergency_telephone | text | 紧急联系人电话 | Emergency contact — telephone | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Contact Details | emergency_relationship | text | 紧急联系人与申请人的关系 | Emergency contact — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Marital & Family | marital_status | radio | 当前婚姻状况 | Current marital status | 3 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_family_name_en | text | 配偶姓（英文） | Spouse — family name (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_given_names_en | text | 配偶名（英文） | Spouse — given names (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_dob | date | 配偶出生日期 | Spouse — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_nationality | country | 配偶国籍 | Spouse — nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_address | textarea | 配偶居住地址 | Spouse — residential address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Marital & Family | spouse_contact_no | text | 配偶联系电话 | Spouse — contact number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education | radio | 最高学历 | Highest education completed | 4 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | highest_education_other | text | 其他最高学历（请说明） | Highest education — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | school_name | text | 最近就读学校名称 | Name of school (most recent) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | school_location | text | 学校所在地（城市/省份/国家） | School location (city / province / country) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | employment_status | radio | 当前职业/就业状态 | Current occupation / employment status | 8 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | employment_status_other | text | 其他职业/就业状态（请说明） | Employment status — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_name | text | 公司/机构/学校名称 | Company / institution / school name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_position | text | 职位/课程 | Position / course | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_address | textarea | 公司/机构/学校地址 | Company / institution / school address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Education & Employment | employer_telephone | text | 公司/机构/学校联系电话 | Company / institution / school telephone | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | purpose_of_visit | radio | 入境目的 | Purpose of visit to Korea | 12 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | purpose_of_visit_other | text | 其他赴韩目的（请说明） | Purpose of visit — Other (please specify) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | expected_korea_visit_count | radio | 预计访韩次数 | Expected number of visits to Korea | 3 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | intended_period_of_stay | text | 拟在韩停留天数 | Intended period of stay (days) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | intended_date_of_entry | date | 拟入境韩国日期 | Intended date of entry into Korea | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | korea_address_mode | radio | 计划停留地点填写方式 | Address in Korea input mode | 3 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | address_in_korea | select | 在韩停留地址（含酒店） | Selected official address in Korea | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | korea_address_detail | text | 详细地址 | Address detail in Korea | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Visit Information | contact_in_korea | text | 在韩联系方式 | Contact number in Korea | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelled_to_korea_5y | radio | 过去5年内是否访问过韩国？ | Have you travelled to Korea in the last 5 years? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | korea_visit_count | text | 过去5年访问韩国次数 | Number of times visited Korea (last 5 years) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | korea_visit_purpose | text | 上次/既往赴韩目的 | Prior Korea visit — purpose | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelled_outside_5y | radio | 过去5年内是否访问过居住国以外的国家/地区（韩国除外）？ | Have you travelled outside your country of residence (excl. Korea) in the last 5 years? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_country | country | 境外旅行国家/地区 | Foreign trip — country | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_purpose | text | 境外旅行目的 | Foreign trip — purpose | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_start_date | date | 境外旅行开始日期 | Foreign trip — period start | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | foreign_trip_end_date | date | 境外旅行结束日期 | Foreign trip — period end | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | has_family_in_korea | radio | 是否有家属目前在韩国停留？ | Do you have any family members currently staying in Korea? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_full_name | text | 在韩家属姓名（英文） | Family in Korea — full name (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_dob | date | 在韩家属出生日期 | Family in Korea — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_nationality | country | 在韩家属国籍 | Family in Korea — nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_in_korea_relationship | text | 与在韩家属的关系 | Family in Korea — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | travelling_with_family | radio | 是否与家属一同赴韩？ | Are you travelling to Korea with any family members? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_full_name | text | 同行家属姓名（英文） | Travelling-with family — full name (English) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_dob | date | 同行家属出生日期 | Travelling-with family — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_nationality | country | 同行家属国籍 | Travelling-with family — nationality | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Travel History & Family | family_with_relationship | text | 与同行家属的关系 | Travelling-with family — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | has_inviting_company | radio | 是否有邀请公司？ | Do you have an inviting company? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | is_visa_portal_member | radio | 是否加入签证门户网站会员？ | Is the inviting company a visa portal website member? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | invitation_company_portal_id | text | 邀请公司签证网站账号 | Inviting company visa website account | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | invitation_company_business_registration_no | text | 营业登记号码 | Business registration number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | invitation_company_name | text | 邀请公司名称 | Inviting company name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | invitation_company_representative_name | text | 代表姓名 | Representative name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | invitation_company_relationship | text | 关系 | Relationship | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | invitation_company_address | textarea | 邀请公司地址 | Inviting company address | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Invitation Company | invitation_company_phone | text | 邀请公司电话号码 | Inviting company phone number | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | visit_cost_usd | text | 访问经费（美元标准） | Travel expenses (USD) | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | cost_payer_name | text | 经费支付者姓名/公司（团体）名 | Payer — name / company / organization | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | cost_payer_relationship | text | 经费支付者关系 | Payer — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | cost_payer_support_type | text | 资助内容 | Payer — support details | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | cost_payer_contact | text | 经费支付者联系方式 | Payer — contact method | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | received_form_assistance | radio | 该申请书是否有人辅助您一同填写？ | Did anyone assist you with filling out this application? | 2 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | assistant_full_name | text | 协助填写人姓名 | Assistant — English full name | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | assistant_dob | date | 协助填写人出生日期 | Assistant — date of birth | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | assistant_telephone | text | 协助填写人电话 | Assistant — contact method | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | assistant_relationship | text | 协助填写人与申请人的关系 | Assistant — relationship to applicant | 0 | pass |
| south_korea | KR_C39_SHORT_TERM_VISIT -> KR_C39_SHORT_TERM_VISIT | Expenses & Assistance | declaration_consent | checkbox | 本人声明本申请表所填内容真实、正确，并知悉任何虚假陈述可能导致拒签或被拒绝入境韩国。 | I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea. | 1 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| sri_lanka | LK_ETA -> LK_ETA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Delivery Location | continent | select | 所在大洲 | Continent | 5 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Delivery Location | embassy_office | select | 受理驻外馆处/办事处 | Receiving embassy/office | 14 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Photo & Basic Status | first_time_applying | radio | 这是您首次在海外、香港或澳门申请赴台吗？ | First time applying to visit Taiwan from abroad/HK/Macau? | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Photo & Basic Status | permit_type | radio | 申请的入台许可类型 | Permit type applied for | 3 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Photo & Basic Status | permit_count | select | 申请入台许可的次数 | Number of permits requested | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Photo & Basic Status | has_other_nationality_passport | radio | 是否持有或曾持有其他国籍？ | Do you hold a passport of another nationality? | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Photo & Basic Status | household_revoked | radio | 中国大陆户籍当前状态 | Current mainland household registration status | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Photo & Basic Status | eligibility_category | radio | 申请资格类别 | Eligibility category | 4 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | name_chinese | text | 中文姓名（繁体字） | Name in Chinese (traditional characters) | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | name_english | text | 英文姓名（按护照填写大写字母） | Name in English (as shown in passport, uppercase) | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | passport_number | text | 护照或旅行证件号码 | Passport / HK visa identity document / Macau travel document / mainland travel document number | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | passport_expiry_date | date | 护照/旅行证件有效期至（公历） | Passport / travel document validity expiry date (Gregorian calendar) | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | gender | select | 性别 | Gender | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | overseas_residency_id_number | text | 海外居留身份证明号码（如永居证、居留卡或签证号码） | Overseas Chinese residency identity number (e.g. permanent residence number, residence card number, or visa number) | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | mainland_id_number_not_applicable | checkbox | 没有中国大陆居民身份证号码 | No mainland ID number | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | mainland_id_number | text | 中国大陆居民身份证号码 | Mainland ID number | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | birth_place_is_mainland | radio | 您的出生地是否在中国大陆？ | Place of birth (same as travel document held) | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | birth_place_other_country | select | 出生国家/地区 | Country/region of birth | 241 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | birth_place_mainland_region | select | 中国大陆出生省/市/地区 | Mainland China birth province/city/region | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | local_mobile_phone | text | 现居地手机号码（含国家/地区区号） | Mobile phone at current residence (include country code) | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | current_occupation | select | 当前职业 | Current occupation | 54 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | occupation_experience | textarea | 工作经历 | Experience | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | company_name | text | 任职单位、所属机构或就读学校全称 | Company name and full organization/unit name or school name | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | job_title | text | 职位名称 | Job title | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | is_taiwanese_spouse | select | 您是否为台湾居民的配偶？ | Are you the spouse of a Taiwanese person? | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | traveling_with_parents | select | 您的父母是否与您一同赴台？ | Are your parents traveling with you? | 2 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Applicant Identity | overseas_address | textarea | 香港、澳门或海外现居地址 | Hong Kong, Macau, or overseas address | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_city | select | 台湾地址—县市 | City/County | 22 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_district | select | 台湾地址—区/乡/镇 | District/township | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_village | text | 台湾地址—村/里（选填） | Tw Contact Village | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_neighborhood | text | 台湾地址—邻号（只填数字） | Tw Contact Neighborhood | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_road | text | 台湾地址—街路及段 | Street or road section | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_lane | text | 台湾地址—巷号（只填数字） | Tw Contact Lane | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_alley | text | 台湾地址—弄号（只填数字） | Tw Contact Alley | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_building_number | text | 台湾地址—门牌、楼层及房号（入住酒店可填酒店名称） | House number / floor / room number (or hotel name if staying at a hotel) | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_local_phone | text | 台湾市内电话号码 | Taiwan landline number | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_mobile_not_applicable | checkbox | 没有台湾联系人手机号码 | No Taiwan contact mobile number | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Taiwan Contact Address | tw_contact_mobile | text | 台湾联系人手机号码 | Taiwan contact mobile number | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Other Nationality | other_nationality_country | select | 持有或曾持有的其他国籍 | Other nationality held | 241 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Other Nationality | other_passport_number | text | 其他护照号码 | Other country's passport/document number | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Other Nationality | other_passport_expiry_date | date | 其他护照到期日期 | Other country's passport/document validity expiry date | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_status | select | 父亲—当前状况（在世、已故或离异） | Kin Father Status | 3 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_name | text | 父亲—姓名 | Kin Father Name | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_date_of_birth | date | 父亲—出生日期 | Kin Father Date Of Birth | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_phone | text | 父亲—联系电话 | Kin Father Phone | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_occupation | select | 父亲—职业 | Kin Father Occupation | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_service_unit | text | 父亲—任职单位/所属机构 | Kin Father Service Unit | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_job_title | text | 父亲—职务/职称 | Kin Father Job Title | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_current_address_same_as_overseas | checkbox | 父亲—当前住址是否与申请人的港澳或海外住址相同？ | Kin Father Current Address Same As Overseas | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_father_current_address | textarea | 父亲—当前住址 | Kin Father Current Address | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_status | select | 母亲—当前状况（在世、已故或离异） | Kin Mother Status | 3 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_name | text | 母亲—姓名 | Kin Mother Name | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_date_of_birth | date | 母亲—出生日期 | Kin Mother Date Of Birth | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_phone | text | 母亲—联系电话 | Kin Mother Phone | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_occupation | select | 母亲—职业 | Kin Mother Occupation | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_service_unit | text | 母亲—任职单位/所属机构 | Kin Mother Service Unit | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_job_title | text | 母亲—职务/职称 | Kin Mother Job Title | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_current_address_same_as_overseas | checkbox | 母亲—当前住址是否与申请人的港澳或海外住址相同？ | Kin Mother Current Address Same As Overseas | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_mother_current_address | textarea | 母亲—当前住址 | Kin Mother Current Address | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_status | select | 配偶—当前状况（在世、已故或离异） | Kin Spouse Status | 3 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_name | text | 配偶—姓名 | Kin Spouse Name | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_date_of_birth | date | 配偶—出生日期 | Kin Spouse Date Of Birth | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_phone | text | 配偶—联系电话 | Kin Spouse Phone | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_occupation | select | 配偶—职业 | Kin Spouse Occupation | 54 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_service_unit | text | 配偶—任职单位/所属机构 | Kin Spouse Service Unit | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_job_title | text | 配偶—职务/职称 | Kin Spouse Job Title | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_current_address_same_as_overseas | checkbox | 配偶—当前住址是否与申请人的港澳或海外住址相同？ | Kin Spouse Current Address Same As Overseas | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_spouse_current_address | textarea | 配偶—当前住址 | Kin Spouse Current Address | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_status | select | 第一名子女—当前状况（在世、已故或离异） | Kin Child1 Status | 3 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_name | text | 第一名子女—姓名 | Kin Child1 Name | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_date_of_birth | date | 第一名子女—出生日期 | Kin Child1 Date Of Birth | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_phone | text | 第一名子女—联系电话 | Kin Child1 Phone | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_occupation | select | 第一名子女—职业 | Kin Child1 Occupation | 54 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_service_unit | text | 第一名子女—任职单位/所属机构 | Kin Child1 Service Unit | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_job_title | text | 第一名子女—职务/职称 | Kin Child1 Job Title | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_current_address_same_as_overseas | checkbox | 第一名子女—当前住址是否与申请人的港澳或海外住址相同？ | Kin Child1 Current Address Same As Overseas | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child1_current_address | textarea | 第一名子女—当前住址 | Kin Child1 Current Address | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_status | select | 第二名子女—当前状况（在世、已故或离异） | Kin Child2 Status | 3 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_name | text | 第二名子女—姓名 | Kin Child2 Name | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_date_of_birth | date | 第二名子女—出生日期 | Kin Child2 Date Of Birth | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_phone | text | 第二名子女—联系电话 | Kin Child2 Phone | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_occupation | select | 第二名子女—职业 | Kin Child2 Occupation | 54 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_service_unit | text | 第二名子女—任职单位/所属机构 | Kin Child2 Service Unit | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_job_title | text | 第二名子女—职务/职称 | Kin Child2 Job Title | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_current_address_same_as_overseas | checkbox | 第二名子女—当前住址是否与申请人的港澳或海外住址相同？ | Kin Child2 Current Address Same As Overseas | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Kinship Information | kin_child2_current_address | textarea | 第二名子女—当前住址 | Kin Child2 Current Address | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | past_mainland_political_military_role | checkbox | 您过去是否曾在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？ | Applicant previously held a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | past_role_detail | text | 过去任职的机关、组织或团体全称 | Previously served at | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | current_mainland_political_military_role | checkbox | 您目前是否在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？ | Applicant currently holds a position or membership in a mainland China party, administrative, military, or politically affiliated organ/organization/group | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | current_role_detail | text | 目前任职的机关、组织或团体全称 | Currently serving at | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | never_held_mainland_political_military_role | checkbox | 本人从未在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份 | Applicant has never held such a mainland China party, administrative, military, or politically affiliated role or membership | 0 | pass |
| taiwan | TW_ENTRY_PERMIT -> TW_ENTRY_PERMIT | Declaration | accepted_terms | checkbox | 我已阅读并同意以下条款与声明 | I have read and accept the following terms and conditions | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | family_name | text | 姓氏 | Family Name | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | first_name | text | 名字 | First Name | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | middle_name | text | 中间名 | Middle Name | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | passport_number | text | 护照号码 | Passport No. | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | nationality | select | 国籍 / 公民身份 | Nationality/Citizenship | 259 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | date_of_birth | date | 出生日期 | Date of Birth | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | gender | radio | 性别 | Gender | 3 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | occupation | text | 职业 | Occupation | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | visa_number | text | 签证号码（如有） | Visa No. | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | country_territory_of_residence | select | 居住国家 / 地区 | Country/Territory of Residence | 260 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | city_state_of_residence | select | 居住城市 / 州 | City/State of Residence | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | phone_country_code | text | 电话区号 | Phone Country Code | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | phone_number | text | 电话号码 | Phone Number | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 旅客信息 | email_address | text | 电子邮箱 | Email Address | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | arrival_date | date | 抵达日期 | Date of Arrival | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | country_boarded | select | 出发国家/地区 | Country/Territory where you Boarded | 259 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | purpose_of_travel | select | 旅行目的 | Purpose of Travel | 11 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | purpose_of_travel_other | text | 其他旅行目的说明 | Purpose of Travel - Other | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | arrival_mode_of_travel | radio | 抵达交通方式 | Arrival Mode of Travel | 3 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | arrival_mode_of_transport | select | 抵达交通工具类型 | Arrival Mode of Transport | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | arrival_transport_other | text | 其他抵达交通工具说明 | Arrival Transport - Other | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | arrival_transport_number | text | 抵达航班号/车辆或船舶编号 | Flight No./Vehicle No. | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | departure_date | date | 离开日期 | Date of Departure | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | departure_mode_of_travel | radio | 离境交通方式 | Departure Mode of Travel | 3 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | departure_mode_of_transport | select | 离境交通工具类型 | Departure Mode of Transport | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | departure_transport_other | text | 其他离境交通工具说明 | Departure Transport - Other | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 抵达和离境信息 | departure_transport_number | text | 离境航班号/车辆或船舶编号 | Flight No./Vehicle No. | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | is_transit_traveler | checkbox | 我是过境旅客，不在泰国停留 | I am a transit passenger, I don't stay in Thailand. | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | accommodation_type | select | 在泰国住宿类型 | Type of Accommodation in Thailand | 6 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | accommodation_type_other | text | 其他住宿类型说明 | Accommodation Type - Other | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | province | select | 府（省级行政区） | Province | 77 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | district | select | 县/区（Amphoe） | District, Area | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | sub_district | select | 分区/乡（Tambon） | Sub-District, Sub-Area | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | postcode | text | 邮政编码 | Post Code | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 住宿信息 | address_in_thailand | textarea | 泰国地址 | Address | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 健康申报 | countries_visited_last_14_days | multi_select | 抵达前两周内停留过的国家 / 地区 | Countries/Territories where you stayed within two weeks before arrival | 260 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 健康申报 | yellow_fever_vaccination_certificate | radio | 您是否持有黄热病疫苗接种证书？ | Do you have a Yellow Fever Vaccination Certificate? | 2 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 健康申报 | yellow_fever_vaccination_date | date | 黄热病疫苗接种日期 | Yellow Fever Vaccination Date | 0 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 健康申报 | health_symptoms_last_14_days | multi_select | 过去 14 天内的症状 | Symptoms during the last 14 days | 12 | pass |
| thailand | TH_TDAC_ARRIVAL_CARD -> TH_TDAC_ARRIVAL_CARD | 健康申报 | health_symptoms_other | text | 请说明其他症状 | Other Symptom - Please Specify | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | surname | text | 姓氏（与护照一致） | Surname (Family name) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | given_names | text | 名字（与护照一致） | Given and middle names | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | has_other_names_used | radio | 是否其他姓名？ | Have you ever been known by any other names (former names, maiden name, aliases)? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | other_names_used | text | 其他姓名 | Other names used | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | place_of_birth_city | text | 出生城市 | Place of birth — City / Town | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | place_of_birth_country | country | 出生国家/地区 | Place of birth — Country | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality / citizenship | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | has_other_nationalities | radio | 是否持有或曾持有其他国籍？ | Do you hold any other nationality / citizenship (current or former)? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality / citizenship | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | national_id_number | text | 国民身份证号码 | National ID number (if your country issues one) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | marital_status | select | 婚姻状况 | Marital status | 4 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | spouse_full_name | text | 配偶/伴侣完整姓名 | Spouse — Full name | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | spouse_nationality | country | 配偶/伴侣国籍 | Spouse — Nationality | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | father_full_name | text | 父亲完整名称 | Father's full name | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Personal Information | mother_full_name | text | 母亲完整名称 | Mother's full name (including maiden name) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | passport_number | text | 护照号码 | Passport number | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | passport_type | select | 护照类型 | Passport type | 1 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | passport_place_of_issue | text | 护照签发地点 | Place of issue (city / authority) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | has_other_passports | radio | 是否目前持有或曾经持有其他护照？ | Do you currently hold or have you previously held any other passport? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Passport | other_passport_country | country | 其他护照国家 | Other passport — Issuing country | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | home_address_line1 | text | 家庭住址街道/门牌/公寓信息 | Home address — Street / Apartment | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | home_address_city | text | 家庭住址城市 | Home address — City / Town | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | home_address_state | text | 家庭住址州/省 | Home address — State / Province | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | home_address_postcode | text | 家庭住址邮政编码 | Home address — Postal code | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | home_address_country | country | 家庭住址国家/地区 | Home address — Country of residence | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | mobile_number | text | 手机号码 | Mobile number | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Contact & Home Address | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Occupation | current_profession | select | 当前职业/职业类别 | Current profession or occupation | 8 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Occupation | position_title | text | 职位/职称 | Position / Title | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Occupation | employer_or_school_name | text | 雇主学校 | Name of employer or school | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Occupation | employer_or_school_address | text | 雇主学校地址 | Address of employer or school | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Occupation | employer_or_school_phone | text | 雇主学校电话 | Telephone of employer or school | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | visa_type_requested | radio | 申请单次或多次入境电子签证 | Visa type requested | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | purpose_of_visit | select | 目的访问 | Purpose of visit to Thailand | 1 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | intended_arrival_date | date | 预计抵达日期 | Intended date of arrival in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | intended_length_of_stay | text | 预计停留时间 | Intended length of stay (days, max 60 per entry) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | port_of_entry | select | 预计入境口岸 | Intended port of entry | 14 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | port_of_entry_other | text | 入境其他 | Specify other port of entry | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | carrier_name | text | 航空公司、船舶或交通承运人名称 | Name of airline, ship, or transport carrier | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | flight_number | text | 航班或列车号码（如已知） | Flight or train number (if known) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | accommodation_type | select | 住宿类型 | Type of accommodation in Thailand | 6 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | accommodation_name | text | 住宿地点或接待方名称 | Name of hotel, resort, or property | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | accommodation_address | text | 住宿地点或接待方地址 | Address in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | accommodation_city | text | 住宿城市 | City / Province in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | accommodation_phone | text | 住宿电话 | Telephone of accommodation | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Trip Details | expense_bearer | select | 谁将承担本次旅行和停留费用？ | Who will cover the expenses for your visit? | 5 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Host in Thailand | has_host_in_thailand | radio | 是否邀请人/接待方？ | Do you have a host (friend, relative, or sponsor) in Thailand? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Host in Thailand | host_full_name | text | 邀请人/接待方完整姓名 | Host — Full name | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Host in Thailand | host_relationship_to_applicant | text | 接待方关系 | Host — Relationship to applicant | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Host in Thailand | host_address | text | 接待方地址 | Host — Address in Thailand | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Host in Thailand | host_phone | text | 邀请人/接待方电话 | Host — Telephone (incl. country code) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Host in Thailand | host_nationality | country | 接待方国籍 | Host — Nationality | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | visited_thailand_before | radio | 是否曾访问泰国？ | Have you ever visited Thailand before? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | prior_thailand_visit_arrival_date | date | 访问抵达日期 | Prior Thailand visit — Arrival date | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | prior_thailand_visit_departure_date | date | 访问离开日期 | Prior Thailand visit — Departure date | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | prior_thailand_visit_purpose | text | 访问目的 | Prior Thailand visit — Purpose | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | refused_visa_or_entry_thailand | radio | 是否曾被泰国拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, Thailand? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | refused_visa_thailand_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (date, place, reason) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | refused_visa_other_country | radio | 是否曾被其他国家拒发签证或拒绝入境？ | Have you ever been refused a visa to, or denied entry into, any other country? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Travel History | refused_visa_other_country_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | has_criminal_record | radio | 是否有需要申报的犯罪、逮捕或定罪记录？ | Have you ever been convicted of a crime in any country? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | criminal_record_details | textarea | 请说明犯罪、逮捕、指控或定罪记录的具体情况 | Provide details (country, date, charge, sentence) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | has_been_deported | radio | 是否曾被拒签、被拒绝入境、被遣返或被要求离境？ | Have you ever been deported from Thailand or any other country? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | deportation_details | textarea | 请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况 | Provide details (country, date, reason) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | has_terrorism_or_security_history | radio | 是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？ | Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security? | 2 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | remarks_special_circumstances | textarea | 特殊 | Remarks / Special Circumstances (optional) | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | application_date | date | 申请日期 | Date of application | 0 | pass |
| thailand | TH_TOURIST_E_VISA -> TH_TOURIST_E_VISA | Character & Declaration | final_declaration | checkbox | 我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任 | I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Kingdom of Thailand. | 1 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| turkey | TR_E_VISA -> TR_E_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Personal Information | full_name | text | 护照上的完整姓名 | Full name as shown on passport | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Personal Information | nationality | country | 国籍 | Current nationality | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Personal Information | place_of_birth | text | 出生地点（城市/地区） | Place of birth | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Personal Information | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Passport Information | passport_issuing_country | country | 护照签发国家/地区 | Passport issuing country | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Passport issue date | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Passport expiry date | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Travel Information | visit_purpose | select | 访问主要目的 | Main purpose of visit | 5 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Travel Information | arrival_date | date | 计划抵达日期 | Planned arrival date | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Travel Information | departure_date | date | 计划离开日期 | Planned departure date | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Travel Information | entry_count | select | 入境 | Entry type needed | 3 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Travel Information | accommodation_name | text | 住宿地点或接待方名称 | Hotel or host name | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Travel Information | accommodation_address | textarea | 住宿地点或接待方地址 | Accommodation address | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Work / Education / Training | current_occupation | text | 当前职业 | Current occupation | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Work / Education / Training | employer_or_school | text | 雇主、学校或经营机构名称 | Employer, school, or business name | 0 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Work / Education / Training | funding_source | select | 谁将支付本次旅行费用？ | Who will pay for this trip? | 5 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Security and Background | has_previous_refusal | radio | 是否曾被拒签、被拒绝入境或被要求离境？ | Have you ever been refused a visa or entry? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Security and Background | has_criminal_history | radio | 是否有需要申报的犯罪记录？ | Do you have any criminal history to declare? | 2 | pass |
| united_arab_emirates | AE_TOURIST_VISA -> AE_TOURIST_VISA | Security and Background | additional_notes | textarea | 补充说明 / 其他可能影响本次申请的信息 | Additional notes for review | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Passport Upload | passport_upload | file | 上传护照资料页（照片或扫描件） | Upload your passport bio-data page | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | given_names | text | 名字（与护照一致） | Given names (as shown in your passport) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | surname | text | 姓氏（与护照一致） | Family name / surname (as shown in your passport) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | other_names_used | radio | 您是否曾使用过其他姓名？ | Have you been known by any other names? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | previous_given_names | text | 曾用名字 | Previous given names | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | previous_surname | text | 曾用姓氏 | Previous family name / surname | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | previous_name_change_date | date | 姓名变更日期 | Date name was changed | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | previous_name_change_reason | text | 姓名变更原因 | Reason for name change | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | sex | select | 性别 | Sex | 3 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | country_of_nationality | country | 您的国籍是什么？ | What is your nationality? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | has_other_nationalities | radio | 您是否持有其他国籍？ | Do you have any other nationalities? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | other_nationality | country | 其他国籍 | Other nationality | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | country_of_birth | country | 出生国家/地区 | Country of birth | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | place_of_birth | text | 出生地（城市或城镇） | Place of birth (city or town) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | is_applicant_under_18 | radio | 在您计划前往英国的当天，您是否未满18岁？ | Will you be under 18 on the date you plan to travel to the UK? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | parent_consent_letter_held | radio | 您是否持有父母双方或法定监护人签署的同意书？ | Do you have a signed letter of consent from both parents or legal guardians? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | accompanying_adult_name | text | 与您同行的成年人姓名 | Name of the adult travelling with you | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | accompanying_adult_relationship | text | 同行成年人与您的关系 | Relationship to the adult travelling with you | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Personal Details | accompanying_adult_passport_number | text | 同行成年人的护照号码 | Passport number of the accompanying adult | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_number | text | 护照号码 | Passport number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_expiry_date | date | 护照到期日期 | Date of expiry | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | passport_place_of_issue | text | 护照签发地点 | Place of issue | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | has_other_passports | radio | 您是否持有其他有效护照或旅行证件？ | Do you have any other valid passports or travel documents? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_nationality | country | 其他护照上显示的国籍 | Nationality shown on other passport | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_number | text | 其他护照号码 | Other passport number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_issue_date | date | 其他护照签发日期 | Other passport date of issue | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | other_passport_expiry_date | date | 其他护照到期日期 | Other passport date of expiry | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | has_national_id_card | radio | 您是否持有国民身份证？ | Do you have a national identity card? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_number | text | 国民身份证号码 | National identity card number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_issuing_country | country | 签发该国民身份证的国家 | Country that issued the national identity card | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | has_held_brp | radio | 您是否曾持有英国生物识别居留许可（BRP）？ | Have you ever held a UK Biometric Residence Permit (BRP)? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | brp_number | text | BRP 编号 | BRP number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_issuing_authority | text | 国民身份证签发机关 | National identity card issuing authority | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_issue_date | date | 国民身份证签发日期（如适用） | National identity card issue date (if applicable) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | About You — Passport & Identity Documents | national_id_expiry_date | date | 国民身份证到期日期（如适用） | National identity card expiry date (if applicable) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | email_address | text | 电子邮箱地址 | Email address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | phone_number | text | 电话号码（含国家/地区区号） | Phone number (including country code) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | has_alternative_phone | radio | 您是否有备用电话号码？ | Do you have an alternative phone number? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | alternative_phone_number | text | 备用电话号码 | Alternative phone number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_address_line_1 | text | 家庭地址第一行 | Home address — line 1 | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_address_line_2 | text | 家庭地址第二行（如适用） | Home address — line 2 | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_address_city | text | 城镇或城市 | Town or city | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_address_state | text | 郡/州/省 | County / state / province | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_address_postcode | text | 邮政编码 | Postcode / ZIP code | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_address_country | country | 国家/地区 | Country | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | how_long_at_address | text | 您在此地址居住了多久？ | How long have you lived at this address? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_different | radio | 您的通信地址是否与家庭住址不同？ | Is your correspondence address different from your home address? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_line_1 | text | 通信地址第一行 | Correspondence address — line 1 | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_city | text | 通信地址城镇或城市 | Correspondence address — town or city | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | correspondence_address_country | country | 通信地址国家/地区 | Correspondence address — country | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | immigration_status_in_residence_country | radio | 您在居住国的移民身份 | Your immigration status in your country of residence | 3 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | immigration_status_visa_expiry | date | 签证到期日期 | Visa expiry date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | immigration_status_pr_year | text | 您成为永久居民的年份 | Year you became a permanent resident | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | immigration_status_other_details | textarea | 请说明您的移民身份情况 | Tell us about your immigration situation | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | years_at_address | text | 在此地址居住的年数 | Years at this address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | months_at_address | text | 额外月数 | Additional months | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_ownership | select | 您住房的产权状况 | Ownership status of your home | 3 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Contact Details | home_ownership_other_details | textarea | 请补充说明您的居住情况 | Tell us more about your living situation | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | marital_status | select | 您目前的婚姻或民事伴侣关系状况？ | What is your current marital or civil partnership status? | 6 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | partner_given_names | text | 配偶/伴侣的名字 | Partner's given names | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | partner_surname | text | 配偶/伴侣的姓氏 | Partner's family name / surname | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | partner_date_of_birth | date | 配偶/伴侣的出生日期 | Partner's date of birth | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | partner_nationality | country | 配偶/伴侣的国籍 | Partner's nationality | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | partner_travelling_with_you | radio | 您的配偶/伴侣是否与您一同前往英国？ | Is your partner travelling to the UK with you? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | has_children | radio | 您是否有未满18岁的子女？ | Do you have any children under 18? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | number_of_children | text | 您有几名未满18岁的子女？ | How many children under 18 do you have? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | children_travelling_with_you | radio | 您的子女中是否有人与您同行？ | Are any of your children travelling with you? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | father_given_names | text | 父亲的名字 | Father's given names | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | father_surname | text | 父亲的姓氏 | Father's family name / surname | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | father_date_of_birth | date | 父亲的出生日期 | Father's date of birth | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | father_nationality | country | 父亲的国籍 | Father's nationality | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | mother_given_names | text | 母亲的名字 | Mother's given names | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | mother_surname | text | 母亲的姓氏 | Mother's family name / surname | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | mother_date_of_birth | date | 母亲的出生日期 | Mother's date of birth | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Family | mother_nationality | country | 母亲的国籍 | Mother's nationality | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | has_uk_accommodation_address | radio | 您是否已安排好在英国入住的地址？ | Do you have an address for where you are going to stay in the UK? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_name | text | 您计划在英国何处入住？（如与他人同住，请填其全名） | Where are you planning to stay in the UK? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_address_line_1 | text | 英国住宿地址第一行 | UK accommodation address — line 1 | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_address_line_2 | text | 英国住宿地址第二行（如适用） | UK accommodation address — line 2 | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_city | text | 城镇或城市 | Town or city | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_postcode | text | 邮政编码 | Postcode | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_arrival_date | date | 您将于何时抵达那里？ | When will you arrive there? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_departure_date | date | 您将于何时离开那里？ | When will you leave there? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Accommodation in the UK | uk_accommodation_plan | textarea | 您在英国的住宿计划是什么？ | Where do you plan to stay in the UK? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | travelled_to_uk_before | radio | 您是否曾前往英国？ | Have you ever travelled to the UK before? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | prev_uk_visit_date | date | 抵达英国的日期 | Date of arrival in the UK | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | prev_uk_visit_duration | text | 您停留了多长时间？ | How long did you stay? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | prev_uk_visit_reason | text | 此次访问的原因 | Reason for the visit | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | prev_uk_visa_type | text | 持有的英国签证类型（如有） | Type of UK visa held (if any) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | prev_uk_visa_reference | text | 英国签证参考号（如知道） | UK visa reference number (if known) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | uk_national_insurance_number | radio | 您是否有英国国民保险号（National Insurance number）？ | Do you have a UK National Insurance number? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | uk_national_insurance_number_value | text | 英国国民保险号 | UK National Insurance number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | visa_refused_uk | radio | 您是否曾被拒发英国签证？ | Have you ever been refused a visa for the UK? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | visa_refused_uk_details | textarea | 请说明该次拒签的具体情况 | Please give details of the refusal | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | visa_refused_other_country | radio | 您是否曾被任何其他国家拒发签证？ | Have you ever been refused a visa for any other country? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | visa_refused_other_country_details | textarea | 请说明该次拒签的具体情况 | Please give details of the refusal | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | deported_removed_refused_entry | radio | 您是否曾被任何国家（包括英国）驱逐、遣返或拒绝入境？ | Have you ever been deported, removed, or refused entry to any country including the UK? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | deported_details | textarea | 请说明具体情况 | Please give details | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | has_schengen_visits | radio | 过去10年内，您是否到访过任何申根国家？ | Have you visited any Schengen country in the last 10 years? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | schengen_visit_country | country | 到访的申根国家 | Schengen country visited | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | schengen_visit_arrival | date | 抵达日期 | Date of arrival | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | schengen_visit_departure | date | 离开日期 | Date of departure | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | schengen_visit_purpose | text | 访问目的 | Purpose of visit | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | has_us_canada_anz_visits | radio | 过去10年内，您是否到访过美国、加拿大、澳大利亚或新西兰？ | Have you visited the USA, Canada, Australia, or New Zealand in the last 10 years? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_country | country | 到访的国家 | Country visited | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_arrival | date | 抵达日期 | Date of arrival | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_departure | date | 离开日期 | Date of departure | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | us_canada_anz_visit_purpose | text | 访问目的 | Purpose of visit | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | has_other_country_visits | radio | 过去10年内，您是否到访过其他国家？ | Have you visited any other countries in the last 10 years? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | other_country_visit_country | country | 到访的国家 | Country visited | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | other_country_visit_arrival | date | 抵达日期 | Date of arrival | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Travel History | other_country_visit_departure | date | 离开日期 | Date of departure | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | purpose_of_visit | select | 您此次访问英国的主要原因是什么？ | What is the main reason for your visit to the UK? | 8 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | uk_arrival_date | date | 您计划何时抵达英国？ | When do you plan to arrive in the UK? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | uk_departure_date | date | 您计划何时离开英国？ | When do you plan to leave the UK? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | visiting_family_in_uk | radio | 您在英国期间是否会探访家人？ | Will you be visiting family while in the UK? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_name | text | 家庭成员的全名 | Family member's full name | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_relationship | text | 您与此人的关系 | What is your relationship to this person? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_immigration_status | select | 该家庭成员在英国的移民身份 | What is their UK immigration status? | 5 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | uk_family_member_address | textarea | 家庭成员的英国地址 | Family member's UK address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | someone_paying_for_visit | radio | 是否有人为您此次访问的费用付费？ | Will anyone be paying towards the cost of your visit? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | spoken_language_preference | radio | 如需讨论您的申请，您希望使用哪种语言？ | Which language would you prefer if we need to discuss your application? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | spoken_language_other_details | text | 请注明语言 | Specify the language | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | planned_spend_currency | select | 计划花费——币种 | Planned spend — currency | 4 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK | planned_spend_amount | text | 您计划在此次访问中花费多少？ | How much do you plan to spend on this visit? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_contact_name | text | 您的英国商务联系人姓名 | Name of your UK business contact | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Trip to the UK — Purpose | tourism_sub_purpose | radio | 您此次旅游访问的主要原因 | Main reason for your holiday visit | 3 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_company_name | text | 英国公司名称 | UK company name | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_company_address | textarea | 英国公司地址 | UK company address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_activity_description | textarea | 请描述您在英国的商务活动性质 | Describe the nature of your business activity in the UK | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | uk_business_paid_by_uk | radio | 访问期间，您是否会由英国公司或个人向您支付报酬？ | Will you be paid by a UK company or individual during your visit? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | study_institution_name | text | 学校、学院或大学名称 | Name of the school, college, or university | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | study_institution_address | textarea | 该院校在英国的地址 | Institution address in the UK | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | study_course_title | text | 课程名称 | Title of the course | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | study_course_start_date | date | 课程开始日期 | Course start date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | study_course_end_date | date | 课程结束日期 | Course end date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | study_institution_accredited | radio | 该院校是否经英国认可机构认证？ | Is the institution accredited by a UK-recognised body? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | study_who_pays | select | 谁为您的课程付费？ | Who is paying for your course? | 5 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | medical_treatment_type | textarea | 您将接受哪种医疗治疗？ | What kind of medical treatment will you be receiving? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | medical_facility_name | text | 医院或诊所名称 | Name of the hospital or clinic | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | medical_facility_address | textarea | 医院或诊所地址 | Hospital or clinic address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | medical_doctor_name | text | 医生或顾问医师姓名 | Name of the doctor or consultant | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | medical_estimated_cost | text | 治疗的预计费用 | Estimated cost of treatment | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | medical_payment_arrangement | textarea | 您将如何支付治疗费用？ | How will you pay for your treatment? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | transit_destination_country | country | 您将继续前往哪个国家？ | Which country are you travelling on to? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | transit_onward_journey_date | date | 续程行程的日期和时间 | Date and time of onward journey | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | transit_onward_booking_reference | text | 续程行程的预订参考号 | Onward travel booking reference | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | transit_destination_visa_status | radio | 您是否持有前往目的地国家的有效签证或居留许可？ | Do you hold a valid visa or residence permit for the destination country? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | transit_destination_visa_details | textarea | 目的地国家签证/居留许可详情 | Destination visa / residence permit details | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_ceremony_date | date | 婚礼/仪式日期 | Date of the ceremony | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_registrar_office_name | text | 婚姻登记处名称 | Name of the register office | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_registrar_office_address | textarea | 婚姻登记处地址 | Register office address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_partner_full_name | text | 拟结婚配偶或民事伴侣的全名 | Full name of your intended spouse or civil partner | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_partner_nationality | country | 拟结婚配偶或民事伴侣的国籍 | Nationality of your intended spouse or civil partner | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | marriage_freedom_to_marry_document | radio | 您是否持有证明可自由结婚的文件（如离婚绝对判令、前配偶死亡证明）？ | Do you have a document proving you are free to marry (e.g. decree absolute, death certificate of previous spouse)? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_host_organisation_name | text | 邀请您的英国机构名称 | Name of the UK organisation that has invited you | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_host_organisation_address | textarea | 邀请机构的地址 | Host organisation address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_description | textarea | 请说明受邀从事的付费许可活动 | Describe the engagement | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_start_date | date | 活动开始日期 | Engagement start date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_engagement_end_date | date | 活动结束日期 | Engagement end date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | ppe_fee_amount | text | 您将获得的费用或报酬金额 | Fee or payment you will receive | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | academic_institution_name | text | 英国接待院校名称 | Name of the UK host institution | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | academic_institution_address | textarea | 英国接待院校地址 | UK host institution address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | academic_research_topic | textarea | 请描述您的研究或学术活动 | Describe your research or academic activity | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | academic_duration_months | text | 访问时长（月） | Duration of the visit (in months) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | academic_qualifications_held | text | 您在所在领域已获得的最高学历/学术资格 | Highest academic qualification held in your field | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | academic_employer_letter_held | radio | 您是否持有母国雇主确认此项研究的证明信？ | Do you have a letter from your employer in your home country confirming this research? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_recipient_name | text | 预期器官接受者的全名 | Full name of the intended organ recipient | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_relationship_to_recipient | text | 您与接受者的关系 | Relationship to the recipient | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_recipient_legal_uk_status | radio | 接受者是否为英国合法居民？ | Is the recipient legally resident in the UK? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_transplant_hospital | text | 进行移植手术的医院 | Hospital where the transplant will take place | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_transplant_date | date | 预定的移植或检测日期 | Intended transplant or testing date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_consultant_name | text | 负责治疗的 GMC 注册专科医生姓名 | Name of the lead GMC-registered specialist | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | organ_donor_consultant_letter_date | date | 顾问医师证明信的日期（须为3个月以内） | Date of the consultant's letter (must be within 3 months) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_training_type | select | 您将参加哪种临床活动？ | What kind of clinical activity are you attending? | 4 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_institution_name | text | 英国机构或皇家学院名称 | Name of the UK institution or Royal College | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_institution_address | textarea | 英国机构地址 | UK institution address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_start_date | date | 开始日期 | Start date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_end_date | date | 结束日期 | End date | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Purpose-Specific Details | clinical_no_patient_treatment_confirm | radio | 请确认您不会为英国患者提供治疗 | Confirm you will not provide treatment to UK patients | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employment_status | select | 您目前的就业状况？ | What is your current employment status? | 5 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_name | text | 雇主名称 | Employer's name | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_address | textarea | 雇主地址 | Employer's address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_phone | text | 雇主电话号码 | Employer's phone number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | job_title | text | 职位名称 | Job title | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | job_start_date | date | 您何时开始这份工作？ | When did you start this job? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | annual_income | text | 您的年收入是多少（以当地货币计）？ | What is your annual income (in local currency)? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | self_employed_business_name | text | 企业名称 | Business name | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | job_description | textarea | 请描述您的工作 | Describe your job | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | self_employed_business_address | textarea | 企业地址 | Business address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | student_institution_name | text | 学校、学院或大学名称 | Name of school, college, or university | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | student_institution_address | textarea | 院校地址 | Institution address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | student_course_name | text | 所学课程/专业 | Course of study | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employment_other_explain | textarea | 请说明您的情况 | Please describe your situation | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_address_line_1 | text | 雇主地址第一行 | Employer address — line 1 | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_address_line_2 | text | 雇主地址第二行（如适用） | Employer address — line 2 | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_address_city | text | 雇主所在城镇/城市 | Employer town/city | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_address_state | text | 雇主所在省/州 | Employer province/state | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_address_postcode | text | 雇主邮政编码 | Employer postal code | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_address_country | country | 雇主所在国家/地区 | Employer country | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_phone_code | text | 雇主电话——国家/地区区号 | Employer phone — international code | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | employer_phone_number | text | 雇主电话——号码 | Employer phone — number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | job_start_month | text | 入职月份 | Job start month | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | job_start_year | text | 入职年份 | Job start year | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | monthly_earnings_currency | select | 月收入——币种 | Monthly earnings — currency | 4 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Employment | monthly_earnings_amount | text | 月收入（税后） | Monthly earnings (after tax) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | has_other_income_or_savings | radio | 您是否有其他收入或储蓄？ | Do you have any other income or savings? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | who_is_paying | select | 谁为您此次英国之行付费？ | Who is paying for your visit to the UK? | 4 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | monthly_spending_money | text | 您在英国每月可用于花费的金额是多少？ | How much money will you have available to spend each month in the UK? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | total_cost_of_trip | text | 您此行的预计总费用是多少（含机票）？ | What is the total estimated cost of your trip (including flights)? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | sponsor_name | text | 担保人/资助方的全名 | Sponsor's full name | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | sponsor_relationship | text | 您与担保人/资助方的关系 | What is your relationship to the sponsor? | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | sponsor_address | textarea | 担保人/资助方的地址 | Sponsor's address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | sponsor_email | text | 担保人/资助方的电子邮箱 | Sponsor's email address | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | sponsor_phone | text | 担保人/资助方的电话号码 | Sponsor's phone number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | finances_other_explain | textarea | 请说明您的资金安排 | Please describe your financial arrangements | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | has_savings | radio | 您是否有储蓄？ | Do you have any savings? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | savings_amount | text | 储蓄总额（以当地货币计） | Total savings (in local currency) | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | has_other_income | radio | 您是否有其他收入或资金支持？ | Do you have any other income or financial support? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | other_income_details | textarea | 请说明您的其他收入或资金支持 | Please describe your other income or financial support | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | monthly_outgoings_currency | select | 每月支出——币种 | Monthly outgoings — currency | 4 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Your Finances | monthly_outgoings_amount | text | 您每月支出的总金额 | Total amount you spend each month | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Dependants Travelling With You | applying_with_dependants | radio | 是否有其他人（配偶、子女或其他受抚养人）与您一同申请英国签证？ | Is anyone else applying for a UK visa together with you (spouse, children, or other dependants)? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_relationship | select | 与您的关系 | Relationship to you | 4 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_given_names | text | 名字 | Given names | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_surname | text | 姓氏 | Family name / surname | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_nationality | country | 国籍 | Nationality | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Dependants Travelling With You | dependant_passport_number | text | 护照号码 | Passport number | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | has_medical_condition_affecting_travel | radio | 您是否有可能影响出行能力的健康状况？ | Do you have any medical conditions that might affect your ability to travel? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | medical_condition_affecting_travel_details | textarea | 请说明您的健康状况 | Please describe your medical condition | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | tb_test_required_acknowledged | radio | 您是否需要肺结核（TB）检测证明？（如您来自指定国家且在英停留超过6个月则需要） | Do you need a tuberculosis (TB) test certificate? (Required if you are from a listed country and staying in the UK for more than 6 months) | 3 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | tb_test_certificate_date | date | 肺结核检测证明的日期 | Date of TB test certificate | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | tb_test_clinic_name | text | 英国内政部认可诊所的名称 | Name of the UK Home Office approved clinic | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | criminal_convictions | radio | 您是否曾在任何国家被判犯罪（包括交通违法）？ | Have you ever been convicted of a criminal offence in any country (including traffic offences)? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | criminal_convictions_details | textarea | 请说明任何犯罪定罪的具体情况 | Please give details of any criminal convictions | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | breach_uk_immigration_laws | radio | 您是否曾违反英国移民法（如逾期居留、非法入境、非法工作）？ | Have you ever breached UK immigration laws (e.g. overstayed a visa, entered illegally, worked illegally)? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | breach_uk_immigration_laws_details | textarea | 请说明违反移民法的具体情况 | Please give details of the immigration breach | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | civil_penalty_uk | radio | 您是否曾被英国内政部处以民事罚款（如未付 NHS 费用）？ | Have you ever received a civil penalty from the UK Home Office (e.g. unpaid NHS fees)? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | civil_penalty_uk_details | textarea | 请说明该民事罚款的具体情况 | Please give details of the civil penalty | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | public_funds_used_uk | radio | 您是否曾领取本不应获得的英国公共福利金？ | Have you ever received UK public funds that you were not entitled to? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | public_funds_used_uk_details | textarea | 请说明具体情况 | Please give details | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | terrorism_related | radio | 您是否曾在任何国家参与、支持或鼓动恐怖活动？ | Have you ever been involved in, supported, or encouraged terrorist activities in any country? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | terrorism_details | textarea | 请说明具体情况 | Please give details | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | war_crimes | radio | 您是否曾参与或被怀疑参与战争罪、反人类罪或种族灭绝？ | Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | war_crimes_details | textarea | 请说明具体情况 | Please give details | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | organisations_concern | radio | 您是否曾是涉及恐怖主义的组织成员，或曾向其提供支持？ | Have you ever been a member of, or given support to, an organisation which has been concerned in terrorism? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | organisations_concern_details | textarea | 请说明具体情况 | Please give details | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | bad_character | radio | 您是否曾从事任何可能表明您不属于品行良好人士的其他活动？ | Have you engaged in any other activities that might indicate you may not be considered a person of good character? | 2 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | bad_character_details | textarea | 请说明具体情况 | Please give details | 0 | pass |
| united_kingdom | UK_STANDARD_VISITOR -> UK_STANDARD_VISITOR | Additional Information | additional_information | textarea | 关于本次申请，您还有其他需要告知我们的信息吗？ | Is there anything else you would like to tell us about your application? | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | consular_post | select | 您计划在哪个美国使领馆申请签证？ | Location where you will be submitting your application | 5 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | surname | text | 姓氏 | Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | given_names | text | 名字 | Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | full_name_native_alphabet | text | 母语字母全名（如适用） | Full Name in Native Alphabet | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | other_names_used | radio | 您是否曾使用过其他名字（即婚前姓、宗教名、职业名、别名等）？ | Have you ever used other names (i.e., maiden, religious, professional, alias, etc.)? | 2 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | other_surname | text | 曾用其他姓氏（婚前姓、宗教名、职业名、别名等） | Other Surnames Used (maiden, religious, professional, aliases, etc.) | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | other_given_names | text | 曾用其他名字 | Other Given Names Used | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | has_telecode | radio | 您是否有代表您姓名的中文电码？ | Do you have a telecode that represents your name? | 2 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | telecode_surname | text | 电码——姓氏 | Telecode Surname | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | telecode_given_names | text | 电码——名字 | Telecode Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | sex | radio | 性别 | Sex | 2 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | marital_status | select | 婚姻状况 | Marital Status | 8 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | marital_status_other_explain | text | 其他——请说明 | Other — Please Explain | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | date_of_birth | date | 出生日期 | Date of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | city_of_birth | text | 出生城市 | City of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | state_of_birth | text | 出生州/省（如适用） | State/Province of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 1 | country_of_birth | select | 出生国家/地区 | Country/Region of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | nationality_country | select | 国籍 | Country/Region of Origin (Nationality) | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | other_nationality | radio | 您是否持有或曾持有除上述国籍以外的其他国籍？ | Do you hold or have you held any nationality other than the one indicated above on nationality? | 2 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | other_nationality_country | select | 其他国籍的国家/地区 | Other Country/Region of Nationality | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | other_nationality_has_passport | radio | 是否持有该国籍的护照？ | Do you hold a passport for that other nationality? | 2 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | other_nationality_passport_number | text | 护照号码 | Passport Number | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | permanent_resident_other_country | radio | 您是否为上述国籍以外的其他国家/地区的永久居民？ | Are you a permanent resident of a country/region other than your country/region of origin (nationality) indicated above? | 2 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | other_permanent_resident_country | select | 其他永久居留国家/地区 | Other Permanent Resident Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | national_id_number | text | 国民身份证号码（如适用） | National Identification Number | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | us_social_security_number | text | 美国社会安全号码（如适用） | U.S. Social Security Number | 0 | pass |
| united_states | DS160 -> DS160 | Personal Information 2 | us_taxpayer_id | text | 美国纳税人识别号（如适用） | U.S. Taxpayer ID Number | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | purpose_of_trip | select | 赴美目的 | Purpose of Trip to the U.S. | 25 | pass |
| united_states | DS160 -> DS160 | Travel Information | purpose_of_trip_specify | select | 具体说明 | Specify | 3 | pass |
| united_states | DS160 -> DS160 | Travel Information | has_specific_plans | radio | 是否已有具体旅行计划？ | Have you made specific travel plans? | 2 | pass |
| united_states | DS160 -> DS160 | Travel Information | arrival_date | date | 到达美国日期 | Date of Arrival in U.S. | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | arrival_flight | text | 到达航班（如已知） | Arrival Flight (if known) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | arrival_city | text | 到达城市 | Arrival City | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | departure_date | date | 离开美国日期 | Date of Departure from U.S. | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | departure_flight | text | 离开航班（如已知） | Departure Flight (if known) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | departure_city | text | 离开城市 | Departure City | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | planned_location | text | 地点 | Location | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | intended_arrival_date | date | 预计到达美国日期 | Intended Date of Arrival in U.S. | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | intended_length_of_stay_value | text | 预计在美停留时间（数值） | Intended Length of Stay in U.S. (Value) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | intended_length_of_stay_unit | select | 预计在美停留时间（单位） | Intended Length of Stay in U.S. (Unit) | 6 | pass |
| united_states | DS160 -> DS160 | Travel Information | us_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | us_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | us_address_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | us_address_state | select | 州 | State | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | us_address_zip | text | 邮编 | ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | trip_payer_type | select | 谁为您的旅行付费？ | Person/Entity Paying for Your Trip | 6 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_surname | text | 付费人姓氏 | Surnames of Person Paying for Trip | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_given_names | text | 付费人名字 | Given Names of Person Paying for Trip | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_phone | text | 电话号码 | Telephone Number | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_email | text | 邮箱地址（如适用） | Payer Email (if applicable) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_relationship | select | 与您的关系 | Relationship to You | 6 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_address_same_as_home | radio | 付费方地址是否与您的家庭或邮寄地址相同？ | Is the address of the party paying for your trip the same as your Home or Mailing Address? | 2 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_address_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_address_state | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_address_postal | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_name | text | 付费公司/组织名称 | Name of Company/Organization Paying for Trip | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_phone | text | 电话号码 | Telephone Number | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_relationship | text | 与您的关系 | Relationship to You | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_address_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_address_state | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_address_postal | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Travel Information | payer_org_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Travel Companions | has_companions | radio | 是否有其他人与您同行？ | Are there other persons traveling with you? | 2 | pass |
| united_states | DS160 -> DS160 | Travel Companions | companion_group_travel | radio | 您是否作为团体或组织的一部分旅行？ | Are you traveling as part of a group or organization? | 2 | pass |
| united_states | DS160 -> DS160 | Travel Companions | companion_group_name | text | 团体名称 | Group Name | 0 | pass |
| united_states | DS160 -> DS160 | Travel Companions | companion_surname | text | 姓氏 | Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Travel Companions | companion_given_names | text | 名字 | Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Travel Companions | companion_relationship | select | 与您的关系 | Relationship to You | 9 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | has_been_in_us | radio | 您是否曾经到过美国？ | Have you ever been in the U.S.? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | previous_visit_date_arrived | date | 到达日期 | Date Arrived | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | previous_visit_length_of_stay | text | 停留时间（数值） | Length of Stay (Value) | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | previous_visit_length_of_stay_unit | select | 停留时间（单位） | Length of Stay (Unit) | 5 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | has_us_drivers_license | radio | 您是否持有或曾持有美国驾照？ | Do you or did you ever hold a U.S. Driver's License? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | us_drivers_license_number | text | 驾照号码 | Driver's License Number | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | us_drivers_license_state | select | 驾照所在州 | Driver's License State | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | has_us_visa | radio | 您是否曾获发美国签证？ | Have you ever been issued a U.S. Visa? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | last_visa_issue_day | select | 签证签发天 | Date Last Visa Was Issued (Day) | 31 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | last_visa_issue_month | select | 签证签发个月 | Date Last Visa Was Issued (Month) | 12 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | last_visa_issue_year | text | 签证签发 | Date Last Visa Was Issued (Year) | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_number | text | 签证号码 | Visa Number | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_number_unknown | checkbox | 不知道 | Do Not Know | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | applying_same_visa_type | radio | 您是否申请相同类型的签证？ | Are you applying for the same type of visa? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | applying_same_country_of_issue_and_residence | radio | 您是否在上述签证签发的同一国家或地点申请，且该国家或地点是否为您的主要居住地？ | Are you applying in the same country or location where the visa above was issued, and is this country or location your place of principal of residence? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | has_been_ten_printed | radio | 您是否曾采集过十指指纹？ | Have you been ten-printed? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_lost_or_stolen | radio | 您的美国签证是否曾丢失或被盗？ | Has your U.S. Visa ever been lost or stolen? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | year_visa_lost_or_stolen | text | 输入签证丢失或被盗的年份 | Enter year visa was lost or stolen | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_lost_or_stolen_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_cancelled_or_revoked | radio | 您的美国签证是否曾被取消或撤销？ | Has your U.S. Visa ever been cancelled or revoked? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | visa_cancelled_or_revoked_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | has_been_refused | radio | 您是否曾被拒绝美国签证、被拒绝入境美国、或在入境口岸撤回入境申请？ | Have you ever been refused a U.S. Visa, or been refused admission to the United States, or withdrawn your application for admission at the port of entry? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | refusal_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | immigrant_petition_filed | radio | 是否有人曾代您向美国公民及移民服务局提交移民申请？ | Has anyone ever filed an immigrant petition on your behalf with the United States Citizenship and Immigration Services? | 2 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | immigrant_petition_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Previous U.S. Travel | vwp_denial | radio | 您是否曾被拒绝美国免签计划（ESTA）授权？ | Have you ever been denied a U.S. Visa Waiver Program (ESTA) authorization? | 2 | pass |
| united_states | DS160 -> DS160 | Address and Phone | home_address_line1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | home_address_line2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | home_address_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | home_address_state_province | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | home_address_postal_code | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | home_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mailing_same_as_home | radio | 您的邮寄地址是否与家庭地址相同？ | Is your Mailing Address the same as your Home Address? | 2 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mailing_address_line1 | text | 邮寄街道地址（第1行） | Mailing Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mailing_address_line2 | text | 邮寄街道地址（第2行，如适用） | Mailing Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mailing_address_city | text | 邮寄城市 | Mailing City | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mailing_address_state | text | 邮寄州/省 | Mailing State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mailing_address_postal | text | 邮寄邮政编码 | Mailing Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mailing_address_country | select | 邮寄国家/地区 | Mailing Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | primary_phone | text | 主要电话号码 | Primary Phone Number | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | secondary_phone | text | 备用电话号码（如适用） | Secondary Phone Number | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | work_phone | text | 工作电话号码（如适用） | Work Phone Number | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | has_other_phones | radio | 您在过去五年中是否使用过其他电话号码？ | Have you used any other phone numbers in the last five years? | 2 | pass |
| united_states | DS160 -> DS160 | Address and Phone | additional_phone | text | 其他电话号码 | Additional Phone Number | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | email_address | text | 邮箱地址 | Email Address | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | has_other_emails | radio | 您在过去五年中是否使用过其他电子邮箱？ | Have you used any other email addresses in the last five years? | 2 | pass |
| united_states | DS160 -> DS160 | Address and Phone | additional_email | text | 其他电子邮箱 | Additional Email Address | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | social_media_platform | select | 社交媒体平台 | Social Media Provider/Platform | 21 | pass |
| united_states | DS160 -> DS160 | Address and Phone | social_media_handle | text | 社交媒体用户名 | Social Media Identifier | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | has_other_social_media | radio | 您是否愿意提供过去五年中使用的其他网站或应用程序的信息（用于创建或分享照片、视频、状态更新等内容）？ | Do you wish to provide information about your presence on any other websites or applications you have used within the last five years to create or share content (photos, videos, status updates, etc.)? | 2 | pass |
| united_states | DS160 -> DS160 | Address and Phone | other_social_media_name | text | 网站/应用名称 | Website/Application Name | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | other_social_media_identifier | text | 用户名 | Identifier | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | mobile_phone | text | 电话 | Mobile (Cellular) Phone Number | 0 | pass |
| united_states | DS160 -> DS160 | Address and Phone | has_social_media | radio | 过去五年内是否使用过任何社交媒体平台？ | Have you used any social media platforms in the last five years? | 2 | pass |
| united_states | DS160 -> DS160 | Address and Phone | social_media_provider | select | 社交媒体 | Social Media Platform | 8 | pass |
| united_states | DS160 -> DS160 | Address and Phone | social_media_identifier | text | 社交媒体 | Social Media Identifier (handle / username) | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_document_type | select | 护照/旅行证件类型 | Passport/Travel Document Type | 5 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_document_type_explain | text | 护照证件 | Please explain | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_number | text | 护照/旅行证件号码 | Passport number | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_book_number | text | 护照本号（如适用） | Passport Book Number | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_issuing_country | select | 护照/旅行证件签发国家/机构 | Country/Authority That Issued Passport/Travel Document | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_issuance_city | text | 签发城市 | City Where Issued | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_issuance_state | text | 签发州/省（如适用） | State/Province Where Issued | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_issuance_country | select | 签发国家/地区 | Country/Region Where Issued | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_issuance_date | date | 签发日期 | Issuance Date | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_expiration_date | date | 到期日期（如适用） | Expiration Date | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | lost_passport | radio | 您是否曾丢失护照或护照被盗？ | Have you ever lost a passport or had one stolen? | 2 | pass |
| united_states | DS160 -> DS160 | Passport Information | lost_passport_number | text | 丢失/被盗护照号码 | Lost/Stolen Passport Number | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | lost_passport_country | select | 护照/旅行证件签发国家/机构 | Country/Authority That Issued Passport/Travel Document | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | lost_passport_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Passport Information | passport_has_expiry | radio | 您的护照是否有明确的到期日期？ | Does your passport have an expiration date? | 2 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | father_surname | text | 父亲姓氏 | Father's Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | father_given_names | text | 父亲名字 | Father's Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | father_date_of_birth | date | 父亲出生日期 | Father's Date of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | mother_surname | text | 母亲姓氏 | Mother's Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | mother_given_names | text | 母亲名字 | Mother's Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | mother_date_of_birth | date | 母亲出生日期 | Mother's Date of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | has_immediate_us_relatives | radio | 您在美国是否有直系亲属（不包括父母）？ | Do you have any immediate relatives, not including parents, in the United States? | 2 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | us_relative_surname | text | 姓氏 | Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | us_relative_given_names | text | 名字 | Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | us_relative_relationship | select | 与您的关系 | Relationship to You | 4 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | us_relative_status | select | 美国状态 | Relative's Status | 4 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | has_other_us_relatives | radio | 您在美国是否有其他亲属？ | Do you have any other relatives in the United States? | 2 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_surname | text | 配偶姓氏 | Spouse's Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_given_names | text | 配偶名字 | Spouse's Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_date_of_birth | date | 配偶出生日期 | Spouse's Date of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_nationality | select | 国籍 | Spouse's Country/Region of Origin (Nationality) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_city_of_birth | text | 配偶出生城市 | Spouse's City of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_country_of_birth | select | 配偶出生国家/地区 | Spouse's Country/Region of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_address_type | select | 配偶地址 | Spouse's Address | 5 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_address_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_address_state | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_address_zip | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Spouse | spouse_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | father_in_us | radio | 您的父亲是否在美国？ | Is your father in the U.S.? | 2 | pass |
| united_states | DS160 -> DS160 | Family Information: Relatives | mother_in_us | radio | 您的母亲是否在美国？ | Is your mother in the U.S.? | 2 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_surname | text | 伴侣姓氏 | Partner's Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_given_names | text | 伴侣名字 | Partner's Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_date_of_birth | date | 伴侣出生日期 | Partner's Date of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_nationality | select | 伴侣国籍 | Partner's Country/Region of Origin (Nationality) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_city_of_birth | text | 伴侣出生城市 | Partner's City of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_country_of_birth | select | 伴侣出生国家/地区 | Partner's Country/Region of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_address_type | select | 伴侣地址 | Partner's Address | 5 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_address_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_address_state | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_address_zip | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Partner | partner_address_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Deceased Spouse | deceased_spouse_surname | text | 已故配偶姓氏 | Deceased Spouse's Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Deceased Spouse | deceased_spouse_given_names | text | 已故配偶名字 | Deceased Spouse's Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Deceased Spouse | deceased_spouse_date_of_birth | date | 已故配偶出生日期 | Deceased Spouse's Date of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Deceased Spouse | deceased_spouse_nationality | select | 已故配偶国籍 | Deceased Spouse's Country/Region of Origin (Nationality) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Deceased Spouse | deceased_spouse_city_of_birth | text | 已故配偶出生城市 | Deceased Spouse's City of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Deceased Spouse | deceased_spouse_country_of_birth | select | 已故配偶出生国家/地区 | Deceased Spouse's Country/Region of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | number_of_former_spouses | select | 前配偶人数 | Number of Former Spouses | 5 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_surname | text | 前配偶姓氏 | Former Spouse's Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_given_names | text | 前配偶名字 | Former Spouse's Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_date_of_birth | date | 前配偶出生日期 | Former Spouse's Date of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_nationality | select | 前配偶国籍 | Former Spouse's Country/Region of Origin (Nationality) | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_city_of_birth | text | 前配偶出生城市 | Former Spouse's City of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_country_of_birth | select | 前配偶出生国家/地区 | Former Spouse's Country/Region of Birth | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_date_of_marriage | date | 结婚日期 | Date of Marriage | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_date_marriage_ended | date | 婚姻结束日期 | Date Marriage Ended | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_how_marriage_ended | text | 婚姻结束方式 | How the Marriage Ended | 0 | pass |
| united_states | DS160 -> DS160 | Family Information: Former Spouse | former_spouse_country_marriage_terminated | select | 婚姻终止国家/地区 | Country/Region Marriage was Terminated | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_surname | text | 美国联系人——姓氏 | U.S. Contact — Surname | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_given_names | text | 美国联系人——名字 | U.S. Contact — Given Names | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_organization | text | 美国联系人——组织（如非个人，如适用） | U.S. Contact — Organization (if not a person) | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_relationship | select | 美国联系人——关系 | U.S. Contact — Relationship | 7 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_address_street1 | text | 美国联系人——街道地址 | U.S. Contact — Street Address | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_city | text | 美国联系人——城市 | U.S. Contact — City | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_state | select | 美国联系人——州 | U.S. Contact — State | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_zip | text | 美国联系人——邮编 | U.S. Contact — ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_phone | text | 美国联系人——电话 | U.S. Contact — Phone | 0 | pass |
| united_states | DS160 -> DS160 | US Point of Contact | us_contact_email | text | 美国联系人——邮箱 | U.S. Contact — Email | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | primary_occupation | select | 主要职业 | Primary Occupation | 22 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | occupation_other_explain | text | 请具体说明 | Specify Other | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | not_employed_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_name | text | 当前雇主或学校名称 | Present Employer or School Name | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_address_line1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_address_line2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_state_province | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_postal_code | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employer_phone | text | 电话号码 | Phone Number | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | job_title | text | 职位 | Job Title | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | employment_start_date | date | 开始日期 | Start Date | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | monthly_salary | text | 月收入（当地货币，如受雇） | Monthly Income in Local Currency (if employed) | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Present | job_duties | textarea | 简要描述您的职责（如适用） | Briefly Describe Your Duties | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | has_previous_employer | radio | 您以前是否有工作？ | Were you previously employed? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_name | text | 雇主名称 | Employer Name | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_address_street1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_address_street2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_state | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_postal | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employer_phone | text | 电话号码 | Telephone Number | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_job_title | text | 职位 | Job Title | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_supervisor_surname | text | 主管姓氏 | Supervisor's Surnames | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_supervisor_given_names | text | 主管名字 | Supervisor's Given Names | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employment_start_date | date | 工作起始日期 | Employment Date From | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_employment_end_date | date | 工作结束日期 | Employment Date To | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | prev_job_duties | textarea | 简要描述您的职责（如适用） | Briefly Describe Your Duties | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | has_attended_education | radio | 您是否就读过中等及以上教育机构？ | Have you attended any educational institutions at a secondary level or above? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_institution_name | text | 学校名称 | Name of Institution | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_address_line1 | text | 街道地址（第1行） | Street Address (Line 1) | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_address_line2 | text | 街道地址（第2行，如适用） | Street Address (Line 2) | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_city | text | 城市 | City | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_state_province | text | 州/省 | State/Province | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_postal_code | text | 邮政编码 | Postal Zone/ZIP Code | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_course_of_study | text | 学习专业 | Course of Study | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_start_date | date | 就读起始日期 | Date of Attendance From | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Previous | education_end_date | date | 就读结束日期 | Date of Attendance To | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | has_clan_tribe | radio | 您是否属于某个宗族或部落？ | Do you belong to a clan or tribe? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | clan_tribe_name | text | 宗族/部落名称 | Clan/Tribe Name | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | language_name | text | 语言名称 | Language Name | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | has_traveled_last_five_years | radio | 您在过去五年内是否前往过任何国家/地区？ | Have you traveled to any countries/regions within the last five years? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | traveled_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | has_belonged_to_organization | radio | 您是否曾加入、资助或为任何专业、社会或慈善组织工作？ | Have you belonged to, contributed to, or worked for any professional, social, or charitable organization? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | organization_name | text | 组织名称 | Organization Name | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | has_specialized_skills | radio | 您是否具备任何专门技能或受过训练，例如枪械、爆炸物、核、生物或化学方面的经验？ | Do you have any specialized skills or training, such as firearms, explosives, nuclear, biological, or chemical experience? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | specialized_skills_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | has_served_military | radio | 您是否曾在军队中服役？ | Have you ever served in the military? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | military_country | select | 国家/地区 | Country/Region | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | military_branch | text | 服役军种 | Branch of Service | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | military_rank | text | 军衔/职位 | Rank/Position | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | military_specialty | text | 军事专长 | Military Specialty | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | military_date_from | date | 服役起始日期 | Date of Service From | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | military_date_to | date | 服役结束日期 | Date of Service To | 0 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | has_served_paramilitary | radio | 您是否曾在准军事组织、自卫组织、叛乱团体、游击队或暴动组织中服役、成为成员或参与其中？ | Have you ever served in, been a member of, or been involved with a paramilitary unit, vigilante unit, rebel group, guerrilla group, or insurgent organization? | 2 | pass |
| united_states | DS160 -> DS160 | Work/Education/Training: Additional | paramilitary_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | has_communicable_disease | radio | 您是否患有具有公共卫生意义的传染病？（具有公共卫生意义的传染病包括软下疳、淋病、腹股沟肉芽肿、传染性麻风病、性病性淋巴肉芽肿、传染期梅毒、活动性结核病以及卫生与公众服务部确定的其他疾病。） | Do you have a communicable disease of public health significance? (Communicable diseases of public significance include chancroid, gonorrhea, granuloma inguinale, infectious leprosy, lymphogranuloma venereum, infectious stage syphilis, active tuberculosis, and other diseases as determined by the Department of Health and Human Services.) | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | has_communicable_disease_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | has_physical_mental_disorder | radio | 您是否有对自己或他人的安全或福祉构成或可能构成威胁的精神或身体障碍？ | Do you have a mental or physical disorder that poses or is likely to pose a threat to the safety or welfare of yourself or others? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | has_physical_mental_disorder_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | is_drug_abuser | radio | 您是否是或曾经是吸毒者或有毒瘾？ | Are you or have you ever been a drug abuser or addict? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 1 | is_drug_abuser_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_arrest_conviction | radio | 您是否曾因任何违法或犯罪行为被逮捕或定罪（即使已获赦免或大赦）？ | Have you ever been arrested or convicted for any offense or crime, even though subject of a pardon, amnesty, or other similar action? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_arrest_conviction_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_violated_controlled_substance | radio | 您是否曾违反或参与违反有关管制物质的法律？ | Have you ever violated, or engaged in a conspiracy to violate, any law relating to controlled substances? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_violated_controlled_substance_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_prostitution | radio | 您是否来美国从事卖淫或非法商业化色情活动，或在过去10年内是否曾从事卖淫或招揽卖淫？ | Are you coming to the United States to engage in prostitution or unlawful commercialized vice or have you been engaged in prostitution or procuring prostitutes within the past 10 years? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_prostitution_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_money_laundering | radio | 您是否曾参与或试图参与洗钱活动？ | Have you ever been involved in, or do you seek to engage in, money laundering? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_money_laundering_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_human_trafficking | radio | 您是否曾在美国境内或境外实施或密谋实施人口贩运罪行？ | Have you ever committed or conspired to commit a human trafficking offense in the United States or outside the United States? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_human_trafficking_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_aided_human_trafficking | radio | 您是否曾故意帮助、教唆、协助或与在美国境内或境外实施或密谋实施严重人口贩运罪行的个人合谋？ | Have you ever knowingly aided, abetted, assisted or colluded with an individual who has committed, or conspired to commit a severe human trafficking offense in the United States or outside the United States? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_aided_human_trafficking_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_trafficking_beneficiary | radio | 您是否是在美国境内或境外实施或密谋实施人口贩运罪行的个人的配偶、儿子或女儿，并且在过去五年内是否故意从贩运活动中获益？ | Are you the spouse, son, or daughter of an individual who has committed or conspired to commit a human trafficking offense in the United States or outside the United States and have you within the last five years, knowingly benefited from the trafficking activities? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 2 | has_trafficking_beneficiary_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | intend_illegal_activity | radio | 您是否试图在美国从事间谍、破坏、出口管制违规或其他非法活动？ | Do you seek to engage in espionage, sabotage, export control violations, or any other illegal activity while in the United States? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | intend_illegal_activity_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | intend_terrorist_activity | radio | 您是否试图在美国从事恐怖活动，或曾经从事过恐怖活动？ | Do you seek to engage in terrorist activities while in the United States or have you ever engaged in terrorist activities? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | intend_terrorist_activity_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_provided_terrorist_support | radio | 您是否曾经或打算向恐怖分子或恐怖组织提供财务援助或其他支持？ | Have you ever or do you intend to provide financial assistance or other support to terrorists or terrorist organizations? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_provided_terrorist_support_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | is_terrorist_member | radio | 您是否是恐怖组织的成员或代表？ | Are you a member or representative of a terrorist organization? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | is_terrorist_member_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | is_terrorist_family | radio | 您是否是在过去五年内从事过恐怖活动（包括向恐怖分子或恐怖组织提供财务援助或其他支持）的个人的配偶、儿子或女儿？ | Are you the spouse, son, or daughter of an individual who has engaged in terrorist activity, including providing financial assistance or other support to terrorists or terrorist organizations, in the last five years? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | is_terrorist_family_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_genocide | radio | 您是否曾下令、煽动、实施、协助或以其他方式参与种族灭绝？ | Have you ever ordered, incited, committed, assisted, or otherwise participated in genocide? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_genocide_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_torture | radio | 您是否曾实施、下令、煽动、协助或以其他方式参与酷刑？ | Have you ever committed, ordered, incited, assisted, or otherwise participated in torture? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_torture_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_extrajudicial_killings | radio | 您是否曾实施、下令、煽动、协助或以其他方式参与法外杀戮、政治杀戮或其他暴力行为？ | Have you committed, ordered, incited, assisted, or otherwise participated in extrajudicial killings, political killings, or other acts of violence? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_extrajudicial_killings_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_child_soldier | radio | 您是否曾招募或使用儿童兵？ | Have you ever engaged in the recruitment or the use of child soldiers? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_child_soldier_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_religious_freedom_violation | radio | 您在担任政府官员期间，是否曾负责或直接实施过特别严重的宗教自由侵犯行为？ | Have you, while serving as a government official, been responsible for or directly carried out, at any time, particularly severe violations of religious freedom? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_religious_freedom_violation_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_population_control | radio | 您是否曾直接参与建立或执行强迫妇女违背自由意愿接受堕胎或强迫男女违背自由意愿接受绝育的人口控制措施？ | Have you ever been directly involved in the establishment or enforcement of population controls forcing a woman to undergo an abortion against her free choice or a man or a woman to undergo sterilization against his or her free will? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_population_control_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_coercive_transplant | radio | 您是否曾直接参与强制摘取人体器官或身体组织？ | Have you ever been directly involved in the coercive transplantation of human organs or bodily tissue? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 3 | has_coercive_transplant_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 4 | has_immigration_fraud | radio | 您是否曾通过欺诈、故意虚假陈述或其他非法手段试图获取或协助他人获取签证、入境美国或其他移民福利？ | Have you ever sought to obtain or assist others to obtain a visa, entry into the United States, or any other United States immigration benefit by fraud or willful misrepresentation or other unlawful means? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 4 | has_immigration_fraud_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 4 | has_removal_order | radio | 您是否曾被任何国家驱逐出境？ | Have you ever been removed or deported from any country? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 4 | has_removal_order_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_withheld_child_custody | radio | 您是否曾在美国境外扣留美国公民儿童，不让美国法院授予合法监护权的人监护？ | Have you ever withheld custody of a U.S. citizen child outside the United States from a person granted legal custody by a U.S. court? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_withheld_child_custody_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_voted_illegally | radio | 您是否曾违反任何法律法规在美国投票？ | Have you voted in the United States in violation of any law or regulation? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_voted_illegally_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_renounced_citizenship | radio | 您是否曾为避税目的而放弃美国国籍？ | Have you ever renounced United States citizenship for the purposes of avoiding taxation? | 2 | pass |
| united_states | DS160 -> DS160 | Security and Background: Part 5 | has_renounced_citizenship_explain | textarea | 请说明该问题回答为“是”的具体情况 | Explain | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | surname | text | 护照姓氏 | Surname (Last name) | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | given_name | text | 护照上的名字及中间名 | Middle and given name (First name) | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | nationality | country | 国籍 | Nationality | 205 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | identity_card_number | text | 身份证或本国身份号码（如有） | Identity card number | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | email_address | text | 用于接收越南电子签证通知的邮箱 | Email | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | re_enter_email_address | text | 再次输入邮箱 | Re-enter Email | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | religion | text | 宗教信仰 | Religion | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | place_of_birth | text | 出生地 | Place of birth | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | has_multiple_nationalities | radio | 是否还拥有或曾拥有其他国籍？ | Have you ever held any other nationalities? | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality | 205 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Personal Information | has_violated_vietnam_laws | radio | 是否曾违反越南法律或法规？ | Have you violated Vietnamese laws/regulations? | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Requested Information | visa_type_requested | radio | 申请单次或多次入境电子签证 | Type of visa requested | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Requested Information | visa_valid_from | date | 希望电子签证从哪一天开始生效？ | Grant e-Visa valid from | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Requested Information | visa_valid_to | date | 电子签证有效期至哪一天？ | Grant e-Visa valid to | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Passport Information | passport_issuing_authority | text | 护照签发机关/地点 | Issuing Authority/Place of issue | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Passport Information | passport_type | select | 护照类型 | Passport type | 4 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Expiry date | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Contact Information | permanent_residential_address | text | 永久居住地址 | Permanent residential address | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Contact Information | contact_address | text | 联系地址 | Contact address | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Contact Information | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Contact Information | emergency_contact_full_name | text | 紧急联系人姓名 | Emergency contact full name | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Contact Information | emergency_contact_current_address | text | 紧急联系人当前居住地址 | Emergency contact current residential address | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Contact Information | emergency_contact_telephone | text | 紧急联系人电话 | Emergency contact telephone number | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Contact Information | emergency_contact_relationship | text | 紧急联系人关系 | Emergency contact relationship | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Occupation | occupation | select | 职业 | Occupation | 7 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Occupation | occupation_info | text | 当前职业说明 | Current occupation details | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Occupation | company_or_school_name | text | 公司/机构/学校名称 | Name of Company/Agency/School | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Occupation | position_course | text | 职位/学习课程 | Position or course of study | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Occupation | company_address | text | 公司/机构/学校地址 | Address of Company/Agency/School | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Occupation | company_phone | text | 公司/机构/学校电话 | Company/agency/school telephone number | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | purpose_of_entry | select | 本次入境越南目的 | Purpose of entry | 5 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | intended_date_of_entry | date | 预计入境日期 | Intended date of entry | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | intended_length_of_stay | text | 预计在越南停留天数 | Intended length of stay in Viet Nam (days) | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | phone_in_vietnam | text | 越南境内电话号码 | Phone number (in Viet Nam) | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | residential_address_in_vietnam | text | 在越南拟停留地址 | Residential address in Viet Nam | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | intended_province_city | select | 在越南拟停留省/市 | Intended province/city in Viet Nam | 34 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | intended_ward_commune | select | 在越南拟停留坊/社 | Intended ward/commune in Viet Nam | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | intended_border_gate_of_entry | select | 预计入境口岸 | Intended border gate of entry | 79 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | intended_border_gate_of_exit | select | 预计出境口岸 | Intended border gate of exit | 79 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | declaration_temporary_residence | checkbox | 是否承诺抵达后按越南法律申报临时居住？ | I commit to declare temporary residence according to Vietnamese law | 1 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | visited_vietnam_in_last_year | radio | 过去一年是否曾到访越南？ | Have you ever been to Viet Nam in the last 01 year? | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | visited_vietnam_purpose_detail | textarea | 上次访问越南的目的和入境日期 | Purpose of the last visit and date of arrival | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | has_relatives_in_vietnam | radio | 您是否有亲属目前居住在越南？ | Do you have relatives currently residing in Viet Nam? | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | relative_full_name_in_vn | text | 在越亲属姓名 | Relative's full name | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | relative_date_of_birth | date | 在越亲属出生日期 | Relative's date of birth | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | relative_nationality | country | 在越亲属国籍 | Relative's nationality | 205 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | relative_relationship | text | 与在越亲属的关系 | Relationship to the relative in Viet Nam | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Information About the Trip | relative_address_in_vn | text | 在越亲属地址 | Relative's address in Vietnam | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Accompanying Children Under 14 | child_full_name | text | 同一本护照上同行的14岁以下儿童姓名 | Full name (child under 14 on same passport) | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Accompanying Children Under 14 | child_sex | select | 同行儿童性别 | Sex | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Accompanying Children Under 14 | child_date_of_birth | date | 同行儿童出生日期 | Date of birth | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Trip Expenses & Insurance | intended_expenses_usd | text | 预计费用（美元） | Intended expenses (in USD) | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Trip Expenses & Insurance | bought_travel_insurance | select | 是否已购买本次旅行保险？ | Have you bought travel insurance? | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Trip Expenses & Insurance | expense_coverage | select | 谁承担申请人的旅行费用？ | Who will cover the applicant's trip expenses? | 2 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Trip Expenses & Insurance | expense_payment_method | select | 付款方式 | Payment method | 3 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Declaration | violation_of_vietnam_laws_details | textarea | 请说明违反越南法律或法规的具体情况 | Details of Vietnamese law/regulation violation | 0 | pass |
| vietnam | evisa_tourism -> VN_E_VISA | Declaration | final_declaration | checkbox | 确认以上信息真实、准确、完整，并愿意对虚假申报承担责任 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | 1 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | surname | text | 护照姓氏 | Surname (Last name) | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | given_name | text | 护照上的名字及中间名 | Middle and given name (First name) | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | date_of_birth | date | 出生日期 | Date of birth | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | sex | select | 性别 | Sex | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | nationality | country | 国籍 | Nationality | 205 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | identity_card_number | text | 身份证或本国身份号码（如有） | Identity card number | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | email_address | text | 用于接收越南电子签证通知的邮箱 | Email | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | re_enter_email_address | text | 再次输入邮箱 | Re-enter Email | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | religion | text | 宗教信仰 | Religion | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | place_of_birth | text | 出生地 | Place of birth | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | has_multiple_nationalities | radio | 是否还拥有或曾拥有其他国籍？ | Have you ever held any other nationalities? | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | other_nationality | country | 其他国籍 | Other nationality | 205 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Personal Information | has_violated_vietnam_laws | radio | 是否曾违反越南法律或法规？ | Have you violated Vietnamese laws/regulations? | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Requested Information | visa_type_requested | radio | 申请单次或多次入境电子签证 | Type of visa requested | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Requested Information | visa_valid_from | date | 希望电子签证从哪一天开始生效？ | Grant e-Visa valid from | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Requested Information | visa_valid_to | date | 电子签证有效期至哪一天？ | Grant e-Visa valid to | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Passport Information | passport_number | text | 护照号码 | Passport number | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Passport Information | passport_issuing_authority | text | 护照签发机关/地点 | Issuing Authority/Place of issue | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Passport Information | passport_type | select | 护照类型 | Passport type | 4 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Passport Information | passport_issue_date | date | 护照签发日期 | Date of issue | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Passport Information | passport_expiry_date | date | 护照到期日期 | Expiry date | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Contact Information | permanent_residential_address | text | 永久居住地址 | Permanent residential address | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Contact Information | contact_address | text | 联系地址 | Contact address | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Contact Information | telephone_number | text | 电话号码 | Telephone number | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Contact Information | emergency_contact_full_name | text | 紧急联系人姓名 | Emergency contact full name | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Contact Information | emergency_contact_current_address | text | 紧急联系人当前居住地址 | Emergency contact current residential address | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Contact Information | emergency_contact_telephone | text | 紧急联系人电话 | Emergency contact telephone number | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Contact Information | emergency_contact_relationship | text | 紧急联系人关系 | Emergency contact relationship | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Occupation | occupation | select | 职业 | Occupation | 7 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Occupation | occupation_info | text | 当前职业说明 | Current occupation details | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Occupation | company_or_school_name | text | 公司/机构/学校名称 | Name of Company/Agency/School | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Occupation | position_course | text | 职位/学习课程 | Position or course of study | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Occupation | company_address | text | 公司/机构/学校地址 | Address of Company/Agency/School | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Occupation | company_phone | text | 公司/机构/学校电话 | Company/agency/school telephone number | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | purpose_of_entry | select | 本次入境越南目的 | Purpose of entry | 5 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | intended_date_of_entry | date | 预计入境日期 | Intended date of entry | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | intended_length_of_stay | text | 预计在越南停留天数 | Intended length of stay in Viet Nam (days) | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | phone_in_vietnam | text | 越南境内电话号码 | Phone number (in Viet Nam) | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | residential_address_in_vietnam | text | 在越南拟停留地址 | Residential address in Viet Nam | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | intended_province_city | select | 在越南拟停留省/市 | Intended province/city in Viet Nam | 34 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | intended_ward_commune | select | 在越南拟停留坊/社 | Intended ward/commune in Viet Nam | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | intended_border_gate_of_entry | select | 预计入境口岸 | Intended border gate of entry | 79 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | intended_border_gate_of_exit | select | 预计出境口岸 | Intended border gate of exit | 79 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | declaration_temporary_residence | checkbox | 是否承诺抵达后按越南法律申报临时居住？ | I commit to declare temporary residence according to Vietnamese law | 1 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | visited_vietnam_in_last_year | radio | 过去一年是否曾到访越南？ | Have you ever been to Viet Nam in the last 01 year? | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | visited_vietnam_purpose_detail | textarea | 上次访问越南的目的和入境日期 | Purpose of the last visit and date of arrival | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | has_relatives_in_vietnam | radio | 您是否有亲属目前居住在越南？ | Do you have relatives currently residing in Viet Nam? | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | relative_full_name_in_vn | text | 在越亲属姓名 | Relative's full name | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | relative_date_of_birth | date | 在越亲属出生日期 | Relative's date of birth | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | relative_nationality | country | 在越亲属国籍 | Relative's nationality | 205 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | relative_relationship | text | 与在越亲属的关系 | Relationship to the relative in Viet Nam | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Information About the Trip | relative_address_in_vn | text | 在越亲属地址 | Relative's address in Vietnam | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Accompanying Children Under 14 | child_full_name | text | 同一本护照上同行的14岁以下儿童姓名 | Full name (child under 14 on same passport) | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Accompanying Children Under 14 | child_sex | select | 同行儿童性别 | Sex | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Accompanying Children Under 14 | child_date_of_birth | date | 同行儿童出生日期 | Date of birth | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Trip Expenses & Insurance | intended_expenses_usd | text | 预计费用（美元） | Intended expenses (in USD) | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Trip Expenses & Insurance | bought_travel_insurance | select | 是否已购买本次旅行保险？ | Have you bought travel insurance? | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Trip Expenses & Insurance | expense_coverage | select | 谁承担申请人的旅行费用？ | Who will cover the applicant's trip expenses? | 2 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Trip Expenses & Insurance | expense_payment_method | select | 付款方式 | Payment method | 3 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Declaration | violation_of_vietnam_laws_details | textarea | 请说明违反越南法律或法规的具体情况 | Details of Vietnamese law/regulation violation | 0 | pass |
| vietnam | VN_E_VISA -> VN_E_VISA | Declaration | final_declaration | checkbox | 确认以上信息真实、准确、完整，并愿意对虚假申报承担责任 | I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration | 1 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | expected_arrival_date | date | 预计抵达日期（DD/MM/YYYY GMT+7） | Expected Arrival Date (DD/MM/YYYY GMT+7) | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | passport_type | select | 护照类型 | Passport Type | 3 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | passport_number | text | 护照号码 | Passport Number | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | passport_expiry_date | date | 护照有效期至（DD/MM/YYYY） | Date of Expiry (DD/MM/YYYY) | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | gender | radio | 性别 | Gender | 3 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | surname | text | 姓氏（按护照） | Surname | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | given_name | text | 名字（按护照） | Given Name | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | date_of_birth | date | 出生日期（DD/MM/YYYY） | Date of Birth (DD/MM/YYYY) | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | nationality | country | 国籍 | Nationality | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | phone_country_code | select | 电话国家 / 地区代码 | Country Code | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | phone_number | text | 电话号码 | Phone Number | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | alias_email_address | text | 电子邮箱 | Email Address | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | visa_information_acknowledgement | checkbox | 我已阅读并理解此信息 | I have read and understood this information. | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | visa_type | select | 签证类型/入境目的 | Visa Type / Purpose | 11 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | visa_number | text | 签证号码/编号 | Number | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | visa_issue_date | date | 签发日期（DD/MM/YYYY） | Date of Issue (DD/MM/YYYY) | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | visa_expiry_date | date | 有效期至（DD/MM/YYYY） | Date of Expiry (DD/MM/YYYY) | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 旅客信息 | visa_issued_place | select | 签发地点 | Issued Place | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | departure_country_before_arrival | country | 抵达越南前出发国家 / 地区 | Departure country before Arrival in Vietnam | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | purpose_of_travel | select | 旅行目的 | Purpose of Travel | 6 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | mode_of_travel | radio | 旅行方式 | Mode of Travel | 3 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | flight_number | select | 航班号 | Flight Number | 9 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | custom_flight_number | text | 手动填写航班号 | Flight Number | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | border_gate_airport | select | 入境机场 | Border Gate | 5 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | vehicle_identification_number | text | 车辆/船舶识别编号 | Vehicle identification number | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | land_border_gate | select | 陆路口岸 | Border Gate | 1 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | sea_port | select | 海港口岸 | Border Gate | 14 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | accommodation_type | radio | 在越南住宿类型 | Type of Accommodation in Vietnam | 3 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | province_city_of_hotel | select | 酒店所在省 / 市 | Province / City of Hotel | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | ward_commune_of_hotel | select | 酒店所在坊 / 社 | Ward / Commune of Hotel | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | hotel_accommodation_address | select | 住宿地址 | Accommodation Address | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | custom_hotel_accommodation_address | text | 其他住宿地址 | Other Accommodation Address | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | accommodation_address | text | 住宿地址 | Accommodation Address | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | workplace_information | textarea | 工作单位信息 | Workplace Information | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 行程信息 | departure_date_from_vietnam | date | 离开越南日期（DD/MM/YYYY GMT+7） | Date of departure from Vietnam (DD/MM/YYYY GMT+7) | 0 | pass |
| vietnam | VN_PREARRIVAL_DECLARATION -> VN_PREARRIVAL_DECLARATION | 确认申报 | final_declaration | checkbox | 我确认以上信息真实、准确且完整 | I confirm that the information is correct. | 0 | pass |

