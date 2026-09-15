# DS-160 字段与分支差异报告（2026-09-14）

## 结论

这份报告描述的是 VIZA 内部的 seed → derivation → CEAC mapping 契约。它不能证明字段标签、选项值、必填规则、选择器、页面跳转或重复项行为与 CEAC 官网一致。修复后的状态为 **内部契约通过，官方完整 parity 未验证**。新增字段必须在实际页面定位、填写并回读成功，才构成该字段在当前分支的运行证据。

当前已在线通过 CAPTCHA 和两阶段恢复流程取回匹配的历史官方确认页；这证明历史提交存在，不代表产生了本次新提交。2026-09-14 22:54 UTC 已在真实前端点击新申请的提交按钮，收到 HTTP 402 / `application_payment_required`：VIZA 要求配置 185 美元官方费用，服务费已免除。数据库核验未产生递交队列、官方申请号或新提交结果。这是 VIZA 的付款关卡，不是 CEAC 提交成功的证据。以下未激活分支仍未获得逐项官网证据。[Smoke 文档](ceac-smoke-test.md)区分本地回归、恢复验证和真实提交验证。

实际审阅页还暴露了 React 19 与旧版 Radix Select/Slot 的 ref 更新循环。已升级 `@radix-ui/react-select` 至 2.3.7、`@radix-ui/react-slot` 至 1.3.3，使用官方修复；没有保留临时 node_modules 补丁。真实审阅页稳定加载后完成了上述点击。新增 canonical Select 回归测试验证父组件重渲染和选项更新不会让稳定 ref detach，也不会丢失已选值。付款跳转过程中仍记录到一次 passive-effect 更新警告，付款完成后的全程尚未验证。[Radix 修复 PR](https://github.com/radix-ui/primitives/pull/3899)、[Select changelog](https://github.com/radix-ui/primitives/blob/main/packages/react/select/CHANGELOG.md)。

新增必填检查覆盖当前已激活字段和每个已保存的重复行，并在创建官方申请之前运行。申请人于 2026-09-15 明确回答协助填写声明为 No；该答案已保存，当前 293 项保存答案通过必填与分支检查。回答 Yes 时仍需相应的真实填写人资料。检查不会把空答案补成 No、NA 或任意日期。

2026-09-15 07:49 UTC 再次从真实审阅页点击提交：限定单申请、非生产环境的本地付款例外使 `submission-access` 返回 200，但 `retry-submission` 返回 500。数据库仍无队列和新官方申请号；独立的数据库付款 trigger 拒绝了未付款入队，HTTP 放行不足以跑通真实流程。费用记录保持原有待付款状态。07:52 UTC 重新通过 Browserbase 到达官方开始页，页面判定为 `start`、无安全拦截；这仍不构成新提交或完整字段 parity 的证据。

原 seed 没有收集签名页的协助填写声明及其 Yes 分支。现在本地新增 Step 22 共 11 字段，覆盖声明、姓名、机构、地址和关系；运行器要求明确答案，先选国家，再填地址，并在所有回发后逐字段回读。护照签名输入也改为唯一明确字段定位和精确回读。字段参考 [2014 年政府 DS-160 截图第 41 页](https://www.reginfo.gov/public/do/DownloadDocument?objectID=49797701)；该静态截图不能证明姓名区 NA checkbox 的实际 DOM 作用域。当前采用 Given Names 的保守候选契约，遇到共享控件、歧义或非预期禁用行为会停止，仍需当前官网 DOM 核验。[国务院 DS-160 FAQ](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/forms/ds-160-online-nonimmigrant-visa-application/ds-160-faqs.html)说明第三方协助的披露要求。

Step 22 的 seed 已改为按 `(visa_type, field_name)` upsert，保留已有字段标识，不再全量删除。新增字段尚未写入共享数据库，代码也未发布；应与新版运行器一起上线，避免旧运行器忽略 Yes 答案。中英文步骤标签已补齐。

照片读取也补齐了账号复用路径：本次申请没有任何照片上传行时，worker 只查询同一申请人的 Universal Profile 可用照片，按更新时间选择一个文件；本次申请已有的照片行（包括 rejected）仍优先，不会被账号文件覆盖。2026-09-14 23:26 UTC 已对实际账号验证可选照片存在且其精确 Storage 对象存在，没有下载文件内容或创建申请材料行。此修复解决了“前端认为账号材料已齐、worker 却只读取 application_documents”的差异。

## 范围与权威来源

- 内部字段来源：`viza-be/agent-backend/scripts/seed-ds160-form-fields.ts` 的 `FIELDS`。解析得到 336 个字段，包含 1–16 步直接字段、17–21 步安全背景生成字段和第 22 步协助填写声明。
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
| `fieldCount` | 336 |
| `mappingCount` | 379 |
| `signatureFieldCount` | 11 |
| `conditionalBranchCount` | 77 |
| `repeatGroups.length` | 23 |
| `missingRunnerInputs.length`（归一化后） | 0 |
| `missingFixtureInputs.length`（当前 fixture 分支） | 0 |
| `unconsumedFields.length` | 0 |
| `officialParityVerified` | `false` |
| `passed` | `true` |

> 可复现性备注：当前工作树的 `--json` 命令返回 exit 0。下方保留修复前的 177 字段差异清单作为历史基线；这些字段现在均有声明的运行时消费者。

修复前 177 个未消费字段中，175 个属于下表的条件分支，另外 2 个没有 `showIf`：`secondary_phone`、`has_other_social_media`。本轮补齐 201 个映射键、严格日期拆分、336 字段运行时契约和 23 个重复组的浏览器适配。`passed: true` 只证明内部字段消费关系闭合；官网完整 parity 仍为 false。

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
| DS-160 / CEAC 聚焦回归（含本地 Playwright DOM） | 128/128 通过 |
| 本轮已修改的跟踪文件 `git diff --check` | 通过 |
| 全包 `npm run type-check` | submission-service、frontend、agent-backend 均通过 |
| Lint | frontend / agent-backend 均无错误；分别保留 58 / 1 个既有警告 |
| Canonical Select 稳定 ref 回归 | 通过；父级重渲染、选项更新不丢失值 |
| 真实账号复用照片元数据与对象存在性 | 通过；未下载文件内容 |
| 内部字段/分支审计 | 通过，0 个未消费字段 |
| 历史 CEAC 申请在线取回 | 通过 CAPTCHA、两阶段取回及匹配申请号的官方确认控件核验 |
| 官方全页面、分支、重复组与本轮真实提交 | 未验证 |

- `officialParityVerified` 必须保持 `false`，直到每个 CEAC 页面都有带官方 DOM 证据的字段/选项/分支检查。
- 历史确认页取回成功只证明历史提交存在。本轮新申请尚未得到官方提交结果，也没有全分支和全部重复组的真实官网证据。
- 2026-09-15 用户明确要求暂缓 VIZA 付款后，迁移 `0192_ds160_local_payment_deferral.sql` 提供仅限本地、指定申请、4 小时内且绑定首个 DS-160 队列的例外；原费用记录仍为待付款，正常官方付款及预约资格不变。真实前端 Submit 于 09:55 UTC 返回 200 并创建队列，已观察到页面提交进度和 worker 领取。
- 本次真实操作发现并修复了原文姓名被翻译别名覆盖、通用材料回退错误要求银行流水/行程单、起始安全验证过渡页被误判等问题。原文姓名按官网规则保留本国语言；DS-160 通用材料回退只强制照片，显式套餐材料规则仍优先。
- 10:41 UTC 官网创建本次申请号并进入 Personal Information 1，但恢复记录写入使用了不存在的 `submission_queue.official_started_at`，因此安全停止。恢复密钥已从同一 Browserbase 会话的受保护诊断中提取、加密保存，且取回页安全问题与同一申请号已核验。继续使用原队列和原官方申请，未再次创建草稿。
- 当前仍未取得本次官方最终提交确认。先前 128 项通过是本地契约/DOM 回归结果，不能代替新一次官方提交；后续运行结果应追加记录。
- 11:07 UTC 前的同号恢复核验表明：Personal Information 1 尚未保存，官网拒绝姓氏/出生年份匹配，留空又被必填规则拒绝。旧草稿保持未签名，恢复资料和错误记录保留；用户随后明确批准保留旧记录并新建替代申请。修复后的确认页在 Continue 前加密保存恢复资料，保存失败不翻页；本轮完整本地 DS-160 回归为 136/136。
- 替代申请流程另发现旧 QA 空草稿被 `new-application` 接口复用。已让真实申请复用查询排除 `VIZA_PLACEHOLDER_DRY_RUN`，与数据库 ongoing 索引一致，未取消演练安全防护。本次误复制到 QA 草稿的 331 项答案按创建时间、同属申请人、逐值匹配和无队列条件撤回，QA 稿恢复为空；相关临时付款例外已撤销。
- 11:30 UTC 真正的新申请创建成功，创建时间为当次操作、无 QA 标记、331 项答案与原稿无差异；当时的 runtime required 仅证明非空，不能证明答案是真实资料。签名协助声明为用户明确填写的 no。实际前端 Submit 于 12:25 UTC 建立新队列，不能把旧草稿的申请号或历史确认页当成本次成功。
- 14:12 UTC 新队列进入真实 CEAC，修复后的三个加密恢复字段在 Continue 前成功保存。Personal Information 1 的 City of Birth 回读发现保存的内容是输入提示文案，并因官网长度限制被截断；姓、名和原文姓名也包含示例或提示。该次操作已停止，未点击最终签名，最终提交尝试表为零条。后续必须先解决数据真实性，再判断同号取回是否可用。
- 同属申请人的较早材料中找到了真实护照，已核对姓名、出生日期及护照有效期。默认复用的护照实际为测试模板；仅本次申请的材料引用已替换为真实护照。82 条身份、护照及语言别名按已核验护照和已保存出生城市修正，并保存来源标记及受保护的修改前备份。该数字包含别名及护照有效期选项，不表示 82 个独立官网问题。真实前端已核验修正后的姓、名、原文姓名、出生城市和护照签发省份，未触发提交。
- 历史已提交记录、非空检查、语言一致性及上传文件元数据都不能证明资料真实。仍需检查提示文案、模板材料、冲突选项及当前旅行资料；不以猜测日期、地址、亲属资料或默认 No 补齐。
- 用户随后要求使用 placeholder，后续验证限定为本地 fixture/DOM 演练；真实队列保持阻塞、租约清除，恢复字段保留，临时付款例外撤销。未用占位答案签名递交官网。提交前校验现可识别活动字段中的中英文提示，遵循英文别名优先规则及重复行条件；缺失或占位答案停止自动重试，错误只记录字段名。当前账号命中 6 个提示字段；142/142 本地回归、service type-check 和内部字段审计通过，官网全分支验证仍未完成。
- 后续仍须逐页核对官网标签、选项、必填规则、条件跳转及重复行，并保存相应的 DOM/回读证据。
- 报告不包含申请人个人数据、账号、答案或官网提交结果。
