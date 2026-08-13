# TW-C Worklog — 前端真实体验审计 / 前端发布体验

- 状态：production 台湾 `visa_form_fields` 元数据 `0124` 同步已执行成功；执行后验证全部通过，等待 TW-A production 视觉复核。
- 负责人：Codex / TW-C。
- 边界确认：第一阶段只做审计/测试；第二阶段按新指派修改台湾前端结果卡、台湾提交状态展示逻辑、台湾 focused tests 和本 worklog；第三阶段只补台湾 Documents 覆盖、新增受控 QA runbook 和本 worklog；后续修复台湾长表单中文题目派生优先级；之后按 TW-A 官网审计修复台湾长表单题目/required 合同；再处理 TW-A 复核后的父/母亲属状态 required 与 `occupation_experience` 条件规则；再处理 long-form 空白的前端 layout/form-request gating 分支；再处理台湾 long-form `mainland_id_number`、`company_name`、`job_title` required badge/validation；再处理台湾地址县市/区乡镇市联动、`tw_local_phone`/`tw_contact_mobile` 反向条件必填、其他国籍条件组 required、父/母存殁 required 兜底；随后只读核对 production `visa_form_fields` 元数据并准备台湾专属幂等同步 SQL；本次在用户明确授权后执行 `0124` production 元数据同步并验证通过。全程未修改 runner、submission-service、支付、feature flag、部署配置或其他 AI worklog；未读取或输出申请人答案、材料、密钥、Cookie、OTP。
- 基线确认：开始时 `git status --short` 已存在多处未提交/未跟踪台湾相关文件；本 worklog 只统计 TW-C 范围内的前端和文档变更。
- 更新时间：2026-08-03 08:59 Asia/Singapore。

## Production `0124` 台湾字段元数据同步执行（2026-08-03）

### 授权与边界

- 授权来源：用户明确回复“批准执行 0124 生产同步”。
- 执行目标：production Supabase project `viza-production` / `oyjxdzsoejraedqghndi`。
- 执行文件：`viza-be/agent-backend/drizzle/0124_tw_entry_permit_form_fields_metadata_sync.sql`。
- 执行范围：仅 `public.visa_form_fields` 且 `visa_type='TW_ENTRY_PERMIT'`。
- 本次未读取或输出申请人答案、材料、密钥、Cookie、OTP；未部署、未提交台湾官网、未处理 CAPTCHA、未付款、未执行 git commit/stash/reset/checkout。

### 执行前 snapshot / 计数

- 执行前只读计数：
  - `TW_ENTRY_PERMIT` 字段元数据总数：`91` rows。
- 执行前目标字段状态匹配预期旧状态，因此允许继续：
  - `household_revoked`：不存在。
  - `tw_contact_district`：`field_type=text`，缺 `dependent_options_key`。
  - `tw_local_phone`：缺 `required_when`。
  - `mainland_id_number`、`company_name`、`job_title`、`kin_father_status`、`kin_mother_status`：`required=false`。
  - `occupation_experience`：旧触发 `current_occupation in [15,16,17,62]`。
  - `tw_contact_city`：已有 22 options，但仍需同步当前繁体/联动合同。
- 执行前 metadata snapshot 已通过只读查询取得，范围仅为 `visa_form_fields` 的 `TW_ENTRY_PERMIT` 元数据；未包含申请答案或文件数据。

### Production 写入结果

- 执行时间：`2026-08-03 08:59 +08`。
- 执行返回：
  - `tw_entry_permit_form_fields_metadata_rows_upserted = 28`。
- 执行后只读计数：
  - `TW_ENTRY_PERMIT` 字段元数据总数：`92` rows。
  - 与预期一致：新增 `household_revoked` 1 行，其余目标字段为 metadata update/upsert。

### 执行后验证结果

执行后验证 SQL 返回全部通过：

- `household_revoked_present = true`
  - `field_type=radio`
  - `required=true`
  - `step_number=1`
  - `display_order=5`
  - `options_count=2`
- `eligibility_category_shifted = true`
  - `display_order=6`
- `tw_contact_city_traditional_options = true`
  - `field_type=select`
  - `required=true`
  - `options_count=22`
  - 包含 `value=16 / 高雄市`
- `district_linked_select = true`
  - `tw_contact_district field_type=select`
  - `required=false`
  - `validation_rules.dependent_on=tw_contact_city`
  - `validation_rules.dependent_options_key=taiwan_districts_by_city`
- `landline_reverse_required = true`
  - `tw_local_phone required=false`
  - `validation_rules.required_when=tw_contact_mobile_not_applicable === true`
- `required_flags_fixed = true`
  - `mainland_id_number required=true`
  - `company_name required=true`
  - `job_title required=true`
  - `kin_father_status required=true`
  - `kin_mother_status required=true`
- `mainland_id_condition_fixed = true`
  - `mainland_id_number conditional_logic.showIf=mainland_id_number_not_applicable === false`
- `occupation_experience_retired_only = true`
  - `occupation_experience required=true`
  - `conditional_logic.showIf=current_occupation === 62`
- `other_passport_condition_fixed = true`
  - `other_passport_number required=true`
  - `conditional_logic.showIf=has_other_nationality_passport === yes`
- `all_checks_passed = true`

### 重点字段最终 production 状态

- `household_revoked`：存在，radio，required。
- `tw_contact_district`：select，保留 optional，但已带 `taiwan_districts_by_city` 联动 key。
- `tw_local_phone`：默认 optional，勾选无在台手机时由 `required_when` 变 required。
- `mainland_id_number`：显示时 required，仍由 `mainland_id_number_not_applicable === false` 控制。
- `company_name` / `job_title`：required。
- `kin_father_status` / `kin_mother_status`：required；父/母其他亲属字段未扩大 required。
- `occupation_experience`：仅 `current_occupation === 62`（退休）时显示/required。

### 异常与后续

- 异常：无。
- 未做本地代码变更或部署；本次只执行已批准的 production metadata sync 并更新审计文档。
- 下一步：请 TW-A 在 production long-form 做视觉复核，确认 `household_revoked`、台湾地址联动、电话反向必填、第二步 required badge、父/母存殁 required 和退休经历触发均在页面真实渲染。

## Production `visa_form_fields` 元数据同步准备（2026-08-02）

### 本次计划与边界

1. 按要求先阅读 Supabase skill/instructions；本次涉及 Supabase，因此只用只读 SQL 核对 production 元数据，不读取或输出申请人答案、文件、账号、OTP、Cookie、密钥或截图。
2. 对照 production `public.visa_form_fields` 与当前 `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`，只列字段元数据差异。
3. 找既有执行模式：台湾 seed runner 目前是 delete + insert，不适合 production；仓库已有 Drizzle SQL migration 和 `ON CONFLICT` upsert 模式。
4. 准备台湾专属幂等同步 SQL，但本阶段不执行 production 写入。

### Supabase 只读生产核对结果

- Supabase project：`viza-production` / `oyjxdzsoejraedqghndi`。
- 只读计数：production 当前 `visa_form_fields where visa_type = 'TW_ENTRY_PERMIT'` 为 `91` rows。
- 只读字段抽查结果：
  - `household_revoked`：production 缺失。
  - `tw_contact_district`：production 仍为 `field_type=text`，缺 `dependent_options_key=taiwan_districts_by_city`。
  - `tw_local_phone`：production 仍为 `required=false` 且缺 `validation_rules.required_when = "tw_contact_mobile_not_applicable === true"`。
  - `mainland_id_number`：production `required=false`，虽有旧 `showIf`，但与 seed 的显示时必填合同不一致。
  - `company_name` / `job_title`：production `required=false`。
  - `kin_father_status` / `kin_mother_status`：production `required=false`，options 为 3 项。
  - `occupation_experience`：production `required=false`，旧触发为 `current_occupation in [15,16,17,62]`；当前 seed 已收窄为退休 `current_occupation === 62` 且显示时 required。
  - `tw_contact_city`：production 为 select 且 22 options，但 options/展示仍需同步当前繁体县市合同。
- 未读取 application answers、documents、queue payload、用户表、密钥、OTP、Cookie 或截图。

### Production 与当前 seed 的差异清单

需要同步到 production 的字段元数据共 `28` 行：

- Step 1：`household_revoked` 新增；`eligibility_category` display_order 从 5 后移到 6。
- Step 2：`passport_number`、`passport_expiry_date`、`overseas_residency_id_number`、`mainland_id_number`、`birth_place_is_mainland`、`occupation_experience`、`company_name`、`job_title`、`is_taiwanese_spouse`、`overseas_address`。
- Step 3：`tw_contact_city`、`tw_contact_district`、`tw_contact_village`、`tw_contact_road`、`tw_contact_building_number`、`tw_local_phone`。
- Step 4：`other_passport_number`、`other_passport_expiry_date`。
- Step 5：`kin_father_status`、`kin_mother_status`。
- Step 6：`past_mainland_political_military_role`、`past_role_detail`、`current_mainland_political_military_role`、`current_role_detail`、`never_held_mainland_political_military_role`、`accepted_terms`。

父/母其他亲属字段不在同步 required 范围内，仍保持 optional。

### 既有执行方式与安全结论

- 不采用 `scripts/seed-tw-entry-permit-form-fields.ts` 直接跑 production：该 runner 会先 `.delete().eq("visa_type", VISA_TYPE)` 再 insert，存在删除/重插窗口，不适合线上受控同步。
- 采用仓库现有 Drizzle SQL migration 风格，并使用 `ON CONFLICT (visa_type, field_name) DO UPDATE`：
  - 只作用 `visa_type='TW_ENTRY_PERMIT'`。
  - 不 `DELETE` 字段。
  - 不修改 `application_*`、`document_requirements`、queue、package、payment 或 runner 表。
  - 已存在字段保留 `id` 和 `created_at`，只更新 `label`、`field_type`、`required`、`step_number`、`step_name`、`display_order`、`placeholder`、`validation_rules`、`options`、`conditional_logic`、`updated_at`。
  - `household_revoked` 缺失时 insert。

### 已准备文件

- `viza-be/agent-backend/drizzle/0124_tw_entry_permit_form_fields_metadata_sync.sql`
  - 预期执行结果：返回 `tw_entry_permit_form_fields_metadata_rows_upserted = 28`。
  - 本次没有执行该 SQL。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 新增测试锁定 `0124`：
    - 包含 `ON CONFLICT (visa_type, field_name) DO UPDATE`。
    - 只含 `TW_ENTRY_PERMIT` 行。
    - 不含 `DELETE FROM`。
    - 不含 `visa_application_answers`、`application_documents`、`document_requirements`。
    - 覆盖 `household_revoked`、`tw_contact_district`、`tw_local_phone`、`mainland_id_number`、`company_name`、`job_title`、`kin_father_status`、`kin_mother_status`。

### 执行前查询

授权生产同步前，先保存以下只读结果作为回滚依据和影响范围确认：

```sql
select jsonb_agg(to_jsonb(vff) order by step_number, display_order, field_name) as tw_entry_permit_form_fields_snapshot
from public.visa_form_fields vff
where visa_type = 'TW_ENTRY_PERMIT';
```

```sql
with expected(field_name) as (
  values
    ('household_revoked'),
    ('tw_contact_district'),
    ('tw_local_phone'),
    ('mainland_id_number'),
    ('company_name'),
    ('job_title'),
    ('kin_father_status'),
    ('kin_mother_status'),
    ('occupation_experience'),
    ('tw_contact_city')
)
select e.field_name,
       f.field_type,
       f.required,
       f.step_number,
       f.display_order,
       case when f.options is null then null else jsonb_array_length(f.options) end as options_count,
       f.validation_rules ->> 'required_when' as required_when,
       f.validation_rules ->> 'dependent_options_key' as dependent_options_key,
       f.conditional_logic ->> 'showIf' as show_if,
       f.id is not null as exists_in_production
from expected e
left join public.visa_form_fields f
  on f.visa_type = 'TW_ENTRY_PERMIT'
 and f.field_name = e.field_name
order by e.field_name;
```

### 待授权执行方式

只在主协调明确授权 production 同步后，由授权操作者通过受控 migration 流程执行：

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f viza-be/agent-backend/drizzle/0124_tw_entry_permit_form_fields_metadata_sync.sql
```

若团队使用 Supabase SQL Editor 或既有 Drizzle release pipeline，也应执行同一个 SQL 文件内容；不要运行台湾 seed runner。

### 执行后验证 SQL

```sql
with checks as (
  select
    exists (
      select 1 from public.visa_form_fields
      where visa_type = 'TW_ENTRY_PERMIT'
        and field_name = 'household_revoked'
        and field_type = 'radio'
        and required = true
    ) as household_revoked_present,
    exists (
      select 1 from public.visa_form_fields
      where visa_type = 'TW_ENTRY_PERMIT'
        and field_name = 'tw_contact_district'
        and field_type = 'select'
        and validation_rules ->> 'dependent_options_key' = 'taiwan_districts_by_city'
    ) as district_linked_select,
    exists (
      select 1 from public.visa_form_fields
      where visa_type = 'TW_ENTRY_PERMIT'
        and field_name = 'tw_local_phone'
        and validation_rules ->> 'required_when' = 'tw_contact_mobile_not_applicable === true'
    ) as landline_reverse_required,
    bool_and(required = true) filter (
      where field_name in ('mainland_id_number', 'company_name', 'job_title', 'kin_father_status', 'kin_mother_status')
    ) as required_flags_fixed,
    exists (
      select 1 from public.visa_form_fields
      where visa_type = 'TW_ENTRY_PERMIT'
        and field_name = 'occupation_experience'
        and required = true
        and conditional_logic ->> 'showIf' = 'current_occupation === 62'
    ) as occupation_experience_retired_only
  from public.visa_form_fields
  where visa_type = 'TW_ENTRY_PERMIT'
)
select * from checks;
```

预期全部返回 `true`。

### 回滚方案

- 执行前必须保存 `tw_entry_permit_form_fields_snapshot` 的完整 JSON 输出。
- 如需回滚，用该 snapshot 生成反向 `ON CONFLICT (visa_type, field_name) DO UPDATE`，恢复这 28 个字段的 metadata；不要回滚或删除 application answers/documents。
- 若 `household_revoked` 已开始被用户填写，不要删除该字段 row；如必须回到旧视觉，可先恢复 snapshot 中其他字段并由主协调决定是否把 `household_revoked.required=false` 临时降级。完整删除只应在确认没有任何申请答案引用该 key 后人工执行。
- 本次未执行 production 写入，因此当前无需实际回滚。

### 本次验证命令与结果

- `cd viza-be/agent-backend && npx vitest run src/tests/tw-entry-permit-schema.test.ts`
  - 通过：`1` 个测试文件，`10` 个测试全部 passed。
- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts app/client/__tests__/client-layout-gating.test.ts`
  - 通过：`3` 个测试文件，`28` 个测试全部 passed。
- `cd viza-be/agent-backend && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现台湾 schema、migration sync、DynamicStepForm、Documents 或 result card 相关 type-check error。

### 阻断与下一步

- 阻断：production DB 仍未同步；当前只是准备好的、安全约束测试覆盖的 SQL。
- 需要主协调授权 production metadata sync。
- 授权同步后，应由 TW-A 重新做 production 台湾 long-form 视觉复核，重点看：
  - `household_revoked` 是否出现；
  - `tw_contact_district` 是否变成县市联动下拉；
  - `tw_local_phone` 勾选无手机后是否变 required；
  - `mainland_id_number`、`company_name`、`job_title`、`kin_father_status`、`kin_mother_status` 是否不再显示普通选填；
  - `occupation_experience` 是否只在退休时触发。

## 台湾地址/电话/条件组 required 修复（2026-08-01）

### 本次计划与边界

1. 重新读取 `docs/taiwan-launch-coordination.md`、`docs/taiwan-launch-worklogs/TW-A.md` 和本 TW-C worklog。
2. 只处理台湾 `TW_ENTRY_PERMIT` long-form 前端字段合同、台湾 seed 合同和 focused tests。
3. 不访问台湾官网、不提交、不处理 CAPTCHA、不上传、不创建队列、不部署、不做 Git 操作、不运行 migration、不修改 runner/submission-service/DB。

### 数据来源

- 官网来源：沿用 TW-A/用户截图给出的台湾官方申请页 DOM/视觉证据：
  - 官网县市列表顺序覆盖 `臺北市、基隆市、新北市、宜蘭縣、新竹市、新竹縣、桃園市、苗栗縣、臺中市、彰化縣、南投縣、嘉義市、嘉義縣、雲林縣、臺南市、高雄市、澎湖縣、屏東縣、臺東縣、花蓮縣、金門縣、連江縣`。
  - 用户截图确认高雄市区下拉包含 `新興區、前金區、苓雅區、鹽埕區` 等选项。
  - 用户截图确认默认手机必填、市内电话选填；勾选“无在台联络手机号码”后手机不必填，市内电话变必填。
  - 用户截图确认其他国籍护（证）照触发后 `所具其他国籍为`、`他国护（证）照号码`、`他国护（证）照有效期限` 均带星号。
  - 用户截图确认 `母 — 存殁` 不应为普通选填；此前 TW-A/TW-C 已确认父/母 status required、父/母其他亲属字段 optional。
- 政府区划交叉来源：内政部户政司 `RSCD0103` 省市縣市鄉鎮市區代碼入口与资料文件，以及主计总处页面说明旧行政区/村里代码已转以户政司村里代码为准。
  - `https://www.ris.gov.tw/documents/html/5/1/168.html`
  - `https://www.ris.gov.tw/documents/data/5/1/RSCD0103.txt`
  - `https://www.stat.gov.tw/cp.aspx?n=3150`
- 本次未登录官网、未提交前校验，因此 `tw_contact_district` required 仍沿用现有 TW-A 结论：区乡镇市改为联动下拉，但保持 optional；若后续官方提交前校验证明必填，再精确收紧。

### 本次变更文件

- `viza-fe/internal-website/lib/taiwan-administrative-units.ts`
  - 新增台湾县市 → 区/乡/镇/市 mapping。
  - 城市使用官网顺序和值 `1..22`，展示为繁体：`臺北市`、`臺中市`、`臺南市`、`臺東縣` 等。
  - 高雄市包含 `新興區`、`前金區`、`苓雅區`、`鹽埕區` 等；全量县市下辖选项计数至少 368。
- `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
  - 台湾 `tw_contact_city` normalization 兜底为 select + `TW_CITY_OPTIONS`。
  - 台湾 `tw_contact_district` normalization 兜底为 select，并写入：
    - `dependent_on: "tw_contact_city"`
    - `dependent_options_key: "taiwan_districts_by_city"`
    - `dependent_options: TW_DISTRICTS_BY_CITY`
  - 台湾 `tw_local_phone` 增加 `required_when: "tw_contact_mobile_not_applicable === true"`，默认仍不是静态 required。
  - 台湾 required 兜底新增 `kin_father_status`、`kin_mother_status`，防止旧 DB rows 仍为 optional 时 UI 显示 `选填`。
- `viza-fe/internal-website/components/dynamic-step-form.tsx`
  - 新增 `required_when` 动态 required 判断，用于星号和继续按钮校验。
  - 新增 `taiwan_districts_by_city` dependent options key，复用既有依赖下拉机制；切换县市会清空旧区值。
- `viza-fe/internal-website/lib/form-utils.ts`
  - 新增 `isRequiredWhenSatisfied()`，复用既有表达式 parser；只影响显式配置了 `validation_rules.required_when` 的字段。
- `viza-fe/internal-website/components/client/wizards/tw/config.ts`
  - 旧 TW wizard 同步使用台湾县市/区乡镇市 mapping。
  - 旧 TW wizard 中勾选无手机时 `tw_local_phone` 标记 required；默认显示手机且 required。
- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - `TW_CITIES` 改为官网繁体展示。
  - `tw_contact_district` 从 text 改为 select，并带 `dependent_options_key: "taiwan_districts_by_city"`。
  - `tw_local_phone` 增加 `required_when: "tw_contact_mobile_not_applicable === true"`。
- `viza-fe/internal-website/lib/__tests__/bilingual-schema-contract.test.ts`
  - 覆盖台湾地址 normalization、mapping 高雄选项、县市切换选项差异、landline `required_when`、父/母 status required 兜底且母亲姓名保持 optional。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 覆盖真实 DynamicStepForm：
    - 高雄市区选项包含 `新興區、前金區、苓雅區、鹽埕區`，切换到臺北市后出现 `中正區` 且高雄区不再出现。
    - 默认市内电话不显示星号、手机显示星号；勾选无手机后手机隐藏、市内电话显示星号并阻止继续。
    - 其他国籍护（证）照回答 `no` 时三字段隐藏；回答 `yes` 时三字段均显示星号并参与校验。
    - 父/母存殁即使模拟旧 DB `required=false` 也显示星号；母亲姓名保持 optional。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 锁定 seed 中 `tw_contact_district` 为 select + 台湾 dependent key。
  - 锁定 `tw_local_phone` 反向条件必填合同。

### 本次验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts app/client/__tests__/client-layout-gating.test.ts`
  - 通过：`3` 个测试文件，`27` 个测试全部 passed。
- `cd viza-be/agent-backend && npx vitest run src/tests/tw-entry-permit-schema.test.ts`
  - 通过：`1` 个测试文件，`9` 个测试全部 passed。
- `cd viza-be/agent-backend && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现台湾地址、电话条件必填、其他国籍条件组、亲属存殁、DynamicStepForm、bilingual schema 或 seed 相关 type-check error。

### 最终显示与复核说明

- 地址：
  - `tw_contact_city` 显示官网繁体县市下拉。
  - `tw_contact_district` 根据 `tw_contact_city` 联动显示对应区/乡/镇/市，不再自由手填。
  - `tw_contact_district` 暂保持 optional，不显示普通必填；这是因为当前证据只确认该字段是下拉，未确认字段级必填。
- 电话：
  - 默认未勾选 `tw_contact_mobile_not_applicable`：`在台联络手机号码*`，`在台联络电话` 不带星号。
  - 勾选 `无在台联络手机号码`：手机字段隐藏/不参与校验，`在台联络电话*` 并参与 required validation。
- 其他国籍护（证）照：
  - `has_other_nationality_passport` 为 `yes` 时，`所具其他国籍为*`、`他国护（证）照号码*`、`他国护（证）照有效期限*` 显示并参与校验。
  - 为 `no` 时三字段隐藏且不参与 required validation。
- 亲属：
  - `父 — 存殁*`、`母 — 存殁*` 有前端 required 兜底。
  - 父/母姓名、生日、电话、职业、单位、职称、地址仍保持 optional，未扩大必填范围。
- `mainland_id_number`、`company_name`、`job_title` 的上一轮兜底仍保留。

### 接口变化与阻断

- 无 runner、submission-service、数据库、migration、支付、feature flag 或部署接口变化。
- 新增前端数据模块 `taiwan-administrative-units.ts`。
- 新增前端 validation metadata 约定：`validation_rules.required_when`。当前只有台湾 `tw_local_phone` 使用。
- 本地/production 页面看到正确地址联动和 required badge 不要求先重新 seed，因为前端 normalization 有兜底；但生产数据仍建议后续受控同步 seed 合同，保持数据源一致。
- 阻断：本任务未部署；production 若未更新前端 bundle，仍会看到旧行为。仍需要 TW-A 用可渲染 long-form 对地址、电话、其他国籍、父/母存殁做视觉复核。

## long-form required badge 修复（2026-08-01）— 大陆身份证、公司名称、职称

### 本次计划与边界

1. 已重新读取 `docs/taiwan-launch-coordination.md`、`docs/taiwan-launch-worklogs/TW-A.md` 和本 TW-C worklog。
2. 只检查并修复台湾 `TW_ENTRY_PERMIT` long-form required badge/validation：`mainland_id_number`、`company_name`、`job_title`。
3. 不访问台湾官网、不提交、不处理 CAPTCHA、不上传、不创建队列、不部署、不做 Git 操作、不运行 migration、不修改 runner/submission-service/DB。

### 根因

- `mainland_id_number` 在 seed 中原本是 `required: false` + `conditional_logic.showIf = "mainland_id_number_not_applicable === false"`。
  - `DynamicStepForm` 的校验只校验 visible fields，因此正确模型应是“字段显示时 required；勾选无大陆身份证号码后字段隐藏并豁免”。
  - 由于 `required=false`，`DynamicFormField` 只看静态 required badge，导致 UI 显示普通 `选填`。
- `company_name` / `job_title` 的代码 seed 与旧 TW wizard 已经是 `required: true`，但用户本地 long-form 仍显示 `company_name` 为 `选填`，说明本地/production DB 可能仍有旧 `visa_form_fields.required=false` rows。
  - 原 `normalizeBilingualFormField()` 只兜底台湾中文题目，不兜底台湾 required 合同，所以旧 DB 的 false 会穿透到 UI。

### 本次变更文件

- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - `mainland_id_number` 改为 `required: true`，保留 `showIf: "mainland_id_number_not_applicable === false"`。
  - 增加 note：显示时必填；只有勾选 `mainland_id_number_not_applicable` 才豁免。
- `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
  - 新增台湾专属 required normalization override：
    - `mainland_id_number`
    - `company_name`
    - `job_title`
  - 仅当 `field.visaType === "TW_ENTRY_PERMIT"` 时生效，不影响韩国、越南、英国、法国等共享字段。
  - 作用：即使本地/production DB 仍是旧 `required=false` rows，long-form normalization 后也会把这三个字段作为 required 渲染和校验。
- `viza-fe/internal-website/components/client/wizards/tw/config.ts`
  - 旧 TW wizard 中 `mainland_id_number` 同步标记 `required: true`。
  - `company_name` / `job_title` 已经是 `required: true`，本次确认保留。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - `mainland_id_number` 合同更新为 `required: true` + `requiredWhen: "mainland_id_number_not_applicable === false"`。
- `viza-fe/internal-website/lib/__tests__/bilingual-schema-contract.test.ts`
  - 新增 stale DB regression：台湾 `mainland_id_number`、`company_name`、`job_title` 即使输入 `required: false`，normalize 后也必须为 required。
  - 新增非台湾共享字段保护：韩国 `job_title` 不被台湾 required override 影响。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 新增真实 DynamicStepForm 渲染测试：
    - `mainland_id_number` 在未勾选“无大陆身份证号码”时显示星号、input `required`，继续按钮 `data-required-filled=false`，且不显示普通 `选填`。
    - 勾选“无大陆身份证号码”后 `mainland_id_number` 隐藏。
    - `company_name` / `job_title` 即使模拟旧 DB `required=false`，经 normalization 后仍显示星号、input `required`、继续按钮被必填校验挡住，且不显示普通 `选填`。

### 本次验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts app/client/__tests__/client-layout-gating.test.ts`
  - 通过：`3` 个测试文件，`21` 个测试全部 passed。
- `cd viza-be/agent-backend && npx vitest run src/tests/tw-entry-permit-schema.test.ts`
  - 通过：`1` 个测试文件，`9` 个测试全部 passed。
- `cd viza-be/agent-backend && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现台湾 required badge、DynamicStepForm、bilingual schema、TW config 或 seed 相关 type-check error。

### 最终显示与复核说明

- `mainland_id_number`：
  - 未勾选 `mainland_id_number_not_applicable` 时：显示 `大陆身份证号码*`，input 为 required，继续按钮不会通过必填校验。
  - 勾选 `无大陆身份证号码` 时：字段隐藏，不要求填写。
- `company_name` / `job_title`：
  - 应显示 `公司名称及单位全衔或学校名称*`、`职称*`，不应显示普通 `选填`。
  - 因前端 normalization 已兜底旧 DB rows，本地页面看到正确 badge 不要求先重新 seed；但为了后端 seed/生产数据合同一致，后续发布/生产数据仍应应用包含本 seed 修正的版本或执行受控数据同步。
- 仍建议 TW-A 用可写授权测试草稿重新视觉复核第二步字段，确认这三个字段实际页面不再显示 `选填`。

### 接口变化与阻断

- 无 runner、submission-service、数据库、migration、支付、feature flag 或部署接口变化。
- 前端 normalization 行为变化仅限 `TW_ENTRY_PERMIT` 三个字段 required override。
- 阻断：本任务未部署；production 若未更新前端 bundle，仍会看到旧行为。

## long-form 空白前端 layout/gating 分支（2026-08-01）

### 本次计划与边界

1. 已重新读取 `docs/taiwan-launch-coordination.md`、`docs/taiwan-launch-worklogs/TW-A.md`、`docs/taiwan-launch-worklogs/TW-G.md` 和本 TW-C worklog。
2. 只检查并处理前端 `/client` layout、long-form 页面 gating、dynamic form 渲染路径和相关前端测试。
3. 不访问台湾官网、不提交、不处理 CAPTCHA、不上传、不创建队列、不运行 migration、不部署、不做 Git 操作。

### 根因分支结论

- `/client` layout 的 session 检查本身不是永久卡死点：
  - `checkSessionValidity()` 对网络/超时等暂时错误会 `setSessionValid(true)` 放行。
  - 无有效 session 时会 `router.replace("/client/login")`；这属于登录门禁，不应让未登录用户看到申请表。
- 发现一个真实前端 gating 风险：
  - `ClientLayoutContent` 在 `sessionValid === true` 后会先执行 pending form request 检查。
  - 若存在 `about_me` form request，会 `router.push("/client/about-me-form?...")`，并在当前 long-form route 上不渲染 children。
  - 对 TW-A 用显式 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` 做字段视觉复核的场景，这个 about-me 门禁会导致只看到 portal 导航/加载壳，`input/select/textarea=0`，而不是台湾表单主体。
- long-form 页面本身对显式台湾 URL 不要求 paid package：
  - `explicitCountry` / `explicitVisaType` 存在时，schema 通过 `getVisaFormSteps(explicitVisaType, { country: explicitCountry })` 读取，不依赖 `getUserVisaPackage()`。
  - `loadApplicationFormContext(..., { preferExplicit: true })` 允许没有现有 application；后续保存/OCR/Documents 再通过 `ensureDraftApplication()` 创建 draft。
  - 仍需要有效登录和可解析 applicant profile；无 session 会去登录，无 profile 会显示错误而不是可保存表单。

### 本次变更文件

- `viza-fe/internal-website/app/client/client-layout-gating.ts`
  - 新增 `shouldSkipFormRequestGateForRoute()`。
  - 仅对显式台湾 long-form：`/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` 返回 true。
  - 同时兼容 TW-G 修过的 HTML 转义参数：`amp;visaType=TW_ENTRY_PERMIT`。
- `viza-fe/internal-website/app/client/layout.tsx`
  - 对显式台湾 long-form 跳过 pending about-me form request gate，并立即 `setFormRequestChecked(true)` 放行 children。
  - 保留 session 校验；未登录仍会进入登录门禁。
  - 不改变其他国家、普通 `/client/application`、about-me、profile、paid package、Documents、提交或 runner 行为。
- `viza-fe/internal-website/app/client/__tests__/client-layout-gating.test.ts`
  - 新增 focused regression tests，覆盖 canonical 和 `amp;visaType` 台湾 long-form 会跳过 form-request gate。
  - 断言越南 long-form 与普通 `/client/application` 不跳过，避免扩大影响面。

### 本次验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run app/client/__tests__/client-layout-gating.test.ts lib/client/application-route-params.test.ts components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 通过：`3` 个测试文件，`10` 个测试全部 passed。
- `cd viza-fe/internal-website && npm test -- --run app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx app/client/documents/__tests__/tw-documents-eligibility.test.tsx`
  - 通过：`2` 个测试文件，`11` 个测试全部 passed。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现台湾 layout/gating、long-form、dynamic form、Documents 或 result card 相关 type-check error。

### 证据位置与复核建议

- 前端 gate helper：`viza-fe/internal-website/app/client/client-layout-gating.ts`。
- layout 接入：`viza-fe/internal-website/app/client/layout.tsx`。
- regression tests：`viza-fe/internal-website/app/client/__tests__/client-layout-gating.test.ts`。
- 仍需 TW-A 在本地/production 部署包含本修复后，重新访问：
  - `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - `/client/application/long-form?country=taiwan&amp;visaType=TW_ENTRY_PERMIT`
  - 期望：不再被 about-me form request gate 挡住；页面应进入台湾 DB-driven `DynamicStepForm` 渲染路径并出现表单控件。
- 如果复核后仍是 `input/select/textarea=0`，下一分支应由 TW-G 继续查 schema 数据加载、production 部署版本、auth/profile 返回值或 CSS/viewport 隐藏问题。

### 接口变化与阻断

- 无 runner、submission-service、数据库、migration、支付、feature flag 或部署接口变化。
- 新增前端纯函数接口：`shouldSkipFormRequestGateForRoute(pathname, searchParams)`，仅供 `/client` layout 判断 form-request gate。
- 阻断：本任务未部署，不能证明 production 已生效；仍需 TW-A 视觉复核后关闭 long-form 空白验收。

## TW-A 复核后剩余字段合同处理（2026-08-01）

### 本次计划与边界

1. 已重新读取 `docs/taiwan-launch-coordination.md`、`docs/taiwan-launch-worklogs/TW-A.md` 和本 TW-C worklog。
2. 只处理台湾 `TW_ENTRY_PERMIT` 字段合同和测试：父/母亲属状态 required、`occupation_experience` 条件触发规则。
3. 不修改 submission-service、runner、官网提交、CAPTCHA、部署、数据库 migration 或共享数据库。

### 本次变更文件

- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - `kin_father_status` / `kin_mother_status` 通过 `kinshipFields()` helper 变为 `required: true`。
  - 父/母姓名、生日、电话、职业、服务单位、职称、现住址等其他亲属字段保持 `required: false`，未盲目扩大必填范围。
  - `occupation_experience` 从 `current_occupation in [15,16,17,62]` 收窄为 `current_occupation === 62`，并设为条件显示时 required。
  - 更新 note：现有官网证据只支持退休时填写经历；自由业/其他业/无不再作为触发条件。
- `viza-fe/internal-website/components/client/wizards/tw/config.ts`
  - 旧 TW wizard 的 `occupation_experience` 显示条件同步收窄为 `form.current_occupation === "62"`。
  - 旧 wizard 的 `GenericField` 类型不支持 select/textarea `required` 属性；正式 required 合同以 seed/dynamic long-form 为准。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 更新 `occupation_experience` 合同为 `required: true` + `current_occupation === 62`。
  - 增加父/母 status required、父/母其他亲属字段保持 optional 的源码合同断言。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 更新前端条件测试：退休 `62` 显示“经历”；自由业 `15` 不显示“经历”。
- `docs/taiwan-launch-coordination.md`
  - 将 TW-G10 更新为字段合同已处理、视觉复核待完成。
- `docs/taiwan-launch-worklogs/TW-C.md`
  - 本记录。

### 本次验证命令与结果

- `cd viza-be/agent-backend && npx vitest run src/tests/tw-entry-permit-schema.test.ts`
  - 通过：`1` 个测试文件，`8` 个测试全部 passed。
- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts`
  - 通过：`2` 个测试文件，`16` 个测试全部 passed。
- `cd viza-be/agent-backend && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现台湾字段合同、TW config、bilingual schema 或 seed 相关 type-check error。

### 本次结论

- `kin_father_status` / `kin_mother_status` 已按 TW-A DOM 复核结论改为 required。
- 父/母其他亲属字段仍保持 optional，因为 TW-A 未见同等级字段 required 标记。
- `occupation_experience` 最终规则：仅 `current_occupation === 62`（退休）时显示并 required；自由业 `15`、其他业 `16`、无 `17` 不再触发。
- 仍需要 TW-A 在可渲染 VIZA long-form 环境中重新视觉复核字段题目和 required 标记；若官方提交前校验显示更多亲属字段必填，再精确补合同。

## 官网题目/必填合同修复（2026-08-01）— TW-G10

### 本次计划与边界

1. 已重新读取 `docs/taiwan-launch-coordination.md`、`docs/taiwan-launch-worklogs/TW-A.md` 和本 TW-C worklog。
2. 根据 TW-A 真实官网题目/必填审计修复台湾长表单字段中文、seed required/conditional 合同和旧 TW wizard config 文案。
3. 不修改 submission-service、runner、自动提交、CAPTCHA、migration、共享数据库或部署配置。

### 本次变更文件

- `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
  - 台湾 `TW_ENTRY_PERMIT` 现在优先查 `TW_FIELD_NAME_ZH`，再回落到通用 `FIELD_NAME_ZH_OVERRIDES`；非台湾仍保持原有 `label_zh` 优先逻辑。
  - 为避免共享 field name 污染其他国家，移除将 `TW_FIELD_NAME_ZH` 整体 spread 到通用 override 表的做法；台湾专属查表只在 `field.visaType === "TW_ENTRY_PERMIT"` 时生效。
  - 修复/补齐中文题目：
    - `household_revoked` → `目前户口登记状态`
    - `passport_number` → `护照号码/香港签证身份证明书号码/澳门旅行证/大陆旅行证号码`
    - `passport_expiry_date` → `护照效期/旅行证效期（西元）`
    - `overseas_residency_id_number` → `侨居身份证号码（如永久居留证号码、居留证号码或签证号码）`
    - `birth_place_is_mainland` → `出生地（同所持旅游证件）`
    - `local_mobile_phone` → `居住地手机号码（需填写国码）`
    - `current_occupation` → `现职`
    - `occupation_experience` → `经历`
    - `company_name` → `公司名称及单位全衔或学校名称`
    - `job_title` → `职称`
    - `is_taiwanese_spouse` → `是否为台湾人民配偶？`
    - `overseas_address` → `港、澳或海外地址`
    - `tw_contact_road` → `街、路段`
    - `tw_contact_building_number` → `门牌号/楼/室（住饭店请填饭店名称）`
    - `other_nationality_country` → `所具其他国籍为`
    - `other_passport_number` → `他国护（证）照号码`
    - `other_passport_expiry_date` → `他国护（证）照有效期限`
    - 政治机关/团体声明补入“大陆地区”“具政治性机关（构）、团体”“曾/现任职于”。
- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - `company_name` 从 `required: false` 改为 `required: true`。
  - `job_title` 从 `required: false` 改为 `required: true`。
  - seed 英文字段合同同步官网语义，特别是旅行证件、侨居身份证、公司/职称、在台地址、他国护（证）照和政治机关/团体声明。
  - `occupation_experience` 保留现有 `current_occupation in [15,16,17,62]` 条件显示/条件必填假设，并增加 note：官网当前可见为“经历”且无星号，仍需提交前/职业切换验证。
  - 父/母亲属区不改 required：TW-A 只确认区块标题带星号，字段级必填未通过提交前校验确认，当前仍保持 `kinshipFields(..., false, ...)`。
- `viza-fe/internal-website/components/client/wizards/tw/config.ts`
  - 同步旧 TW wizard config 的台湾官网题目文案。
  - 补入 `household_revoked` 旧 wizard 字段，避免旧路径遗漏官网必填项。
  - 地址合同保持：`tw_contact_city`、`tw_contact_road`、`tw_contact_building_number` 必填语义；区/村里/邻/巷/弄/市话选填；`tw_contact_mobile` 在未选择“无在台联络手机号码”时显示。
- `viza-fe/internal-website/lib/__tests__/bilingual-schema-contract.test.ts`
  - 扩展台湾坏 metadata 覆盖测试。
  - 新增台湾官网题目回归测试，覆盖旅行证件/侨居身份证/在台地址/他国护（证）照/政治声明等字段。
  - 新增非台湾共享字段保护测试：韩国 `passport_number` 仍可优先使用自己的 `label_zh`，不被台湾文案污染。
- `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - `company_name`、`job_title` required 预期改为 true。
  - 新增 seed 文案/合同测试，锁定官网题目、`occupation_experience` note、父母亲属区不盲目 required。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 更新旧 TW config 条件/文案断言。
  - 新增前端合同测试，固定在台地址 required/optional/conditional 显示关系和公司/职称/经历显示关系。
- `docs/taiwan-launch-coordination.md`
  - 更新 `TW-G10` 为部分关闭，并记录本次修复。
- `docs/taiwan-launch-worklogs/TW-C.md`
  - 本记录。

### 本次验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run lib/__tests__/bilingual-schema-contract.test.ts components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 通过：`2` 个测试文件，`16` 个测试全部 passed。
- `cd viza-be/agent-backend && npx vitest run src/tests/tw-entry-permit-schema.test.ts`
  - 通过：`1` 个测试文件，`8` 个测试全部 passed。
- `cd viza-be/agent-backend && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现台湾字段合同、TW config、bilingual schema 或 seed 相关 type-check error。

### 本次结论与剩余阻断

- 已修明确差异：
  - 台湾字段中文优先级。
  - 台湾共享字段名的专属旅行证件/护（证）照/侨居身份证含义。
  - `company_name`、`job_title` 官网必填但 seed 选填的问题。
  - 台湾地址/contact required 合同测试覆盖。
  - 政治机关/团体声明中文含义。
- 保留待验证：
  - `occupation_experience`：TW-A 看到官网当前可见无星号，但旧 VIZA 合同对自由业/其他业/无/退休条件显示并可能条件必填。本次未放宽，以免低估官网 JS/提交前校验；需要 TW-A/TW-03 用职业切换和提交前校验确认。
  - 父/母亲属区：官网父/母区标题带星号，但字段级 required 未确认。本次不盲目把所有父母字段改 required；需要后续提交前校验或官方规则确认。
  - 未做真实 VIZA long-form 视觉复核；可以让 TW-A 重新打开 VIZA long-form 验证修正后的中文题目。

## 长表单中文题目修复（2026-08-01）— 台湾人工字段文案优先

### 本次计划与边界

1. 修复 `TW_ENTRY_PERMIT` 长表单中文题目被数据库坏 `validation_rules.label_zh` 覆盖的问题。
2. 只调整前端 bilingual schema label 派生优先级：台湾字段命中人工字段表时先用 `FIELD_NAME_ZH_OVERRIDES`。
3. 其他国家不改变优先级：韩国、越南、英国、法国等仍先使用有效 `label_zh`，再走字段名 override。
4. 不修改 submission-service、runner、自动提交、CAPTCHA、seed、migration、共享数据库或部署配置。

### 本次变更文件

- `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
  - `FieldLike` 加入 `visaType`，让 `deriveChineseFieldLabel()` 能识别台湾签证类型。
  - `deriveChineseFieldLabel()` 对 `field.visaType === "TW_ENTRY_PERMIT"` 且 `FIELD_NAME_ZH_OVERRIDES` 有对应字段时优先返回人工字段表文案。
  - 非台湾字段继续保持原顺序：有效 `validation_rules.label_zh` 优先，再使用 field-name override。
- `viza-fe/internal-website/lib/__tests__/bilingual-schema-contract.test.ts`
  - 新增台湾回归测试：即使 `validationRules.label_zh` 分别写成坏文案“联系人城市”“联系人号码”“联系人”，最终仍返回：
    - `tw_contact_city` → `县市`
    - `tw_contact_building_number` → `门牌/楼层/室号（住饭店请填饭店名称）`
    - `tw_contact_mobile_not_applicable` → `无在台联络手机号码`
  - 同文件一条既有断言同步到当前实际人工覆盖文案 `您是否持有其他有效护照或旅行证件？`；这不改变产品逻辑，只让测试匹配现有全局 field-name override。
- `docs/taiwan-launch-coordination.md`
  - 状态日志记录本次台湾中文题目优先级修复。
- `docs/taiwan-launch-worklogs/TW-C.md`
  - 记录本次修复、测试与边界。

### 本次验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run lib/__tests__/bilingual-schema-contract.test.ts`
  - 通过：`1` 个测试文件，`9` 个测试全部 passed。
- `cd viza-fe/internal-website && npm test -- --run lib/__tests__/bilingual-schema-contract.test.ts -t "prefers Taiwan curated field-name labels"`
  - 通过：台湾新增回归测试 passed。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现 `bilingual-schema-contract.ts` 或台湾长表单相关 type-check error。

### 本次发现与影响

- 已知坏 metadata 示例现在不会覆盖台湾人工文案：
  - “联系人城市”不会覆盖 `县市`。
  - “联系人号码”不会覆盖 `门牌/楼层/室号（住饭店请填饭店名称）`。
  - “联系人”不会覆盖 `无在台联络手机号码`。
- 该修复依赖 `TW_FIELD_NAME_ZH` 已经合并进 `FIELD_NAME_ZH_OVERRIDES`；本次只改变台湾字段的读取优先级。
- `components/dynamic-step-form.tsx` 无需改动；它通过 normalized bilingual schema 读取 label，修复点在 label contract 层即可传导到长表单。

### 阻断项与接口变化

- 无运行时接口变化。
- 未做 VIZA long-form 视觉复核；建议后续由主协调者在可访问页面上确认 `tw_contact_city`、`tw_contact_building_number`、`tw_contact_mobile_not_applicable` 和 `tw_contact_road` 的实际页面文案。
- 全量 type-check 仍需由 Travel 相关负责人修复无关错误后再作为全绿门槛。

## 第三阶段更新（2026-08-01）— 台湾前端状态、Documents 覆盖与受控 QA

### 本阶段计划与边界

1. 已重新读取 `docs/taiwan-launch-coordination.md` 与全部 `docs/taiwan-launch-worklogs/TW-*.md`，确认当前目标仍是授权登录后自动填写/上传/校验并停在 CAPTCHA 前。
2. 只处理 TW-C 独占范围：台湾前端结果卡与提交状态展示、台湾 Documents 相关测试、新增台湾受控 QA runbook、自己的 worklog。
3. 不处理 CAPTCHA、不点击最终提交、不承诺 tracking、不访问真实官方账号。
4. 不修改 runner、seed、migration、共享数据库、支付、feature flag、部署配置或其他 AI worklog。

### 本阶段变更文件

- `viza-fe/internal-website/app/client/documents/__tests__/tw-documents-eligibility.test.tsx`
  - 新增 Documents 前端展示测试，覆盖 `eligibility_category` 1、2、3、4。
  - 每个类别都断言只出现自己的 `eligibility_supporting_document_<category>` 标签，不出现其他三类资格证明材料。
  - 同时断言共同材料 `photo`、`mainland_travel_document` 仍显示。
  - 同时断言条件材料 `hk_macau_id_scan`、`other_nationality_passport_scan`、`mainland_id_card_scan` 在传入的 Documents 数据中仍可渲染。
- `docs/taiwan-controlled-qa-runbook.md`
  - 新增受控 QA runbook，写清运营如何观察 `queued`、`logging_in`、`otp_required`、`filling`、`uploading`、`validating`、`stopped_at_captcha`、`failed`。
  - 写清缺必填字段、缺文件/文件不合格、OTP 超时、官网字段变化、网络失败的处理步骤。
  - 写清什么时候禁止重试，避免重复打开官网、重复排队或泄露敏感资料。
  - 写清 `stopped_at_captcha` 的记录方式：只说明尚未提交、无普通官网接续链接、未做 CAPTCHA、未点击最终提交。
- `docs/taiwan-launch-worklogs/TW-C.md`
  - 记录本阶段计划、验证结果、发现、证据位置、建议修改文件、阻断项和接口变化。

本阶段没有修改 Documents 生产逻辑；测试使用 `DocumentCenterClient` 的 `initialData` 走真实前端渲染路径。

### 本阶段验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx app/client/documents/__tests__/tw-documents-eligibility.test.tsx`
  - 通过：`3` 个测试文件，`14` 个测试全部 passed。
  - 覆盖：
    - 台湾动态表单中文单列真实渲染路径。
    - 英文姓名大写、中文姓名简转繁。
    - 条件字段和 review section。
    - 台湾八状态显示映射。
    - `stopped_at_captcha` 不显示普通官网接续链接，明确尚未提交。
    - failed 只展示安全类别和 field/document key，且不泄露账号、OTP、Cookie、原始错误、截图路径或申请人姓名。
    - Documents 资格 1–4 各只显示自己的资格证明材料，且共同/条件材料仍显示。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项仍是无关 Travel 错误：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts(63,54)`、`(68,27)`、`(71,27)`：空 tuple 取 index。
    - `scripts/capture-travel-city-coverage-screenshots.ts(3,26)`：缺少 `playwright` module/types。
  - 本次输出未出现台湾前端、Documents 新测试或 TW-C 变更文件相关 type-check error。

### 本阶段发现与证据位置

- 台湾八状态前端展示已经存在并由 `TwResultCard` focused test 固定：
  - `viza-fe/internal-website/app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx`
  - 状态集合：`queued`、`logging_in`、`otp_required`、`filling`、`uploading`、`validating`、`stopped_at_captcha`、`failed`。
- `stopped_at_captcha` 已明确表示尚未提交，且不展示普通官网接续链接：
  - `TwResultCard.test.tsx` 的 stopped-at-CAPTCHA 用例断言没有 link。
  - `taiwan-frontend-experience-audit.test.tsx` 同步固定旧误导路径不会回归。
- failed 状态安全展示已经由测试覆盖：
  - 缺字段只显示 `field:<key>`。
  - 缺文件只显示 `doc:<key>`。
  - OTP 超时显示安全类别和处理提示。
  - 测试断言不会显示申请人姓名、账号、OTP、Cookie、原始错误整句或截图路径；前端也不渲染这些敏感信息。
- Documents 资格材料展示由新增测试覆盖：
  - `viza-fe/internal-website/app/client/documents/__tests__/tw-documents-eligibility.test.tsx`
  - 本测试覆盖的是前端 Documents 渲染层；生产数据筛选逻辑仍依赖 `app/client/documents/actions.ts` 从申请答案和 `document_requirements` 读取并过滤。
- 受控 QA runbook：
  - `docs/taiwan-controlled-qa-runbook.md`
  - 运营可按状态、失败类别、field/document key 处理问题；遇到官网字段变化、连续失败、OTP 通道不可用、材料 key 不匹配时禁止继续重试。

### 建议后续修改文件

- `viza-be/submission-service/src/tw/**` / `src/queue/halt-runners.ts` 台湾段
  - 后续由 TW-A/TW-G 稳定写入结构化状态与错误：`status`、`currentStage`、`errorCode`、`missingFields`、`missingDocuments`。
  - 不要把普通 `portalUrl` 当成同会话接续链接。
- `viza-fe/internal-website/app/client/documents/actions.ts`
  - 若后续要把 Documents 资格筛选从展示测试提升为数据加载单元测试，可在不改变行为的前提下为台湾筛选逻辑增加可测试 seam，或用 mocked Supabase 覆盖 `loadDocumentCenterData`。
- `viza-fe/internal-website/lib/application-submission-display.ts`
  - 后续集成阶段可复核 `stopped_at_captcha` 是否应作为台湾人工行动/终端状态参与导航和轮询策略。

### 阻断项与接口变化

- `TW-G0` 仍需主协调者/runner 集成确认：当前前端诚实显示停在 CAPTCHA 前，但不能提供同一官网会话接续能力。
- 未做真实官方账号登录、未做 CAPTCHA、未点击最终提交、未部署、未写共享数据库。
- 本阶段没有新增运行时接口；沿用第二阶段前端接口：
  - `TwSubmissionResult.status`: `queued`、`logging_in`、`otp_required`、`filling`、`uploading`、`validating`、`stopped_at_captcha`、`failed`。
  - 可选：`currentStage?: string | null`、`errorCode?: string`、`missingFields?: string[]`、`missingDocuments?: string[]`。
  - `portalUrl` 仍仅为诊断字段，不是普通官网接续链接。

## 第二阶段更新（2026-08-01）

### 本阶段边界

- 已按主协调者新阶段要求，独占修改台湾前端结果卡、台湾提交状态展示逻辑、台湾 focused tests 和本 worklog。
- 未修改 runner、seed、migration、共享数据库、支付、feature flag、部署配置或其他 AI worklog。
- 未做 CAPTCHA 自动化，未点击官网最终提交。

### 第二阶段变更文件

- `viza-fe/internal-website/app/client/application/_components/result-cards/TwResultCard.tsx`
  - 移除“已填写完成”“打开官网输入验证码并送出”等不真实路径。
  - 不再展示普通官网 URL 作为可接续链接；`portalUrl` 只保留为诊断字段，不渲染 CTA。
  - 新增台湾八状态展示：`queued`、`logging_in`、`otp_required`、`filling`、`uploading`、`validating`、`stopped_at_captcha`、`failed`。
  - `stopped_at_captcha` 明确展示“已停在官方验证码前，尚未提交”，并说明 VIZA 没有识别 CAPTCHA、没有点击「确认资料」最终提交。
  - `failed` 展示脱敏失败类别和行动建议：缺必填字段、缺文件/文件不合格、官网字段变化、OTP 超时、网络/官网连接失败、未知需人工复核。
  - 失败定位只显示 field/doc key，例如 `field:household_revoked`、`doc:eligibility_supporting_document_3`，不展示原始错误整段或申请人敏感资料。
- `viza-fe/internal-website/app/client/application/_components/result-cards/SubmissionStatusStep.tsx`
  - 台湾申请 active queue/snapshot 优先渲染 `TwResultCard`，不再掉回通用 WaitingCard/FailureCard 文案。
  - 将 queue `currentStage` 合成为台湾状态卡可识别状态；例如 `uploading_documents` → `uploading`。
  - 台湾重试 loading 文案改为“官网自动填写任务重新排队；不会处理 CAPTCHA 或最终提交”，不再显示通用“自动提交/Fly 云端任务”。
- `viza-fe/internal-website/lib/submission-result.ts`
  - 前端 `TwSubmissionResult` 扩展为八状态 union。
  - 删除前端台湾 `captchaAutoFilled` 字段。
  - 将 `portalUrl` 注释改为诊断用途，明确普通官网 URL 不是 resumable handoff。
- `viza-fe/internal-website/app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx`
  - 新增 focused tests：八状态映射、验证码前停点不渲染官网链接、缺字段/缺文件/OTP 失败分类、submission status poll 的 Taiwan `currentStage` 映射。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 更新旧冲突测试：现在断言 stopped_at_captcha 不提供普通官网接续链接。

### 第二阶段验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx`
  - 通过：`2` 个测试文件，`9` 个测试全部 passed。
- `cd viza-fe/internal-website && npm run type-check`
  - 未通过，但失败项不在本轮台湾文件：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺少 `playwright` 类型/module。
  - 未发现台湾变更相关 type-check error 输出。

### 第二阶段发现与剩余阻断

- 前端现在不会再承诺“已自动提交”或“打开普通官网即可继续已填申请”。
- `stopped_at_captcha` 仍然是人工/运营后续动作；前端仅诚实展示停在 CAPTCHA 前，不能关闭 TW-G0 的同会话交接问题。
- 若 runner/queue 继续使用未枚举的 `current_stage` 文本，前端会 fallback 到 `queued` 或按关键词归类；建议 TW-A/TW-G 后续稳定传入这组八状态之一，或至少保持 `logging_in`、`otp_required`、`filling_fields`、`uploading_documents`、`validating_*`、`captcha_boundary` 这类可识别 stage。
- 失败分类是前端脱敏归因，不替代 runner 的结构化错误合同；后续最好让 runner 写入 `errorCode`、`missingFields`、`missingDocuments`，减少对错误字符串的解析。

### 第二阶段给其他工作包的接口变化

- 前端 `TwSubmissionResult.status` 现在接受：
  - `queued`
  - `logging_in`
  - `otp_required`
  - `filling`
  - `uploading`
  - `validating`
  - `stopped_at_captcha`
  - `failed`
- 前端不再使用 `captchaAutoFilled`。
- 前端可读取但不渲染 `portalUrl`；不要把普通官网 URL 当成交接链接。
- 可选新字段：`currentStage?: string | null`、`errorCode?: string`、`missingFields?: string[]`、`missingDocuments?: string[]`。

## 计划与执行

1. 已完整阅读 `docs/taiwan-launch-coordination.md`，确认只执行第一波 `TW-C`：前端真实体验审计、证据收集和新增测试。
2. 只读检查台湾目的地入口、长表单、动态表单、Documents、提交状态、结果卡、submission result 类型和 runner 会话关闭证据。
3. 新增 focused 前端审计测试，固定当前真实渲染路径和当前结果卡冲突文案。
4. 运行 focused 测试并记录结果。
5. 将 smoke 清单、发现、证据、建议修改文件、阻断项和接口变化写入本 worklog。

## 验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx`
- 结果：通过。`components/__tests__/taiwan-frontend-experience-audit.test.tsx (4 tests) 117ms`，`Test Files 1 passed (1)`，`Tests 4 passed (4)`。
- 未运行全量 lint/type-check/e2e；本阶段只跑 focused 前端测试，避免触碰其他并行改动和环境依赖。
- 未做真实台湾官网提交、未做 CAPTCHA 自动化、未运行 migration、未部署。

## 新增测试证据

- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx:52`：确认 `TW_ENTRY_PERMIT` 在 `DynamicStepForm` 中走中文单列真实渲染路径，不显示英文列/英文 placeholder。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx:82`：确认台湾英文姓名输入会转大写，中文姓名 blur 后会简转繁。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx:114`：确认台湾配置里的条件字段/section：其他国籍 step 只在 `has_other_nationality_passport=yes` 时显示；无大陆身份证时隐藏大陆身份证号码；出生地为其他、职业为自由业时对应条件字段进入 review section。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx:136`：第二阶段已更新为断言 `stopped_at_captcha` 不提供普通官网接续链接，只说明验证码前停点且尚未提交。

## 只读审计发现

### TW-C-1 / 历史阻断：结果卡交互与服务器会话关闭冲突

- 第一阶段发现位置：`viza-fe/internal-website/app/client/application/_components/result-cards/TwResultCard.tsx`。
- 第一阶段旧文案曾声称“已在移民署境外人士线上申办系统上，用你保存的答案自动填写完整份申请表，一路填到验证码页为止”，CTA 为“打开移民署官网，输入验证码并送出”。
- 第二阶段已移除该前端文案和普通官网 CTA；`stopped_at_captcha` 现在只说明官方验证码待处理且尚未提交。
- 后端会话证据：`viza-be/submission-service/src/tw/apply.ts` 在返回 `stopped_at_captcha` 后的 `finally` 执行 `session.close()`；`src/tw/session.ts` 的 close 会关闭 Playwright context/browser。
- 结论：用户点击结果卡在本机新开官网，只会得到一个新的官方浏览器会话；没有同一 server browser context、远程接续 token、cookie/session handoff 或持久账号。它不能看到服务器无头浏览器里已填写的表单。此项对应协调文档 `TW-G0`，公开上线阻断。

### TW-C-2 / 真实渲染路径已确认，但依赖已有未提交改动

- 目的地入口存在：`viza-fe/internal-website/lib/visa-destinations.ts` 中 `country: "taiwan"`、`visaType: "TW_ENTRY_PERMIT"`。
- 动态表单路径存在：`/client/application?country=taiwan&visaType=TW_ENTRY_PERMIT` 会跳到 `/client/application/long-form?...`；长表单渲染 `DynamicStepForm`，并传入 `country`/`visaType`。
- `DynamicStepForm` 中 `CHINESE_ONLY_VISA_TYPES = new Set(["TW_ENTRY_PERMIT"])`，中文界面下为单列中文渲染。
- 注意：这些前端文件当前处于未提交修改状态，可能属于其他工作包/既有基线；TW-C 未修改它们。

### TW-C-3 / Documents 资格材料筛选走真实加载路径，但受 DB 状态阻断

- `viza-fe/internal-website/app/client/documents/actions.ts` 会从 `document_requirements` 加载材料要求。
- 台湾专属筛选逻辑存在：`isTwEntryPermitApplication` + `filterTwEligibilityRequirements` 会读取 `answers.eligibility_category`，仅保留 `eligibility_supporting_document_${category}`。
- 风险：如果 `0123_tw_entry_permit_document_requirements_zh_and_eligibility_split.sql` 未由授权人员执行，前端无法展示“一类资格只对应一份资格证明”的最终生产数据。本阶段未写 DB，无法在线验证真实 rows。

### TW-C-4 / 提交状态可显示 TW 结果卡，但终端状态命名需第二阶段复核

- `SubmissionStatusStep` 已按 `result.country === "TW"` 渲染 `TwResultCard`。
- `lib/application-submission-display.ts` 的终端状态集合未包含 `stopped_at_captcha`；只要 `submissionResult` 存在仍会显示状态页，但“durable terminal result”判断是否会影响台湾后续导航/轮询，需要 TW-04/TW-G 复核。

### TW-C-5 / 前端队列状态/provider 对台湾仍偏泛化

- `lib/submission-queue.ts` 未为 `TW_ENTRY_PERMIT` 返回台湾专属 queue status/provider；默认是 `pending`/`null`。
- 后端 dispatch/registry 已有台湾 runner 路由证据，但前端申请提交时是否总能进入正确队列，应由 TW-04/TW-G 在交接模型确定后补一条集成测试确认。

## 可重复 Smoke 清单

### 自动化 smoke

1. `cd viza-fe/internal-website`
2. `npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx`
3. 期望：4 个测试全部通过。

### 本地人工 smoke（不点官网确认资料、不做 CAPTCHA 自动化）

1. 登录本地测试用户，打开 `/client/application?country=taiwan&visaType=TW_ENTRY_PERMIT`。
2. 确认跳转到 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`。
3. 在动态表单中确认台湾表单为简体中文单列，不出现中英双列。
4. 输入英文姓名小写，确认输入值立即转大写；输入中文姓名简体，离开输入框后转繁体。
5. 切换 `has_other_nationality_passport`、`mainland_id_number_not_applicable`、`birth_place_is_mainland`、`current_occupation`，确认条件字段显示/隐藏与新增测试一致。
6. 在 Documents 步骤选择不同 `eligibility_category` 的申请答案后刷新材料页，确认只出现对应的一份 `eligibility_supporting_document_1..4`。若未出现，先检查 `0123` 是否已由授权人员执行。
7. 模拟/等待台湾 runner 返回 `result.country="TW"`、`status="stopped_at_captcha"` 后查看结果卡；不要点击官方“确认资料”，不要自动处理 CAPTCHA。
8. 记录结果卡是否仍提供普通官网链接。若 runner 仍关闭 server browser session，则该链接应视为空白新会话入口，不是可接续入口。

## 第一阶段建议修改文件与精确方向（第二阶段已部分完成）

- `viza-fe/internal-website/app/client/application/_components/result-cards/TwResultCard.tsx`
  - 在 TW-G0 决策前不要继续承诺“用户另开官网即可在已填写申请上输入验证码并送出”。
  - 若选择“人工协助会话/用户可接续远程会话”，CTA 必须使用同一远程浏览器会话的短时接续链接，并明确会话有效期、谁输入 OTP/CAPTCHA、谁点击确认。
  - 若选择“资料包模式”，删除“已自动填写完整份申请表”“一路填到验证码页”“打开官网输入验证码并送出”等文案，改为资料包/清单交付文案。
- `viza-fe/internal-website/lib/submission-result.ts`
  - 将 `TwSubmissionResult.portalUrl` 语义与真实能力对齐；普通官网 URL 不应被描述成“finish themselves”的接续入口。
  - 移除或隔离 `captchaAutoFilled` 等与 TW-G1 冲突的类型字段，除非 TW-A 已完全处理且前端不再使用。
  - 如 TW-G0 选择远程接续，新增明确字段如 `handoffMode` / `handoffUrl` / `expiresAt` / `manualAction`，不要复用普通 `portalUrl` 表达会话接管。
- `viza-fe/internal-website/app/client/application/_components/result-cards/SubmissionStatusStep.tsx`
  - 保持 TW 专属结果卡路由，但补测 `stopped_at_captcha`、`failed`、无 handoff URL 三种状态。
- `viza-fe/internal-website/lib/application-submission-display.ts`
  - 复核是否需要将 `stopped_at_captcha` 纳入台湾终端/人工行动状态，避免状态页轮询和导航把它当作非终态。
- `viza-fe/internal-website/lib/submission-queue.ts`
  - 复核 `TW_ENTRY_PERMIT` 是否需要台湾专属 queue status/provider，或明确由后端按 application country/visa_type 路由；补一条 focused test。
- `viza-fe/internal-website/app/client/documents/actions.ts`
  - 若 TW-B/TW-05 关闭 G2/G3 后数据合同稳定，保留当前资格材料筛选；补 Documents 层测试覆盖 category 1..4 和缺失答案 fallback。

## 阻断/需要决策

- `TW-G0` 未关闭：交接模型未定，且当前 runner 关闭浏览器后前端仍给普通官网链接。
- `TW-G2` 未由本任务验证：`0123` 是否已在共享 Supabase 执行未知；TW-C 未触碰数据库。
- 无法在本阶段提供真实官网同会话截图：协调文档禁止真实提交/CAPTCHA 自动化；当前产品也没有远程接续链接可截图。

## 给其他工作包的接口变化

- 无接口变化。
- 新增测试只记录当前前端事实和冲突文案；未来 TW-04 修改结果卡文案/交接模型时，应同步更新 `taiwan-frontend-experience-audit.test.tsx` 中最后一条“current result-card conflict”测试为新的期望。

## 2026-08-03 申请完整性与缺失材料导航

### 计划

1. 用真实 `visa_form_fields`、`validation_rules.required_when` / `required_unless`、`conditional_logic.showIf` 和 `document_requirements` 计算缺失项，不在前端另写一份静态台湾清单。
2. 在确认/提交页展示“还缺 X 项信息、Y 份材料”，拆分为“缺失信息”和“缺失材料”两组。
3. “去填写”切到对应 long-form step，滚动并聚焦 `field_name`；未触发或隐藏条件字段不得进入清单。
4. “去上传”切到 Documents/supporting materials step，定位 `requirement_key` 对应上传卡，显示上传说明并高亮。
5. 提交/重试前服务端再次检查完整性；清单未清零时禁止进入 `runner_job`。
6. 增加 focused tests，并记录 type-check 中仍存在的无关阻断。

### 实现结果

- 新增可复用完整性计算器：`viza-fe/internal-website/lib/application-completeness.ts`
  - 输出稳定 `fieldName`、`stepNumber`、`requirementKey`、中英文展示名称和材料说明。
  - 表单缺失项按动态 schema 当前答案计算：只列出可见且当前条件触发的 required 字段。
  - 材料缺失项按 `document_requirements` + 当前答案计算：台湾当前支持 `mainland_id_card_scan`、`eligibility_supporting_document_1..4`、`hk_macau_id_scan`、`other_nationality_passport_scan` 的条件/类别过滤。
  - 不输出申请答案值、文件名、文件路径、密钥、Cookie、OTP 或截图。
- 新增只读缺失接口：`viza-fe/internal-website/app/api/applications/[id]/completeness/route.ts`
  - 通过当前用户/legacy client session 做 application ownership 检查。
  - 仅读取 schema、answers 的字段 key/value 用于计算、document requirements 和安全 document status；响应只返回缺失 key 与展示文案。
- 修改台湾提交/重试保护：`viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
  - `TW_ENTRY_PERMIT` live assisted 在 `insertTaiwanRunnerJob()` 前调用完整性检查。
  - 若不完整，返回 `422 application_incomplete` 和安全缺失清单，不创建 `runner_job`，不更新 application 为 processing。
- 新增确认页缺失面板：`viza-fe/internal-website/app/client/application/_components/ApplicationCompletenessPanel.tsx`
  - 顶部显示“还缺 X 项信息、Y 份材料”或“资料已完整，可以继续提交”。
  - 缺失信息显示中文字段名、所属步骤、“去填写”。
  - 缺失材料显示中文材料名、材料说明、“去上传”。
- 更新 long-form 页面：`viza-fe/internal-website/app/client/application/long-form/page.tsx`
  - 进入 Review/Team/Confirmation 时自动刷新完整性。
  - 保存字段、继续 Documents、上传成功后自动刷新完整性。
  - 有缺失项时确认页提交按钮被缺失状态阻断；点击提交仍会做服务端重查，避免绕过前端。
  - “去填写”切到对应动态 step 并设置 `focusFieldName`；“去上传”切到 Documents step 并设置 `highlightRequirementKey`。
  - 支持 `step=documents&requirementKey=...` deep-link 打开 Documents 并定位材料卡。
- 更新动态表单与 Documents：
  - `viza-fe/internal-website/components/dynamic-step-form.tsx` 给真实渲染字段增加 `data-field-name`、滚动、聚焦和短暂高亮。
  - `viza-fe/internal-website/app/client/documents/document-center-client.tsx` 给上传卡增加 `data-requirement-key`、高亮/滚动能力；上传/复用成功后通知页面刷新完整性。

### 当前测试申请覆盖

- 目标测试申请：`applicationId=6f64272e-1af6-4a48-8525-fcabc5276308`
- 当前功能路径可列出并导航：
  - `mainland_id_card_scan`：当 `mainland_id_number_not_applicable` 未勾选时由材料条件触发，显示在“缺失材料”，点击“去上传”打开 Documents step 并高亮该上传卡。
- 2026-08-03 TW-A 官网只读复核后修正：当前测试申请为新加坡递送地 + 留学生路径，不应列出 `household_revoked`；该字段只在 `eligibility_category=2` 且 `embassy_office in ["50","51"]` 时显示/必填。

### 验证命令与结果

- `cd viza-fe/internal-website && npm test -- --run lib/__tests__/application-completeness.test.ts app/client/documents/__tests__/tw-documents-eligibility.test.tsx components/__tests__/taiwan-frontend-experience-audit.test.tsx 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts'`
- 结果：通过。`Test Files 4 passed (4)`，`Tests 29 passed (29)`。
- 覆盖点：
  - 条件字段未触发时不列出。
  - 条件字段触发且为空时列出。
  - `mainland_id_card_scan` 缺失材料导航锚点正确。
  - 补齐答案和材料后清单清零。
  - 有缺失项时 `retry-submission` 返回 `application_incomplete`，不会创建台湾 `runner_job`。
  - 非台湾国家仍只按通用 required document 规则处理，不吃台湾专属条件。
  - 台湾地址/坏翻译/required badge 既有 focused 测试仍通过。
- `cd viza-fe/internal-website && npm run type-check -- --pretty false`
- 结果：失败，但只剩既有无关阻断：
  - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
  - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` 类型/模块。
  - 本次台湾完整性改动相关类型未再报错。

### 页面入口与 smoke 步骤

1. 打开台湾 long-form：`/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&applicationId=6f64272e-1af6-4a48-8525-fcabc5276308`
2. 进入确认/提交步骤；页面顶部应显示“还缺 X 项信息、Y 份材料”。
3. 当前测试申请不应因为缺 `household_revoked` 被阻断；只有 `eligibility_category=2` 且 `embassy_office=50/51` 的测试路径才应显示该缺失字段。
4. 点击 `mainland_id_card_scan` 的“去上传”；应切到 Documents/supporting materials step，`mainland_id_card_scan` 上传卡滚动到中间并高亮，卡片显示上传说明。
5. 保存字段或上传材料后，确认页缺失清单应自动重新检查；已补齐项目立即消失。
6. 缺失清单未清零时点击提交/重试，前端停在确认页；服务端 `retry-submission` 也返回 `422 application_incomplete`，不会创建 `runner_job`。
7. 全部补齐后，确认页显示“资料已完整，可以继续提交”，才允许继续安全 smoke 流程。

### 阻断项与后续需要 TW-G/发布处理

- 未部署：本次只改代码和测试，未部署 production。需要 TW-G/发布负责人部署 `internal-website` 后，production 才能看到缺失清单、字段聚焦和材料高亮。
- 未执行 DB 写入：本次不需要新的 migration/production 写入；依赖 0124 已同步的 production 台湾字段元数据和既有 `document_requirements`。
- 未创建 `runner_job`、未进入台湾官网、未处理 OTP/CAPTCHA、未付款、未做官方最终提交。
- 建议 TW-A 在 TW-G 部署后重新做 production 视觉复核：确认 `household_revoked` 与 `mainland_id_card_scan` 在测试申请中能被列出并一键导航。

### 接口变化

- 新增 `GET /api/applications/{applicationId}/completeness`
  - 成功响应：`{ ok: true, applicationId, completeness }`
  - `completeness` 包含：
    - `complete`
    - `missingInfoCount`
    - `missingDocumentCount`
    - `missingInfo[]`: `fieldName`, `labelZh`, `labelEn`, `stepNumber`, `stepName`, `stepLabelZh`
    - `missingDocuments[]`: `requirementKey`, `documentType`, `labelZh`, `labelEn`, `description`, `required`
  - 响应不包含申请答案、文件路径、文件名、账号、OTP、Cookie、密钥或截图。
- `POST /api/applications/{applicationId}/retry-submission` 台湾 live assisted 新增安全失败：
  - `422`
  - `code: "application_incomplete"`
  - `completeness` 为同一安全缺失清单。

## 2026-08-03 `household_revoked` 条件合同修复

### 官网事实输入

- TW-A 官网只读核对确认：
  - DOM 存在 `name="householdRevoked"`，外层为 `#household-revoked-div`。
  - 当前新加坡递送地 + 留学生路径为 `display:none`，不需要回答。
  - 官网 showIf：`traveller.applyQualification === "5" AND overseaOfficeId in ["50","51"]`。
  - VIZA 映射：`eligibility_category === "2" AND embassy_office in ["50","51"]`。
- 结论：`household_revoked` 无条件 required 是错误的；当前测试 application `6f64272e-1af6-4a48-8525-fcabc5276308` 不应因缺该字段被阻断。

### 实现结果

- Seed/schema metadata：
  - `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - `household_revoked.required` 改为 `false`。
  - 新增 `validation_rules.required_when = "eligibility_category === 2 && embassy_office in [50, 51]"`。
  - 新增 `conditional_logic.showIf = "eligibility_category === 2 && embassy_office in [50, 51]"`。
- 前端旧 wizard config：
  - `viza-fe/internal-website/components/client/wizards/tw/config.ts`
  - `basic_status` 和 review 只在 `eligibility_category=2` 且 `embassy_office=50/51` 时显示 `household_revoked`。
- 前端双语/schema normalization：
  - `viza-fe/internal-website/lib/bilingual-schema-contract.ts` 已确认没有 `household_revoked` 的 TW-only 无条件 required override；新增测试锁定它保持 `required=false` 并保留条件 metadata。
- 动态表单与完整性检查：
  - 动态表单继续使用真实 `conditional_logic.showIf` 与 `validation_rules.required_when`；触发时显示 required badge，不触发时隐藏且不校验。
  - `viza-fe/internal-website/lib/application-completeness.ts` 通过同一 schema 条件计算缺失项；当前新加坡 + 留学生路径不列出 `household_revoked`。
- Runner normalize/apply：
  - `viza-be/submission-service/src/tw/normalize.ts`
    - 新增 `isTwHouseholdRevokedRequiredFromAnswers()`。
    - 仅在 `eligibility_category=2 && embassy_office in [50,51]` 时 require/output `household_revoked`。
    - 非触发路径即使缺值也不报 missing、不输出该字段。
  - `viza-be/submission-service/src/tw/apply.ts`
    - 仅在同一条件触发时填写官方 `householdRevoked`。
    - 触发但缺值时传 `undefined` 给 strict filler，避免把缺失误当成 `N`。

### 已准备但未执行的 production metadata SQL

- 新增文件：`viza-be/agent-backend/drizzle/0125_tw_household_revoked_conditional_metadata.sql`
- 范围：
  - 仅作用 `public.visa_form_fields`
  - 仅 `visa_type='TW_ENTRY_PERMIT'`
  - 仅 `field_name='household_revoked'`
  - 幂等 `ON CONFLICT (visa_type, field_name) DO UPDATE`
  - 不删除字段，不修改 application answers/documents/queues/packages/users/payments/runner state/OTP/CAPTCHA/cookies/uploads。
- 预期影响：
  - upsert 1 row。
  - production 现有 `household_revoked.required=true` 将变为 `false`。
  - `validation_rules.required_when` 与 `conditional_logic.showIf` 都变为 `eligibility_category === 2 && embassy_office in [50, 51]`。
- 执行前只读 SQL：
  - `SELECT visa_type, field_name, required, validation_rules, conditional_logic FROM public.visa_form_fields WHERE visa_type = 'TW_ENTRY_PERMIT' AND field_name = 'household_revoked';`
- 执行后验证 SQL：
  - SQL 已写在 `0125` 文件注释中，检查 `required=false`、`required_when_ok=true`、`show_if_ok=true`。
- 回滚方案：
  - SQL 已写在 `0125` 文件注释中；仅在明确授权时把该行恢复为 `required=true`、清空 `conditional_logic` 并移除 `required_when`。
- 本轮未执行 production SQL；新的 production 写入需要用户再次批准。

### 测试结果

- `cd viza-fe/internal-website && npm test -- --run lib/__tests__/application-completeness.test.ts components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts`
  - 通过：`Test Files 3 passed (3)`，`Tests 33 passed (33)`。
  - 覆盖：
    - `category=2 + office=50/51` 显示且 required。
    - `category=2 + office=53` 隐藏。
    - `category=1 + office=50` 隐藏。
    - 当前新加坡 + 留学生路径不列入缺失、不阻断完整性。
- `cd viza-fe/internal-website && npm test -- --run app/client/documents/__tests__/tw-documents-eligibility.test.tsx 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts'`
  - 通过：`Test Files 2 passed (2)`，`Tests 12 passed (12)`。
- `cd viza-be/agent-backend && npm test -- --run src/tests/tw-entry-permit-schema.test.ts`
  - 通过：`Test Files 1 passed (1)`，`Tests 11 passed (11)`。
- `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/normalize.spec.ts`
  - 通过：`tests 11`，`pass 11`。
- `cd viza-be/agent-backend && npm run type-check -- --pretty false`
  - 通过。
- `cd viza-be/submission-service && npm run type-check -- --pretty false`
  - 通过。
- `cd viza-fe/internal-website && npm run type-check -- --pretty false`
  - 失败，但仍只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` 类型/模块。
- 误触发说明：
  - `cd viza-be/submission-service && npm test -- --run src/tw/__tests__/normalize.spec.ts` 实际被 package script 展开成全量 `src/**/*.spec.ts`，不是 focused；台湾 normalize 用例在该输出中通过，但全量被缺 Supabase env 和既有无关测试失败阻断。随后已用 `node --import tsx --test src/tw/__tests__/normalize.spec.ts` 单文件重跑并通过。

### 当前结论

- 代码侧已修复：当前测试申请不再应因缺 `household_revoked` 被完整性检查或 runner readiness 阻断。
- production 仍需授权执行 `0125` metadata correction；在执行前，production DB 可能仍保留 0124 写入的 `required=true`。
- 未部署、未执行 production SQL、未创建 `runner_job`、未进入台湾官网、未处理 OTP/CAPTCHA、未付款、未做 git 操作。

## 2026-08-03 资格 4「应检附文件」官网截图逐行核对

### 输入与边界

- 用户提供官网截图：`Screenshot 2026-08-03 at 14.15.29.png`。
- 专属范围：申请资格第 4 类「旅居国外或香港、澳门取得当地依亲居留权且有财力证明」。
- 本轮只按截图中实际出现的附件表逐行抄录；未进入台湾官网、未提交、未处理 OTP/CAPTCHA、未付款、未部署、未执行 production DB 写入、未修改产品代码。
- 红星 `*` 视为当前资格下必传；无红星但出现在同一官网附件表的行视为当前资格相关条件/情形适用材料，应保留在资格 4 清单中，但不放进旧的泛化「可选补充材料」区块。

### 截图逐行抄录

| 顺序 | 官网附件行原文 | 红星 | 判定 | 建议 VIZA requirement_key | 显示/触发条件草案 |
|---:|---|---|---|---|---|
| 1 | 大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件 | 是 | 资格 4 必传 | `mainland_travel_document` | `eligibility_category === "4"` |
| 2 | 现住地依亲居留权证明及等值新台币十万元以上存款且备有金融机构出具一个月之内证明，且存款期间须达一个月以上。 | 是 | 资格 4 必传核心资格证明 | `eligibility_supporting_document_4` | `eligibility_category === "4"` |
| 3 | 旅居香港或澳门之申请人，须附香港或澳门居民身份证(正、反面)及有效香港或澳门签证(11岁以下免附) | 否 | 资格 4 表内情形适用材料；不可放入泛化可选区 | `hk_macau_id_scan` | `eligibility_category === "4"` 且申请人为旅居香港/澳门；现有可先映射 `embassy_office in ["50","51"]`，但需确认它是否等同“旅居香港或澳门” |
| 4 | 其他相关证明文件(若无要求则免附，申请人如旅居日本，请上传3个月内住民票) | 否 | 资格 4 表内情形适用材料；不可放入泛化可选区 | `other_supporting_document` 或新增更精确 key `japan_residence_record` 待确认 | `eligibility_category === "4"` 且官方/运营要求补件；如旅居日本则需要触发字段。可能需要新增“现住地/旅居地是否日本”或基于日本办事处/居留地字段判断，不能只靠旧可选材料 |
| 5 | 具有他国国籍护(证)照文件 | 否 | 资格 4 表内情形适用材料；不可放入泛化可选区 | `other_nationality_passport_scan` | `eligibility_category === "4"` 且 `has_other_nationality_passport === "yes"` |
| 6 | 大陆身份证（正、反面） | 是 | 资格 4 必传 | `mainland_id_card_scan` | `eligibility_category === "4"`；截图红星显示资格 4 下必传。若 VIZA 仍保留“无大陆身份证号码”豁免，需要与官网表再次核对同一路径截图/HTML，避免旧逻辑覆盖本截图事实 |

### 准备加入资格 4 的材料清单

1. `mainland_travel_document`
   - 中文显示：大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件
   - 必传：是
   - 条件：`eligibility_category === "4"`
2. `eligibility_supporting_document_4`
   - 中文显示：现住地依亲居留权证明及等值新台币十万元以上存款且备有金融机构出具一个月之内证明，且存款期间须达一个月以上。
   - 必传：是
   - 条件：`eligibility_category === "4"`
3. `hk_macau_id_scan`
   - 中文显示：旅居香港或澳门之申请人，须附香港或澳门居民身份证(正、反面)及有效香港或澳门签证(11岁以下免附)
   - 必传：否，表内情形适用
   - 条件草案：资格 4 + 旅居香港/澳门。现有字段可暂用 `embassy_office in ["50","51"]`，但这需要确认是否准确等同“旅居香港或澳门”。
4. `other_supporting_document` 或新增 `japan_residence_record`
   - 中文显示：其他相关证明文件(若无要求则免附，申请人如旅居日本，请上传3个月内住民票)
   - 必传：否，表内情形适用
   - 条件草案：资格 4 + 官方/运营要求补件；如旅居日本则应触发。可能需要新增触发字段或从现住地/办事处推导，等待确认。
5. `other_nationality_passport_scan`
   - 中文显示：具有他国国籍护(证)照文件
   - 必传：否，表内情形适用
   - 条件：资格 4 + `has_other_nationality_passport === "yes"`
6. `mainland_id_card_scan`
   - 中文显示：大陆身份证（正、反面）
   - 必传：是
   - 条件：`eligibility_category === "4"`。是否还允许“无大陆身份证号码”豁免，需要用户/官网同路径补充证据；本截图本身显示红星。

### 是否需要新增触发字段

- 可能需要：
  - “旅居香港或澳门”触发来源：如果 `embassy_office=50/51` 只是递送办事处而不等同居住地，则不能直接用它决定 `hk_macau_id_scan`。
  - “旅居日本”触发来源：截图明确日本住民票是情形适用材料，但当前 VIZA 是否有可稳定判断旅居日本的字段需复核；若没有，需要新增触发字段或运营标记。
  - “官方/运营要求其他相关证明文件”：截图写“若无要求则免附”，这更像运营/官网要求触发，不应作为普通可选补充材料泛展示。
- 待确认：`mainland_id_card_scan` 是否在资格 4 下无条件必传，或是否存在另一张勾选“无大陆身份证号码”后的官网附件表。当前截图按红星处理为必传。

### 等待用户确认

- 本轮先不改产品代码和 DB。
- 等用户确认上述资格 4 材料清单、key、触发条件后，再进入代码/metadata 变更准备。

## 2026-08-03 主协调补充修复 — Radix Select 空值循环

- 背景：用户本地页面在重启 dev server 后仍出现 `Maximum update depth exceeded`，堆栈指向 `components/ui/select.tsx`、`DynamicFormField`、`DynamicStepForm.renderSide`。
- 根因补充：上一轮用 hidden sentinel `SelectItem` 表示空值，可能被 Radix Select 作为真实 item 参与受控值同步；在台湾出生地/地址等 select 初始空值场景下，仍可能触发空值与 placeholder 之间的重复更新。
- 修复范围：主协调在本地直接修改 `viza-fe/internal-website/components/dynamic-form-field.tsx`，移除 hidden empty sentinel item；普通 select 空值改为 `value={undefined}` 显示 placeholder；`onValueChange` 对空值或同值直接返回；渲染 `SelectItem` 时过滤空 value。
- 验证：`cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx`，结果 `16/16 passed`。
- 本轮未部署、未写 production DB、未进入台湾官网、未处理 OTP/CAPTCHA、未付款、未做 git commit/stash/reset/checkout。

## 2026-08-03 资格 4 Documents 合同实现准备（未执行生产写入）

### 用户确认

- 用户回复 `ok` 后，TW-C 将上述资格 4 截图清单纳入代码/metadata 准备包。
- 仍遵守边界：未执行 production DB 写入、未部署、未创建 `runner_job`、未进入台湾官网、未处理 OTP/CAPTCHA、未付款、未做 git commit/stash/reset/checkout。

### 已改代码

- `viza-fe/internal-website/app/client/documents/actions.ts`
  - `DocumentRequirement` 增加 `applicability` / `metadata`，让同一官网附件表内的非红星材料可标记为 `conditional`，不再混入泛化“可选补充材料”。
  - 台湾 TW_ENTRY_PERMIT Documents 读取更多安全条件答案：`eligibility_category`、`embassy_office`、`has_other_nationality_passport`、`mainland_id_number_not_applicable`。
  - 资格 4 下：
    - `mainland_travel_document` required，显示截图红星文案。
    - `eligibility_supporting_document_4` required，显示“依亲居留权 + 等值新台币十万元以上存款证明”。
    - `mainland_id_card_scan` required，即使旧无大陆身份证豁免逻辑存在，也不把截图红星项显示为普通选填。
    - `hk_macau_id_scan`、`other_supporting_document`、`other_nationality_passport_scan` 标为表内情形适用；其中他国护照在 `has_other_nationality_passport` 为 yes/true/1 时升级为 required。
  - 过滤旧的 lumped `eligibility_supporting_document`，避免生产若仍残留旧 row 时重复显示。
- `viza-fe/internal-website/app/client/documents/document-center-client.tsx`
  - 新增独立“情形适用材料”分组。
  - “可选补充材料”恢复只承载真正可选材料，避免所有台湾非红星材料被泛化。
  - 台湾专用内置 label 更新为截图口径：`mainland_travel_document`、`eligibility_supporting_document_4`、`hk_macau_id_scan`、`other_supporting_document`。
- `viza-fe/internal-website/lib/application-completeness.ts`
  - 资格 4 下 `mainland_id_card_scan` 作为 required missing document 计算。
  - `hk_macau_id_scan` 仍只在港澳受理条件触发时列为缺失；`other_nationality_passport_scan` 仍只在其他国籍护照条件触发时列为缺失；`other_supporting_document` 无明确触发字段时不阻断。
  - 过滤旧 `eligibility_supporting_document`。
- `viza-be/submission-service/src/queue/halt-runners.ts`
  - runner 前缺材料守门同步：资格 4 下 `mainland_id_card_scan` 必须存在，否则不会进入官网自动流程。
- `viza-be/submission-service/src/tw/apply.ts`
  - 上传逻辑同步：资格 4 下即使 `mainland_id_number_not_applicable === "true"`，也会尝试上传官网红星的 `mainland_id_card_scan`；不改变 CAPTCHA/最终提交边界。

### 待批准 metadata SQL

- 新增但未执行：
  - `viza-be/agent-backend/drizzle/0126_tw_eligibility_4_document_requirements.sql`
- 范围：
  - 仅 `public.document_requirements`
  - 仅 `country='taiwan' AND visa_type='TW_ENTRY_PERMIT'`
  - upsert active Taiwan TW_ENTRY_PERMIT package rows
  - 不触碰 `application_documents`、`visa_application_answers`、storage paths、users、payments、queues、OTP/CAPTCHA、Cookie 或其他国家
- 目标 keys：
  - required/red-star: `mainland_travel_document`、`eligibility_supporting_document_4`、`mainland_id_card_scan`
  - table conditional: `hk_macau_id_scan`、`other_nationality_passport_scan`、`other_supporting_document`
- SQL 内已写入执行前查询、执行后验证 SQL、影响 logical keys 和 rollback metadata-only 草案。
- 当前状态：等待主协调/用户另行授权；本轮没有执行 production SQL。

### 测试结果

- `cd viza-fe/internal-website && npm test -- --run app/client/documents/__tests__/tw-documents-eligibility.test.tsx lib/__tests__/application-completeness.test.ts`
  - 通过：`Test Files 2 passed (2)`，`Tests 14 passed (14)`。
  - 覆盖：
    - 资格 1-4 只显示对应资格证明材料。
    - 资格 4 红星材料进入“必需材料”。
    - 资格 4 同表非红星材料进入“情形适用材料”，不进入泛化“可选补充材料”。
    - `mainland_id_card_scan` 资格 4 下 required missing document。
    - 港澳/他国护照条件触发时列缺，未触发时不列缺。
- `cd viza-fe/internal-website && npm test -- --run app/client/documents/__tests__/tw-documents-eligibility.test.tsx -t "eligibility 4 red-star"`
  - 通过：1 个资格 4 专项测试通过。
- `cd viza-be/agent-backend && npm test -- --run src/tests/tw-entry-permit-schema.test.ts -t "eligibility 4 document requirement sync|runner-required material"`
  - 通过：2 个相关测试通过，10 skipped。
- `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/normalize.spec.ts`
  - 通过：`tests 11`，`pass 11`。
- `cd viza-be/submission-service && npm run type-check`
  - 通过。
- `cd viza-fe/internal-website && npm run type-check`
  - 失败，仍是既有无关 Travel 阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。
- `cd viza-be/agent-backend && npm test -- --run src/tests/tw-entry-permit-schema.test.ts`
  - 全文件仍有既有无关阻断：受理单位 option 常量期望只有旧 14 项，但当前 seed 返回 28 项；本轮新增的资格 4 material sync / runner required tests 已用 `-t` 单独通过。

### 剩余确认/阻断

- `hk_macau_id_scan` 的缺失阻断条件仍沿用现有 `embassy_office in ["50","51"]`；截图文字是“旅居香港或澳门之申请人”，若递送办事处不等同旅居地，需要 TW-A/官网 DOM 或新增字段进一步确认。
- `other_supporting_document` / 日本住民票目前显示为情形适用但不阻断；因为截图写“若无要求则免附”，当前没有安全触发字段判断“旅居日本”或“官方/运营要求补件”。
- 资格 4 截图红星显示 `mainland_id_card_scan` 必传；若未来用户提供“无大陆身份证号码”勾选后的同路径附件表，需再复核是否存在官方豁免。
- 生产要看到 DB metadata 同步后的 `applicability` 等字段，需要另行授权执行 `0126`；前端已有代码兜底和分组能力，但生产 DB 不会自动改变。

## 2026-08-03 本地 Dynamic Select runtime error 修复

### 输入与边界

- 用户截图显示本地前端红屏：
  - `Maximum update depth exceeded`
  - 堆栈顶部：`components/ui/select.tsx` / `DynamicFormField` select trigger / `DynamicStepForm.renderSide`
- 本轮只处理前端 runtime error；未部署、未写 production DB、未进入台湾官网、未处理 OTP/CAPTCHA、未付款、未做 git commit/stash/reset/checkout。
- 按协调要求未改 agent-backend seed/schema tests；TW-B 正在处理出生地 seed/schema 合同。

### 根因判断

- 最新台湾地址联动引入 `tw_contact_city -> tw_contact_district` dependent select；`getDynamicDependentOptions()` 每次 render 都用 spread 克隆 dependent options。
- Radix Select 在选项数组引用持续变化、且 value 已存在时，可能触发同值 `onValueChange` 同步；`DynamicStepForm.handleChange()` 之前即使值未变化也会创建新 values object 并 `setValues()`，形成重复渲染。
- 这和先前台湾 `continent -> embassy_office` 联动的稳定数组问题同类。

### 已改文件

- `viza-fe/internal-website/components/dynamic-step-form.tsx`
  - `getDynamicDependentOptions()` 对 `dependent_options`、`taiwan_districts_by_city`、`vietnam_wards_by_province` 返回稳定数组引用，不再每次 render 克隆。
  - 新增 `stableOptionArray()` 用窄 cast 保持静态 options 引用稳定，同时满足现有 `VisaFormFieldOption[]` 类型。
  - `handleChange()` 增加同值 guard：当前值等于 normalized value 时直接返回，不再创建新 values object 或清空 dependents。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 新增 regression：台湾 city/district dependent select 在同值 prefill + rerender 后不会触发 `Maximum update depth exceeded`，且区乡镇大列表仍可打开。

### 验证

- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx components/__tests__/dynamic-form-field-localization.test.tsx`
  - 通过：`Test Files 2 passed (2)`，`Tests 21 passed (21)`。
- `cd viza-fe/internal-website && npm run type-check`
  - 失败，但只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 当前状态

- 台湾 dependent select 红屏修复已完成；本地需刷新/重启 dev server 后复核截图路径页面。
- 本轮没有执行 production 同步或部署。

## 2026-08-03 本地 Dynamic Select runtime error 继续修复（出生地分支）

### 输入与边界

- 用户刷新后仍看到 `Maximum update depth exceeded`，堆栈仍在：
  - `components/ui/select.tsx` / `SelectPrimitive.Trigger`
  - `components/dynamic-form-field.tsx` 普通 Select
  - `components/dynamic-step-form.tsx` `renderSide`
- 新上下文：TW-B 新增/锁定出生地合同：
  - `birth_place_is_mainland`：一级 select，`中國大陸 / 其他`
  - `birth_place_mainland_region`：`中國大陸` 分支
  - `birth_place_other_country`：`其他` 分支，复用 `NATIONALITY_OPTIONS`
- 本轮只改前端 runtime；未改 seed/schema/runner/DB/deploy，未进入台湾官网/OTP/CAPTCHA/付款，未做 git commit/stash/reset/checkout。

### 定位结论

- 具体高风险 field/key：
  - `birth_place_is_mainland`：2 项普通 Radix Select，堆栈落点符合截图。
  - `birth_place_mainland_region`：大陆出生地大列表，走 searchable select。
  - `birth_place_other_country`：国家/地区大列表，走 searchable select。
- 循环原因判断：
  - 上轮已稳定 dependent options source，但普通 Select 仍直接以空字符串/内部 `_empty` 风格处理 placeholder。
  - 出生地一级 select 会控制二级分支显示；当 Select 内部 placeholder/空值或同值同步触发 `onValueChange` 时，若写回表单答案，会造成 `renderSide -> DynamicFormField -> Select` 重复更新风险。
  - `handleChange()` 的同值 guard 已保留，防止同值回写继续制造新 `values` object。

### 已改文件

- `viza-fe/internal-website/components/dynamic-form-field.tsx`
  - 普通 Radix Select 增加稳定空值 sentinel：`EMPTY_SELECT_SENTINEL`。
  - `value` 为空时传 sentinel 给 UI，`onValueChange` 再转换回 `""`，避免空值/placeholder 状态在 Select 内部和表单状态之间来回抖动。
  - 空值 sentinel item 隐藏显示，只用于稳定 Radix value，不作为真实申请答案。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 新增出生地 regression：一级 `birth_place_is_mainland` 渲染 `中國大陸`，二级 `birth_place_mainland_region` 渲染大列表；切换到 `其他` 后显示 `birth_place_other_country` 大列表，包含 994 special identity row；全程不触发 `Maximum update depth exceeded`。

### 验证

- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx components/__tests__/dynamic-form-field-localization.test.tsx`
  - 通过：`Test Files 2 passed (2)`，`Tests 22 passed (22)`。
- `cd viza-fe/internal-website && npm run type-check`
  - 失败，但只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 当前状态

- 本轮对出生地一级/二级 select 做了最小前端修复与 regression 覆盖。
- 若用户本地 dev server 仍保留旧 bundle，需要重启/硬刷新后再复核。

## 2026-08-03 主协调最终修复：父子草稿回报循环

### 根因

- 红屏虽然落在 Radix `SelectPrimitive.Trigger`，真正的循环发生在表单父子层：
  - `DynamicStepForm` 每次 effect 都回报当前草稿；
  - 父页面收到草稿后更新 `draftVersion`；
  - 父页面重渲染时重新建立 `step.fields` 数组；
  - 子表单因 `step.fields` 引用改变再次回报内容完全相同的草稿，形成循环。
- 上一轮空值 sentinel 不是最终根因，主协调已移除该 sentinel，普通 Select 只保留合法非空 option 与同值 guard。

### 已改文件

- `viza-fe/internal-website/components/dynamic-step-form.tsx`
  - 缓存上一次送出的草稿 patch；字段和值内容完全一致时不再通知父页面。
  - 用户实际修改答案时仍正常送出新的 patch。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 新增父页面重渲染并重建 Taiwan step/fields 的 regression；未修改答案只通知一次，改选项后通知第二次。

### 验证

- focused test：`17/17` 通过。
- 本地 3000 dev server 已重新启动并加载新代码；台湾 long-form 返回 `200`。
- 启动后的初始请求完成后继续观察 5 秒，没有再出现持续 POST 循环。
- 未部署、未写 production DB、未进入台湾官网、未处理 OTP/CAPTCHA、未付款。

## 2026-08-03 主协调接回：四类资格动态应检附材料

### 发生的问题

- 四类资格材料成果没有汇入同一个页面规则源：资格 1/2 有局部前端兜底，资格 3/4 主要停留在未执行的 `0127/0126` metadata SQL 与局部 server normalization。
- 页面测试直接传入已经筛好的单一资格材料，未覆盖“用户选择 `eligibility_category` 后，页面实际筛选完整清单”的路径，因此旧测试可通过但真实页面不会正确切换。
- `extraRequirements` 与数据库同 key 时旧数据库 row 优先，前端截图合同无法覆盖 stale label / applicability。
- 台湾应检附文件仍可能显示旧的泛化“可选补充材料”区块。

### 本地修复

- 新增 `viza-fe/internal-website/lib/taiwan-entry-permit-document-requirements.ts`
  - 将资格 1/2/3/4 已确认截图合同收成单一前端规则源。
  - 每类固定 3 项红星必需材料：旅行证件、该类别资格证明、大陆身份证正反面。
  - 同表无红星材料按类别进入“情形适用材料”；资格 1/2 保留已确认的未成年材料差异，资格 1 与资格 3/4 保留各自港澳材料行。
- `long-form/page.tsx`
  - 页面根据当前 `eligibility_category` 计算 visible / required / extra requirements。
  - 台湾应检附文件隐藏旧的泛化可选材料区块。
- `document-center-client.tsx`
  - 前端资格合同可覆盖同 key 的 stale 数据库展示属性，同时保留已上传文件。
  - 情形适用材料卡 badge 显示“情形适用”，不再显示“可选”。
- `tw-documents-eligibility.test.tsx`
  - 改为从包含四类资格 row 的原始数据开始，调用真实资格规则筛选。
  - 覆盖四类只显示对应资格证明、各自条件材料差异、照片不在本 section 重复、旧可选区不出现。

### 验证与边界

- focused tests：3 个文件、31/31 passed。
- `git diff --check` 通过。
- 前端 type-check 仍仅有既有无关 Travel/Playwright 阻断，没有新增台湾错误。
- 本地 3000 dev server 已热更新；未执行 `0126`、`0127` 或任何 production DB 写入，未部署，未触碰 runner job、官网登录、OTP/CAPTCHA、最终提交或付款。

## 2026-08-04 台湾长表单布局：应检附文件内嵌资格页

### 根因/目标

- 台湾 TW_ENTRY_PERMIT 长表单原本仍把 `Supporting Documents` 作为独立动态步骤插入流程，导致左侧导航出现单独“应检附文件”，并让 review/status、缺材料跳转继续依赖旧 `documentStepIndex`。
- 本轮按用户要求把“应检附文件”完整放到“申请资格与证别”同页下方；照片仍保留在该页原有 photo upload 位置，下方材料中心排除 `photo`，不重复展示照片。

### 本地改动

- `viza-fe/internal-website/app/client/application/long-form/page.tsx`
  - 新增台湾布局 helper：TW_ENTRY_PERMIT 不再显示独立 documents step，`Supporting Documents` 不进入台湾 grouped sidebar。
  - `reviewStepIndex` / `teamStepIndex` / `statusStepIndex` 改为基于 `showStandaloneDocumentStep` 计算；台湾没有独立材料步骤时 review/status 不再后移。
  - 在 `Photo & Basic Status`（页面显示“申请资格与证别”）步骤内，资格表单下方内嵌 `DocumentCenterClient`，沿用 `taiwan-entry-permit-document-requirements.ts` 的 visible / required / extra requirement 计算。
  - 下方材料中心 `excludeRequirementKeys={["photo"]}`，并继续隐藏台湾旧泛化“可选补充材料”。
  - `?step=documents` 深链、完整性面板“去上传”、review photo edit 均跳到同一个资格页/材料宿主步骤，而不是旧独立材料页；若异常 schema 缺少资格页，则回退到第一个可见表单步骤，不跳不存在的旧材料页。
- `viza-fe/internal-website/app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts`
  - 覆盖台湾 grouped sidebar 不再包含独立“应检附文件”。
  - 覆盖“申请资格与证别”作为 inline documents host。
  - 覆盖移除独立 materials step 后 review/team/status index 不错位。
  - 覆盖资格 1/2/3/4 切换时 visible requirement key 随 `eligibility_category` 更新，且下方材料不包含 `photo`。

### 验证

- `cd viza-fe/internal-website && npx vitest run app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts app/client/documents/__tests__/tw-documents-eligibility.test.tsx`
  - 通过：`Test Files 2 passed (2)`，`Tests 12 passed (12)`。
- `cd viza-fe/internal-website && npx tsc --noEmit --pretty false`
  - 仍失败，但只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 边界

- 未部署、未写 production DB、未执行 SQL/migration/seed，未执行 `0126`/`0127`。
- 未创建或重试 runner job，未进入台湾官网，未登录，未处理 OTP/CAPTCHA，未最终提交，未付款。

## 2026-08-04 台湾在台联络地址酒店填写提示

### 本地改动

- `viza-fe/internal-website/components/dynamic-step-form.tsx`
  - 在 `TW_ENTRY_PERMIT` 且 step 为 `Taiwan Contact Address` 时，于字段列表上方显示简体中文提示：
    - “可填写在台住宿酒店的地址；即使尚未预订酒店，也可以先填写预计入住的酒店地址。没有在台个人联系电话时，可将酒店电话填写在‘在台市内电话’。”
  - 使用既有台湾页面 notice 样式；不使用 modal/toast/AI 提示。
  - 未修改 required、联动、答案保存或官网提交映射。
- `viza-fe/internal-website/components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 新增 focused test：台湾联系地址页显示完整提示；台湾其他 step 不显示；非台湾签证不显示。

### 验证

- `cd viza-fe/internal-website && npx vitest run components/__tests__/taiwan-frontend-experience-audit.test.tsx -t "hotel address guidance"`
  - 通过：`Tests 1 passed | 17 skipped`。
- `cd viza-fe/internal-website && npx vitest run components/__tests__/taiwan-frontend-experience-audit.test.tsx`
  - 本轮新增测试通过；整文件仍有 2 个既有地址区名断言失败，断言期望 `新興區`，当前渲染为 `新兴区`，与本轮提示文案改动无关。
- `cd viza-fe/internal-website && npx tsc --noEmit --pretty false`
  - 仍失败，但只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 边界

- 未修改 `long-form/page.tsx`、DocumentCenter、occupation schema、submission-service、seed/SQL。
- 未执行 production DB、migration/seed/SQL，未部署，未改 env，未创建/retry runner_job，未进入台湾官网/登录/OTP/CAPTCHA/最终提交/付款。

## 2026-08-04 台湾资格页应检附文件融合呈现

### 本地改动

- `viza-fe/internal-website/app/client/documents/document-center-client.tsx`
  - 新增窄义 `presentation="taiwan-inline"` 模式，只用于台湾 TW_ENTRY_PERMIT 资格页内嵌材料区。
  - 台湾 inline 模式去掉独立材料中心头部/外壳：不再显示“当前表单材料”、重复“中国台湾 材料”、申请状态、清单来源、大型页面总览。
  - 保留紧凑“材料完成度”、缺失/齐备状态、必需材料、情形适用材料、上传控件、缺失高亮和刷新。
  - 默认 `DocumentCenterClient` 与其他 embedded 使用者仍保留原头部和页面行为。
- `viza-fe/internal-website/app/client/application/long-form/page.tsx`
  - 台湾“申请资格与证别”页下方的“应检附文件”传入 `presentation="taiwan-inline"`。
  - 分隔线/留白保持同页承接，photo 仍只在上方 photo 上传区，不在下方材料清单重复。
- `viza-fe/internal-website/app/client/documents/__tests__/tw-documents-eligibility.test.tsx`
  - 覆盖台湾 inline 模式不显示独立材料中心头部，但仍显示材料完成度、必需材料、情形适用材料。
  - 覆盖默认 embedded DocumentCenter 仍显示原头部。
  - 资格 1/2/3/4 切换和 photo 排除继续沿用同一测试路径。

### 验证

- `cd viza-fe/internal-website && npx vitest run app/client/documents/__tests__/tw-documents-eligibility.test.tsx app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts`
  - 通过：`Test Files 2 passed (2)`，`Tests 14 passed (14)`。
- `cd viza-fe/internal-website && npx tsc --noEmit --pretty false`
  - 仍失败，但只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 边界

- 未执行 production DB、SQL、seed、migration，未部署，未改 env。
- 未创建/retry runner_job，未进入台湾官网/登录/OTP/CAPTCHA/最终提交/付款。

## 2026-08-04 台湾 completeness 当前资格证明兜底

### 根因

- `computeApplicationCompleteness()` 只会过滤 `document_requirements` 中已有的台湾资格证明 rows。
- 当 production metadata stale，例如申请答案 `eligibility_category="2"`，但现有 requirements 仍指向/要求 `eligibility_supporting_document_1` 或 `eligibility_supporting_document_2.required=false` 时，completeness 可能把已上传的 `_1` 当成满足条件，误判 `complete=true`。
- runner preflight 已按当前资格要求 `_2`，因此前端 completeness 与 runner preflight 不一致。

### 本地修复

- `viza-fe/internal-website/lib/application-completeness.ts`
  - 对 TW_ENTRY_PERMIT completeness 增加台湾专属兜底：当 requirements 中存在 legacy/分裂后的 eligibility proof row 时，先从 `taiwan-entry-permit-document-requirements.ts` 取当前 `eligibility_category` 对应的 `eligibility_supporting_document_${category}`。
  - 当前资格 proof row 会合并/覆盖 stale `required`、label、document type 等展示合同，并强制作为 required completeness 项。
  - 其他资格 proof rows 仍通过既有过滤排除；不改 shared runner，不改 DB。
  - 兜底范围只限 eligibility proof，不扩大到其他台湾材料。
- `viza-fe/internal-website/lib/__tests__/application-completeness.test.ts`
  - 新增 regression：`eligibility_category=2` 且只上传 `eligibility_supporting_document_1` 时，必须缺 `eligibility_supporting_document_2`。
  - 上传 `eligibility_supporting_document_2` 后 `complete=true`。
  - 同时确认 `_1` 不会作为 category 2 的缺失项。

### 验证

- `cd viza-fe/internal-website && npx vitest run lib/__tests__/application-completeness.test.ts app/client/documents/__tests__/tw-documents-eligibility.test.tsx app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts`
  - 通过：`Test Files 3 passed (3)`，`Tests 24 passed (24)`。
- `cd viza-fe/internal-website && npx tsc --noEmit --pretty false`
  - 仍失败，但只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 边界

- 未修改 DB/env，未执行 production SQL、seed、migration，未部署。
- 未创建/retry runner_job，未访问台湾官网/登录/OTP/CAPTCHA/最终提交/付款。

## 2026-08-05 台湾 completeness/readiness 条件字段与无效值门禁

### 根因

- `computeApplicationCompleteness()` 主要检查 schema required / required_when 与材料要求；对台湾官网实际 preflight 失败的若干“非空但无效”或“生产 metadata 滞后导致未触发”的字段缺少前端 readiness 校验。
- 结果是页面可能显示 `complete=true`，从而允许进入 retry/enqueue；runner preflight 或官网随后才发现：
  - `name_chinese` 为纯拉丁/不含中文字符；
  - `birth_place_is_mainland=mainland` 后 `birth_place_mainland_region` 为空；
  - 父/母 `存` 后亲属详情字段为空；
  - 学生路径 `company_name` 用“学生”等占位值，官网拒绝。

### 本地修复

- `viza-fe/internal-website/lib/application-completeness.ts`
  - 增加 TW_ENTRY_PERMIT 专属 readiness 校验层，输出仍使用既有 `missingInfo` 结构，因此确认页/完整性面板可按 `fieldName + stepNumber` 跳回准确字段。
  - `name_chinese`：schema 存在该字段时，必须非空且至少包含 CJK；纯拉丁不再视为 complete。本轮不自动猜/转换姓名。
  - 出生地分支：`birth_place_is_mainland` 为大陆/官方值 `1` 时，`birth_place_mainland_region` 必须存在；为其他/官方值 `5` 时，`birth_place_other_country` 必须存在。
  - 父/母亲属：`kin_father_status` / `kin_mother_status` 为 `存`/`1`/living/alive 时，要求对应姓名、生日、电话、现职、服务单位、职称；若未勾选“现住址同申请人海外地址”，还要求现住址。
  - 学生路径：`current_occupation === "14"` 时，`company_name` 必填且不能是 `学生`/`student`/`school`/`none`/`n/a`/`无` 等占位值；英文合法学校名保留通过，避免误拒英文学校名称。
  - 不改 submission-service runner、seed/schema 源文件、DB/env。
- `viza-fe/internal-website/lib/__tests__/application-completeness.test.ts`
  - 新增 regression：截图四类错误同时出现时，`complete=false`，缺失/无效 key 包含 `name_chinese`、`birth_place_mainland_region`、`company_name`、父母 living 后的详情字段，并保留准确 stepNumber/stepName。
  - 新增 regression：真实英文学生学校名 + 完整触发字段时通过，不误拒。

### 验证

- 首次未提升权限运行 Vitest 被 sandbox 阻止写入 `node_modules/.vite-temp`，随后按规则提升权限重跑。
- `cd viza-fe/internal-website && npx vitest run lib/__tests__/application-completeness.test.ts`
  - 通过：`Test Files 1 passed (1)`，`Tests 12 passed (12)`。
- `cd viza-fe/internal-website && npx vitest run lib/__tests__/application-completeness.test.ts app/client/documents/__tests__/tw-documents-eligibility.test.tsx app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts`
  - 通过：`Test Files 3 passed (3)`，`Tests 26 passed (26)`。
- `cd viza-fe/internal-website && npx tsc --noEmit --pretty false`
  - 仍失败，但只剩无关阻断：
    - `features/ph-etravel/__tests__/launch-readiness.test.ts` / `features/ph-etravel/preflight-status.ts` 类型不匹配。
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 边界

- 未修改 submission-service runner、seed/schema 源文件、生产 DB、env。
- 未部署、未创建/retry runner_job、未访问台湾官网/登录/OTP/CAPTCHA/最终提交/付款。

## 2026-08-04 台湾 inline 应检附文件上传要求提示

### 本地改动

- `viza-fe/internal-website/app/client/documents/document-center-client.tsx`
  - 仅在 `presentation="taiwan-inline"` 时，于紧凑完成度和材料列表之前显示“上传文件要求”小标题和 5 条有序列表。
  - 提示内容为简体中文，包含格式、清晰度、1024K、翻译件、按原证件大小扫描/重命名、双面证件正反面上传要求。
  - 默认 embedded / 独立 DocumentCenter 不显示该提示，避免恢复完整材料中心页面外壳。
  - 只增加可见说明；未修改 uploader `accept`、大小限制、压缩或上传逻辑。
- `viza-fe/internal-website/app/client/documents/__tests__/tw-documents-eligibility.test.tsx`
  - 覆盖 5 条上传要求只在台湾 compact inline 模式出现。
  - 继续覆盖台湾 inline 模式不显示“当前表单材料”、重复“中国台湾 材料”、申请状态、清单来源，同时保留材料完成度、必需材料、情形适用材料。
  - 覆盖默认 embedded DocumentCenter 不显示该提示。

### 验证

- `cd viza-fe/internal-website && npx vitest run app/client/documents/__tests__/tw-documents-eligibility.test.tsx app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts`
  - 通过：`Test Files 2 passed (2)`，`Tests 14 passed (14)`。
- `cd viza-fe/internal-website && npx tsc --noEmit --pretty false`
  - 仍失败，但只剩既有无关阻断：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index errors。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` module/type。

### 待核对

- 用户提示要求“文件须小于 1024K”，本轮按边界只加说明，未核对/修改当前上传大小限制、accept、压缩或服务端校验；后续如要强制执行需单独审计 uploader 与后端上传限制。

### 边界

- 未执行 production DB、SQL、seed、migration，未部署，未改 env。
- 未创建/retry runner_job，未进入台湾官网/登录/OTP/CAPTCHA/最终提交/付款。
