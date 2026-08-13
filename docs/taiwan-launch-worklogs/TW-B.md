# TW-B Worklog — Schema/官方 DOM/材料合同审计

- 状态：第一波 TW-B 已完成，等待主协调者整合
- 负责人：Codex / TW-B
- 基线确认：已读取 `docs/taiwan-launch-coordination.md`；协调文档只读未修改。开始时 `git status --short` 已有多处既有/并行改动，包括台湾 seed、0123 migration、前端、submission-service 等；本次仅修改 TW-B 允许范围内文件。
- 更新时间：2026-08-01 12:30 Asia/Singapore

## 计划与执行

1. 已比对台湾 seed、`normalize.ts`、`apply.ts` 真实 DOM name mapping、`halt-runners.ts` Documents 解析、`0122/0123` document_requirements。
2. 已确认官方必填 `householdRevoked` 在 seed 中缺失；已在 seed 添加 `household_revoked`，保留 VIZA 合同值 `yes/no`，并记录官方 DOM `householdRevoked` 与官方值 `N/Y`。
3. 已核对 `eligibility_category`：seed/normalizer/Documents 使用 `1/2/3/4`，runner 填官网时映射到官方 DOM `4/5/6/9`，0123 document keys 拆为 `eligibility_supporting_document_1..4`。
4. 已核对照片、旅行证件、港澳身份证明、其他国籍护照、大陆身份证及资格证明的条件逻辑。
5. 已新增台湾 schema 静态测试，覆盖 seed 字段、文件上传不进 form fields、资格类别编码、0123 拆分和 Documents 条件逻辑。

## 变更文件

- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - 新增 `household_revoked` 必填单选字段。
  - 选项：
    - `no` → 官方 `N`：未注销户口登记，或已注销户口登记但尚未取得香港、澳门护照。
    - `yes` → 官方 `Y`：已注销户口登记。
  - `validation_rules` 记录 `official_dom_name: "householdRevoked"` 和 `official_values: { no: "N", yes: "Y" }`。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 新增 4 个 Vitest 静态 schema 测试。
- `docs/taiwan-launch-worklogs/TW-B.md`
  - 记录本次审计、验证、阻断项、人工 DB 步骤和接口变化。

未修改：`docs/taiwan-launch-coordination.md`、`viza-be/submission-service/src/tw/**`、前端代码、共享数据库、其他 worklog。

## 验证命令与结果

- 命令：`npx vitest run src/tests/tw-entry-permit-schema.test.ts`
- 目录：`viza-be/agent-backend`
- 结果：通过，`1` 个测试文件，`4` 个测试全部 passed。

未执行：

- 未执行 seed。
- 未执行 migration。
- 未执行任何 Supabase 写操作。
- 未执行 git commit/stash/checkout/switch/reset/rebase/merge/add。
- 未执行部署或真实官方提交。

## 字段对照结论

| VIZA seed field | 官方 DOM / 合同 | 结论 |
|---|---|---|
| `continent` | `continent` | 一致。 |
| `embassy_office` | `overseaOfficeId` | seed 使用官方办事处 value；Documents 港澳条件依赖 `50/51`。 |
| `first_time_applying` | `applyCaseExtendTemp.firstApplyFlag`, `Y/N` | seed `yes/no`，runner 映射 `Y/N`。 |
| `permit_type` | `traveller.applyVisa`, `1/2/H` | 一致。 |
| `permit_count` | `traveller.applyCnt`, `1/2` | 一致。 |
| `has_other_nationality_passport` | `traveller.othPassportFlag`, `Y/N` | seed `yes/no`，runner 映射 `Y/N`；控制其他国籍护照材料。 |
| `household_revoked` | `householdRevoked`, `N/Y` | 本次修复。官方必填；seed 现在收集，runner 现有只读路径可读取该 key 并映射 `yes/no` 到 `Y/N`。 |
| `eligibility_category` | seed `1/2/3/4`; 官方 DOM `4/5/6/9` | 不改 seed 编码；runner 用映射 `1→4, 2→5, 3→6, 4→9`；Documents 用 seed 编码后缀。 |
| `birth_place_is_mainland` | seed `mainland/other`; 官方 `1/5` | runner 映射；schema 保持语义值。 |
| `mainland_id_number_not_applicable` | `traveller.noPersonIdFlag` | checkbox；为 `true` 时不要求大陆身份证材料。 |
| `tw_contact_mobile_not_applicable` | `traveller.noTwMobileFlag` | checkbox；为 `true` 时不要求台湾手机字段。 |
| `accepted_terms` | `agree` | 必须为 true。 |

## 材料与条件逻辑结论

| requirement_key | 来源/显示 | 条件 |
|---|---|---|
| `photo` | `document_requirements`，不进 `visa_form_fields` | 必须上传；runner 作为 `photoFilePath`。 |
| `mainland_travel_document` | `document_requirements` | 所有资格类别必须上传。 |
| `eligibility_supporting_document_1` | 0123 拆分后 row | `eligibility_category = 1`，留学生：有效学生签证/再入国签证 + 3 个月内在学证明。 |
| `eligibility_supporting_document_2` | 0123 拆分后 row | `eligibility_category = 2`，永久居留权证明。 |
| `eligibility_supporting_document_3` | 0123 拆分后 row | `eligibility_category = 3`，出入境查验章戳护照内页 + 工作签证 + 3 个月内公司在职证明。 |
| `eligibility_supporting_document_4` | 0123 拆分后 row | `eligibility_category = 4`，依亲居留权证明 + 财力证明。 |
| `hk_macau_id_scan` | `document_requirements` | 仅 `embassy_office in {"50","51"}` 时需要；未满 11 岁豁免目前未在 schema/runner 中建模，是产品/runner后续点。 |
| `other_nationality_passport_scan` | `document_requirements` | 仅 `has_other_nationality_passport === "yes"` 时需要。 |
| `mainland_id_card_scan` | `document_requirements` | 仅 `mainland_id_number_not_applicable !== "true"` 时需要。 |
| `other_supporting_document` | `document_requirements` | 可选/情形适用，例如日本住民票。 |

## 0123 人工数据库步骤

重要：TW-B 未执行、也不得执行以下步骤。仅授权人员在 Supabase SQL Editor 或受控 pipeline 执行。

1. 执行前保存当前状态：
   ```sql
   SELECT requirement_key, label_en, label_zh, description, required, sort_order
   FROM document_requirements
   WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT'
   ORDER BY sort_order, requirement_key;
   ```
2. 确认 `visa_packages` 存在唯一目标 package：
   ```sql
   SELECT id, country, visa_type
   FROM visa_packages
   WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT';
   ```
3. 由授权人员执行：
   `viza-be/agent-backend/drizzle/0123_tw_entry_permit_document_requirements_zh_and_eligibility_split.sql`
4. 执行后验证：
   ```sql
   SELECT requirement_key, label_zh, description, required, sort_order
   FROM document_requirements
   WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT'
   ORDER BY sort_order, requirement_key;

   SELECT count(*) AS tw_requirement_count
   FROM document_requirements
   WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT';

   SELECT requirement_key, count(*) AS copies
   FROM document_requirements
   WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT'
   GROUP BY requirement_key
   HAVING count(*) <> 1;
   ```
5. 预期验证结果：
   - 总数为 `10`。
   - 不存在 `eligibility_supporting_document` 通用旧 row。
   - 存在且各一条：`eligibility_supporting_document_1..4`。
   - `photo`、`mainland_travel_document`、`hk_macau_id_scan`、`other_nationality_passport_scan`、`mainland_id_card_scan`、`other_supporting_document` 的 `label_zh/description` 为简体中文。

回滚注意事项：

- 最稳妥方式是使用执行前保存的查询结果恢复。
- 若需逻辑回滚：删除 `eligibility_supporting_document_1..4`，恢复 0122 的通用 `eligibility_supporting_document` row，并把 6 个未拆分 row 的 `label_zh/description` 恢复到执行前值。
- 若授权环境支持事务，建议在受控 pipeline 中包装执行和验证；验证失败则 rollback，不要让半更新状态进入共享环境。

## 阻断/需要决策

- `TW-G2` 仍未关闭：`0123` 需要授权人员人工执行并保存验证输出。
- `household_revoked` 已进入 seed，但 `viza-be/submission-service/src/tw/normalize.ts` 未把它列入显式 handled key，也未在 normalizer 层强制 required；由于 `mergePassThrough` 会保留 seed 新字段，正常动态表单提交流程可传到 runner。是否在 runner/normalizer 层再硬校验属于 TW-A/TW-02 范围。
- 港澳身份证明的“未满 11 岁免附”还没有 applicant age/document 条件建模；当前 DB 描述已提示，runner 条件仍只按港澳办事处判断。需要 TW-A/TW-02 或产品决策是否收集年龄豁免/监护材料。
- runner 注释提到未成年人且无法定代理人/监护人陪同来台的材料尚未完全确认；本次未加入 document_requirements。

## 给其他工作包的接口变化

- 新增动态表单答案 key：`household_revoked`。
- 类型/值合同：`"no"` 或 `"yes"`。
- 官方提交映射：`"no" → "N"`，`"yes" → "Y"`，DOM name 为 `householdRevoked`。
- Documents 资格证明合同继续使用 `eligibility_supporting_document_${eligibility_category}`，其中 `eligibility_category` 为 seed 编码 `1/2/3/4`，不是官方 DOM 编码 `4/5/6/9`。

---

## 第二阶段更新 — 唯一字段合同与静态锁定

- 状态：第二阶段 TW-B 已完成，等待主协调者整合。
- 更新时间：2026-08-01 12:45 Asia/Singapore。
- 本阶段边界：继续独占台湾 seed、台湾 migration、台湾 schema tests、本文 worklog；未修改 runner、前端、真实 Supabase、总览或其他 worklog。
- 重要状态修正：第一阶段记录过 `household_revoked` 仍依赖 normalizer pass-through；第二阶段只读核对发现并行 runner 工作已把它加入 `normalize.ts` handled keys，并用 `requireYesNo(a.household_revoked, "household_revoked")` 显式校验。TW-B 未修改该 runner 文件，只在 schema test 中锁定这个新事实。

### 第二阶段变更文件

- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 从 4 条基础测试扩展为 6 组合同驱动静态测试。
  - 测试内维护 `FIELD_CONTRACTS` 与 `DOCUMENT_CONTRACTS`，锁定 VIZA answer key、规范值、官网 DOM name、官网提交值、seed 字段类型、必填条件、0122/0123 material requirement。
  - 测试读取 seed、0122/0123 migration、runner `apply.ts`、runner `normalize.ts`、queue `halt-runners.ts`、Documents 筛选 action、动态表单姓名转换代码作为只读证据。

### 第二阶段验证命令与结果

- 命令：`npx vitest run src/tests/tw-entry-permit-schema.test.ts`
- 目录：`viza-be/agent-backend`
- 结果：通过，`1` 个测试文件，`6` 个测试全部 passed。

仍未执行：

- 未执行 seed。
- 未执行 migration。
- 未执行任何共享 Supabase 写操作。
- 未执行 git commit/stash/checkout/switch/reset/rebase/merge/add。
- 未部署，未真实官方提交。

## 唯一字段合同

说明：

- “规范值”是 VIZA answer value / normalizer 输入输出应保持的值。
- “官网提交值”是 runner 写入真实 DOM 的值；与规范值不同的字段由 runner 映射。
- “必填条件”中的 `always` 表示 seed 层应收集且 runner 到 CAPTCHA 前需要值；`conditional` 表示条件满足时必填。

| VIZA answer key | 规范值 | 官网 DOM name | 官网提交值 | 必填条件 |
|---|---|---|---|---|
| `continent` | `A/B/C/D/E` | `continent` | 同规范值 | always |
| `embassy_office` | `50/51/5A/5C/5F/55/56/53/52/67/57/58/66/54` | `overseaOfficeId` | 同规范值 | always |
| `first_time_applying` | `yes/no` | `applyCaseExtendTemp.firstApplyFlag` | `yes→Y`, `no→N` | always |
| `permit_type` | `1/2/H` | `traveller.applyVisa` | 同规范值 | always |
| `permit_count` | `1/2` | `traveller.applyCnt` | 同规范值 | always |
| `has_other_nationality_passport` | `yes/no` | `traveller.othPassportFlag` | `yes→Y`, `no→N` | always |
| `household_revoked` | `yes/no` | `householdRevoked` | `yes→Y`, `no→N` | always；官方必填“目前户口登记状态” |
| `eligibility_category` | `1/2/3/4` | `traveller.applyQualification` | `1→4`, `2→5`, `3→6`, `4→9` | always；驱动资格证明材料 |
| `name_chinese` | 繁体中文字符串 | `traveller.chineseName` | 同规范值 | always；前端 blur 简转繁，runner 不再转换 |
| `name_english` | 大写英文姓名 | `traveller.englishName` | 同规范值 | always；前端和 normalizer 均大写 |
| `date_of_birth` | ISO `YYYY-MM-DD` | `traveller.birthDate` | runner datepicker 填值 | always |
| `passport_number` | 字符串 | `traveller.passportNo` | 同规范值 | always |
| `passport_expiry_date` | ISO `YYYY-MM-DD` | `traveller.passportExpiryDate` | runner datepicker 填值 | always；seed 注明入境时剩余 6 个月以上 |
| `gender` | `0/1` | `traveller.gender` | 同规范值 | always |
| `overseas_residency_id_number` | 字符串 | `traveller.overseaIdNo` | 同规范值 | always |
| `mainland_id_number_not_applicable` | checkbox `true/false` | `traveller.noPersonIdFlag` | checked/unchecked | optional toggle；控制大陆身份证号码和大陆身份证材料 |
| `mainland_id_number` | 字符串 | `traveller.personId` | 同规范值 | conditional：未勾选 `mainland_id_number_not_applicable` |
| `birth_place_is_mainland` | `mainland/other` | `traveller.birthPlaceCode` | `mainland→1`, `other→5` | always |
| `birth_place_other_country` | nationality numeric code | `traveller.birthPlace1` | 同规范值 | conditional：`birth_place_is_mainland === other` |
| `local_mobile_phone` | 字符串 | `traveller.xtel` | 同规范值 | always |
| `current_occupation` | occupation numeric code | `traveller.occupation` | 同规范值 | always |
| `occupation_experience` | 字符串 | `traveller.resume` | 同规范值 | conditional：`current_occupation in [15,16,17,62]` |
| `company_name` | 字符串 | `careersInformations[0].unitTitle` | 同规范值 | seed optional；runner 会填；是否官方硬必填需页面验证 |
| `job_title` | 字符串 | `careersInformations[0].workTitle` | 同规范值 | seed optional；runner 会填；是否官方硬必填需页面验证 |
| `is_taiwanese_spouse` | `yes/no` | `traveller.partnerOfTaiwan` | `yes→Y`, `no→N` | always；官方有必填星号 |
| `traveling_with_parents` | `yes/no` | `traveller.accompanyMark` | `yes→Y`, `no→N` | optional |
| `overseas_address` | 字符串 | `traveller.address` | 同规范值 | always |
| `tw_contact_city` | `1..22` | `traveller.city` | 同规范值 | always |
| `tw_contact_district` | 字符串 | `traveller.township` | 同规范值 | optional |
| `tw_contact_village` | 字符串 | `traveller.village` | 同规范值 | optional |
| `tw_contact_neighborhood` | 数字字符串 | `traveller.neighborhood` | 同规范值 | optional |
| `tw_contact_road` | 字符串 | `traveller.road` | 同规范值 | always |
| `tw_contact_lane` | 数字字符串 | `traveller.lane` | 同规范值 | optional |
| `tw_contact_alley` | 数字字符串 | `traveller.alley` | 同规范值 | optional |
| `tw_contact_building_number` | 字符串 | `traveller.number` | 同规范值 | always |
| `tw_local_phone` | 字符串 | `traveller.twTelNo` | 同规范值 | optional |
| `tw_contact_mobile_not_applicable` | checkbox `true/false` | `traveller.noTwMobileFlag` | checked/unchecked | optional toggle |
| `tw_contact_mobile` | 字符串 | `traveller.twMobile` | 同规范值 | conditional：未勾选 `tw_contact_mobile_not_applicable` |
| `other_nationality_country` | nationality numeric code | `coaExtraPassportInfo.othNation` | 同规范值 | conditional：`has_other_nationality_passport === yes` |
| `other_passport_number` | 字符串 | `coaExtraPassportInfo.othPassportNo` | 同规范值 | conditional：`has_other_nationality_passport === yes` |
| `other_passport_expiry_date` | ISO `YYYY-MM-DD` | `coaExtraPassportInfo.othPassportExpiryDate` | runner datepicker 填值 | conditional：`has_other_nationality_passport === yes` |
| `kin_{father,mother,spouse,child1,child2}_status` | `1/2/3` | `kinships[i].deadMark` | 同规范值 | optional |
| `kin_*_name` | 字符串 | `kinships[i].chineseName` | 同规范值 | optional |
| `kin_*_date_of_birth` | ISO `YYYY-MM-DD` | `kinships[i].birthDate` | runner datepicker 填值 | optional |
| `kin_*_phone` | 字符串 | `kinships[i].telNo` | 同规范值 | optional |
| `kin_*_occupation` | occupation numeric code | `kinships[i].occupation` | 同规范值 | optional |
| `kin_*_service_unit` | 字符串 | `kinships[i].unitTitle` | 同规范值 | optional |
| `kin_*_job_title` | 字符串 | `kinships[i].workTitle` | 同规范值 | optional |
| `kin_*_current_address_same_as_overseas` | checkbox `true/false` | button `同申請人海外地址` | button click / copied address | optional helper |
| `kin_*_current_address` | 字符串 | `kinships[i].address` | 同规范值 | optional |
| `past_mainland_political_military_role` | checkbox `true/false` | `traveller.beenCnPartyJob` | checked/unchecked | optional toggle |
| `past_role_detail` | 字符串 | `traveller.beenCnPartyJobDesc` | 同规范值 | conditional：`past_mainland_political_military_role === true` |
| `current_mainland_political_military_role` | checkbox `true/false` | `traveller.cnPartyJob` | checked/unchecked | optional toggle |
| `current_role_detail` | 字符串 | `traveller.cnPartyJobDesc` | 同规范值 | conditional：`current_mainland_political_military_role === true` |
| `never_held_mainland_political_military_role` | checkbox `true/false` | `traveller.neverCnPartyJob` | checked/unchecked | optional declaration |
| `accepted_terms` | `true` | `agree` | checked | always；mustBeTrue |

## 材料合同

| requirement_key | required row | runner 必填条件 | 官方/业务含义 |
|---|---:|---|---|
| `photo` | true | always；作为 `photoFilePath` 上传 | 近期 2 寸白底彩色证件照 |
| `mainland_travel_document` | true | always | 大陆核发 6 个月以上旅行证件，或港澳非永久性居民旅行证件 |
| `eligibility_supporting_document_1` | true | `eligibility_category === "1"` | 留学生：有效学生签证/再入国签证 + 3 个月内在学证明 |
| `eligibility_supporting_document_2` | true | `eligibility_category === "2"` | 当地永久居留权证明 |
| `eligibility_supporting_document_3` | true | `eligibility_category === "3"` | 出入境查验章戳护照内页 + 工作签证 + 3 个月内公司在职证明 |
| `eligibility_supporting_document_4` | true | `eligibility_category === "4"` | 依亲居留权证明 + 财力证明 |
| `hk_macau_id_scan` | false | `embassy_office in {"50","51"}` | 港澳居民身份证正反面 + 有效港澳签证；未满 11 岁免附但目前未建模 |
| `other_nationality_passport_scan` | false | `has_other_nationality_passport === "yes"` | 其他国籍护照/证件 |
| `mainland_id_card_scan` | false | `mainland_id_number_not_applicable !== "true"` | 大陆身份证正反面 |
| `other_supporting_document` | false | optional/applicable | 例如日本 3 个月内住民票 |

## Runner 需要的必填/条件字段清单

Runner 到 CAPTCHA 前可靠自动填表至少需要：

- 表单必填：`continent`、`embassy_office`、`first_time_applying`、`permit_type`、`permit_count`、`has_other_nationality_passport`、`household_revoked`、`eligibility_category`、`name_chinese`、`name_english`、`date_of_birth`、`passport_number`、`passport_expiry_date`、`gender`、`overseas_residency_id_number`、`birth_place_is_mainland`、`local_mobile_phone`、`current_occupation`、`is_taiwanese_spouse`、`overseas_address`、`tw_contact_city`、`tw_contact_road`、`tw_contact_building_number`、`accepted_terms`。
- 条件表单字段：
  - `mainland_id_number` when `mainland_id_number_not_applicable !== "true"`。
  - `birth_place_other_country` when `birth_place_is_mainland === "other"`。
  - `occupation_experience` when `current_occupation in {"15","16","17","62"}`。
  - `tw_contact_mobile` when `tw_contact_mobile_not_applicable !== "true"`。
  - `other_nationality_country`、`other_passport_number`、`other_passport_expiry_date` when `has_other_nationality_passport === "yes"`。
  - `past_role_detail` when `past_mainland_political_military_role === "true"`。
  - `current_role_detail` when `current_mainland_political_military_role === "true"`。
- 文件必填：
  - `photo`、`mainland_travel_document`、`eligibility_supporting_document_${eligibility_category}`。
  - `hk_macau_id_scan` when `embassy_office in {"50","51"}`。
  - `other_nationality_passport_scan` when `has_other_nationality_passport === "yes"`。
  - `mainland_id_card_scan` when `mainland_id_number_not_applicable !== "true"`。

## 无法仅靠 schema 保证、需要 runner/页面验证的项目

- 官方页面字段是否真实可见/可选：seed 可以锁 key/value，但不能证明页面运行时没有被官方改 DOM、改枚举或新增星号；runner 仍需在 CAPTCHA 前做页面级验证/诊断。
- `household_revoked` 已进入 seed，且只读核对到并行 runner/normalizer 已显式 `requireYesNo` 并 strict 填入 `householdRevoked`。剩余风险是官方页面运行时是否仍保留该 DOM/name/value，需要 runner 页面验证。
- `company_name`、`job_title`：seed 目前 optional，runner 会填；前端 wizard 旧配置把它们 marked required，但真实动态表单以 DB seed 为准。是否官方硬必填应由 runner 以页面星号/提交前校验确认。
- 日期控件格式与实际填入成功：schema 锁 ISO `YYYY-MM-DD`，但 Playwright datepicker 成功与否只能由 runner smoke 验证。
- 台湾地址细项：schema 可标 road/building required，但无法保证官方因城市/乡镇联动引入新的 district 选择约束；需 runner 页面验证。
- 文件上传按描述文字定位：schema/migration 锁 requirement key 与描述，但 runner 实际上传仍依赖官网页面中的繁体描述 substring；若官方文案变动，需要 runner 诊断。
- 港澳身份证明“未满 11 岁免附”：当前缺少年龄豁免/监护材料模型；schema 只能在描述中提示，runner 当前按港澳办事处要求文件。
- 未成年人且无法定代理人/监护人陪同来台材料：runner 注释称现场只部分确认；本阶段未纳入 document_requirements。
- OTP、CAPTCHA boundary、同一 browser session 保持、最终不点击“确认资料”：均不是 schema 能保证的项目，归 TW-A/TW-02/TW-G0。

---

## 第三阶段更新 — 台湾生产数据合同与真实 Smoke 预检

- 状态：第三阶段 TW-B 已完成，等待主协调者整合与授权操作员真实 smoke。
- 更新时间：2026-08-01 13:30 Asia/Singapore。
- 本阶段边界：已重新读取 `docs/taiwan-launch-coordination.md` 和全部 TW worklog；只修改台湾 schema focused test 与本文 worklog。未修改 runner、前端、共享数据库或 migration。
- 生产前提：授权人员已验证 production `TW_ENTRY_PERMIT` 的 `document_requirements` 共 `10` 条，且资格材料为 `eligibility_supporting_document_1` 到 `_4`。

### 第三阶段变更文件

- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 从 `6` 组测试扩展为 `7` 组。
  - 新增 production 数据合同锁定：
    - 台湾 `document_requirements` 最终必须恰好是 `10` 条。
    - 四类资格材料 key 必须是 `eligibility_supporting_document_1`、`_2`、`_3`、`_4`。
    - 旧通用 key `eligibility_supporting_document` 只能被 `0123` 删除；不得再作为 runner required document 或 Documents 筛选目标出现。
    - 每条生产材料的 `required`、`sort_order`、中文 label/description 来源必须与 0122+0123 合同一致。
  - 继续锁定字段合同：VIZA answer key、规范值、官网 DOM name、官网提交值、seed required/conditional、官方枚举转换、姓名转换、日期、地址、资格类别 1-4、`household_revoked`、港澳/其他国籍/大陆身份证条件材料。

### 第三阶段验证命令与结果

- 命令：`npx vitest run src/tests/tw-entry-permit-schema.test.ts`
- 目录：`viza-be/agent-backend`
- 结果：通过，`1` 个测试文件，`7` 个测试全部 passed。

仍未执行：

- 未执行任何 SQL 写入。
- 未执行 seed。
- 未执行 migration。
- 未执行任何共享 Supabase 写操作。
- 未执行 git commit/stash/checkout/switch/reset/rebase/merge/add。
- 未部署，未处理 CAPTCHA，未点击官网最终提交。

## 生产数据合同

### document_requirements 最终 10 条

| requirement_key | required | sort_order | 条件/用途 |
|---|---:|---:|---|
| `photo` | true | 10 | always；官网照片上传 slot `documents[0].attachs[0]` |
| `mainland_travel_document` | true | 20 | always；大陆旅行证件或港澳非永久居民旅行证件 |
| `eligibility_supporting_document_1` | true | 30 | `eligibility_category === "1"`；留学生 |
| `eligibility_supporting_document_2` | true | 31 | `eligibility_category === "2"`；永久居留权 |
| `eligibility_supporting_document_3` | true | 32 | `eligibility_category === "3"`；1 年以上居留且工作证明 |
| `eligibility_supporting_document_4` | true | 33 | `eligibility_category === "4"`；依亲居留权 + 财力证明 |
| `hk_macau_id_scan` | false | 40 | `embassy_office in {"50","51"}`；港澳受理单位 |
| `other_nationality_passport_scan` | false | 50 | `has_other_nationality_passport === "yes"` |
| `mainland_id_card_scan` | false | 60 | `mainland_id_number_not_applicable !== "true"` |
| `other_supporting_document` | false | 70 | optional/applicable |

生产合同结论：

- `document_requirements` 必须恰好返回上述 `10` 个 key。
- `eligibility_supporting_document` 旧通用 key 不得存在于 production 结果。
- Documents 前端筛选和 runner 必填检查都必须使用 `eligibility_supporting_document_${eligibility_category}`。
- 资格类别使用 VIZA/seed 编码 `1/2/3/4`；官网 DOM `traveller.applyQualification` 使用官方值 `4/5/6/9`，由 runner 映射。

### 字段 → 官网 DOM → 官网值合同摘要

| 范围 | VIZA key / 条件 | 官网 DOM name | 官网提交值 |
|---|---|---|---|
| 港澳办事处 | `embassy_office=50/51` | `overseaOfficeId` | `50/51`；触发 `hk_macau_id_scan` |
| 其他国籍 | `has_other_nationality_passport=yes` | `traveller.othPassportFlag` | `Y`；触发其他国籍字段和 `other_nationality_passport_scan` |
| 无其他国籍 | `has_other_nationality_passport=no` | `traveller.othPassportFlag` | `N`；其他国籍字段/材料不应出现为必填 |
| 大陆身份证豁免 | `mainland_id_number_not_applicable=true` | `traveller.noPersonIdFlag` | checkbox checked；不要求 `mainland_id_number` / `mainland_id_card_scan` |
| 大陆身份证未豁免 | `mainland_id_number_not_applicable=false` | `traveller.noPersonIdFlag` + `traveller.personId` | checkbox unchecked + 身份证号；要求 `mainland_id_card_scan` |
| 资格 1 | `eligibility_category=1` | `traveller.applyQualification` | `4`；要求 `eligibility_supporting_document_1` |
| 资格 2 | `eligibility_category=2` | `traveller.applyQualification` | `5`；要求 `eligibility_supporting_document_2` |
| 资格 3 | `eligibility_category=3` | `traveller.applyQualification` | `6`；要求 `eligibility_supporting_document_3` |
| 资格 4 | `eligibility_category=4` | `traveller.applyQualification` | `9`；要求 `eligibility_supporting_document_4` |
| 户口状态 | `household_revoked=yes/no` | `householdRevoked` | `yes→Y`, `no→N` |
| 中文姓名 | `name_chinese` | `traveller.chineseName` | 前端 blur 简转繁后提交；runner只校验/填写收到值 |
| 英文姓名 | `name_english` | `traveller.englishName` | 前端/normalizer 转大写 |
| 日期 | `date_of_birth`、`passport_expiry_date`、`other_passport_expiry_date`、kinship DOB | 对应 `*.birthDate` / `*.ExpiryDate` | VIZA canonical `YYYY-MM-DD`；runner date helper 写入官网控件 |
| 台湾地址 | `tw_contact_city/road/building_number` 等 | `traveller.city/township/village/neighborhood/road/lane/alley/number` | city 为 `1..22`；road + number 必填 |
| 台湾手机豁免 | `tw_contact_mobile_not_applicable=true` | `traveller.noTwMobileFlag` | checkbox checked；不要求 `traveller.twMobile` |
| 职业经历 | `current_occupation in 15/16/17/62` | `traveller.resume` | 条件显示/填写 |
| 政党军政经历 | past/current checkbox true | `traveller.beenCnPartyJobDesc` / `traveller.cnPartyJobDesc` | 条件填写详情 |

## 只读生产复核 SQL

以下 SQL 只读，可由授权人员在 production 部署前后留档；TW-B 未执行。

```sql
SELECT requirement_key, label_zh, description, required, sort_order
FROM document_requirements
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT'
ORDER BY sort_order, requirement_key;
```

```sql
SELECT count(*) AS tw_requirement_count
FROM document_requirements
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT';
```

```sql
SELECT requirement_key
FROM document_requirements
WHERE country = 'taiwan'
  AND visa_type = 'TW_ENTRY_PERMIT'
  AND requirement_key IN (
    'photo',
    'mainland_travel_document',
    'eligibility_supporting_document_1',
    'eligibility_supporting_document_2',
    'eligibility_supporting_document_3',
    'eligibility_supporting_document_4',
    'hk_macau_id_scan',
    'other_nationality_passport_scan',
    'mainland_id_card_scan',
    'other_supporting_document'
  )
ORDER BY requirement_key;
```

```sql
SELECT requirement_key
FROM document_requirements
WHERE country = 'taiwan'
  AND visa_type = 'TW_ENTRY_PERMIT'
  AND requirement_key = 'eligibility_supporting_document';
```

预期：

- 第一条查询返回上述 10 条。
- count 为 `10`。
- 四个 `eligibility_supporting_document_1..4` 全部存在。
- 旧通用 `eligibility_supporting_document` 查询返回 `0` 行。

## 真实官网 CAPTCHA 前 Smoke 预检清单

### 操作员开始前的非敏感条件

- 使用授权的台湾官方测试/运营账号；账号、密码、OTP、cookie、storage state 不写入代码、日志、截图或 worklog。
- 使用经同意的安全测试申请资料；不得使用真实未授权客户资料做演练。
- 申请在 VIZA 中已有完整台湾答案，且 `TW_ENTRY_PERMIT` Documents 已上传并通过基本文件可读性检查。
- production `document_requirements` 只读复核已确认 10 条，且旧通用 key 不存在。
- 测试样本至少覆盖：
  - 非港澳办事处 + 无其他国籍 + 有大陆身份证。
  - 港澳办事处 `50` 或 `51` + 需要 `hk_macau_id_scan`。
  - 其他国籍护照 `yes` + 需要三项其他国籍字段和文件。
  - 大陆身份证豁免 `true` + 不要求大陆身份证号码/文件。
  - 资格类别 `1/2/3/4` 各一例，或至少在同一轮前后分别跑四个安全样本。
  - `household_revoked=yes` 和 `no` 至少各一例。
- 操作员明确知道边界：不得识别/填写 CAPTCHA，不得点击官网 `確認資料`。

### 每一步期望看到什么

| 步骤 | 期望 |
|---|---|
| 授权官网登录 | 官方会话进入可申请状态；VIZA 日志/metadata 只记录登录状态，不记录凭据/OTP |
| 同意条款 | 看到官方条款 modal，被勾选并进入递送地点 |
| 递送地点 | `continent` 与 `overseaOfficeId` 实际值等于 VIZA 合同值 |
| 邮箱 OTP | 邮箱字段显示已认证；OTP 不出现在持久日志 |
| 照片与基本状态 | 照片 input 已挂载文件；`first_time_applying`、`permit_type`、`permit_count`、`has_other_nationality_passport`、`eligibility_category`、`householdRevoked` 实际值符合合同 |
| 应检附文件 | 已挂载 `mainland_travel_document`、对应 `eligibility_supporting_document_${category}`，并按条件挂载港澳/其他国籍/大陆身份证文件 |
| 申请人资料 | 中英文姓名、生日、证件号、证件有效期、性别、居留证号、大陆身份证/出生地/职业等字段实际值匹配 |
| 台湾地址 | 城市、路/街、门牌号为必填且实际值匹配；乡镇/村里/邻/巷/弄等选填项不造成页面错误 |
| 其他国籍 block | 仅 `has_other_nationality_passport=yes` 时出现并填入国家、护照号、有效期 |
| 亲属资料 | 选填字段如提供则实际值匹配；同海外地址按钮不会覆盖错误 block |
| 申报事项 | past/current/never checkbox 与条件详情一致；`agree` 已勾选 |
| CAPTCHA boundary | 页面停在 CAPTCHA 与 `確認資料` 前；无 CAPTCHA 值、无最终提交 |

### 必须立即停止的结果

- 任一官网 DOM name 找不到、不可见、不可选，或填后实际值与合同不一致。
- 资格类别页面显示的材料与 `eligibility_supporting_document_${category}` 不一致，或出现旧通用资格材料要求。
- 条件材料缺失但页面要求上传，或页面新增未建模必填材料。
- `householdRevoked` 消失、值不再是 `Y/N`，或官方新增第三个必填户口状态值。
- 邮箱 OTP 未认证、账号登录异常、官方提示 session 过期。
- 页面进入 CAPTCHA 后又出现新的必填校验错误。
- 任一流程试图处理 CAPTCHA 或点击 `確認資料`。

## 成功证据模板

真实 smoke 完成后，授权操作员应保存脱敏证据，不写入敏感资料原文：

- 官网字段值验证摘要：字段 key、DOM name、期望官方值、实际官方值、matched/skipped 状态；不得包含证件号、地址、邮箱、OTP 等原值。
- 已挂载文件摘要：requirement_key、官网材料描述匹配结果、本地文件 basename/hash 或脱敏占位、mounted=true；不得保存客户文件原件到 Git。
- 停点证据：页面 URL/标题、存在 CAPTCHA、存在 `確認資料` 按钮、`pagesFilled` 包含 `captcha_boundary`。
- 无最终提交证据：无官方案号提交回执、无付款页面、无提交成功页面、无 `確認資料` 点击日志、无 CAPTCHA 求解字段。
- production 数据证据：只读 SQL 的 10 条结果截图或导出；旧通用 key 查询为 0 行。

## 未确认的官网动态字段与风险

- `company_name`、`job_title`：seed 仍为 optional；runner 可填但不强制。真实页面如标星或提交前强制，应由 runner page validation 报错并回传给 schema/产品决定是否改为 required。
- 港澳身份证明“未满 11 岁免附”：当前 schema/runner 没有年龄豁免模型；港澳办事处一律按需要文件处理。
- 未成年人且无法定代理人/监护人陪同来台材料：runner 注释里仍标记未完全确认，本阶段未加入 10 条 production requirement。
- 文件上传定位仍依赖官网繁体描述 substring；官方文案漂移会导致 runner 页面级上传验证失败。
- 台湾地址的 city/district 联动约束、date picker 实际格式、页面新增星号字段，只能由真实页面 smoke 或 runner strict helper 发现，不能由 schema 静态测试完全保证。
- `photo` 属于官网表单 slot 和 VIZA Documents 双重边界：schema 测试锁定不进入 `visa_form_fields`，runner 仍需验证官网 file input 已实际挂载。

---

## 并行检查 — 台湾 long-form 数据/API 是否返回空

- 状态：TW-B 数据/API 分支检查完成；等待 TW-C/TW-G 接回页面渲染问题。
- 更新时间：2026-08-01 19:58 Asia/Singapore。
- 本阶段边界：已重新读取台湾上线协调总览和全部 TW worklog；只修改台湾 schema focused test 与本文 worklog。未修改 runner、submission-service、前端 layout、共享数据库、migration、部署或其他 worklog。

### A. DB/API 是否非空

使用本地 `viza-fe/internal-website/.env.local` 指向的 Supabase host 做只读 REST 复核；未输出任何密钥值。

anon role 只读结果：

- `visa_form_fields?visa_type=eq.TW_ENTRY_PERMIT`：`91` 条。
- 第一阶段字段非空：
  - `continent`，`step_number=0`，`display_order=1`，`required=true`，`field_type=select`
  - `embassy_office`，`step_number=0`，`display_order=2`，`required=true`，`field_type=select`
- `visa_packages?country=eq.taiwan&visa_type=eq.TW_ENTRY_PERMIT`：`0` 条。
- `document_requirements?country=eq.taiwan&visa_type=eq.TW_ENTRY_PERMIT`：`0` 条。

service-role 只读结果：

- `visa_packages country=taiwan visa_type=TW_ENTRY_PERMIT`：`1` 条，`is_active=true`。
- `visa_form_fields visa_type=TW_ENTRY_PERMIT`：`91` 条。
- 第一阶段字段同上，`continent` / `embassy_office` 均存在。
- `document_requirements country=taiwan visa_type=TW_ENTRY_PERMIT`：`10` 条。
- `document_requirements` keys：
  - `photo`
  - `mainland_travel_document`
  - `eligibility_supporting_document_1`
  - `eligibility_supporting_document_2`
  - `eligibility_supporting_document_3`
  - `eligibility_supporting_document_4`
  - `hk_macau_id_scan`
  - `other_nationality_passport_scan`
  - `mainland_id_card_scan`
  - `other_supporting_document`

结论：

- 台湾 form fields 数据/API 本身不是空；`getVisaFormSteps("TW_ENTRY_PERMIT", { country: "taiwan" })` 应至少能拿到第一步字段。
- production/local long-form `input/select/textarea=0` 不应归因为 `visa_form_fields` 缺数据。
- anon 下 `visa_packages` / `document_requirements` 返回 0，service-role 下非空；这符合/指向 RLS/role 可见性差异，而不是数据缺失。

### B. 映射 / RLS / env 判断

只读源码结论：

- `app/actions/visa-form-fields.ts` 的 `getVisaFormSteps()`：
  - 调用 `resolveVisaFormSchemaVisaType(visaType, options.country)`。
  - 查询 `.from("visa_form_fields").eq("visa_type", schemaVisaType)`。
  - 按 `step_number`、`display_order` 排序。
  - 不依赖 `visa_packages.id`，也不按 `country` 过滤。
- `lib/visa-form-schema-aliases.ts` 只对 Vietnam eVisa 做 alias；未改写 `TW_ENTRY_PERMIT`，因此台湾 schemaVisaType 保持 `TW_ENTRY_PERMIT`。
- `0003_visa_form_fields.sql` 给 `visa_form_fields` 建了 public read policy：`FOR SELECT USING (true)`。
- `0006_visa_packages.sql` 中 `visa_packages_select` 是 `FOR SELECT TO authenticated`，所以 anon REST 查 package 为 0 不代表缺 package。
- 当前本地 env 指向同一 Supabase host：
  - `viza-fe/internal-website/.env.local`：`NEXT_PUBLIC_SUPABASE_URL` host 存在，anon key 存在，service key 存在。
  - `viza-be/agent-backend/.env.local` / `.env`：同一 host，service key 存在，anon key 未配置。

判断：

- 数据层可确认非空。
- `getVisaFormSteps` 参数大小写和 alias 映射没有发现台湾特有 bug。
- package/documents 在 anon 下不可见是 RLS/role 行为；前端 server actions 若需要 package/documents，会通过 authenticated session 或 admin/service client 路径读取，不能用 anon REST 的 0 行直接判定生产缺数据。
- 若页面视觉仍为 `input/select/textarea=0`，更可能是 long-form 页面层未完成 auth/context/loading、没有执行/完成 `getVisaFormSteps` hydration、或渲染分支没有进入动态表单主体；这应由 TW-C/TW-G 接回。

### C. 本阶段是否修复

- 未做 runtime 修复；没有发现台湾 seed/API/schema bug 会导致 `getVisaFormSteps(taiwan, TW_ENTRY_PERMIT)` 返回空。
- 已扩展 `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`：
  - 从 `8` 组测试扩展为 `9` 组。
  - 新增“long-form data/API contract”静态测试，锁定：
    - `visa_form_fields` RLS 为 public read。
    - `visa_packages` 为 authenticated read，解释 anon package 0 行。
    - 台湾 seed 第一阶段字段 `continent` / `embassy_office` 存在。
    - seed 展开结构包含五组 kinship fields。
    - `getVisaFormSteps` 必须查 `visa_form_fields.visa_type = schemaVisaType`，并按 step/order 排序。
    - schema alias 不得把 `TW_ENTRY_PERMIT` 改写成其他 visa type。

### D. 测试/查询结果

focused test：

```bash
cd viza-be/agent-backend
npx vitest run src/tests/tw-entry-permit-schema.test.ts
```

结果：

- 沙箱内第一次运行失败于 Vitest 临时配置写入 `EPERM`，不是测试断言失败。
- 允许写临时文件后重跑通过：`1` 个测试文件，`9` 个测试全部 passed。

只读 REST 查询结果摘要：

- anon：`visa_form_fields=91`、first step `continent/embassy_office` 非空；`visa_packages=0`、`document_requirements=0`。
- service-role：`visa_packages=1`、`visa_form_fields=91`、`document_requirements=10`。

未执行：

- 未执行任何 SQL 写入。
- 未执行 seed/migration。
- 未部署。
- 未读取或输出密钥值。
- 未触碰真实官网、CAPTCHA 或真实提交。

### E. 需要 TW-C/TW-G 接回

需要接回。TW-B 结论是数据/API 分支非空，`getVisaFormSteps` 的底层查询路径可命中台湾字段；当前 `input/select/textarea=0` 不像 schema seed 或 `visa_form_fields` 数据缺失。

建议 TW-C/TW-G 下一步只读/本地复核：

- 在 long-form 页面运行时记录脱敏 debug：`explicitCountry`、`explicitVisaType`、`packageLoaded`、`dbSteps.length`、`effectiveSteps.length`、`loading`、`error`，不要记录申请人答案。
- 确认浏览器端是否因为无登录用户、`loadApplicationFormContext()` 返回 error、或 `ensureDraftApplication()` 阻塞导致只显示 portal 导航。
- 在 server action 层用 mock Supabase 给 `getVisaFormSteps("TW_ENTRY_PERMIT", { country: "taiwan" })` 加一条前端/API focused test，验证返回 steps 后页面能进入 `DynamicStepForm`。这部分属于 TW-C/TW-G 前端/route 范围，TW-B 未改。

### 只读 SQL 给人工复核

```sql
SELECT id, country, visa_type, name, is_active
FROM visa_packages
WHERE country = 'taiwan'
  AND visa_type = 'TW_ENTRY_PERMIT';
```

```sql
SELECT step_number, field_name, field_type, required, display_order
FROM visa_form_fields
WHERE visa_type = 'TW_ENTRY_PERMIT'
ORDER BY step_number, display_order
LIMIT 20;
```

```sql
SELECT count(*) AS tw_form_field_count
FROM visa_form_fields
WHERE visa_type = 'TW_ENTRY_PERMIT';
```

```sql
SELECT requirement_key, required, sort_order
FROM document_requirements
WHERE country = 'taiwan'
  AND visa_type = 'TW_ENTRY_PERMIT'
ORDER BY sort_order, requirement_key;
```

预期：

- package 查询返回 `1` 条 active package。
- form field count 为 `91`。
- form fields 第一条至少包含 `continent` 和 `embassy_office`。
- document requirements 返回 `10` 条，且旧通用 `eligibility_supporting_document` 不存在。

---

## 资格 3 官网附件表截图核对 — 待用户确认后再改代码

- 状态：已收到用户提供的官网截图，截图文字清楚；本节只记录准备加入资格 3 的材料清单，不改产品代码。
- 更新时间：2026-08-03 14:20 Asia/Singapore。
- 本轮边界：只负责申请资格第 3 类「旅居国外或香港、澳门 1 年以上且领有工作证明」的官网「应检附文件」。未执行 DB 写入、migration、seed、部署、git 操作、台湾官网提交、OTP、CAPTCHA 或付款。
- 截图来源：用户上传 `Screenshot 2026-08-03 at 14.15.12.png`。

### 官网截图逐行抄录

| 行 | 红星 | 官网文字 | 当前资格 3 处理 |
|---:|---|---|---|
| 1 | 是 | `大陸地區所發尚餘6個月以上效期之旅行證件或香港、澳門政府核發之非永久性居民旅行證件` | 当前资格 3 必传 |
| 2 | 是 | `有現住地之出入境查驗章戳之護照內頁(證明旅居國外、香港或澳門一年以上)、工作簽證(例如：簽證、工作證或居留證)及3個月內公司在職證明` | 当前资格 3 必传 |
| 3 | 否 | `旅居香港或澳門之申請人，須附香港或澳門居民身分證(正、反面)及有效香港或澳門簽證(11歲以下免附)` | 当前资格 3 情形适用材料；仅在申请人旅居香港或澳门时要求 |
| 4 | 否 | `其他相關證明文件(若無要求則免附，申請人如旅居日本，請上傳3個月內住民票)` | 当前资格 3 情形适用材料；若无要求则免附；旅居日本时需住民票 |
| 5 | 否 | `具有他國國籍護(證)照文件` | 当前资格 3 情形适用材料；仅持有他国国籍护（证）照时要求 |
| 6 | 是 | `大陸身分證（正、反面）` | 当前资格 3 必传 |

### 准备加入/调整的资格 3 材料合同

原则：按用户确认，只照抄官网资格 3 截图里的附件表；不额外发明字段，不额外推导旧条件逻辑。

| VIZA requirement key | 官网行 | required | 资格 3 展示/处理 |
|---|---:|---:|---|
| `mainland_travel_document` | 1 | true | 按官网行文展示为资格 3 必传 |
| `eligibility_supporting_document_3` | 2 | true | 按官网行文展示为资格 3 必传，内容包含出入境查验章戳护照内页、工作签证、3 个月内公司在职证明 |
| `hk_macau_id_scan` | 3 | false | 按官网行文展示在资格 3 附件表中：旅居香港或澳门之申请人须附，11 岁以下免附 |
| `other_supporting_document` | 4 | false | 按官网行文展示在资格 3 附件表中：若无要求则免附；旅居日本请上传 3 个月内住民票 |
| `other_nationality_passport_scan` | 5 | false | 按官网行文展示在资格 3 附件表中：具有他国国籍护（证）照文件 |
| `mainland_id_card_scan` | 6 | true | 按官网行文展示为资格 3 必传 |

### 不准备自动加入的旧材料

- 未成年同意书：本截图未出现，不列入资格 3。
- 其他未在截图中出现的条件材料：不列入资格 3。
- 旧的泛化 `eligibility_supporting_document`：不恢复。
- 旧的泛化“可选补充材料区块”：不作为单独推断来源；仅保留截图第 4 行这个具体官网行。

### 用户确认记录

- 2026-08-03：用户确认 `mainland_id_card_scan` 按截图在资格 3 下作为必传材料处理。
- 2026-08-03：用户确认资格 3 附件表按官网截图逐行照抄，不新增字段，不发明额外逻辑。
- 2026-08-03：用户确认截图第 4 行按官网原文处理：`其他相關證明文件(若無要求則免附，申請人如旅居日本，請上傳3個月內住民票)`。

### 用户确认后的落地变更

- 状态：资格 3 官网附件表合同已落到台湾 schema/migration 静态合同；等待主协调/DB 发布负责人决定是否后续受控执行。
- 更新时间：2026-08-03 14:29 Asia/Singapore。
- 本轮边界：未改 runner、前端、submission-service、共享数据库、总览或其他 worklog；未执行 migration/seed/SQL 写入；未部署；未进入官网 OTP/CAPTCHA/付款/最终提交。

变更文件：

- `viza-be/agent-backend/drizzle/0127_tw_eligibility_3_document_requirements.sql`
  - 新增待授权执行的幂等台湾材料同步 SQL。
  - 只覆盖 `country='taiwan'`、`visa_type='TW_ENTRY_PERMIT'` 的 6 个既有 requirement key：
    - `mainland_travel_document`
    - `eligibility_supporting_document_3`
    - `hk_macau_id_scan`
    - `other_supporting_document`
    - `other_nationality_passport_scan`
    - `mainland_id_card_scan`
  - 红星必传按官网截图标记：`mainland_travel_document`、`eligibility_supporting_document_3`、`mainland_id_card_scan`。
  - 同表情形适用按官网截图保留：`hk_macau_id_scan`、`other_supporting_document`、`other_nationality_passport_scan`。
  - 不插入旧通用 `eligibility_supporting_document`；不碰申请答案、已上传文件、队列、用户、付款、OTP/CAPTCHA。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 新增资格 3 migration 静态测试，锁定 6 行截图合同、`official_eligibility_3_attachment_screenshot_2026_08_03` 来源标记、旧通用资格材料不得插入、不得改 applicant data。
  - 顺手修正台湾官方办事处枚举测试，使其覆盖当前 seed 中完整 28 个办事处，而不是旧亚洲子集。

验证命令与结果：

```bash
cd viza-be/agent-backend
npx vitest run src/tests/tw-entry-permit-schema.test.ts
```

结果：

- 第一次运行失败于两处旧/过宽测试断言：
  - `EMBASSY_OFFICES` 测试仍只期待亚洲 14 个值，但 seed 当前已有 28 个官方办事处。
  - 资格 3 测试禁止字符串过宽，把只读预检 SQL 注释里的旧通用 key 也当成风险。
- 修正断言后重跑通过：`1` 个测试文件，`13` 个测试全部 passed。

只读复核 SQL，供授权人员后续使用；TW-B 未执行：

```sql
SELECT requirement_key, label_zh, required, sort_order, metadata
FROM public.document_requirements
WHERE country = 'taiwan'
  AND visa_type = 'TW_ENTRY_PERMIT'
  AND requirement_key IN (
    'mainland_travel_document',
    'eligibility_supporting_document_3',
    'hk_macau_id_scan',
    'other_supporting_document',
    'other_nationality_passport_scan',
    'mainland_id_card_scan'
  )
ORDER BY visa_package_id NULLS LAST, sort_order, requirement_key;
```

需要主协调/TW-C 接回确认：

- 本轮只做 schema/migration 合同。当前前端 Documents 侧已存在资格 4 的页面归一化逻辑；资格 3 若要在页面上按截图把 `mainland_id_card_scan` 放入“必需材料”、把 3/4/5 行放入“情形适用材料”，仍需前端负责人在不改变材料 key 的前提下接回视觉/交互验证。
- `0127` 是待授权执行文本；不得由 TW-B 或自动代理执行 production SQL。

---

## 出生地选项合同落地 — 用户确认后执行

- 状态：出生地 seed/schema 合同已落地；等待 TW-A/TW-C/DB 发布负责人按各自范围接回。
- 更新时间：2026-08-03 14:45 Asia/Singapore。
- 用户确认：上一轮更正后的合同方案已确认，第四张截图中的 `無國籍/難民...` 项属于选择 `其他` 后第二个下拉的一部分。
- 本轮边界：未改前端组件/页面/旧 wizard，未改 runner/submission-service，未写 production DB，未执行 seed/migration/SQL，未部署，未进行 git commit/stash/reset/checkout，未进入台湾官网 OTP/CAPTCHA/付款/最终提交。

### 合同结论

- 一级字段：`出生地(同所持旅遊證件)`。
- VIZA key：`birth_place_is_mainland`。
- 官方 DOM：`traveller.birthPlaceCode`。
- VIZA canonical：`mainland / other`。
- 官方值：`mainland -> 1`（`中國大陸`），`other -> 5`（`其他`）。
- `中國大陸` 分支：
  - 新增 seed key：`birth_place_mainland_region`。
  - 官方 DOM：`traveller.birthPlace1`。
  - 候选来源：独立 `BIRTH_PLACE_MAINLAND_OPTIONS`，保留用户截图中的繁体大陆省市/自治区/地区名称。
  - 不和全球国家/地区/特殊身份列表混用。
- `其他` 分支：
  - 既有 seed key：`birth_place_other_country`。
  - 官方 DOM：`traveller.birthPlace1`。
  - 候选来源：复用台湾官方 numeric code `NATIONALITY_OPTIONS`。
  - 明确不得替换成 ISO alpha code。
  - 特殊身份项按用户截图繁体 label 锁定：
    - `994` → `無國籍-依1954年無國籍人士公約`
    - `995` → `難民-依1954年難民公約所定義`
    - `996` → `難民-非依1954年難民公約所定義`
    - `997` → `無國籍-不屬於代碼994、995及996者`
    - `999` → `無國籍`

### 变更文件

- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - 新增 `BIRTH_PLACE_MAINLAND_OPTIONS`，作为 `中國大陸` 分支二级候选来源。
  - `birth_place_is_mainland` 从旧 radio 合同调整为 select 合同，并在 `validation_rules` 中锁定官方 DOM `traveller.birthPlaceCode` 与官方值 `1/5`。
  - 新增 `birth_place_mainland_region`，仅 `birth_place_is_mainland === mainland` 时显示，使用 `BIRTH_PLACE_MAINLAND_OPTIONS`，官方 DOM 为 `traveller.birthPlace1`。
  - `birth_place_other_country` 增加 `validation_rules`，锁定 `其他` 分支使用 `NATIONALITY_OPTIONS`、官方 DOM `traveller.birthPlace1`，并禁止改用 ISO alpha code。
  - 将 `NATIONALITY_OPTIONS` 的特殊项 `994/995/996/997/999` label 改为用户截图繁体。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 更新 `birth_place_is_mainland` field type 预期为 `select`。
  - 新增/扩展测试锁定：
    - `traveller.birthPlaceCode`
    - `traveller.birthPlace1`
    - 官方值 `1/5`
    - 大陆分支与全球/特殊分支分离
    - `994/995/996/997/999` 特殊 code 与繁体 label
    - `NATIONALITY_OPTIONS` 不得被 ISO alpha code 替代

### 验证命令与结果

```bash
cd viza-be/agent-backend
npx vitest run src/tests/tw-entry-permit-schema.test.ts
```

结果：

- 第一次运行失败于测试 helper 对 `.map(...)` 常量解析过粗，把后面的 `NATIONALITY_OPTIONS` 误读成 `BIRTH_PLACE_MAINLAND_OPTIONS`；不是 seed 合同失败。
- 调整断言后重跑通过：`1` 个测试文件，`14` 个测试全部 passed。

### 需要接回的点

- TW-C/前端：动态表单需要视觉确认 `birth_place_is_mainland` 的 select、`birth_place_mainland_region` 与 `birth_place_other_country` 两个互斥二级下拉是否按预期展示；旧 wizard 若仍参与任何路径，需要同步同一合同，但本轮未碰。
- TW-A/runner：runner 当前已映射 `birth_place_is_mainland` 到 `traveller.birthPlaceCode`，并只在 `other` 分支填 `birth_place_other_country`；新增 `birth_place_mainland_region` 后，`mainland` 分支填 `traveller.birthPlace1` 需要 TW-A 在 runner 范围内接回，否则生产同步 seed 前不应启动需要该字段的真实 smoke。
- DB 发布负责人：production 元数据若需同步，应另行准备/授权台湾专属幂等 SQL；TW-B 本轮未准备也未执行 production 写入。
- Label 统一：`NATIONALITY_OPTIONS` 大多数国家/地区 label 仍是简体；本轮只按截图把 5 个特殊身份项改为繁体。若产品要求官网级繁体展示，后续需要用官方 DOM/HTML 统一全量 label。

---

## 现职条件字段与台湾联系地址 UI 合同

- 状态：schema seed、生产 metadata 预案、本地前端字段合同和 focused tests 已完成。
- 更新时间：2026-08-04 14:40 Asia/Singapore。
- 用户确认：本地官网截图规则直接生效；不再追加提问。
- 本轮边界：未执行 seed、SQL、migration、production DB 写入、部署、git commit/stash/reset/checkout/switch/rebase/merge；未改 runner/submission-service；未改 `long-form/page.tsx`、DocumentCenter 或材料布局文件；未进入台湾官网登录/OTP/CAPTCHA/付款/最终提交。

### 现职字段合同

官方 `current_occupation` canonical code 核对结果：

- `14` = `Student` / `学生`
- `61` = `Unemployed / job-seeking` / `待业`
- `62` = `Retired` / `退休`

字段显示/必填合同：

| current_occupation code | company_name | job_title |
|---|---|---|
| `14` 学生 | 显示，维持 required | 隐藏，不 required |
| `61` 待业 | 隐藏，不 required | 隐藏，不 required |
| `62` 退休 | 隐藏，不 required | 隐藏，不 required |
| 其他现职 | 显示，required | 显示，required |

落地方式：

- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - `company_name.conditional_logic.showIf = "current_occupation not in [61,62]"`
  - `company_name.validation_rules.required_when = "current_occupation not in [61,62]"`
  - `job_title.conditional_logic.showIf = "current_occupation not in [14,61,62]"`
  - `job_title.validation_rules.required_when = "current_occupation not in [14,61,62]"`
- `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
  - 对 stale/local DB row 增加同一条件 metadata override，避免生产 metadata 未同步时本地长表单仍把隐藏字段当成无条件必填。
- `viza-be/agent-backend/drizzle/0128_tw_occupation_company_title_conditional_metadata.sql`
  - 新增台湾专属幂等 SQL，范围仅 `visa_type='TW_ENTRY_PERMIT'` 且 `field_name IN ('company_name','job_title')`。
  - 只更新 metadata；不碰申请答案、文件、队列、用户、付款、runner 状态、OTP/CAPTCHA。
  - 仅供授权 DB 发布负责人后续人工执行；TW-B 未执行。

### 台湾联系地址 UI 合同

用户界面要求：

- `tw_contact_city` / 县市：下拉关闭后的已选文字和展开后的选项显示简体中文，例如 `臺北市 -> 台北市`。
- `tw_contact_district` / 乡镇市区：下拉关闭后的已选文字和展开后的选项显示简体中文，例如 `中山區 -> 中山区`。
- 只改 UI label/text；canonical value、县市到区乡镇市联动 key、保存答案和台湾官网提交值保持原合同。
- 不改出生地全球列表、特殊身份项或其他已确认需繁体的官网选项。

落地方式：

- `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
  - `tw_contact_city.options` 使用简体 `text/label_zh`，保留原 `official_label`。
  - `tw_contact_district.validationRules.dependent_options` 使用简体 `text/label_zh`，保留原繁体 value 与 `official_label`。
  - `dependent_on = "tw_contact_city"`、`dependent_options_key = "taiwan_districts_by_city"` 保持不变。
  - 简体映射覆盖全量台湾县市/区乡镇清单中常见繁简差异；测试锁定 `臺北市`、`中山區`、`中壢區`、`麥寮鄉` 等不会只改截图示例。

### 测试更新

变更/新增测试：

- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 锁定 `company_name`、`job_title` 的条件 metadata。
  - 锁定 occupation code `14/61/62`。
  - 锁定 `0128` 只触碰台湾表单 metadata，且包含人工验证 SQL/回滚说明。
- `viza-fe/internal-website/lib/__tests__/form-utils.test.ts`
  - 覆盖 `not in [..]` showIf：学生、待业、退休、普通职业。
- `viza-fe/internal-website/lib/__tests__/application-completeness.test.ts`
  - 覆盖隐藏字段不再阻断 completeness/required。
- `viza-fe/internal-website/lib/__tests__/bilingual-schema-contract.test.ts`
  - 覆盖 stale DB row 的 occupation metadata override。
  - 覆盖台湾联系地址 UI 简体显示、canonical value/official_label 不变、联动 key 不变。
- `viza-fe/internal-website/components/__tests__/dynamic-step-form-tw-occupation-conditions.test.tsx`
  - 覆盖学生：职位不可见、公司可见、无 Maximum update depth error。
  - 覆盖退休/待业：职位和公司都不可见。
  - 覆盖普通职业：职位和公司都可见且 required。
  - 覆盖台湾联系地址下拉关闭/展开均为简体显示，值仍为官方 canonical。

验证命令与结果：

```bash
cd viza-fe/internal-website
npx vitest run lib/__tests__/form-utils.test.ts lib/__tests__/bilingual-schema-contract.test.ts lib/__tests__/application-completeness.test.ts components/__tests__/dynamic-step-form-tw-occupation-conditions.test.tsx
```

结果：`4` 个测试文件通过，`31` 个测试 passed。

```bash
cd viza-be/agent-backend
npx vitest run src/tests/tw-entry-permit-schema.test.ts
```

结果：`1` 个测试文件通过，`15` 个测试 passed。

### 人工 DB 步骤

只读预检 SQL，供授权人员使用；TW-B 未执行：

```sql
SELECT visa_type, field_name, required, validation_rules, conditional_logic
FROM public.visa_form_fields
WHERE visa_type = 'TW_ENTRY_PERMIT'
  AND field_name IN ('company_name', 'job_title')
ORDER BY field_name;
```

若 production metadata 仍为旧合同，授权人员可人工执行：

- 文件：`viza-be/agent-backend/drizzle/0128_tw_occupation_company_title_conditional_metadata.sql`
- 执行前确认只包含 `TW_ENTRY_PERMIT` + `company_name/job_title`。
- 执行后使用文件内 post-flight SQL 确认：
  - `company_name.required_when/showIf = current_occupation not in [61,62]`
  - `job_title.required_when/showIf = current_occupation not in [14,61,62]`

回滚注意：

- 只能在授权后按 `0128` 文件注释中的 metadata-only rollback SQL 操作。
- 回滚会让 production 回到旧的无条件必填风险；真实 smoke 前不建议回滚，除非发现官网 DOM 与本地截图规则冲突。

### 需要接回的点

- DB 发布负责人：如 production metadata 仍 stale，需要人工执行 `0128`；TW-B 未执行。
- TW-A/runner：本轮未改 runner。若 runner normalizer 或 payload validator 仍把 `company_name/job_title` 当无条件必填，需要在 runner 范围内按同一 `14/61/62` 合同接回，否则真实 smoke 可能在隐藏字段上误阻断。
- TW-C/前端：本轮只改字段合同/组件 focused test，不碰 layout；可在长表单视觉回归中确认 `tw_contact_city/tw_contact_district` 下拉已选和展开项均显示简体。

---

## 真实姓名、出生地大陆二级、父母存活条件与学生学校名合同

- 状态：seed 与 schema focused tests 已更新。
- 更新时间：2026-08-05 20:40 Asia/Singapore。
- 本轮边界：已重新读取协调总览和全部 TW worklog；未改 runner/submission-service、long-form layout、Documents、production DB、部署或其他 worklog；未执行 seed、migration、SQL 写入、官网登录、OTP、CAPTCHA、付款或最终提交。

### 核对结论

1. `name_chinese`
   - 现有 seed 只有 `required: true`，不足以表达官网要求。
   - 已补 metadata：
     - `official_dom_name = traveller.chineseName`
     - `requires_traditional_chinese_name = true`
     - `disallow_latin_only = true`
     - `disallow_latin_replacement = true`
   - 合同结论：必须是申请人的真实繁体中文姓名；不能只填非空值，不能用英文名、拼音或其他拉丁字母替代。

2. `birth_place_is_mainland` / `birth_place_mainland_region`
   - 现有 seed 已存在大陆分支二级字段 `birth_place_mainland_region`，官方 DOM 为 `traveller.birthPlace1`。
   - 已补 `birth_place_mainland_region.validation_rules.required_when = "birth_place_is_mainland === mainland"`。
   - 合同结论：出生地一级选择 `中國大陸` 时，二级大陆省市/自治区/地区必须填写；`其他` 分支仍使用 `birth_place_other_country` + `NATIONALITY_OPTIONS`。

3. 父/母亲属字段
   - 旧合同只把 `kin_father_status`、`kin_mother_status` 标为 required，父母其他字段仍 optional；这与用户提供的官网截图规则不一致。
   - 已把父/母 status 为 `存` 的条件合同写入 seed：
     - `kin_{father,mother}_name` required when `kin_{father,mother}_status === 1`
     - `kin_{father,mother}_date_of_birth` required when `kin_{father,mother}_status === 1`
     - `kin_{father,mother}_phone` required when `kin_{father,mother}_status === 1`
     - `kin_{father,mother}_occupation` required when `kin_{father,mother}_status === 1`
     - `kin_{father,mother}_current_address` required when `kin_{father,mother}_status === 1 && kin_{father,mother}_current_address_same_as_overseas === false`
   - 父/母 `current_address_same_as_overseas` 作为官网“同申请人海外地址”辅助开关保留；勾选后由现有 normalize 语义复制申请人海外地址，不要求手填地址。

4. 父/母服务单位与职称
   - 已按 occupation code 写入条件合同：
     - 自由业 `15`、其他业 `16`、无 `17`：不要求服务单位/职称。
     - 退休 `62`：仍要求退休前服务单位/职称。
     - 其他父/母现职：要求服务单位/职称。
   - seed 条件：
     - `kin_{father,mother}_service_unit.required_when = kin_{father,mother}_status === 1 && kin_{father,mother}_occupation not in [15,16,17]`
     - `kin_{father,mother}_job_title.required_when = kin_{father,mother}_status === 1 && kin_{father,mother}_occupation not in [15,16,17]`

5. 学生学校名
   - 既有合同已确认 `current_occupation = 14` 时 `job_title` 不显示、不必填，`company_name` 仍显示且必填。
   - 已补 `company_name` metadata：
     - `student_school_name_required_when = "current_occupation === 14"`
     - `accepted_scripts_when_student = ["traditional_chinese", "english"]`
   - 合同结论：学生的 `company_name` 必须填正式学校全名；官网只接受繁体中文或英文，不应填简称、空值或无关占位符。

### 变更文件

- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - 补 `name_chinese` 真实繁体中文姓名 metadata。
  - 补 `birth_place_mainland_region` 条件必填 metadata。
  - 补 `company_name` 在学生场景的正式学校名和脚本要求 metadata。
  - 修正父/母亲属字段：status=存 时姓名、生日、电话、现职、居住地址条件必填；服务单位/职称按 occupation code 条件必填。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 锁定上述 seed 合同。
  - 锁定大陆出生地二级在 normalizer 中已要求 `birth_place_mainland_region`。
  - 不把 runner 已支持大陆二级填表作为已完成事实；该项仍需 TW-A 接回。
- `docs/taiwan-launch-worklogs/TW-B.md`
  - 记录本轮核对、变更、验证、阻断项和需要用户补充的真实资料 key。

### 验证命令与结果

第一次运行因当前沙箱禁止 Vitest 在仓库目录写临时 config 文件而失败：

```bash
cd viza-be/agent-backend
npx vitest run src/tests/tw-entry-permit-schema.test.ts
```

失败原因：`EPERM`，无法写入 `vitest.config.ts.timestamp-*.mjs`。

随后只为运行 focused test 提升权限，未执行 seed/migration/SQL：

```bash
cd viza-be/agent-backend
npx vitest run src/tests/tw-entry-permit-schema.test.ts
```

结果：`1` 个测试文件通过，`15` 个测试 passed。

### 需要用户补充的真实资料 key

这些值不能由 schema、runner 或 AI 猜测，必须由申请人/操作员提供真实资料：

- `name_chinese`：申请人真实繁体中文姓名。
- `birth_place_mainland_region`：当 `birth_place_is_mainland = mainland` 时的大陆出生省市/自治区/地区。
- `company_name`：当 `current_occupation = 14` 时，正式学校全名，且需为繁体中文或英文。
- `kin_father_status`、`kin_mother_status`：父/母存殁状态。
- 若父亲为 `存`：
  - `kin_father_name`
  - `kin_father_date_of_birth`
  - `kin_father_phone`
  - `kin_father_occupation`
  - `kin_father_current_address`，除非使用 `kin_father_current_address_same_as_overseas = true`
  - `kin_father_service_unit`、`kin_father_job_title`，当 `kin_father_occupation not in [15,16,17]`；其中 `62` 退休须填退休前单位/职称。
- 若母亲为 `存`：
  - `kin_mother_name`
  - `kin_mother_date_of_birth`
  - `kin_mother_phone`
  - `kin_mother_occupation`
  - `kin_mother_current_address`，除非使用 `kin_mother_current_address_same_as_overseas = true`
  - `kin_mother_service_unit`、`kin_mother_job_title`，当 `kin_mother_occupation not in [15,16,17]`；其中 `62` 退休须填退休前单位/职称。

### 阻断与接回项

- Production metadata 仍需授权人员决定是否同步；TW-B 本轮没有准备或执行新的 production SQL。
- TW-A/runner：当前只读核对显示 runner/`apply.ts` 仍只在 `birth_place_is_mainland === "other"` 时填 `traveller.birthPlace1`；大陆分支 `birth_place_mainland_region` 的官网填表需在 runner 范围接回。
- TW-A/runner：父母 status=存 后新增条件必填字段是否需要在 runner normalizer 层硬校验，属于 runner 范围；本轮只写 seed/schema 合同。
- TW-C/前端：若 production DB 尚未同步这些条件 metadata，长表单视觉/completeness 可能仍依赖旧字段合同；本轮未改前端兜底层或 layout。

---

## 0130 metadata migration 预案

- 状态：新增台湾专属幂等 metadata migration 与静态测试；未执行。
- 更新时间：2026-08-05 23:20 Asia/Singapore。
- 编号核对：`viza-be/agent-backend/drizzle` 当前最高编号为 `0129`，历史上已有两个 `0126` 文件；下一个未占用编号采用 `0130`。
- 本轮边界：未执行 migration、seed、SQL、production DB 写入、部署、git 操作；未改 runner/submission-service、frontend、long-form layout、Documents 或其他 worklog。

### 新增文件

- `viza-be/agent-backend/drizzle/0130_tw_identity_birthplace_parent_student_metadata.sql`

同步范围仅限 `public.visa_form_fields` 中 `visa_type='TW_ENTRY_PERMIT'` 的 19 个字段：

- `name_chinese`
- `birth_place_mainland_region`
- `company_name`
- `kin_father_name`
- `kin_father_date_of_birth`
- `kin_father_phone`
- `kin_father_occupation`
- `kin_father_service_unit`
- `kin_father_job_title`
- `kin_father_current_address_same_as_overseas`
- `kin_father_current_address`
- `kin_mother_name`
- `kin_mother_date_of_birth`
- `kin_mother_phone`
- `kin_mother_occupation`
- `kin_mother_service_unit`
- `kin_mother_job_title`
- `kin_mother_current_address_same_as_overseas`
- `kin_mother_current_address`

同步内容：

- `name_chinese`：真实繁体中文姓名 metadata；禁止拉丁字母/英文名占位替代。
- `birth_place_mainland_region`：`birth_place_is_mainland === mainland` 时显示并 required。
- `company_name`：保留 `current_occupation not in [61,62]` 条件，并补学生 `current_occupation === 14` 时正式学校名规则；接受脚本为 `traditional_chinese` 或 `english`。
- 父/母为 `存`：
  - 姓名、生日、电话、现职 required。
  - 地址在未勾选同申请人海外地址时 required。
  - 服务单位/职称在 occupation 不属于 `15/16/17` 时 required；退休 `62` 明确要求退休前单位/职称。

安全特性：

- 使用 `ON CONFLICT (visa_type, field_name) DO UPDATE SET` 幂等 upsert。
- 不含 `DELETE FROM`。
- 不触碰 `visa_application_answers`、`application_documents`、`document_requirements`、`runner_job`、用户、付款、OTP、CAPTCHA 或上传文件。
- 文件内包含 pre-flight 只读 SQL、post-flight 验证 SQL 与 metadata-only rollback SQL。

### 静态测试

变更文件：

- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`

新增测试覆盖：

- `0130` 文件存在且只包含 `TW_ENTRY_PERMIT`。
- 目标字段恰好 19 个且无重复。
- 锁定 `name_chinese`、`birth_place_mainland_region`、`company_name`、父/母详情字段、地址、单位/职称的 validation/conditional metadata。
- 锁定无 `DELETE FROM`，不更新 applicant answers/documents，不插入 runner job，不碰 `document_requirements`。
- 锁定文件内有验证和回滚说明。

验证命令与结果：

```bash
cd viza-be/agent-backend
npx vitest run src/tests/tw-entry-permit-schema.test.ts
```

结果：`1` 个测试文件通过，`16` 个测试 passed。

### 人工执行提示

TW-B 未执行。若后续由授权 DB 发布负责人执行，应先保存 `0130` 文件内 pre-flight 查询结果，再执行该 SQL，最后跑文件内 post-flight 验证 SQL。失败或需要回退时，只能在授权后按文件内 rollback SQL 做 metadata-only 回滚。
