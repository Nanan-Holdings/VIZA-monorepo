# DS-160 字段与分支差异报告（2026-09-14）

## 结论

这份报告描述的是 VIZA 内部的 seed → derivation → CEAC mapping 契约。它不能证明字段标签、选项值、必填规则、选择器、页面跳转或重复项行为与 CEAC 官网一致。修复后的状态为 **内部契约通过，官方完整 parity 未验证**。新增字段必须在实际页面定位、填写并回读成功，才构成该字段在当前分支的运行证据。

当前已在线通过 CAPTCHA 和两阶段恢复流程取回匹配的历史官方确认页；这证明历史提交存在，不代表产生了本次新提交。以下未激活分支仍未获得逐项官网证据。[Smoke 文档](ceac-smoke-test.md)区分本地回归、恢复验证和真实提交验证。

## 范围与权威来源

- 字段权威来源：`viza-be/agent-backend/scripts/seed-ds160-form-fields.ts:45` 的 `FIELDS`。解析得到 325 个字段，包含 1–16 步直接字段和 17–21 步安全背景自动生成的 Yes/No 问题及说明字段（生成逻辑位于 `:3279-3366`）。
- Mapping 来源：`src/ds160-form-mappings.ts` 与 `src/ds160-extended-mappings.ts` 的 18 个页面组，共 379 个唯一 mapping key。新增候选选择器保留未验证标记。
- 归一化来源：`viza-be/submission-service/src/ds160-derive-answers.ts:41-121, 472-490`。日期拆分、NA 标志和旧字段别名在运行时加载答案后才出现。
- 分支/重复组解析：`viza-be/submission-service/src/ds160-parity.ts`。报告使用审计脚本 `scripts/audit-ds160-field-parity.ts --json` 的 `branches`、`repeatGroups`、`missingRunnerInputs` 和 `unconsumedFields` 结构。
- 前端条件表达式：`viza-fe/internal-website/lib/form-utils.ts:18-90, 107-174`。前端支持 `===`、`!==`、`in`、`not in`、`contains_any`、`&&`、`||` 和 `_empty`。

代码中的签证类别证据只覆盖 B1/B2 默认路径：`viza-fe/internal-website/components/client/wizards/us/config.ts:117-125` 将 `DS160` 的默认类型设为 `B1/B2`，并在 `:60` 将旅行目的审阅文案固定为 B1/B2；provider registry 在 `viza-be/submission-service/src/country-submissions/registry.ts:657-670` 声明 `DS160`、`B1_B2` 和 `US_B1_B2`。没有同等证据证明 F、J、H、L、M 等其他非移民类别的类别专属分支已经覆盖，因此本报告的已证范围按 **B1/B2 默认路径** 记录，不能外推到所有 DS-160 类别。

## 审计快照

命令：

```text
npx ts-node scripts/audit-ds160-field-parity.ts --json
```

当前 JSON 关键结果：

| 项目 | 数量/状态 |
| --- | ---: |
| `fieldCount` | 325 |
| `mappingCount` | 379 |
| `conditionalBranchCount` | 76 |
| `repeatGroups.length` | 23 |
| `missingRunnerInputs.length`（归一化后） | 0 |
| `missingFixtureInputs.length`（当前 fixture 分支） | 0 |
| `unconsumedFields.length` | 0 |
| `officialParityVerified` | `false` |
| `passed` | `true` |

> 可复现性备注：当前工作树的 `--json` 命令返回 exit 0。下方保留修复前的 177 字段差异清单作为历史基线；这些字段现在均有声明的运行时消费者。

修复前 177 个未消费字段中，175 个属于下表的条件分支，另外 2 个没有 `showIf`：`secondary_phone`、`has_other_social_media`。本轮补齐 201 个映射键、严格日期拆分、325 字段运行时契约和 23 个重复组的浏览器适配。`passed: true` 只证明内部字段消费关系闭合；官网完整 parity 仍为 false。

## 修复前分支差异基线

下表逐项保留 seed 中的原始 `showIf` 字符串。`缺失字段` 指修复前没有声明运行时消费者的字段。修复后，orchestrator 排除未激活分支，按当前 DOM 解析重复行，并在全部回发后回读答案；有效答案无法定位或回读时停止。

### Personal Information 1（step 1）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `other_names_used === yes` | `other_surname`, `other_given_names` |
| `has_telecode === yes` | `telecode_surname`, `telecode_given_names` |
| `marital_status === other` | `marital_status_other_explain` |

### Personal Information 2（step 2）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `other_nationality === yes` | `other_nationality_country`, `other_nationality_has_passport` |
| `other_nationality_has_passport === yes` | `other_nationality_passport_number` |
| `permanent_resident_other_country === yes` | `other_permanent_resident_country` |

### Travel Information（step 3）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `has_specific_plans === yes` | `arrival_flight`, `arrival_city`, `departure_flight`, `departure_city`, `planned_location` |
| `trip_payer_type === other_person` | `payer_address_same_as_home` |
| `payer_address_same_as_home === no` | `payer_address_street1`, `payer_address_street2`, `payer_address_city`, `payer_address_state`, `payer_address_postal`, `payer_address_country` |
| `trip_payer_type === other_company` | `payer_org_name`, `payer_org_phone`, `payer_org_relationship`, `payer_org_address_street1`, `payer_org_address_street2`, `payer_org_address_city`, `payer_org_address_state`, `payer_org_address_postal`, `payer_org_address_country` |

- `showIf`: `has_specific_plans === yes || intended_length_of_stay_unit === YEAR(S) || intended_length_of_stay_unit === MONTH(S) || intended_length_of_stay_unit === WEEK(S) || intended_length_of_stay_unit === DAY(S)`  
  缺失字段：`us_address_street2`

### Travel Companions（step 4）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `companion_group_travel === no` | `companion_surname`, `companion_given_names`, `companion_relationship` |

### Previous U.S. Travel（step 5）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `has_been_in_us === yes` | `previous_visit_date_arrived`, `previous_visit_length_of_stay`, `previous_visit_length_of_stay_unit`, `has_us_drivers_license` |
| `has_us_drivers_license === yes` | `us_drivers_license_number`, `us_drivers_license_state` |
| `has_us_visa === yes` | `last_visa_issue_day`, `last_visa_issue_month`, `last_visa_issue_year`, `visa_number_unknown`, `applying_same_visa_type`, `applying_same_country_of_issue_and_residence`, `has_been_ten_printed`, `visa_lost_or_stolen`, `visa_cancelled_or_revoked` |
| `visa_lost_or_stolen === yes` | `year_visa_lost_or_stolen`, `visa_lost_or_stolen_explain` |
| `visa_cancelled_or_revoked === yes` | `visa_cancelled_or_revoked_explain` |
| `has_been_refused === yes` | `refusal_explain` |
| `immigrant_petition_filed === yes` | `immigrant_petition_explain` |

### Address and Phone（step 6）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `mailing_same_as_home === no` | `mailing_address_line1`, `mailing_address_line2`, `mailing_address_city`, `mailing_address_state`, `mailing_address_postal`, `mailing_address_country` |
| `has_other_phones === yes` | `additional_phone` |
| `has_other_emails === yes` | `additional_email` |
| `has_other_social_media === yes` | `other_social_media_name`, `other_social_media_identifier` |

修复前另有两个没有 `showIf` 的未消费字段：`secondary_phone`、`has_other_social_media`。前者是可选电话号码，后者是其他社交媒体分支控制器；本轮已为两者补充映射。

### Passport Information（step 7）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `passport_document_type === other` | `passport_document_type_explain` |
| `lost_passport === yes` | `lost_passport_number`, `lost_passport_country`, `lost_passport_explain` |

### Family Information（steps 8–12）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `has_immediate_us_relatives === yes` | `us_relative_surname`, `us_relative_given_names`, `us_relative_relationship`, `us_relative_status` |
| `spouse_address_type === other` | `spouse_address_street1`, `spouse_address_street2`, `spouse_address_city`, `spouse_address_state`, `spouse_address_zip`, `spouse_address_country` |
| `marital_status === civil_union` | `partner_surname`, `partner_given_names`, `partner_date_of_birth`, `partner_nationality`, `partner_city_of_birth`, `partner_country_of_birth`, `partner_address_type` |
| `partner_address_type === other` | `partner_address_street1`, `partner_address_street2`, `partner_address_city`, `partner_address_state`, `partner_address_zip`, `partner_address_country` |
| `marital_status === widowed` | `deceased_spouse_surname`, `deceased_spouse_given_names`, `deceased_spouse_date_of_birth`, `deceased_spouse_nationality`, `deceased_spouse_city_of_birth`, `deceased_spouse_country_of_birth` |
| `marital_status === divorced` | `number_of_former_spouses`, `former_spouse_surname`, `former_spouse_given_names`, `former_spouse_date_of_birth`, `former_spouse_nationality`, `former_spouse_city_of_birth`, `former_spouse_country_of_birth`, `former_spouse_date_of_marriage`, `former_spouse_date_marriage_ended`, `former_spouse_how_marriage_ended`, `former_spouse_country_marriage_terminated` |

- `showIf`: `marital_status === married || marital_status === legally_separated || marital_status === common_law || marital_status === other`  
  缺失字段：`spouse_country_of_birth`, `spouse_address_type`

### U.S. Contact Information（step 13）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `us_contact_relationship !== _empty` | `us_contact_address_street2` |

### Work/Education/Training（steps 14–16）

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `primary_occupation === other` | `occupation_other_explain` |
| `primary_occupation === not_employed` | `not_employed_explain` |
| `primary_occupation !== _empty && primary_occupation !== retired && primary_occupation !== homemaker && primary_occupation !== not_employed` | `employer_address_line2` |
| `has_previous_employer === yes` | `prev_employer_address_street1`, `prev_employer_address_street2`, `prev_employer_city`, `prev_employer_state`, `prev_employer_postal`, `prev_employer_country`, `prev_employer_phone`, `prev_job_title`, `prev_supervisor_surname`, `prev_supervisor_given_names`, `prev_employment_start_date`, `prev_employment_end_date`, `prev_job_duties` |
| `has_attended_education === yes` | `education_institution_name`, `education_address_line1`, `education_address_line2`, `education_city`, `education_state_province`, `education_postal_code`, `education_country`, `education_course_of_study`, `education_start_date`, `education_end_date` |
| `has_clan_tribe === yes` | `clan_tribe_name` |
| `has_traveled_last_five_years === yes` | `traveled_country` |
| `has_belonged_to_organization === yes` | `organization_name` |
| `has_specialized_skills === yes` | `specialized_skills_explain` |
| `has_served_military === yes` | `military_country`, `military_branch`, `military_rank`, `military_specialty`, `military_date_from`, `military_date_to` |
| `has_served_paramilitary === yes` | `paramilitary_explain` |

### Security and Background（steps 17–21）

修复前安全背景每个 `yes` 说明字段都没有 runtime consumer：

| 原始 `showIf` | 缺失字段 |
| --- | --- |
| `has_communicable_disease === yes` | `has_communicable_disease_explain` |
| `has_physical_mental_disorder === yes` | `has_physical_mental_disorder_explain` |
| `is_drug_abuser === yes` | `is_drug_abuser_explain` |
| `has_arrest_conviction === yes` | `has_arrest_conviction_explain` |
| `has_violated_controlled_substance === yes` | `has_violated_controlled_substance_explain` |
| `has_prostitution === yes` | `has_prostitution_explain` |
| `has_money_laundering === yes` | `has_money_laundering_explain` |
| `has_human_trafficking === yes` | `has_human_trafficking_explain` |
| `has_aided_human_trafficking === yes` | `has_aided_human_trafficking_explain` |
| `has_trafficking_beneficiary === yes` | `has_trafficking_beneficiary_explain` |
| `intend_illegal_activity === yes` | `intend_illegal_activity_explain` |
| `intend_terrorist_activity === yes` | `intend_terrorist_activity_explain` |
| `has_provided_terrorist_support === yes` | `has_provided_terrorist_support_explain` |
| `is_terrorist_member === yes` | `is_terrorist_member_explain` |
| `is_terrorist_family === yes` | `is_terrorist_family_explain` |
| `has_genocide === yes` | `has_genocide_explain` |
| `has_torture === yes` | `has_torture_explain` |
| `has_extrajudicial_killings === yes` | `has_extrajudicial_killings_explain` |
| `has_child_soldier === yes` | `has_child_soldier_explain` |
| `has_religious_freedom_violation === yes` | `has_religious_freedom_violation_explain` |
| `has_population_control === yes` | `has_population_control_explain` |
| `has_coercive_transplant === yes` | `has_coercive_transplant_explain` |
| `has_immigration_fraud === yes` | `has_immigration_fraud_explain` |
| `has_removal_order === yes` | `has_removal_order_explain` |
| `has_withheld_child_custody === yes` | `has_withheld_child_custody_explain` |
| `has_voted_illegally === yes` | `has_voted_illegally_explain` |
| `has_renounced_citizenship === yes` | `has_renounced_citizenship_explain` |

### 修复前已消费的 5 个条件表达式

这 5 个表达式在修复前的内部审计中已经没有 `unmappedFields`，但仍没有官方 live 证据：

| 原始 `showIf` | 已消费字段 |
| --- | --- |
| `has_specific_plans === no` | `intended_arrival_date`, `intended_length_of_stay_value`, `intended_length_of_stay_unit` |
| `has_companions === yes` | `companion_group_travel` |
| `companion_group_travel === yes` | `companion_group_name` |
| `social_media_platform !== NONE && social_media_platform !== null` | `social_media_handle` |
| `has_social_media === yes` | `social_media_provider`, `social_media_identifier` |

## 重复组

审计发现 23 个需要在浏览器中验证添加、删除、重载后索引和保存行为的重复组：

`other_nationality`, `permanent_resident`, `trip_purpose`, `specific_travel_plans`, `planned_locations`, `companions`, `previous_visits`, `drivers_licenses`, `visa_refused`, `immigrant_petition`, `additional_phones`, `additional_emails`, `social_media`, `other_social_media`, `lost_passport`, `us_relatives`, `former_spouses`, `previous_employers`, `education`, `languages`, `traveled_countries`, `organizations`, `military_service`。

当前已为这些组声明运行时消费者，并实现按官网当前 DOM 定位重复行、添加/删除以及全部回发后的逐行回读。本地浏览器回归覆盖索引间隙、条件子字段和回发丢值；这不能证明上述每一组在真实 CEAC 页面都已经逐行验证。

## 前端、归一化与 runner 的边界

1. 审计 evaluator 已支持当前 DS-160 seed 使用的 `===`、`!==`、`&&`、`||`、`_empty` 和 `YEAR(S)` 等原始值，并在遇到未知语法时终止。当前 fixture 缺口、缺失运行时输入和反向未消费字段均为 0。
2. 当前归一化已将简化表单的 `employer_city`、`employer_state_province`、`employer_postal_code`、`employer_country`、`monthly_salary` 桥接到 CEAC canonical keys，并拆分 `employment_start_date`。因此审计的 `missingRunnerInputs` 为 0；这是内部名称桥接，不是官网字段或选项值验证。
3. CEAC orchestrator 现在排除未激活分支，严格要求已回答且激活的映射字段可定位，并对全部回发后的字段和重复行执行回读；定位歧义、字段不可见或答案未保留会中止。没有用户答案的官网新增必填项仍需由真实页面验证发现，静态覆盖不能代替该检查。
4. 前端的 required/showIf 和 repeat 逻辑来自通用表单契约；它没有对 CEAC 每个页面的官方 requiredness、option value、selector、服务器端验证和分支跳转做逐项证明。

## 官方验证状态与下一步

本轮已完成的修复包括：字段和条件映射补齐、工作信息别名和严格日期拆分；移除缺失学校、电话、日期及未回答 Yes/No 的推测默认值；保留申请人的领馆选择并跨 CAPTCHA 重试与会话恢复复用；重复行适配和严格回读；区分社交媒体平台的 NONE 与其他网站问题；起始页 smoke 不再把仍停留在起始页的 `no_captcha` 当作已进入后续页面。代码尚未部署到生产环境。

最终提交函数在单次调用中只点击一次，随后等待官方确认控件和相同 Application ID；未观察到独立 confirmation number 时返回 `null`。已应用迁移 `0191_ds160_final_submission_guard.sql`，持久记录同一授权下的最终点击状态。Worker 在创建会话前检查既有申请和提交状态，生成官方申请号后立即加密保存取回资料；存在检查点或不确定提交结果时进入恢复核验，不盲目新建申请。

已取得的验证证据：

| 检查 | 结果 |
| --- | --- |
| DS-160 / CEAC 聚焦回归（含本地 Playwright DOM） | 101/101 通过 |
| 本轮已修改的跟踪文件 `git diff --check` | 通过 |
| 全包 `npm run type-check` | 通过 |
| 内部字段/分支审计 | 通过，0 个未消费字段 |
| 历史 CEAC 申请在线取回 | 通过 CAPTCHA、两阶段取回及匹配申请号的官方确认控件核验 |
| 官方全页面、分支、重复组与本轮真实提交 | 未验证 |

- `officialParityVerified` 必须保持 `false`，直到每个 CEAC 页面都有带官方 DOM 证据的字段/选项/分支检查。
- 历史确认页取回成功只证明历史提交存在。本轮新申请尚未得到官方提交结果，也没有全分支和全部重复组的真实官网证据。
- 新申请已从真实前端操作建立并复制保存答案；提交资格接口返回 `application_payment_required`，要求为新申请配置官方费用。不得绕过付款边界直接插入队列。
- 后续仍须逐页核对官网标签、选项、必填规则、条件跳转及重复行，并保存相应的 DOM/回读证据。
- 报告不包含申请人个人数据、账号、答案或官网提交结果。
