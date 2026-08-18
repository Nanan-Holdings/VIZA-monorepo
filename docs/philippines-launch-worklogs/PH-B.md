# PH-B Worklog：VIZA Schema、条件分支与文件要求

> 第一轮状态：完成。此文件仅 PH-B 可更新。审计日期：2026-08-01（Asia/Singapore）。

## 目标

完整盘点当前 `PH_ETRAVEL_ARRIVAL_CARD` 的 DB seed、frontend 动态表单、profile prefill、document fallback 与测试，识别字段和文件合同缺口，但不实施修改。

## 审计范围与读取文件

- 协调与约束：`AGENTS.md`、`docs/AGENTS.md`、`docs/philippines-launch-coordination.md`、`docs/philippines-launch-worklogs/PH-A.md`、`PH-B.md`、`PH-C.md`、`PH-D.md`。
- Seed/schema/options：`viza-be/agent-backend/AGENTS.md`、`scripts/ph-etravel/AGENTS.md`、`scripts/ph-etravel/form-fields.ts`、`official-options.ts`、`official-options.snapshot.json`、`seed-form-fields.ts`、`drizzle/0103_ph_etravel_arrival_card_package.sql`。
- Frontend dynamic form/options/prefill/documents：`viza-fe/AGENTS.md`、`viza-fe/internal-website/AGENTS.md`、`features/ph-etravel/AGENTS.md`、`features/arrival-cards/AGENTS.md`、`app/client/AGENTS.md`、`app/client/arrival-cards/AGENTS.md`、`app/client/arrival-cards/philippines/page.tsx`、`app/client/application/long-form/page.tsx`、`components/dynamic-step-form.tsx`、`components/dynamic-form-field.tsx`、`features/ph-etravel/option-labels.ts`、`app/api/ph-etravel/options/route.ts`、`lib/universal-profile-prefill.ts`、`app/client/documents/actions.ts`、`app/actions/submit-signature.ts`。
- Runner 消费合同（只读，用于文件/字段 slot 审计）：`viza-be/submission-service/AGENTS.md`、`src/ph-etravel/AGENTS.md`、`src/ph-etravel/normalize.ts`、`form-filler.ts`、`runner.ts`、`src/index.ts` PH 区块、`src/country-submissions/registry.ts`。
- 测试：`viza-be/submission-service/src/ph-etravel/__tests__/normalize.spec.ts`、`form-filler.spec.ts`、`viza-fe/internal-website/features/ph-etravel/__tests__/*`、`app/api/ph-etravel/options/route.test.ts`、`DigitalArrivalCardResultCard.test.tsx` PH 用例。
- 官方/官方快照来源：协调总览引用的 `https://etravel.gov.ph` FAQ/Data Policy；本代码内 `official-options.snapshot.json` 来源 `https://ws.etravel.gov.ph`，build `77f106d9c659765d93977987ceb12abaf7d43bd5`，retrieved `2026-07-21`。

## 已验证事实

- 当前 arrival seed 唯一导出 `PH_ETRAVEL_VISA_TYPE = "PH_ETRAVEL_ARRIVAL_CARD"`，`seed-form-fields.ts` 会删除并重建该 visa_type 的 `visa_form_fields`，本轮未运行。
- 当前 arrival seed 共 61 个字段、8 个步骤：Travel Registration、Traveller Information、Travel Details - Philippine Arrival、Destination in the Philippines、Health Declaration、Other Travel Details、Customs Declaration、Declaration Signature。
- official options 快照包含：countries 250、airlines 103、airPorts 20、seaPorts 53、arrivalPurposes 16、occupations 15、sicknessSymptoms 17、declarationChecklist 12。Arrival seed 只消费 AIR company/port；未消费 seaPorts。
- 前端 Philippines arrival 入口直接重定向到 `/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true`。
- Dynamic form 没有 PH 专属字段补丁；字段来自 DB seed。PH 专属前端逻辑只做 step 中文名、country/airline/airport label 本地化、`flight_number` 按 `airline_name` 调 `/api/ph-etravel/options` 拉官方 ARRIVAL flights。
- Universal Profile prefill 会填 first/last/name、date_of_birth、sex、nationality、country_of_birth、occupation、residence address、country_of_residence、passport fields、email、phone 等通用键；不理解 PH `MALE/FEMALE`、`FILIPINO/FOREIGNER`、occupation code、country alpha2/alpha3 混用的所有官方枚举一致性。
- `app/client/documents/actions.ts` 对 `PH_ETRAVEL_ARRIVAL_CARD` 和 departure 强制返回 frontend fallback，绕过 `document_requirements` 表。当前没有 PH eTravel DB `document_requirements`。
- Runner 会在 PH job 中下载 application documents 和可复用 applicant documents，找 photo/portrait/applicant_photo 作为 eGovPH profile onboarding photo；找 `customs_signature_file`/`electronic_signature`/`signature`/`signature_image` 写入 answer。若无 PH photo，fallback 扫 `application-documents/<authUserId>/<applicationId>/photo/*` 的最新图片。Customs signature 同时可由 form-filler 在官方 canvas 上手绘。
- Provider registry 对 arrival 标记 `implementationStatus: "partial"`，requiredFields 只列基础 arrival 字段，不列 conditional children、customs checklist 12 项、profile photo 或 customs signature file。

## VIZA Arrival Field Inventory

字段清单按 seed 当前事实记录；测试覆盖为“直接覆盖/间接覆盖/未覆盖”。Options 数量来自 2026-07-21 snapshot。

| Step | Fields | Type/required/conditions | Options/source | Runner/test coverage |
| --- | --- | --- | --- | --- |
| 1 Travel Registration | `registration_for`, `transport_type`, `is_special_flight`, `data_privacy_agreement` | radio req, radio req, checkbox opt, checkbox req | `FOR_ME/FOR_OTHER`; `AIR/SEA` | normalize/form-filler 覆盖 `registration_for`、AIR；未覆盖 SEA 和 data privacy 提交合同 |
| 2 Traveller Information | `first_name`, `middle_name`, `last_name`, `suffix`, `date_of_birth`, `sex`, `passport_holder_type`, `nationality`, `country_of_birth`, `occupation`, `passport_number`, `passport_issuing_authority`, `passport_issue_date`, `passport_expiry_date`, `mobile_country_code`, `mobile_number`, `country_of_residence`, `residence_address_line1`, `residence_address_line2` | 基础身份/护照/联系方式；`last_name` seed 设 optional 但 runner plan required；`mobile_country_code` regex 允许 `+`，placeholder 是 `86` | suffix 5；sex `MALE/FEMALE`；passport holder `FILIPINO/FOREIGNER`；countries 250；occupations 15 | normalize 覆盖大部分；profile prefill 间接覆盖；未覆盖 Filipino/foreigner required 差异、last_name optional 漂移、枚举 canonicalization |
| 3 Travel Details - Philippine Arrival | `purpose_of_travel`, `traveller_type`, `airline_name`, `flight_number`, `origin_country`, `airport_of_origin`, `flight_departure_date`, `flight_arrival_date`, `port_of_entry`, `with_transit`, `transit_country`, `transit_airport`, `transit_date` | 大多 req；transit 3 字段 `with_transit === yes`；`with_transit` checkbox opt | arrivalPurposes 16；traveller types 包含 passenger/crew；airlines 103；flight_number remote official source dependsOn `airline_name`; airPorts 20 | AIR normalize/form-filler/API proxy 覆盖；transit normalize 覆盖；未覆盖 SEA；traveller_type 允许 crew 但产品未分流；`with_transit` checkbox stores true/on, condition expects `yes` 风险 |
| 4 Destination in the Philippines | `destination_type`, `destination_same_as_residence`, `destination_residence_address`, `destination_hotel_name`, `destination_hotel_address`, `destination_transit_airport`, `destination_country` | radio req；RESIDENCE/HOTEL/TRANSIT 条件 req；same-as-residence opt | options `RESIDENCE/HOTEL/TRANSIT/TRAVEL_PORT`，但 TRAVEL_PORT 无 child fields；airport 20；countries 250 | HOTEL and TRANSIT runner tests；RESIDENCE not tested；TRAVEL_PORT unsupported but exposed |
| 5 Health Declaration | `has_recent_travel_history_30d`, `visited_country_30d`, `has_exposure_to_sick_person_30d`, `has_been_sick_30d`, `sickness_symptom` | three health radios req；visited/symptoms conditional repeatable | yes/no; countries 250; symptoms 17 | normalize covers yes path for visited/symptoms; no frontend repeat UI branch test found; official Review branch not proven |
| 6 Other Travel Details | `accompanied_under_18_count`, `accompanied_18_plus_count`, `checked_baggage_count`, `handcarry_baggage_count`, `first_time_visiting_philippines` | counts are text req with numeric pattern; first visit radio req | yes/no | normalize/form-filler covers counts and first visit basic; no min/max/count select parity evidence |
| 7 Customs Declaration | `customs_information_acknowledgement`, `has_baggage_or_currency_to_declare`, `customs_checklist_1..12` | acknowledgement checkbox req；declare radio req；12 checklist radios req only if `has_baggage_or_currency_to_declare === yes` | declarationChecklist official snapshot 12; yes/no | No direct normalize mapping from `customs_checklist_*` to runner plan; runner instead consumes legacy `has_dutiable_goods`, `has_currency_over_threshold`, `has_goods_to_declare`, `has_currency_to_declare` not in seed |
| 8 Declaration Signature | `customs_signature_declaration`, `final_declaration` | both checkbox req | n/a | final_declaration validation covered; customs declaration checkbox/canvas covered indirectly; no file requirement parity |

## 文件 Inventory

| Item | Current VIZA source | Required? | Format | Runner consumption | Audit conclusion |
| --- | --- | --- | --- | --- | --- |
| `profile_photo` / `applicant_photo` | frontend fallback document requirement only; application documents and reusable applicant documents; latest user photo storage fallback | frontend says required for arrival/departure | `.jpg/.jpeg/.png`; runner also accepts `.webp` when scanning latest photo | PH job selects photo-like document path and passes to eGovPH profile onboarding upload/injection; not a `visa_form_fields` field | P0/P1 boundary: no DB `document_requirements`; no official per-branch proof that every arrival traveller needs upload; runner can proceed to official onboarding needing photo while schema contract has no stable slot |
| `customs_signature_file` | frontend fallback document requirement only; reusable signature types include it | frontend says required | `.pdf/.jpg/.jpeg/.png` | index writes path to `answers.customs_signature_file`; normalize carries it; form-filler has file upload plan but also draws canvas if no file | P0 drift: seed has no file field; runner can draw canvas, so frontend-required upload may be unnecessary or wrong; PDF accepted by UI but Playwright file input/image/canvas path may not accept PDF |
| `customs_signature_declaration` | seed checkbox | required | boolean | runner checks/draws on official declaration page | Confused with file slot; name suggests declaration not upload |
| Other PH documents | none | none | none | none | No passport bio page requirement for PH eTravel in current fallback; photo discovery may reuse unrelated `photo` documents from sibling applications |

## P0 缺口

1. **AIR/SEA contract broken**：seed exposes `transport_type = SEA` and traveller types for sea/vessel/cruise, but step 3 remains airline/flight/airport/AIR port only; `seaPorts` 53-option snapshot unused. Runner arrival plan also primarily AIR (`airline`, `flight_number` choice, `airport_of_origin`, AIR ports). SEA arrival cannot be considered supported.
2. **Customs schema vs runner contract drift**：seed creates official-looking `customs_checklist_1..12` but normalize/form-filler consume legacy aggregate fields (`has_dutiable_goods`, `has_currency_over_threshold`, `has_goods_to_declare`, `has_currency_to_declare`, currency detail fields) that users cannot fill in arrival seed. Positive customs/currency declaration is not end-to-end mapped.
3. **Document contract is not single source of truth**：PH eTravel has only frontend fallback requirements, no DB `document_requirements`/schema contract. `profile_photo` and `customs_signature_file` are required in UI but absent from arrival seed and provider required fields.
4. **Customs signature file likely over-required/wrong format**：UI requires `customs_signature_file` and accepts PDF; runner can draw official canvas without a file and may only use file inputs if visible. This can block users for a document not proven official-required and may pass unusable PDF to runner.
5. **Unsupported/persona branches exposed as normal answers**：`traveller_type` includes `FLIGHT CREW`, `CRUISE CREW`, `VESSEL CREW`; package description/coordination says crew/special identities must be independently proven or diverted. Current schema lets them enter ordinary arrival path.
6. **`destination_type = TRAVEL_PORT` exposed without child questions or runner mapping**：option appears in seed but no conditional fields and runner arrival plan does not map it. Selecting it will likely fail validation or mis-submit.

## P1 缺口

1. **Required drift for last name**：seed marks `last_name` optional; runner field plan marks it required. Official parity unknown; contract must choose one.
2. **Checkbox condition semantics risk**：conditions use `with_transit === yes`, but checkbox controls often store `"true"`, `"on"`, or checked state. Dynamic form has helper logic, but PH condition branches lack direct tests.
3. **Destination residence branch unproven**：RESIDENCE fields exist, including `destination_same_as_residence`, but runner normalize does not apply same-as-residence; no direct tests found.
4. **Profile prefill enum mismatch risk**：universal profile writes `sex` as `male/female`, country may be alpha2/alpha3/name, occupation may be free text. Dynamic form canonicalization may fix some option values, but no PH-specific test ensures `MALE/FEMALE`, official country code set, and OCC codes are preserved.
5. **Traveller type vs transport type not constrained**：AIR can select vessel/cruise types; SEA can select aircraft/flight crew. No dynamic condition or validation ties them together.
6. **`passport_holder_type` not used for field branching**：Filipino vs foreigner is collected, but no arrival-specific conditional required/hidden fields were identified in VIZA schema.
7. **Flight number fallback absent for official list miss**：PH flight numbers come from official API by airline and do not add an `OTHER` manual field; normalize supports `flight_number_other`, but seed/frontend do not expose it.
8. **Provider requiredFields incomplete**：registry validation omits many conditionals (`transit_*`, destination children, health repeats, customs checklist) and all document slots, so dry-run validation can pass while official page still lacks required data.

## P2 缺口

1. `mobile_country_code` placeholder says `86` while regex allows `+86`; runner concatenates country code + number. UX/normalization should settle on official expected shape.
2. Step/order labels mix “Philippine Arrival”, “Declaration Signature”, and frontend translations; acceptable but should be frozen after official matrix.
3. `data_privacy_agreement` is seed-required but not in runner field plan; if purely VIZA/official entry page acknowledgement, it needs an explicit non-runner classification.
4. `is_special_flight` exists but no conditions/options/tests clarify when official requires it.
5. `first_time_visiting_philippines` uses radio yes/no but no official conditional downstream documented.

## 测试结果

- Passed: `cd viza-be/submission-service && node --import tsx --test src/ph-etravel/__tests__/normalize.spec.ts src/ph-etravel/__tests__/form-filler.spec.ts` → 19/19 pass.
- Passed: `cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts app/api/ph-etravel/options/route.test.ts --testTimeout=15000` → 8/8 pass.
- Passed: `cd viza-fe/internal-website && npx vitest run app/client/application/_components/result-cards/__tests__/DigitalArrivalCardResultCard.test.tsx -t "stored Philippines success" --testTimeout=15000` → PH result card case 1/1 pass.
- Non-authoritative failed attempt: `npm test -- src/ph-etravel/...` in submission-service unintentionally ran the whole package because the script includes `src/**/*.spec.ts`; full suite failed on unrelated missing Supabase env and existing non-PH assertions. No migration/seed/official smoke was run.
- Non-authoritative mixed frontend result-card run: PH case passed, but the whole file had 4 non-PH hook-order failures in Vietnam/Indonesia/DS-160 retry cases.

## 第二轮建议修改路径与测试清单（不实施）

Schema/document owner PH-B 建议独占：

- `viza-be/agent-backend/scripts/ph-etravel/form-fields.ts`
  - Split AIR vs SEA arrival fields; use `PH_ETRAVEL_SEA_PORT_OPTIONS` and vessel/company fields or hide SEA until official parity is proven.
  - Remove or gate crew traveller types from ordinary passenger schema, or add explicit unsupported/diversion fields per PH-A official matrix.
  - Remove unsupported `TRAVEL_PORT` or add official child fields/runner contract.
  - Replace customs aggregate/checklist model with frozen official matrix: each checklist id needs runner-facing key, details fields, currency/BSP subfields, required condition, and tests.
  - Align `last_name`, privacy agreement, special flight, Filipino/foreigner requiredness, and checkbox condition values.
- `viza-be/agent-backend/scripts/ph-etravel/official-options.ts`
  - Preserve AIR/SEA option sets separately; ensure Chinese labels never replace official codes.
- New migration or seed update for PH eTravel `document_requirements` after coordinator approval.
  - Add stable requirements only after PH-A confirms official need: likely `profile_photo` for eGovPH onboarding if applicable, and signature handling if official file upload is real.
  - Do not make `customs_signature_file` required if runner canvas signing is the supported contract.
- Tests to add/extend:
  - Agent-backend schema unit test enumerating all PH arrival seed fields, options, conditions, repeat groups, and no unsupported options.
  - Frontend dynamic form test for PH `with_transit`, destination RESIDENCE/HOTEL/TRANSIT, AIR flight remote options, and SEA hidden/unsupported behavior.
  - Document fallback/DB requirements test for PH after contract migration.
  - Submission-service normalize/form-filler contract tests for AIR passenger, SEA passenger, customs positive checklist/currency/BSP, residence, transit, Filipino/foreigner branches.

## 接口请求

- PH-A：提供 official arrival matrix for AIR vs SEA, passenger vs crew, Filipino vs foreigner, destination `TRAVEL_PORT`, customs checklist detail fields, currency/BSP fields, and whether profile photo/signature upload is officially required per branch.
- PH-C：确认 runner intended contract for `customs_checklist_1..12` vs current legacy aggregate customs fields, and whether `customs_signature_file` should be uploaded, drawn on canvas, or removed from user requirements.
- PH-D：确认 frontend should block unsupported SEA/crew/TRAVEL_PORT branches at eligibility/form layer until schema/runner parity exists; confirm live toggle behavior after schema freeze.
- 主协调者：第二轮请冻结 document slot names before PH-B migration/seed work; otherwise frontend fallback and runner download heuristics会继续漂移。

## 未运行事项与剩余不确定性

- 未运行 migration、seed、远程数据库操作、部署、official smoke、账号注册、OTP、Turnstile、最终提交或 QR 捕获。
- 未研究 departure 或 9(a)；departure 只在读取共享 PH runner/schema文件时作为对照出现，未作为本轮结论依据。
- 未使用台湾字段作为菲律宾依据；工作区台湾改动均保持只读。
- 当前 official parity 仍依赖 PH-A 官方矩阵裁决；本 worklog 只证明 VIZA 当前实现事实和合同漂移。

## 第二轮执行记录：Schema 与条件分支 P0 修复（2026-08-01）

本轮先重新阅读了 `docs/philippines-launch-coordination.md` 第 10-13 节、全部 PH worklog、PH-A 第一轮官方矩阵、当前 git status；检查到 `docs/philippines-etravel-arrival-field-contract.md` 已存在于工作区，但仍是 untracked/外部生成文件，本轮只读，不修改。

### 改动文件

- `viza-be/agent-backend/scripts/ph-etravel/official-options.ts`
  - 将 ordinary arrival 的 `PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS` 收窄为 passenger-only：`AIRCRAFT PASSENGER`、`VESSEL PASSENGER`。
  - 新增 AIR/SEA passenger traveller options、unsupported arrival traveller options、AIR/SEA destination option sets。
  - 新增 currency/detail options，用于 customs positive 明细 schema，不再让 customs 只能表达为 aggregate boolean。
- `viza-be/agent-backend/scripts/ph-etravel/form-fields.ts`
  - 移除 ordinary arrival 的 `is_special_flight` 暴露。
  - `last_name` 改为 required。
  - AIR travel branch：`airline_name`、`flight_number`、`airport_of_origin`、flight dates、`port_of_entry` 仅 `transport_type === AIR` 显示；`with_transit` 为 AIR/SEA 共享入口。
  - SEA travel branch：新增 `vessel_name`、`voyage_number`、`seaport_of_origin`、voyage dates、`sea_port_of_entry`、`is_disembarking`，仅 `transport_type === SEA` 显示。
  - 修复 checkbox 条件：`with_transit` 使用 boolean true/false；AIR transit 使用 `transit_airport`，SEA transit 使用 `transit_seaport`，共享 `transit_country` / `transit_date`。
  - `traveller_type` 增加 `allowed_by_transport`，普通 arrival 明确排除 crew/cruise/special/official-exempt persona。
  - `destination_type` 增加 AIR/SEA allowed mapping；`TRANSIT` 仅 AIR children；`TRAVEL_PORT` 新增 SEA child `disembarking_port_code`。
  - 增加 canonical metadata：official country code、official option value、date format，避免 profile alias 直接落入官方 enum。
  - customs checklist 保持 1-12 逐项 yes/no；新增 goods positive 明细和 currency positive 明细字段，条件由 `customs_checklist_1..12` 正向答案触发，不新增 `has_goods_to_declare` / `has_currency_to_declare` aggregate boolean。
  - 仍不定义 `profile_photo` 或 `customs_signature_file` 为 unconditional arrival form field。
- `viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts`
  - 重写 arrival schema tests，覆盖 dedicated visa type、Filipino/Foreigner、AIR/SEA、illegal persona/transport mapping、transit、destination、health、customs/goods/currency、document file not unconditional。
- `docs/philippines-launch-worklogs/PH-B.md`
  - 追加本第二轮执行记录。

### Inventory 结论

- Ordinary arrival 当前 schema 已从 “AIR fields + SEA option 泄漏” 调整为 passenger-only `FILIPINO/FOREIGNER × AIR/SEA` 双分支。
- SEA 已有独立 vessel/voyage/sea port field inventory；SEA 不再显示 airline/flight/airport 字段，SEA transit 使用 `transit_seaport`。
- `TRAVEL_PORT` 不再是裸 option：已绑定 SEA-only `disembarking_port_code` child。
- customs 已从 “入口总开关 + 12 项答案” 扩展为官方逐项答案 + goods/currency positive 明细合同；aggregate boolean 只能作为 customs entry gate，不能替代逐项答案。
- document contract 本轮保持 no-migration/no-file-field：profile photo 与 customs signature file 未被定义成所有 arrival 用户无条件必需。

### P0 状态

- Fixed in schema/tests：AIR/SEA branch drift、ordinary persona overexposure、`TRAVEL_PORT` no-child、customs aggregate-substitute risk、checkbox transit condition、`last_name` required drift、RESIDENCE/HOTEL/TRANSIT/TRAVEL_PORT condition drift、enum canonicalization metadata、unconditional file requirement drift。
- Still P0 cross-owner until PH-C/PH-D implement：runner normalize/fill contract must consume new SEA fields and customs details；frontend dynamic form must enforce `allowed_by_transport`/destination filtering or route unsupported branches before user submission；DB/document requirements still need frozen migration after official Review.

### 测试结果

- Passed: `cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts --testTimeout=15000` → 12/12 pass.
- Passed: `cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-departure-card-schema.test.ts --testTimeout=15000` → 4/4 pass. This was a targeted offline guard because departure shares `PH_ETRAVEL_DECLARATION_CHECKLIST` and sea port options; no departure code or schema was edited.
- Not run: migration, seed, remote DB, deployment, live official eTravel flow, Turnstile/OTP, final submission, QR capture.

### 仍需 Review 证明的分支

- SEA exact field names/options for origin seaport vs arrival seaport vs transit seaport, `is_disembarking`, `disembarking_port_code` requiredness, and whether `TRAVEL_PORT` only appears when `is_disembarking === yes`。
- Currency detail option values and requiredness：owner/recipient personal vs business fields、BSP authorization fields、source/purpose options、courier/airway bill fields、foreign currency stay-day fields。
- Goods detail repeat structure：official API payload shape for item rows, amount/currency naming, repeat limits。
- Profile photo and customs signature handling：official per-branch requirement, accepted MIME, and whether signature is canvas draw vs file upload。
- Filipino vs Foreigner branch differences beyond passport holder type and nationality/purpose fields。

### 接口请求

- PH-A：请补第二轮 Review evidence：AIR/SEA exact field contract、destination/TRAVEL_PORT conditions、customs goods/currency positive payload and requiredness、profile photo/customs signature official requirement。
- PH-C：请按本轮 schema contract 更新 runner normalize/filler mapping，特别是 SEA `vessel_name`/`voyage_number`/`sea_port_of_entry`/`disembarking_port_code` 与 customs 1-12 + positive details；同时裁定 signature canvas/file contract。
- PH-D：请确认 dynamic form 是否读取 `allowed_by_transport`；若不读取，需要前端过滤 traveller/destination illegal combos，并验证 SEA 不显示 AIR fields。
- Coordinator：请冻结 document slot names 后再安排 migration/seed；本轮按要求未创建 document migration。

## 第二轮验收退回修正：Customs/Currency Requiredness 与 Option Evidence（2026-08-01）

本轮只修改 PH-B 独占文件：`form-fields.ts`、`official-options.ts`、arrival schema test、PH-B worklog；未修改 runner、frontend、migration、seed 或其他 worklog。

### 修正结论

- Customs checklist `customs_checklist_1..12`：保留 12 项逐项 yes/no 条件分支，但 `required` 从 `true` 降为 `false`；`validation_rules.evidence_level = needs_review_requiredness`。证据等级：字段存在/逐项答案结构来自 PH-A/official public build，requiredness 仍等待 PH-A Review。
- Goods positive details：`goods_total_currency`、`goods_total_amount`、`goods_item_description`、`goods_item_quantity`、`goods_item_value` 全部保留条件分支，但 `required: false`；只作为 `goods_positive_detail` 合同字段，不在 Review 前阻断表单完成。证据等级：字段组存在 needs_review；requiredness、repeat payload、repeat limits 等待 PH-A Review。
- Currency positive details：owner/recipient/currency/BSP/source/purpose/transfer/courier/travel fields 全部保留条件分支，但未验证 requiredness 均为 `required: false` 并标记 `needs_review_requiredness` 或 `needs_review_options`。证据等级：字段组来自 PH-A field contract；requiredness、选项 code、DOM control、payload 仍等待 PH-A Review。
- Owner N/A：`currency_owner_not_applicable` 为 optional checkbox；owner name/business fields 使用 `showIf((customs_checklist_1 === yes || customs_checklist_2 === yes) && currency_owner_not_applicable !== true)` 并补 `required_unless: currency_owner_not_applicable === true` metadata，证明勾选 N/A 时 owner 详情不会阻断。
- Currency enum code：删除 schema 对未经 Review 的 source/purpose option code 依赖；`currency_source` 和 `currency_transport_purpose` 改为 text 字段，并只记录 PH-A 已知显示值 metadata：
  - source display values：`Salary`、`Business`、`Other (Specify)`。
  - purpose display values：`Leisure`、`Medical`、`Payables`、`Education`、`Other (Specify)`。
  - 明确 `code_contract = do_not_submit_display_value_as_verified_code`。
- `official-options.ts` option metadata：snapshot 映射 option 标为 `official_snapshot`；非 snapshot/未闭合 Review 的 option 标为 `needs_review` 并写 `official_source`。测试证明所有 form options 要么有官方 snapshot 来源，要么明确带 evidence 标记。

### Evidence Table

| Area | Fields / options | Current schema behavior | Evidence level | Waiting for PH-A Review |
| --- | --- | --- | --- | --- |
| Customs checklist | `customs_checklist_1..12` | shown when customs entry gate is yes; optional in VIZA schema | `needs_review_requiredness` | whether official Review blocks each blank response; stable item ids/payload |
| Goods amount/items | `goods_total_*`, `goods_item_*` | conditional, optional, repeat metadata only | `needs_review_requiredness` | amount/currency names, item row payload, requiredness, repeat limits |
| Currency owner | `currency_owner_*`, `currency_owner_not_applicable` | conditional, optional; owner fields hidden/waived when N/A checked | `needs_review_requiredness` | owner-vs-declarant rules, personal/business requiredness |
| Currency recipient | `currency_recipient_*` | conditional, optional | `needs_review_requiredness` | recipient requiredness and business/person branch |
| Currency items | `currency_type`, `currency_name`, `currency_amount` | conditional, optional | `needs_review_requiredness` / `needs_review_options` | official currency and monetary instrument API codes |
| BSP | `bsp_authorization_*` | conditional on PHP threshold, optional | `needs_review_requiredness` | BSP requiredness, document attachment requirement |
| Source/purpose | `currency_source`, `currency_transport_purpose`, `*_other` | text + display-value metadata, no unverified enum code | `needs_review_options` | official code values and Other condition controls |
| Transfer/courier | `currency_transport_method`, `courier_name`, `airway_bill_*` | method options use PH-A contract strings with `needs_review`; courier details optional | `needs_review_requiredness` | official method values, courier field requiredness |
| Foreign currency travel | `no_of_days_in_philippines`, `last_travel_to_philippines` | conditional, optional | `needs_review_requiredness` | requiredness and date/text control |

### 验收退回测试结果

- Passed: `cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts --testTimeout=15000` → 14/14 pass。
- Passed: `cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts src/tests/ph-etravel-departure-card-schema.test.ts --testTimeout=15000` → 18/18 pass。

### 新增/更新测试证明

- Positive customs/goods details 不因未验证子字段 `required: true` 错误阻断。
- Positive currency details 不因未验证 owner/recipient/BSP/source/purpose/courier fields 错误阻断。
- `currency_owner_not_applicable=true` 时 owner detail fields 被隐藏/waived，N/A path 可完成。
- 所有 form options 的 value 要么来自 official snapshot，要么带 `evidence_level`；currency source/purpose 不再使用 `SALARY`、`SAVINGS`、`INVESTMENT`、`TRAVEL`、`PAYMENT` 等自定义 code。

## 第三轮官网事实采集：Foreigner + SEA ordinary arrival（2026-08-01）

本轮按协调要求暂停 schema/seed/frontend/runner/migration 修改，只做菲律宾 eTravel 官网事实采集；唯一写入为本 PH-B worklog。直接访问官方公开站点时，`https://etravel.gov.ph/new-travel-declaration` 在无登录 session 下返回 `307 /logout?sessionExpired=true`，因此未进入真实申请人流程、未使用凭据/OTP/CAPTCHA、未付款、未最终提交。以下证据严格区分：

- `live visible`：无需登录即可看到的公开页面/响应。
- `official public bundle/API`：官方生产站点公开 Next.js bundle 或公开 `ws.etravel.gov.ph` API 返回；可证明字段 key、条件、option 来源，但不等同于人工 Review 截图。
- `unobserved-login-blocked`：需要登录/session/后续交互才能确认的实际渲染、红星、错误文案或最终提交 payload。

### 官方来源与访问结果

| Source | URL | Access date | Result |
| --- | --- | --- | --- |
| eTravel home | `https://etravel.gov.ph/` | 2026-08-01 | `live visible`；生产 build id `79dfb3348d0a0f2a798c95b2cbd450cc9201257f`。 |
| Sign in | `https://etravel.gov.ph/signin` | 2026-08-01 | `live visible`；未登录、未输入凭据。 |
| New travel declaration | `https://etravel.gov.ph/new-travel-declaration` | 2026-08-01 | `unobserved-login-blocked`；无 session 直接重定向 `/logout?sessionExpired=true`。 |
| Next.js route bundles | `/_next/static/{buildId}/_buildManifest.js` and page chunks | 2026-08-01 | `official public bundle/API`；读取 `/new-travel-declaration`、`/wizard/me`、`/wizard/other`、`/wizard/declaration`、shared form chunks。 |
| Common API | `https://ws.etravel.gov.ph/api/v1/common/travel_ports` | 2026-08-01 | `official public bundle/API`；73 ports total：AIR 20、SEA 53。 |
| Common API | `https://ws.etravel.gov.ph/api/v1/common/travel_companies` | 2026-08-01 | `official public bundle/API`；105 companies all AIR，SEA 0。 |
| Common API | `https://ws.etravel.gov.ph/api/v1/common/purpose_of_visits?for_arrival=1` | 2026-08-01 | `official public bundle/API`；15 arrival purposes。 |
| Common API | `https://ws.etravel.gov.ph/api/v1/common/currencies` | 2026-08-01 | `official public bundle/API`；263 currencies。 |
| Common API | `https://ws.etravel.gov.ph/api/v1/common/monetary_instruments` | 2026-08-01 | `official public bundle/API`；16 monetary instruments。 |
| Common API | `https://ws.etravel.gov.ph/api/v1/common/sickness_symptoms?order_by=name&status_by=asc&is_active=1` | 2026-08-01 | `official public bundle/API`；15 symptoms。 |

### Foreigner + SEA 页面/步骤顺序（公开 bundle 推断）

| Order | Official page/flow | Evidence | Notes |
| --- | --- | --- | --- |
| 0 | `/signin` | `live visible` | 无凭据访问只确认登录入口存在；未继续登录。 |
| 1 | `/new-travel-declaration` | `official public bundle/API` + `unobserved-login-blocked` | 初始登记页 bundle 包含 transport、arrival/departure、passport holder/persona、SEA disembarking 等逻辑；实际页面因 session 阻断未 live visible。 |
| 2 | `/wizard/me` or `/wizard/other` profile completion | `official public bundle/API` | 对 self/other 申请人的 profile、passport、permanent residence completeness 检查。 |
| 3 | Travel Details | `official public bundle/API` | Foreigner + SEA ordinary path 使用 vessel/voyage/port 分支。 |
| 4 | Health Declaration | `official public bundle/API` | Vaccination/antigen、recent travel、exposure、symptoms 条件分支。 |
| 5 | Other Travel Details | `official public bundle/API` | Family members、baggage、first-time visit。 |
| 6 | Customs flow | `official public bundle/API` | 仅当 selected travel port has `with_custom_declaration` 时插入 customs 相关步骤。 |
| 7 | General Declaration | `official public bundle/API` | 仅当 `with_something_to_declare` 为 true。 |
| 8 | Currency Declaration | `official public bundle/API` | 仅当 customs declaration 的 `is_with_currency_declaration` 为 true。 |
| 9 | Declaration Attachment and Signature | `official public bundle/API` | Signature required；有申报事项时显示 attachment upload。 |

### Foreigner + SEA 逐题矩阵

| Step | Official key | English question / help text observed | Control | Required / condition | Visible options | Validation / files | VIZA field | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Initial registration | `transportation_type` | Transport type labels from translation keys: Air / Sea | segmented/radio | default `AIR`; user can select SEA | `AIR`, `SEA` | value cleared side effects for incompatible fields | `transport_type` | `confirmed-public-bundle`; VIZA maps to `AIR/SEA`。 |
| Initial registration | `flight_type` | Arrival / Departure | radio/select | required in initial flow | `ARRIVAL`, `DEPARTURE` | SEA + ARRIVAL enables disembarking question | visa type / arrival card gate | `confirmed-public-bundle`。 |
| Initial registration | `nationality` / passport holder type | Foreigner vs Filipino branch inferred from persona/nationality logic | radio/select | branch driver | `FOREIGNER`, Filipino branch values | live label unobserved | `traveler_category` | `confirmed-public-bundle`; actual label unobserved。 |
| Initial registration | `is_disembarking` | `Field.is_disembarking`; PH-A first round observed “Are you disembarking?” | checkbox/boolean | shown for `transportation_type=SEA` and `flight_type=ARRIVAL` | true/false | AIR/special-flight fields cleared for SEA | `is_disembarking` | `confirmed-public-bundle`; live visible blocked。 |
| Profile | `photo_url` | Profile photo completeness key | file/profile asset | completeness check includes `photo_url` | unknown | profile photo requirement branch not live confirmed | document/profile photo | `unobserved-login-blocked`; do not make unconditional file requirement。 |
| Profile | `passport_number` | Passport number | text | profile completeness check includes `passport_number` | n/a | exact format unobserved | `passport_number` | `confirmed-public-bundle`; live validation unobserved。 |
| Profile | `gender` | Sex/Gender | select/radio | completeness check includes `gender` | unknown | exact labels unobserved | `gender` | `confirmed-public-bundle`; option labels need Review。 |
| Profile | `birth_date` | Date of birth | date | completeness check includes `birth_date` | n/a | also drives antigen rule for age >= 15 | `date_of_birth` | `confirmed-public-bundle`; date bounds unobserved。 |
| Profile | `nationality_country_code` | Nationality/Citizenship country | API country select | required in travel/profile validation | countries API | exact Foreigner filter unobserved | `citizenship` | `confirmed-public-bundle`。 |
| Profile | `country_of_birth_code` | Country of birth | API country select | required | countries API | n/a | `country_of_birth` | `confirmed-public-bundle`。 |
| Profile | `passport_issued_country_code` | Passport issued country | API country select | required | countries API | n/a | `passport_issuing_country` | `confirmed-public-bundle`。 |
| Profile | `passport_issued_date` | Passport issued date | date | required | n/a | exact date bounds unobserved | `passport_issue_date` | `confirmed-public-bundle`; VIZA may need key map。 |
| Profile | `occupation_code` | Occupation | select/API | completeness check includes `occupation_code` | unknown | source endpoint not fully inventoried this round | `occupation` | `confirmed-public-bundle`; options unobserved。 |
| Residence | permanent address object | Permanent residence fields | address fields | completeness check when missing profile residence | country/street; PH address cascade if country is PH | exact labels unobserved | `country_of_residence`, address lines | `mismatch`; VIZA freeform residence lacks confirmed PH region/province/municipality/barangay cascade。 |
| Travel Details | `purpose_of_visit_code` | Purpose of Visit | API select | arrival purpose required | see options table below | `return_date` required for Foreigner + `POV001`/`POV007` | `purpose_of_travel` | `confirmed-public-api`; VIZA option snapshot drift。 |
| Travel Details | `passenger_type` | Passenger type | select | required | SEA: `VESSEL PASSENGER`, `VESSEL CREW`; AIR: `AIRCRAFT PASSENGER`, `FLIGHT CREW` | ordinary VIZA should block crew | `persona_type` | `confirmed-public-bundle`; VIZA intentionally limits ordinary arrival to passenger。 |
| Travel Details | `vessel_name` | Vessel Name | text | required when `transportation_type=SEA` | n/a | no transport company dropdown for SEA | `vessel_name` | `confirmed-public-bundle`; matches VIZA concept。 |
| Travel Details | `flight_number` with SEA label `Field.voyage_number` | Voyage Number | text | required for `VESSEL PASSENGER` / `VESSEL CREW` | n/a | official payload key remains `flight_number` even when label is Voyage Number | `voyage_number` | `mismatch`; VIZA uses separate `voyage_number`, runner/schema must map to official `flight_number`。 |
| Travel Details | `origin_country_code` | Country of Origin | API country select | required for arrival | countries excluding PH | n/a | `origin_country` | `confirmed-public-bundle`。 |
| Travel Details | `origin_port` | Airport/Seaport of Origin | uppercase text | required for arrival | n/a | label adapts by transport; official key shared | `seaport_of_origin` | `mismatch`; VIZA splits AIR/SEA field names, official key is `origin_port`。 |
| Travel Details | `departure_date` | Date of Departure | date | required | n/a | min today, max today + 4 days in bundle | `voyage_departure_date` | `mismatch`; official uses shared `departure_date`, not flight/voyage-specific key。 |
| Travel Details | `with_transit` | SEA transit question label via `Field.with_transit_sea` | checkbox/boolean | optional branch | true/false | opens transit country/port/date | `has_transit` | `confirmed-public-bundle`。 |
| Travel Details | `transit_country_code` | Country of Transit | API country select | required when `with_transit=true` | countries excluding PH | n/a | `transit_country` | `confirmed-public-bundle`。 |
| Travel Details | `transit_port` | Airport/Seaport of Transit | uppercase text | required when `with_transit=true` | n/a | official key shared AIR/SEA | `transit_seaport` | `mismatch`; VIZA split field needs map to `transit_port`。 |
| Travel Details | `transit_date` | Date of Transit | date | required when `with_transit=true` | n/a | exact bounds unobserved | `transit_date` | `confirmed-public-bundle`。 |
| Travel Details | `destination_port_code` | Airport/Seaport of Destination / Arrival port in Philippines | API select | required for arrival | travel_ports filtered by transport; SEA 53 | selected port controls customs flow via `with_custom_declaration` | `sea_port_of_entry` | `mismatch`; VIZA concept matches, official key is `destination_port_code`。 |
| Travel Details | `arrival_date` | Date of Arrival | date | required | n/a | min today, max today + 4 days in bundle | `voyage_arrival_date` | `mismatch`; official uses shared `arrival_date`。 |
| Travel Details | `return_date` | Return date | date | Foreigner + arrival + `POV001` Holiday or `POV007` Visit Friends/Relatives, non-batch | n/a | min today | missing/unclear | `mismatch`; VIZA schema inventory should add/review return-date branch。 |
| Destination | `stay_location_type` | Destination/stay type | select | only for AIR arrival or SEA arrival where `is_disembarking=true` | SEA: `RESIDENCE`, `HOTEL`, `TRAVEL_PORT`; AIR: `RESIDENCE`, `HOTEL`, `TRANSIT` | controls destination child fields | `destination_type` | `condition-mismatch`; VIZA must not show when SEA not disembarking。 |
| Destination | `is_destination_same_as_permanent_address` | Same as permanent address | checkbox | when `stay_location_type=RESIDENCE` | true/false | copies/permanent address behavior | same-address flag | `confirmed-public-bundle`。 |
| Destination | `destination_upon_arrival_in_philippines` | Destination upon arrival in Philippines | text/autocomplete | required for `RESIDENCE`/`HOTEL` in active destination branch | hotels API for HOTEL | exact address validation unobserved | `philippines_address` / hotel fields | `confirmed-public-bundle`; VIZA field grouping differs。 |
| Destination | `transit_port_code`, `transit_destination_country_code` | Philippine transit airport and onward country | select + country select | AIR `TRANSIT` only | `TP1000`, `TP2000`, `TP3000`, `TP001` | not SEA | AIR-only transit fields | `confirmed-public-bundle`; SEA must not expose。 |
| Destination | `disembarking_port_code` | Port when `TRAVEL_PORT` selected | API select | SEA + `stay_location_type=TRAVEL_PORT` | travel_ports API | exact filter after TRAVEL_PORT needs Review | `disembarking_port_code` | `confirmed-public-bundle`; fixes prior naked TRAVEL_PORT issue。 |
| Health | `with_negative_antigen` | Negative antigen question | boolean | shown when not fully vaccinated and age >= 15 | yes/no | exact wording unobserved | missing/health antigen | `mismatch`; VIZA needs health contract review。 |
| Health | `meta.with_recent_travel_history` | Recent travel history | boolean | optional branch | yes/no | if true show visited countries | `has_recent_travel_history` | `confirmed-public-bundle`。 |
| Health | `visited_countries` | Countries visited | multi API select | required when recent travel yes | countries API | n/a | `recent_travel_countries` | `confirmed-public-bundle`。 |
| Health | `is_with_history_exposure` | Exposure history | boolean | required in health step | yes/no | exact help text unobserved | `has_exposure_history` | `confirmed-public-bundle`。 |
| Health | `is_sicked_within_thirty_days` | Sick within thirty days | boolean | required in health step | yes/no | if true show symptoms | `has_symptoms` | `confirmed-public-bundle`。 |
| Health | `sickness_symptoms` | Symptoms | multi API select | required when sick yes | 15 symptom labels from API | current API count drift vs VIZA snapshot | `symptoms` | `option-mismatch`; resync needed。 |
| Other Travel Details | `accompanied_family_members.below_eighteen` | Below 18 yrs. old | numeric | required | n/a | numeric count | `family_members_under_18` | `confirmed-public-bundle/PH-A`; exact validation unobserved。 |
| Other Travel Details | `accompanied_family_members.above_or_equal_eighteen` | 18 yrs. old and above | numeric | required | n/a | numeric count | `family_members_18_and_above` | `confirmed-public-bundle/PH-A`。 |
| Other Travel Details | `no_of_checked_in_baggages` | Checked-in baggage (pcs) | numeric | required | n/a | numeric count | `checked_baggage_count` | `confirmed-public-bundle`。 |
| Other Travel Details | `no_of_hand_carried_baggages` | Hand-carried baggage (pcs) | numeric | required | n/a | numeric count | `hand_carry_baggage_count` | `confirmed-public-bundle`。 |
| Other Travel Details | `first_time_visit` | First time visiting Philippines? | boolean | required | yes/no | n/a | `first_time_philippines` | `confirmed-public-bundle`。 |
| Customs gate | selected `travel_port.with_custom_declaration` | Customs declaration flow condition | system condition | customs steps inserted only if selected destination port has `with_custom_declaration` | port metadata | not all SEA ports have customs flag | customs step/gate | `condition-mismatch`; VIZA currently risks showing customs for all arrival users。 |
| Customs checklist | declaration items 1-12 | General Declaration Reminder items 1-12 | yes/no checklist | shown when something to declare; requiredness still Review | itemized official labels from PH-A/static text | bundle errors if goods amount positive and none of items 3-12 answered yes | `customs_checklist_1..12` | `confirmed-public-bundle` for itemized contract; requiredness `needs_review`。 |
| Goods | `amount_of_goods_acquired.amount` and item rows | Goods acquired / goods amount and details | amount/items | positive amount branches into details | currency/options need Review | no aggregate boolean substitute accepted | goods fields | `confirmed-public-bundle`; VIZA requiredness must stay non-blocking until Review。 |
| Currency | `is_with_currency_declaration` | Currency declaration trigger | boolean | when currency threshold/declaration applies | yes/no | PHP 50,000 / USD 10,000 reminders observed in static text | currency gate | `confirmed-public-bundle`; exact field requiredness needs PH-A Review。 |
| Currency details | currency, monetary instruments, owner/recipient/source/purpose/transfer fields | Currency declaration details | API selects/text/conditionals | only after currency positive branch | currencies 263; monetary instruments 16 | unverified source/purpose enum codes must not be hard-coded | currency detail fields | `needs-review`; VIZA custom enum codes must remain absent/degraded。 |
| Attachment | `attachments` | Declaration attachment | upload | shown if `with_something_to_declare` true | camera/file depending device/auth | accepted MIME: `image/png`, `image/jpg`, `image/jpeg`; project `etravel` | customs documents | `confirmed-public-bundle`; no PDF evidence。 |
| Signature | `signature`, `signature_source` | Signature | pad/string/signature widget | validation requires `signature`; initial value may reuse `profile.signature` | `PAD` source observed | signature is not proven as separate unconditional file slot | customs signature | `confirmed-public-bundle`; file requirement `unobserved`。 |

### 官方 option/API 采集

| Area | Official result | VIZA implication |
| --- | --- | --- |
| SEA travel ports | 53 SEA ports observed: `TP009` Port of Batangas, `TP0011` Port of Cebu, `TP0013` Port of Cagayan de Oro, `TP0015` Port of Iloilo, `TP0016` Subic Bay, `TP0017` San Fernando Luzon, `TP0101` Port of Sasa Davao, `TP0102` Port of Puerto Princesa, `TP0103` Manila South Harbor, `TP0105` Port of Laoag, `TP0106` Lal-lo Seaport, `PHBTN` Port of Bataan, `TP0107` San Fernando International Seaport, `TP0108` Zamboanga Port, `TP0109` Davao Toril Fishport Complex, `TP0111` Tabacco Seaport, `TP0113` Tacloban Seaport, `TP0114` Port of General Santos, `TP116` Port of Bislig, `TP117` Port of Surigao, `TP118` Port of Iligan, `TP119` Port of Bacolod, `TP120` Port of Legazpi, `TP121` Port of Pangasinan, `TP122` Port of Currimao, `TP123` Port of Calbayog, `TP124` Port of Sta Cruz, `TP125` Port of Masinloc, `TP126` Subic Bay Yacht Club, `TP128` Claveria, `TP129` Salomague Port, `TP130` Macapagal Port Terminal, `TP131` Macapagal Port Terminal Landbase, `TP132` El Nido, `TP133` Coron, `TP136` Subport of Sual, `APARRI` Port of Aparri, `PHSAN` Port of Irene, `PHBSO` Port of Basco, `CAMIGUIN` Port of Camiguin, `LEGAZPI` Port of Legazpi, `PHBOR` Boracay Seaport, `PHTAG` Port of Bohol, `ORCISL` Ochid Island, `RMBLN` Romblon, `TP-BSP` Port of Bongao, `CLYISL` Calayan Island, `TP137` Holiday Ocean Marina IGACOS, `PHSPS` Port of Subic Bay Freeport-Landbase, `CSLISL` Casulian Island, `SIARGAO` Siargao, `BSCBTN` Basco Batanes, `MHTP01` Mahatao Port. | Use official code as submit value; custom declaration availability depends on per-port `with_custom_declaration` metadata, not transport alone。 |
| Travel companies | 105 AIR companies, SEA 0. | SEA path should not display airline/transport-company select; use `vessel_name` text。 |
| Arrival purposes | 15 observed: `OFW` OFW, `POV001` Holiday/Pleasure/Vacation, `POV002` Convention/Conference, `POV003` Education/Training/Studies, `POV004` Government/Official Mission, `POV005` Health/Medical Reason, `POV006` Business/Professional, `POV007` Visit Friends/Relatives, `POV008` Work/Employment, `POV009` Religion/Pilgrimage, `POV010` Incentive, `POV011` Returning Resident, `POV012` Transit, `POV017` Meetings, `POV018` Trade Fair/Exhibition. API flags OFW as Filipino-only. | Current VIZA purpose snapshot needs Review/resync; Foreigner branch must not offer Filipino-only OFW。 |
| Sickness symptoms | 15 observed: Altered Mental Status, Colds, Cough, Diarrhea, Difficulty of Breathing, Dizziness, Fever, Headache, Loss of appetite, Loss of smell, Loss of taste, Muscle Pain, Nausea, Rashes/vesicles/blisters, Sore throat. | Current VIZA symptom snapshot count/options need resync。 |
| Currencies | 263 observed. | Currency fields should use official currency API/snapshot; no unverified custom source/purpose codes。 |
| Monetary instruments | 16 observed: CASH, BONDS, COMMERCIAL PAPERS, CONFIRMATION OF SALE/INVESTMENT, COSTUDIAL RECEIPTS, DEPOSIT CERTIFICATES, DEPOSIT SUBSTITUTE INSTRUMENTS, DRAFTS, MONEY ORDERS, NOTES, OTHER CHECKS, SECURITIES, TRADING ORDERS, TRANSACTION TICKETS, TRAVELER'S CHECK, TRUST CERTIFICATES. | Currency declaration instrument options need official mapping; spelling `COSTUDIAL` is as observed from API and should not be silently corrected without Review。 |

### SEA 与 AIR 差异结论

| Topic | AIR official behavior | SEA official behavior | Current VIZA risk |
| --- | --- | --- | --- |
| Initial registration | AIR can show special flight branch. | SEA + arrival shows `is_disembarking`; SEA clears special flight/flight-company fields. | SEA must stay independent from airline/airport UI。 |
| Company / vehicle | `travel_company_code` select + `flight_number` from flight-number API. | `vessel_name` text + `flight_number` key labelled Voyage Number. No SEA company API rows. | VIZA `voyage_number` must map to official `flight_number`。 |
| Dates | shared `departure_date` / `arrival_date`. | shared `departure_date` / `arrival_date`; not `voyage_departure_date` / `voyage_arrival_date`. | VIZA currently has voyage-specific keys; runner must map or schema should align in later change。 |
| Origin/transit/destination ports | shared keys with airport labels. | shared `origin_port`, `transit_port`, `destination_port_code` with seaport labels/options. | VIZA split names are product fields, not official payload keys。 |
| Stay location | `RESIDENCE`, `HOTEL`, `TRANSIT`. | only when disembarking: `RESIDENCE`, `HOTEL`, `TRAVEL_PORT`. | Destination section must hide when SEA not disembarking; AIR `TRANSIT` must not leak into SEA。 |
| Philippine transit | AIR `TRANSIT` uses fixed `transit_port_code` options and onward country. | SEA uses `TRAVEL_PORT` + `disembarking_port_code`; separate `with_transit` still uses text `transit_port` for transit before arrival. | Prior naked `TRAVEL_PORT` child was correctly identified; keep Review on filters/requiredness。 |
| Customs | depends on selected destination port metadata `with_custom_declaration`. | same, but only some SEA ports carry customs flag. | VIZA should not make customs universal for all arrival paths。 |

### 当前 VIZA schema/contract 缺口

| Severity | Gap | Evidence | Next owner/action |
| --- | --- | --- | --- |
| P0 | SEA Voyage Number official payload key is `flight_number`, but VIZA field is `voyage_number`. | `official public bundle/API` render/validation uses `flight_number` with SEA label `Field.voyage_number`. | PH-B/PH-C next schema-runner contract must map or rename; runner cannot submit `voyage_number` as official key without transform。 |
| P0 | SEA dates official keys are shared `departure_date` and `arrival_date`; VIZA has `voyage_departure_date`/`voyage_arrival_date`. | Bundle date validation/render uses generic keys for AIR and SEA. | PH-B/PH-C must align submit contract; avoid “flight date” naming for SEA but submit official keys。 |
| P0 | Destination port official key is `destination_port_code`; VIZA `sea_port_of_entry` is product alias. | Travel Details API select uses `/travel_ports` filtered by `transportation_type`. | Runner/schema must define alias clearly and consume official code。 |
| P0 | Customs flow is conditional on selected port `with_custom_declaration`, not all arrival users. | Wizard inserts customs steps only when travel port metadata has customs flag. | Future schema/frontend must gate customs by selected official port metadata; keep requiredness non-blocking until Review。 |
| P0 | `stay_location_type` for SEA is shown only when `is_disembarking=true`; VIZA destination field must not show for non-disembarking SEA. | Bundle condition: AIR arrival or SEA arrival + disembarking. | Frontend/schema condition must include disembarking gate。 |
| P1 | Official SEA origin/transit port keys are shared `origin_port`/`transit_port`, while VIZA splits `seaport_of_origin`/`transit_seaport`. | Bundle uses shared uppercase text inputs with transport-specific labels. | Acceptable UI alias only if runner maps back to official keys。 |
| P1 | Return date branch for Foreigner + Holiday/Visit Friends or Relatives appears missing/unclear in VIZA arrival contract. | Bundle requires `return_date` for Foreigner arrival purpose `POV001`/`POV007` non-batch. | Add Review-backed schema field or document why runner supplies it。 |
| P1 | SEA has official crew option `VESSEL CREW`, but ordinary VIZA arrival intentionally blocks crew/special persona. | Bundle passenger type options include passenger and crew by transport. | Product guard is valid; mark unsupported branch explicitly in UI/runner。 |
| P1 | Purpose/symptom snapshots drift from current official API. | 2026-08-01 API returns 15 purposes and 15 symptoms. | Resync official-options after PH-A Review snapshot freeze。 |
| P1 | Residence profile may require country/street and PH-specific region/province/municipality/barangay cascade. | Profile completeness bundle references permanent residence shape. | PH-A/PH-D Review needed before schema/profile prefill change。 |
| P1 | Currency declaration API-backed options need official mapping; source/purpose enum values remain unverified. | Public API confirms currencies and monetary instruments only, not source/purpose codes. | Do not hard-code custom enum values; wait for PH-A Review。 |
| P2 | Exact English labels/help text from post-login pages remain partly unobserved. | Login/session blocked live form. | PH-A approved Review session or official test account needed for screenshots/DOM labels。 |
| P2 | Profile photo/customs signature file slot behavior remains unobserved live. | Bundle shows signature required and conditional image attachment upload; profile photo in completeness check. | Do not create unconditional document migration before Review。 |

### 本轮测试/执行边界

- Not run：schema tests、seed、migration、deployment、remote DB、runner、frontend、official submission。
- Not attempted：login credential use、OTP、CAPTCHA/Turnstile bypass、payment、QR/final submit。
- Only edited：`docs/philippines-launch-worklogs/PH-B.md`。

## 第二轮登录态 SEA UI 爬取：普通旅客 + SEA + ARRIVAL（2026-08-01）

本轮目标是从官方 Dashboard 新建 `FOR ME + SEA + ARRIVAL` 并逐页核实 SEA Travel Details。实际浏览器状态：Chrome 中已有 eTravel 登录态标签，但打开即位于 `/wizard/me?...&wizard_page=5` 的 `Philippine Customs Declaration` → `Customs Declaration attachments and signature` 页面。该页包含 `Take a photo or upload a file.`、`Signature`、`Clear`、`Previous`、`Next` 以及法律确认文案。按任务边界“遇到签名页/Review/法律确认/CAPTCHA/OTP/账号密码/真实文件上传必须停下”，本轮没有点击 `Previous`、`Next`，没有从 Dashboard 新建新申报，没有继续到 Review/Submit，没有记录任何账号、邮箱、OTP、Cookie、护照号、真实姓名、截图路径或敏感内容。

### 登录态 UI 可见结论

| Area | Result | Evidence class | Contract impact |
| --- | --- | --- | --- |
| Existing browser session | eTravel tab was available in Chrome and opened to `/wizard/me` page 5. | `live visible` | Proves an authenticated wizard page can be reached in this browser, but current position is outside Travel Details scope. |
| Current visible page | Heading: `Philippine Customs Declaration`; subheading/body: `Customs Declaration attachments and signature`, `For Customs - Declaration Attachments and Signature`, `Take a photo or upload a file.`, `Signature`; buttons `Clear`, `Previous`, `Next`; legal certification before `Next`. | `live visible` | Stop boundary reached. No further UI interaction performed. |
| SEA Travel Details live UI | Not reached this round. | `unobserved-stopped-at-signature` | Travel Details labels/required marks remain from official public bundle/API evidence, not live wizard screenshots. |
| Dashboard new `FOR ME + SEA + ARRIVAL` | Not attempted after signature-page stop. | `unobserved-stopped-at-signature` | Needs PH-A/Coordinator-provided safe test route or permission to navigate from dashboard without touching signature/review state. |

### SEA Travel Details 字段合同（当前证据等级）

下表不把登录态签名页观察误标为 Travel Details live proof；`official public bundle/API` 仍是字段名/key/condition 的主要证据，登录态本轮只证明当前流程已到签名页并触发停止规则。

| Visible order in SEA Travel Details | Official field/key | Official label / prompt | Control type | Required / condition evidence | Options / source | Current VIZA field | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `purpose_of_visit_code` | Purpose of Visit | API select | Arrival travel details validation requires purpose. | `/api/v1/common/purpose_of_visits?for_arrival=1`; current API 15 options, OFW Filipino-only. | `purpose_of_travel` | `confirmed-public-api`; live UI unobserved. |
| 2 | `passenger_type` | Passenger type | select | Required. Transport-specific options. | SEA includes `VESSEL PASSENGER`, `VESSEL CREW`; ordinary VIZA should allow passenger only. | `persona_type` / traveller type | `confirmed-public-bundle`; live UI unobserved. |
| 3 | `vessel_name` | Vessel Name | text | Required when `transportation_type=SEA`. | n/a | `vessel_name` | `confirmed-public-bundle`; VIZA concept matches. |
| 4 | `flight_number` | Voyage Number | text | Required for `VESSEL PASSENGER` / `VESSEL CREW`; official bundle keeps payload key `flight_number` while label changes to Voyage Number for SEA. | n/a | `voyage_number` | `P0 mismatch`; VIZA field is product alias and must map to official `flight_number`. |
| 5 | `origin_country_code` | Country of Origin | country API select | Required for arrival. | `/api/v1/common/countries`, excluding PH in bundle condition. | `origin_country` | `confirmed-public-bundle/API`. |
| 6 | `origin_port` | Airport/Seaport of Origin | uppercase text input | Required for arrival; label adapts by transport. | n/a | `seaport_of_origin` | `P1 alias mismatch`; VIZA split field must map to official shared `origin_port`. |
| 7 | `departure_date` | Date of Departure | date | Required; bundle sets min today, max today + 4 days. | n/a | `voyage_departure_date` | `P0 mismatch`; official key is shared `departure_date`, not `voyage_departure_date`. |
| 8 | `with_transit` | SEA transit question via `Field.with_transit_sea` | checkbox/boolean | Optional branch gate. | true/false | `has_transit` | `confirmed-public-bundle`; live label unobserved. |
| 9 | `transit_country_code` | Country of Transit | country API select | Required when `with_transit=true`. | `/api/v1/common/countries`, excluding PH. | `transit_country` | `confirmed-public-bundle/API`. |
| 10 | `transit_port` | Airport/Seaport of Transit | uppercase text input | Required when `with_transit=true`; official key shared across AIR/SEA. | n/a | `transit_seaport` | `P1 alias mismatch`; map to official `transit_port`. |
| 11 | `transit_date` | Date of Transit | date | Required when `with_transit=true`. | n/a | `transit_date` | `confirmed-public-bundle`. |
| 12 | `destination_port_code` | Airport/Seaport of Destination / arrival port | API select | Required for arrival; filtered by `transportation_type=SEA`. | `/api/v1/common/travel_ports`; SEA 53 options. | `sea_port_of_entry` | `P0 alias mismatch`; VIZA must submit official `destination_port_code`. |
| 13 | `arrival_date` | Date of Arrival | date | Required; bundle sets min today, max today + 4 days. | n/a | `voyage_arrival_date` | `P0 mismatch`; official key is shared `arrival_date`, not `voyage_arrival_date`. |
| Conditional | `return_date` | Return Date | date | Required for Foreigner + arrival + purpose `POV001` Holiday/Pleasure/Vacation or `POV007` Visit Friends/Relatives, non-batch. | n/a | missing/unclear | `P1 missing branch`; add after Review. |
| Conditional | `stay_location_type` | Stay / destination type | select | Shown for AIR arrival OR SEA arrival with `is_disembarking=true`. | SEA: `RESIDENCE`, `HOTEL`, `TRAVEL_PORT`; AIR: `RESIDENCE`, `HOTEL`, `TRANSIT`. | `destination_type` | `P0 condition mismatch`; hide for SEA when not disembarking. |
| Conditional | `destination_upon_arrival_in_philippines` | Destination upon arrival in the Philippines | text/autocomplete | Required for `RESIDENCE`/`HOTEL` while destination branch active. | HOTEL uses hotels API. | `philippines_address` / hotel fields | `confirmed-public-bundle`; VIZA grouping differs. |
| Conditional | `disembarking_port_code` | Port for `TRAVEL_PORT` | API select | SEA + `stay_location_type=TRAVEL_PORT`. | travel ports API; exact filter needs live Review. | `disembarking_port_code` | `confirmed-public-bundle`; live UI unobserved. |

### SEA ports 抽样（official API）

Official endpoint：`https://ws.etravel.gov.ph/api/v1/common/travel_ports`；2026-08-01 current result contains 53 SEA ports. First 10 observed display/code pairs:

| # | code | official display |
| --- | --- | --- |
| 1 | `TP009` | Port of Batangas (PHBTG) |
| 2 | `TP0011` | Port of Cebu (PHCEB) |
| 3 | `TP0013` | Port of Cagayan de Oro |
| 4 | `TP0015` | Port of Iloilo (PHILO) |
| 5 | `TP0016` | Subic Bay (PHSFS) |
| 6 | `TP0017` | San Fernando, Luzon (PHSFE) |
| 7 | `TP0101` | Port of Sasa, Davao Seaport |
| 8 | `TP0102` | Port of Puerto Princesa |
| 9 | `TP0103` | Manila South Harbor |
| 10 | `TP0105` | Port of Laoag |

### P0/P1 schema diff and owner handoff

| Severity | Diff | Evidence level | Required follow-up |
| --- | --- | --- | --- |
| P0 | `voyage_number` is a VIZA alias; official SEA Voyage Number still submits as `flight_number`. | `official public bundle/API`; live Travel Details UI not reached this round. | PH-B schema contract and PH-C runner mapping must make alias explicit before submit automation. |
| P0 | `voyage_departure_date` / `voyage_arrival_date` are VIZA aliases; official fields are shared `departure_date` / `arrival_date`. | `official public bundle/API`. | PH-C runner must submit shared official keys; PH-D label may say Date of Departure/Arrival for SEA without implying flight dates. |
| P0 | `sea_port_of_entry` maps official `destination_port_code`. | `official public bundle/API` + SEA ports API. | PH-B/PH-C must lock key mapping; PH-D should show official SEA port display/code values. |
| P0 | `destination_type` / stay location must be gated by `is_disembarking=true` for SEA. | `official public bundle/API`; login-state UI stopped before Travel Details. | PH-D dynamic form must not expose Residence/Hotel/TRAVEL_PORT for non-disembarking SEA. |
| P0 | Customs pages depend on selected destination port `with_custom_declaration`, not global arrival status. | `official public bundle/API`; current live page proves a customs signature step exists for the current draft but does not disclose selected port. | PH-B/PH-D must use port metadata; PH-C runner must not assume customs for all SEA arrivals. |
| P1 | `seaport_of_origin` and `transit_seaport` are VIZA split fields; official keys are `origin_port` and `transit_port`. | `official public bundle/API`. | PH-C map aliases; PH-D can keep transport-specific labels if submit contract is clear. |
| P1 | SEA travel company field is absent; public API has SEA company count 0. | `official public API`. | Do not add SEA transport company dropdown unless later live Review contradicts API/bundle. |
| P1 | `return_date` branch likely missing for Foreigner + `POV001`/`POV007`. | `official public bundle/API`. | PH-A Review should confirm live required marker/error; PH-B schema should add only after contract approval. |

### 本轮边界

- Performed：claimed existing Chrome eTravel tab, read visible non-sensitive DOM text on signature page, updated this worklog only.
- Not performed：Dashboard new application, Previous/Next navigation, file upload, signature edit, Review, Submit, OTP/CAPTCHA, schema/test/seed/frontend/runner changes.
- Remaining live proof gap：needs a safe official test session starting at Dashboard or Travel Details, with permission to stop before signature/review and without recording sensitive applicant data.

## 第四轮 schema 合同修正：Review evidence + structured customs/currency + family/signature gate（2026-08-01）

本轮不浏览官网；开始前已重新读取 `docs/philippines-launch-coordination.md` 第 16 节、PH-A/PH-B/PH-C/PH-D 最新 worklog，并执行只读 `git status --short`。只修改 PH-B 独占文件；未运行 migration、seed、部署、commit 或批量 git add。

### 改动文件

- `viza-be/agent-backend/scripts/ph-etravel/form-fields.ts`
  - 新增 `customs_signature` 字段，`field_type=signature_pad`、`required=true`、official key `signature`、`signature_source=PAD`、`gate=review_precondition`；证据等级为 coordinator AIR Review live evidence。保留 `customs_signature_declaration` 为 `static_statement`，不再把法律文案伪装为 applicant checkbox。
  - 新增 `family_member_gate_confirmation`，step `Family Member(s)`，位于 signature 后、Review 前；无 family member 时要求确认 `NO_COMPANION_CONFIRMED`，并标记 `not_a_nested_applicant_field=true`、`creates_individual_declarations=true`。
  - Customs 仍保留 12 项 `customs_checklist_1..12` 逐项 yes/no，requiredness 继续 `needs_review_requiredness`，不退回 aggregate boolean。
  - Goods positive 分支保留 `amount_of_goods_acquired.currency/amount` 映射，并把 item fields 标为 `repeat_group=customs_goods_items`、`repeat_contract=items[]`、official table `Add Item`。
  - Currency positive 分支补足结构化字段：owner/recipient 的 business/name/occupation/country/address/postal code、`currency_items` repeat、monetary instrument、BSP authorization date、source arrays、purpose arrays、physical/courier children。
  - 移除未 live 观察到的 `bsp_authorization_number` schema 字段；第 16 节/PH-A live evidence 只支持 BSP date。
  - `currency_source` 与 `currency_transport_purpose` 从 text 改为 checkbox arrays；Other detail 字段只在包含 `OTHER` 时显示。
  - SEA Review 仍未 live verified：`voyage_number`、`voyage_departure_date`、`voyage_arrival_date`、`sea_port_of_entry` 均保留 VIZA alias，但显式记录 official key (`flight_number`、`departure_date`、`arrival_date`、`destination_port_code`)、`product_alias=true`、`evidence_level=needs_live_review`。
  - `destination_type` 增加 SEA disembark gate：`transport_type === AIR || (transport_type === SEA && is_disembarking === yes)`；SEA branch 仍标 `needs_live_review`。
- `viza-be/agent-backend/scripts/ph-etravel/official-options.ts`
  - 新增 16 个 `PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS`，来源为 PH-B 2026-08-01 official public API evidence。
  - 将 currency source/purpose option values 升级为 PH-A live UI 观察到的 DOM values：`SALARY/BUSINESS/OTHER` 与 `LEISURE/MEDICAL/PAYABLES/EDUCATION/OTHER`，证据等级 `verified_public`。
  - 将 transfer method options 标记为 PH-A live UI 观察到的 values：`is_physically_transferred_by_person`、`is_shipped_thru_courier_service`。
  - 新增 `PH_ETRAVEL_FAMILY_COMPANION_GATE_OPTIONS`：`NO_COMPANION_CONFIRMED` 与 `RETURN_TO_SELECT_FAMILY`，映射官方弹窗 `Yes` / `No` 行为。
- `viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts`
  - 更新 SEA alias/official key/evidence tests。
  - 更新 destination SEA disembark gate tests。
  - 增加 structured goods items、structured currency owner/recipient/item/source/purpose/physical/courier tests。
  - 增加 signature required gate tests，证明 required 的是 `signature_pad`，不是 `customs_signature_file`。
  - 增加 Family Member(s) gate tests。
  - 增加不把 Review-only result fields (`review_summary`、official reference、QR、final submit 等) seed 成 applicant questions 的测试。
- `docs/philippines-launch-worklogs/PH-B.md`
  - 追加本执行记录。

### Evidence/requiredness 处理

| Area | Contract status |
| --- | --- |
| Signature canvas | Review 前必填；证据来自 coordinator 第 16 节 AIR live Review path。不是无条件文件上传。 |
| Attachment upload | 继续 `needs_review`；Review path 观察到 `NO ATTACHMENTS`，不能反推所有 customs/currency positive path 都不需要附件，也不能反推必须上传。 |
| Family Member(s) | 独立官方 gate；无家庭成员需要确认没有 companion。不是同一表单里可自动混填的普通子字段。 |
| Customs checklist | 12 项逐项答案保留；requiredness 仍 `needs_review_requiredness`。 |
| Goods details | 保留 amount + `items[]` 结构；requiredness/重复限制仍 `needs_review_requiredness`。 |
| Currency details | 保留 owner/recipient、`currency_items[]`、BSP date、source/purpose arrays、physical/courier children；requiredness 仍 `needs_review_requiredness`。 |
| Source/purpose values | PH-A live UI 已观察 DOM values，升级为 `verified_public`；仍不推断 final acceptance。 |
| SEA Review | 仍未 live verified；不得用 AIR Review 替代 SEA Review。SEA aliases 全部保持 `needs_live_review`。 |
| Review-only result fields | 未 seed 成 applicant questions；reference/QR/final submit 仍不在 schema。 |

### 测试结果

- Attempted：`cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts --testTimeout=15000`
- Result：未运行成功。Vitest 在加载配置时尝试写入 `viza-be/agent-backend/vitest.config.ts.timestamp-1785585359373-6589b9c88cf4a8.mjs`，当前沙箱返回 `EPERM: operation not permitted`。
- 按协调者跟进要求，本轮没有请求用户审批、没有升级权限重跑；记录为环境写入受限导致 tests not run。

### 仍缺证据 / 接口请求

- PH-A/Coordinator：仍需 SEA Review live evidence；本轮不能用 AIR Review 替代 SEA 的 Review 顺序、显示条件或 requiredness。
- PH-A/Coordinator：仍需 final `Submit`、official reference、QR、result/recovery page 的授权验证；当前只到 Review/Summary，不能标记提交闭环。
- PH-A：仍需 customs/currency positive fields 的 requiredness validation；第 16 节说明 incomplete values 已到 Review，但不能推断 final acceptance。
- PH-C：runner 必须消费结构化 customs/currency fields 与 family/signature gates；缺结构化字段时应 fail closed/action-required，不能合并成 aggregate/free-text。
- PH-D：frontend/dynamic form 需要表达 signature required gate、Family Member(s) gate、SEA `needs_live_review` 与 Summary-not-submitted 状态。

## 第五轮 schema 合同修正：SEA Review live evidence 消化（2026-08-01）

本轮不浏览官网；已读取 `docs/philippines-launch-coordination.md` 第 17 节、PH-A 最新 SEA Review live evidence，以及 `docs/philippines-etravel-arrival-field-contract.md`。只修改 PH-B 独占 schema/options/test/worklog 文件；未修改总览、PH-A/C/D worklog、runner、frontend、migration、seed、部署或 commit。

### 完成项

- SEA Review 状态从旧的“未验证”更新为“已验证一个 controlled `SEA + ARRIVAL + is_disembarking=true + VESSEL PASSENGER` path 到 `New Travel Declaration Summary`，但仍有 path-specific gaps”。
- `voyage_number` 保留 VIZA alias，但 `validation_rules.official_key = flight_number`；证据等级从 `needs_live_review` 升为 `verified_live`，并显式保留 `VESSEL CREW`、`CRUISE PASSENGER`、`CRUISE CREW` 为 `needs_review`/unsupported gaps。
- `voyage_departure_date` / `voyage_arrival_date` 保留 VIZA aliases，但 official keys 明确为 `departure_date` / `arrival_date`，证据等级升级为 `verified_live` for observed SEA passenger path。
- 新增 `return_date` applicant field，official key `return_date`，条件为 `purpose_of_travel === POV001`；证据来自 SEA Holiday path live observation，并标记 `not_air_only=true`。其他 purpose/persona 的 return-date requiredness 仍 `needs_review`。
- `destination_type` 保持 `transport_type === AIR || (transport_type === SEA && is_disembarking === yes)` gate；SEA `RESIDENCE/HOTEL/TRAVEL_PORT` 证据升级为 `verified_live` for observed disembarking passenger path，non-disembarking path 仍 `needs_review`。
- `disembarking_port_code` 明确 official key 为 `disembarking_port_code`，绑定 SEA `TRAVEL_PORT` branch，证据升级为 `verified_live`。
- 新增 `sea_manual_customs_forms_notice` static contract：SEA observed selected path showed manual Customs Baggage/Currency forms notice and download links, not AIR-style electronic customs questions。
- Electronic customs questions/checklist/goods/currency/signature gate 改为仅在 `(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS)` 下显示；避免把 AIR electronic customs + signature page 设置成所有 SEA 无条件必需。
- `customs_signature` 仍是 electronic customs flow 的 `signature_pad` required gate，但证据标记为 `verified_live_air_path_not_universal_sea`，并记录 SEA manual forms path before Review 未出现 signature page。
- Family Member(s) gate 保持 transport-independent shared Review precondition：AIR/SEA 都有 Family Member(s) 和 no-companion confirmation modal；仍不是普通 nested applicant field。

### 测试更新

- 更新 arrival schema tests 覆盖：
  - SEA alias official keys：`voyage_number -> flight_number`，voyage dates -> `departure_date`/`arrival_date`，`sea_port_of_entry -> destination_port_code`。
  - SEA `return_date` Holiday branch is not AIR-only。
  - SEA disembark destination gate and `TRAVEL_PORT -> disembarking_port_code`。
  - SEA manual customs notice vs AIR/electronic customs/signature separation。
  - Family Member(s) gate shared across AIR/SEA and not transport-scoped。

### 测试结果

- Attempted：`cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts --testTimeout=15000`
- Result：未运行成功；Vitest 仍在加载 config 时尝试写入 repo 内临时文件并被沙箱拒绝：
  - `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend/vitest.config.ts.timestamp-1785585770458-81f7f8658a7d3.mjs'`
- 按协调者要求，本轮未请求审批、未升级权限重跑；记录为 tests blocked before execution。
- Passed：`git diff --check -- viza-be/agent-backend/scripts/ph-etravel/form-fields.ts viza-be/agent-backend/scripts/ph-etravel/official-options.ts viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts docs/philippines-launch-worklogs/PH-B.md`。

## 第十二轮 E11 SEA electronic positive attachments/signature 合同消费（2026-08-04）

> 范围：只读取 coordination 第 24 节、arrival field contract E11 与 PH-A/B/C/D 最新记录；未浏览官网，未接触敏感资料、登录凭据或受控草稿，未运行 migration、seed、部署或最终 Submit。仅修改 PH-B 独占 schema/test/worklog；`official-options.ts` 本轮只读确认，无 options 变更。

### E11 已消费的证据

- 将 `PH_ETRAVEL_SEA_ELECTRONIC_POSITIVE_COVERAGE` 从 E10 的 through-Currency 收束为 E11 的 `SEA + ARRIVAL + VESSEL PASSENGER + Manila South Harbor + electronic customs Yes` through `For Customs - Declaration Attachments and Signature`。
  - page order 现为 Confirmation Yes -> Other Travel Details -> General Declaration -> Currency Declaration -> attachments/signature page。
  - `customs_signature` 被纳入该 path coverage，且仍受 `ELECTRONIC_CUSTOMS_FLOW` 条件限制；manual SEA 继续没有该 gate，不成为全体 SEA 的无条件要求。
- `no_of_days_in_philippines` 与 `last_travel_to_philippines`：保持 schema `required=false`，但记录 E11 的 `Required` 验证仅在 `currency_transport_method === is_physically_transferred_by_person` 分支成立，metadata 为 `verified_live_sea_electronic_positive_physical_branch_only`。
- `customs_signature`：保留 `signature_pad` / canvas、`required=true`（仅在其条件页面显示时），记录 E11 空白 `Next` 的 `Required` 与页面级 required-fields 验证；不是 `customs_signature_file`。
- E11 仅显示 `Take a photo or upload a file.` 文案。没有稳定 file input、`accept`、MIME、size、数量或上传必填验证，故没有新增 attachment applicant field，且 metadata 明确为 `needs_review`。

### 刻意保持未闭合

- E11 合成签名后的继续操作被 managed-browser policy 阻断，不是官方表单结果；positive-path Family Member(s)、no-companion、Summary、final Submit、reference、QR 与 result/recovery 全部仍为 `needs_review`。没有从 E9 的 electronic No 路径外推。
- Owner N/A 稳定 selector、owner/recipient 完整 requiredness、courier/BSP/Other detail requiredness、货币/monetary option 完整快照、Other goods 无 row 页面阻断、SEA non-disembarking/port customs variants 仍未提升。

### 回归与接口

- 新增/更新 schema 静态断言：E11 path page coverage、signature canvas Required、physical branch-only Required、附件不进入 applicant schema、manual/electronic 分流、positive path 的 Family gate `needs_review`、result-only fields 不进入 applicant schema。
- PH-C：可把 SEA positive phase 从 Currency 延展到签名 action gate；必须在签名后 fail-closed，不能把 E9 No 的 Family/Summary 复用到 positive path。
- PH-D：可将 positive SEA 签名显示为 action-required；不得把上传文案呈现为强制上传或新增 MIME/size 规则。
- PH-A：仍需官方证明 positive-path post-signature Family/Summary、上传 file control/validation、以及上述 selector/options/requiredness gaps。

### 测试结果

- Passed：静态 coverage 检查输出 `ph-e11-static-coverage-ok:6`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` 的依赖状态检查尝试在 agent-backend 写入临时文件，报 `EPERM: operation not permitted`；按约束未请求审批、未重试、未安装依赖。
- Passed：`git diff --check -- viza-be/agent-backend/scripts/ph-etravel/form-fields.ts viza-be/agent-backend/scripts/ph-etravel/official-options.ts viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts docs/philippines-launch-worklogs/PH-B.md`。

## 第十一轮 E10 SEA electronic customs Yes 证据消费（2026-08-04）

本轮已读取适用 AGENTS、协调总览第 23 节、canonical field contract、PH-A/B/C/D 最新段落和当前 status。只消费已落盘 E10；未浏览官网，未改 runner/frontend/coordination/migration/seed，也未执行真实申请、OTP/Cookie、付款或 final Submit。

### E10 schema metadata / coverage

- 新增 `PH_ETRAVEL_SEA_ELECTRONIC_POSITIVE_COVERAGE`，精确范围是 `SEA + ARRIVAL + VESSEL PASSENGER + Manila South Harbor + electronic customs Yes`。
- 该 metadata 的 confirmed page order 是：Customs Confirmation `Yes` -> Other Travel Details -> General Declaration -> Currency Declaration；`confirmed_through` 严格止于 Currency Declaration。
- 记录 AIR E7 与 SEA E10 共用的 structured selector scope：Other Travel Details、12 个 `check_lists.*.response`、Other goods amount/modal/table surface、owner/recipient groups、currency item modal、BSP date、source/purpose arrays and Other details、physical/courier branches。
- coverage 机器清单共 55 个 schema fields；它不包含 `data_privacy_agreement`、`customs_signature`、Family gate、Review/Summary、final Submit、official reference 或 QR/result fields。
- `customs_information_acknowledgement` 与 `has_baggage_or_currency_to_declare` 的 SEA positive evidence 从旧的整体 `needs_review` 收窄为 `verified_live_through_currency`，并新增 `sea_electronic_positive_post_currency_evidence_level=needs_review`。
- `customs_signature.sea_electronic_positive_branch_evidence_level` 现在明确为 `needs_review_post_currency`；E9 no-declaration signature/Family/Summary 不被复用为 E10 positive evidence。
- SEA manual notice 的未验证变体更新为 `SEA_ELECTRONIC_POSITIVE_POST_CURRENCY`。manual SEA、electronic No、非下船/未观察 port 都列为 E10 coverage excluded paths，避免所有 SEA 被要求 electronic positive fields。

### Requiredness / option boundary

- E10 的 controls visible/reused 不改变任何 positive customs/currency detail field 的 `required`：机器静态检查确认 50 个 customs/currency detail fields 均仍为 `required=false`。
- Owner N/A stable selector、owner/recipient requiredness、physical branch empty validation、Other goods row persistence/page-level validation、完整 currency/monetary option payloads仍未闭合。
- `official-options.ts` 本轮只读审计，无 option code 改动。SEA E10 只确认可见 values/labels和既有 selector shape，不证明完整 payload/code list。

### Tests / validation

- 新增 schema tests：E10 page order、55-field coverage、AIR/SEA selector reuse scope、manual/no-declaration/non-observed SEA exclusions、post-Currency gates，以及 static/privacy/result fields 禁入 E10 applicant coverage。
- Static coverage passed：`sea-e10-coverage-ok:55`。
- Static requiredness boundary passed：`sea-e10-requiredness-ok:50`。
- Attempted targeted Vitest：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。未进入 test body；pnpm dependency-status check attempted `pnpm install` and failed with `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend/_tmp_29618_e359d069b70b29d9934ba4b6e68b4eff'`。未请求权限、未安装依赖、未重试。
- `git diff --check` passed。

### PH-A 下一段证据 / interfaces

- PH-A E11 仍需仅验证同一 SEA positive path 的 Currency completion 后顺序：attachments/file behavior、signature、Family/no-companion、Summary；不得从 AIR E7 或 SEA E9 no-declaration 推导。
- PH-C 可将 E10 page order 和 structured selector scope 用于 SEA-specific fail-closed action plan，但必须在 Currency completion 后停止；不得将 E10 解释为 final automation authorization。
- PH-D 可条件呈现 structured SEA electronic positive data，仍不得暗示 completed/submitted，且不得给 manual/no-declaration SEA 强加 positive fields。

## 第十轮 canonical field contract vs schema/options/tests 差异审计（2026-08-03）

本轮按当前 `docs/philippines-etravel-arrival-field-contract.md` 的 E2、E6、E7、E8、E9 canonical evidence 完成；未等待 PH-A E10，未浏览官网。已读取协调总览、PH-A/B/C/D worklog、field contract 和当前 worktree；只修改 PH-B 独占 schema/test/worklog 文件，未修改 runner、frontend、coordination、migration、seed、部署或 commit。

### 已修复的确定性合同差异

- 新增 `PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE`：36 个已有官方 control/value key 的 canonical applicant controls 均有 `field_name`、official key、E2/E6/E7/E8/E9 evidence 和 path-specific 标记。schema test 逐项断言该 field 存在且 metadata official key 一致。
- E8 SEA official aliases 保持不变并纳入 coverage：`vessel_name`、`voyage_number -> flight_number`、`voyage_departure_date -> departure_date`、`voyage_arrival_date -> arrival_date`、`sea_port_of_entry -> destination_port_code`。E6 `disembarking_port_code` 仍与 page-0 `destination_port_code` 分开。
- 补齐已确认 control/value key metadata：`transportation_type`、`nationality`、`birth_date`、`passport_issued_date`、`purpose_of_visit_code`、`passenger_type`、`origin_country_code`、`origin_port`/`port_origin`、`departure_date`、`arrival_date`、`transit_*`/`port_transit`、`stay_location_type`、destination value/label split、health、Family counts、baggage 和 customs confirmation。
- 纠正 Other Travel Details 的 label/value 漂移：`checked_baggage_count -> no_of_checked_in_baggages`，并记录 display/group key `no_of_baggage`；`handcarry_baggage_count -> no_of_hand_carried_baggages`；`first_time_visiting_philippines -> first_time_visit`；family count 分别映射到 `accompanied_family_members.below_eighteen` / `above_or_equal_eighteen`。
- customs confirmation 的 official key 明确为 `with_something_to_declare_arrival`、control 为 `yes_no_button`。`customs_information_acknowledgement` 和 confirmation 的 `required` 均降为 `false`，requiredness 继续标注 `needs_review`；这不会把 selector/page visibility 误当作已验证的阻断规则。
- `is_disembarking` 保持 E6/E8 path-specific visibility gate，且不再作为未验证分支的 schema `required=true`。E8 omission 不是 `false` 路径证明。
- 移除了 `data_privacy_agreement` applicant checkbox：E8 只确认 Start 页的 Data Privacy/Affidavit copy 与 Continue action，contract 把 static notice/action 排除在 applicant answers 之外，未观察到可持久化的申请人 checkbox。

### 覆盖与边界

- Coverage assertions 同时禁止将 account email/password/OTP、Review/Summary、final Submit、official reference、QR 等 runtime/result/action surface 作为申请人字段。
- SEA manual forms、SEA electronic no-declaration/signature/Family/Summary 和 SEA electronic positive customs 均继续是独立 path；没有被降格为所有 SEA 的统一规则。
- `official-options.ts` 本轮只审计未改动：countries/purposes/ports 等 snapshot-backed list 保持 snapshot evidence；SEA destination-port stable code、完整 currency/monetary lists 等未知项没有猜测 code。

### 未闭合差异（不实施）

| Owner/gate | Remaining gap |
| --- | --- |
| official evidence | SEA `is_disembarking=false`/omitted applicability；per-port manual vs electronic customs metadata；SEA electronic `Yes` positive customs/currency selectors and requiredness；attachment/file input condition；final Submit/reference/QR/result/recovery。 |
| option snapshot | full current SEA destination/travel-port codes with flow metadata；complete current currency and monetary instrument option payloads。 |
| PH-C runner | consume newly explicit baggage/family/customs control keys; continue path-content detection; do not send static/privacy or result fields; do not apply AIR positive selectors to SEA electronic Yes without E10 evidence。 |
| PH-D shared UI | render only path-specific gates and structured repeat/modal fields; do not treat `required=false` evidence freeze as an optional official answer; keep result success gated on reference plus independent QR。 |

### E10 consumption checklist

When PH-A publishes E10, PH-B must consume only: SEA electronic positive `Yes` branch page order and selectors; whether AIR structured General/Currency controls are reused; explicit `is_disembarking=false` behavior; port code/customs-flow source; attachment control/requiredness; and any final Submit/reference/QR/result evidence. Each item needs separate selector, requiredness, option-value, and path applicability evidence; visibility alone does not close requiredness.

### Validation

- Static TypeScript coverage check passed: imported current form schema and verified all 36 `PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE` entries resolve to a schema field with the expected official key (`coverage-ok:36`)。
- Attempted targeted test: `cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Vitest did not start: pnpm dependency-status check attempted `pnpm install` and failed with `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend/_tmp_8875_ca5c97c6e157679b873179112ce37c7e'`。按任务约束未申请权限、未安装依赖、未重试。
- `git diff --check` passed with no whitespace errors。

## 第九轮 remaining requiredness/options schema gap freeze（2026-08-01）

本轮不浏览官网、不等待 PH-A 新 SEA evidence；已读取协调总览第 19.4 节、PH-A/B/C/D 最新 worklog 与最新 field contract。只修改 PH-B 独占 schema/test/worklog；未修改 runner、frontend、协调总览、其他 worklog、migration、seed、部署或 commit。

### Freeze matrix

| Category | Gap | Current schema guard | Needed before launch |
| --- | --- | --- | --- |
| `official_evidence_required` | Attachment requiredness/file input/size/condition | No `travel_document` / `profile_photo` / `customs_attachment_file` applicant field; AIR Summary previously allowed `NO ATTACHMENTS` observation only | PH-A official validation proof for requiredness, accepted file input selector, MIME/size, and condition |
| `official_evidence_required` | Owner N/A stable selector | `currency_owner_not_applicable` remains optional; `official_key_candidate=owner_details_not_applicable`; `stable_selector_evidence_level=needs_review` | PH-A stable live selector/name and checked/unchecked behavior |
| `official_evidence_required` | Owner/recipient full requiredness | Owner/recipient fields remain `required=false`, `evidence_level=needs_review_requiredness`; owner fields use `required_unless` only when N/A is true | PH-A validation matrix for person/business, owner N/A, recipient, country/address/postal |
| `official_evidence_required` | Physical branch empty validation | `no_of_days_in_philippines` and `last_travel_to_philippines` keep `physical_branch_empty_validation=needs_review` | PH-A empty-field validation evidence for physical transfer branch |
| `official_evidence_required` | Other goods no-row page-level blocking | Goods item modal empty validations recorded, but `page_level_no_row_blocking=needs_review_not_reproduced_after_delete` | PH-A proof whether positive goods page can continue with zero saved rows |
| `official_evidence_required` | SEA non-disembarking and SEA port/customs variants | Verified SEA path remains one disembarking/manual-forms path; `sea_manual_customs_forms_notice.unverified_variants` lists non-disembarking, other port customs flow, and SEA electronic customs/signature variants | PH-A live evidence for non-disembarking, alternate ports, and any SEA electronic customs/signature path |
| `official_evidence_required` | Final Submit/reference/QR/result/recovery | Result-only names remain absent from applicant schema | Coordinator/PH-A final official success, reference, QR, recovery and no-resubmit behavior |
| `option_snapshot_required` | Complete currency option list | `currency_item_currency` has `official_options_count=263` and `complete_option_list_evidence_level=needs_review`; no hardcoded full list | Fresh official snapshot/API list and canonical value contract |
| `option_snapshot_required` | Complete monetary instrument option list | Current known public list retained, but field metadata keeps `complete_option_list_evidence_level=needs_review` | Fresh official snapshot/API list and canonical value contract |
| `option_snapshot_required` | SEA port customs-flow metadata | `selected_port_customs_flow` and `with_custom_declaration` remain internal/derived, not applicant fields | Official or runner-safe port metadata source for manual vs electronic customs routing |
| `frontend_shared_required` | Structured customs/currency UI | Schema exposes structured checklist/items/owner/recipient/source/purpose/branch fields; no aggregate replacement allowed | PH-D/shared dynamic form must render repeats, modals/arrays, N/A hiding, and branch conditions |
| `frontend_shared_required` | Attachment UI | No unconditional file field in schema | PH-D/shared UI contract once official attachment condition is proven |
| `frontend_shared_required` | SEA disembarking/port/customs conditions | Schema guards destination/customs by `is_disembarking` and derived port customs flow | PH-D/shared condition evaluator must honor SEA-specific gates without treating internal keys as applicant questions |
| `frontend_shared_required` | Result/status UI | Result-only fields are not seeded | Shared result/status flow must distinguish Review visibility from submitted success |
| `runner_required` | AIR positive customs/currency automation | Selectors are canonicalized, but requiredness and final acceptance remain partial | PH-C can phase-enable behind fail-closed gates only |
| `runner_required` | Owner N/A strategy | Owner N/A remains candidate/needs_review | PH-C needs stable selector strategy after PH-A evidence |
| `runner_required` | Physical branch strategy | Physical branch requiredness remains needs_review | PH-C needs validation-safe plan before autofill |
| `runner_required` | SEA port customs runtime detection | `selected_port_customs_flow` remains derived metadata | PH-C/coordinator need source of truth for SEA port customs route |
| `runner_required` | Final result recovery | Result fields remain runtime-only | PH-C/coordinator need no-resubmit recovery once final success is observed |

### Schema/test 更新

- `viza-be/agent-backend/scripts/ph-etravel/form-fields.ts`
  - 新增 `PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE`，把 remaining launch gaps 固定分到 `official_evidence_required`、`option_snapshot_required`、`frontend_shared_required`、`runner_required`。
  - `currency_item_currency` 增加 `complete_option_list_evidence_level=needs_review`，避免 263 count 被误读为完整当前 snapshot 已闭合。
  - `sea_manual_customs_forms_notice` 增加 `unverified_variants`，明确当前只验证一个 SEA disembarking/manual-forms passenger path。
  - `customs_signature` 增加 `universal_sea_requiredness=not_verified`，防止 AIR/electronic signature evidence 被推广成所有 SEA required。
- `viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts`
  - 新增 freeze matrix assertions，锁定四类 gaps。
  - 增加 guard：attachment/internal bridge/result-only fields 不得进入 applicant schema。
  - 增加 guard：currency full option list仍 `needs_review`；SEA manual forms 和 signature 不得被当成 universal SEA electronic/signature requiredness。
- `viza-be/agent-backend/scripts/ph-etravel/official-options.ts`
  - 本轮未修改；仅沿用既有 selector evidence-backed options，不新增未证实 option code。

### 测试结果

- Attempted：`pnpm vitest run viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts`
- Result：未执行到测试体；pnpm 的依赖状态检查阶段触发本地权限阻断，并进入内部 `pnpm install` 失败路径：
  - `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/_tmp_93827_b067eb2094a1e65ca50bd2eae2e95209'`
  - `Command failed with exit code 255: pnpm install`
- 按协调者要求，本轮未等待审批、未请求审批、未升级权限重跑。
- Passed：`git diff --check`。

### 接口请求

- PH-A/Coordinator：请继续补官方 evidence：attachment requiredness/file input、Owner N/A stable selector、owner/recipient requiredness、physical branch empty validation、Other goods no-row blocking、complete currency/monetary option lists、SEA non-disembarking/alternate port/customs variants、final Submit/reference/QR/result/recovery。
- PH-C：runner 可读取 `PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE` 作为 fail-closed checklist；不要把 internal `selected_port_customs_flow` / `with_custom_declaration` 当作 applicant schema 字段。
- PH-D：shared frontend unblock 仍需 structured customs/currency repeat UI、Owner N/A hiding/required-unless、attachment condition UI、SEA-specific disembark/customs conditions、result/status separation。

## 第十轮 SEA electronic customs variant / E9 evidence 消费（2026-08-01）

本轮按协调者跟进要求，不等待或申请审批；已用已允许的本地读写完成最小 schema/test/worklog 更新。已读取 coordination 第 20 节、第 21.4 节、PH-A E8/E9 evidence、field contract 与 PH-B 第九轮 freeze matrix。只修改 PH-B 独占 schema/test/worklog；未修改 runner、frontend、协调总览、其他 worklog、migration、seed、部署或 commit。

### E8/E9 evidence consumed

- E8 proved one `SEA + VESSEL PASSENGER + Manila South Harbor` electronic customs variant exists:
  - SEA page 0 uses `destination_port_code` for `Seaport of Destination`。
  - The E8 page did not show `is_disembarking` or stay-destination UI before Health。
  - Customs flow showed electronic confirmation, `No` branch -> Other Travel Details -> signature page。
- E9 finalized the same SEA electronic no-declaration path after a synthetic/test signature:
  - Signature page is canvas/pad, not a document upload。
  - Family Member(s) appears after signature。
  - No-companion confirmation modal appears before Summary。
  - `New Travel Declaration Summary` appears at `wizard_page=6` with `Previous` / `Submit`。
  - Final `Submit` was not clicked; no official reference/QR/result。

### Schema/test updates

- `form-fields.ts`
  - `is_disembarking` is no longer modeled as a universal SEA question. It now has `conditional_logic.showIf = transport_type === SEA && sea_disembarking_question_shown === true` and metadata recording that E8 SEA electronic omitted this question。
  - `sea_port_of_entry` keeps VIZA field name but records official key `destination_port_code`, distinct from `disembarking_port_code`, with option value evidence still `needs_review`。
  - `disembarking_port_code` remains only the SEA `TRAVEL_PORT` child field and records that E8 used `destination_port_code` without showing this branch。
  - `traveller_type` metadata records live SEA dropdown labels `VESSEL CREW` / `VESSEL PASSENGER`, while `VESSEL CREW` remains observed-but-not-seeded/unsupported for ordinary passenger v1; cruise remains separate dashboard route。
  - SEA electronic confirmation/no-declaration evidence is recorded on customs confirmation fields, but `sea_electronic_positive_branch_evidence_level` remains `needs_review`。
  - `customs_signature` now records E8/E9 SEA electronic no-declaration signature -> Family -> Summary evidence, while `universal_sea_requiredness` remains `not_verified` and SEA manual path remains no-signature-before-Review。
  - Family gate metadata now includes `sea_electronic_no_declaration_sequence=after_signature_before_summary` and verified Summary evidence for that path。
  - Freeze matrix removes post-signature Family/Summary as an open E9 blocker, but keeps SEA positive customs/currency branch, non-disembarking applicability, port metadata, final Submit/reference/QR/result, and attachment requiredness open。
- `ph-etravel-arrival-card-schema.test.ts`
  - Updated SEA branch tests for path-specific `is_disembarking`。
  - Added assertions for `destination_port_code` vs `disembarking_port_code` distinction。
  - Added assertions preventing `VESSEL CREW` from becoming an ordinary supported applicant option despite being observed in the official dropdown。
  - Added assertions that SEA electronic signature/Family/Summary evidence is path-specific, not universal SEA, and that SEA positive customs/currency remains open。

### Still open / not promoted

- SEA electronic customs `Yes` positive branch remains `needs_review`; do not assume it fully reuses AIR General/Currency selectors until observed。
- Explicit `is_disembarking=false` or unchecked behavior remains `needs_review`; E8 proved omission in one path, not a selected false path。
- Full SEA destination port option values/codes and per-port manual/electronic customs metadata remain `needs_review`。
- Attachment/travel document requiredness, file input, MIME/size/condition remain `needs_review`。
- Final `Submit`, official reference, independent QR, result/recovery remain blocked and non-applicant runtime/result fields。

### 测试结果

- Attempted：`pnpm vitest run viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts`
- Result：未执行到测试体；pnpm 的依赖状态检查阶段触发本地权限阻断，并进入内部 `pnpm install` 失败路径：
  - `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/_tmp_6979_087ed5d9507d24f91b6c7f4e4e349619'`
  - `Command failed with exit code 255: pnpm install`
- 按协调者要求，本轮未等待审批、未请求审批、未升级权限重跑。
- Passed：`git diff --check`。

### 接口请求

- PH-A/Coordinator：仍需 SEA electronic positive `Yes` branch、explicit non-disembarking behavior、port option/code/customs metadata、attachment requiredness/file input、final Submit/reference/QR/result/recovery。
- PH-C：runner 应继续把 SEA electronic signature page 作为 action-required guard；不得自行画签名、不得点击 final Submit；不要把 `selected_port_customs_flow` 当 applicant field。
- PH-D：shared UI/status 可区分 SEA electronic no-declaration Review-reached/action-required path，但不能把 Summary/Submit-visible 当 submitted success，也不能把 signature 或 manual/electronic customs设成 universal SEA。

### 剩余 gaps

- SEA live evidence only covers one `is_disembarking=true` ordinary passenger path; SEA non-disembarking path remains unverified live。
- SEA `VESSEL CREW` and all cruise paths remain unsupported/needs_review; ordinary VIZA must continue to divert them。
- SEA customs behavior remains port/path dependent；only one manual forms route is verified。SEA electronic customs/general/currency/signature flow, if triggered by another port/customs condition, remains unverified live。
- Final `Submit` was not clicked；official reference、QR、result/recovery page and post-submit status tracking remain blocking。
- Positive AIR electronic customs/currency actual autofill and final validation remain fail-closed/action-required until PH-C has live selector evidence and requiredness closure。

## 第六轮 schema ↔ runner contract drift audit（2026-08-01）

本轮不浏览官网；已读取 `docs/philippines-launch-coordination.md` 第 18 节、PH-C 最新 worklog、当前 PH-B schema/options/tests，以及 PH-C 修改后的 `normalize.ts` / `form-filler.ts` 只读参考。执行开始前只读 `git status --short`；当前工作树存在大量既有 dirty/untracked 文件，本轮只修改 PH-B 独占文件。

### 核对结论

- SEA aliases 与 PH-C runner aligned：
  - schema `voyage_number` 继续是 VIZA alias，official key 保持 `flight_number`；PH-C field plan 也提交 `portalName=flight_number`。
  - schema `voyage_departure_date` / `voyage_arrival_date` official keys 保持 `departure_date` / `arrival_date`；PH-C normalize 使用这两个 VIZA alias 输入并输出官方日期 payload。
  - schema `return_date` 保持 Holiday/Pleasure/Vacation branch 且 `not_air_only=true`；PH-C runner 已保留 arrival `return_date`。
- SEA disembark contract aligned：
  - schema `is_disembarking` gates SEA destination branch；PH-C runner 仅在 `isDisembarking=true` 计划 destination fields。
  - schema `destination_type=TRAVEL_PORT` child 是 `disembarking_port_code`；PH-C runner 计划 `portalName=disembarking_port_code`。
- Customs/currency structured contract aligned at schema/normalize level：
  - schema 保留 12 项 `customs_checklist_1..12`，不把 aggregate boolean 当官方逐项答案。
  - schema 保留 goods `items[]`、currency owner/recipient、currency `items[]`、source/purpose arrays、physical/courier children；PH-C normalize 已消费对应结构并在缺结构化字段时 fail closed/action-required。
- Signature/family aligned with 第 18 节：
  - `customs_signature` 只在 AIR/electronic customs flow 作为 Review precondition gate，不再是 universal SEA requirement，也不要求 `customs_signature_file` 无条件上传。
  - `family_member_gate_confirmation` 是 AIR/SEA shared pre-Review non-submitted gate；本轮将 metadata 从偏 AIR 的 `after_signature_before_review` 改为通用 `pre_review_family_member_gate`，并保留 AIR electronic customs sequence 与 SEA manual forms sequence。
- Result-only fields aligned：
  - schema tests 继续证明 `review_summary`、`new_travel_declaration_summary`、`official_reference_number`、`etravel_qr_code`、`final_submit` 未 seed 成 applicant questions。

### 本轮 schema/test 修正

- `viza-be/agent-backend/scripts/ph-etravel/form-fields.ts`
  - 为 goods item fields 增加 PH-C normalize 兼容 aliases：`description`、`quantity`、`amount_usd`、`amountInUsd`、`goods_item_amount_usd` 等；仍以 schema canonical `goods_item_description` / `goods_item_quantity` / `goods_item_value` 为申请题。
  - 为 currency item/source/purpose/method 增加 PH-C normalize 兼容 aliases：`currency_name`、`currency_type`、`currency_item_monetary_instrument`、`currency_sources`、`source_of_currency`、`currency_transport_purposes`、`purpose_of_currency_transport`、`currency_transfer_method` 等。
  - 为 owner/recipient representative fields 增加 runner aliases，例如 given/family/surname/business/country_code/street_address/zip_code；不新增官方字段。
  - 为 courier `airway_bill_no` 增加 `runner_aliases=["airway_bill_number"]` 与 `runner_plan_key="airway_bill_number"`，记录 schema official/live label 与 PH-C runner plan key 的兼容关系。
  - 为 SEA manual/electronic customs flow 增加 `selected_port_customs_flow_contract="derived_port_metadata_not_applicant_field"`，明确该变量是 port metadata/live flow 派生值，不是 applicant question。
  - 更新 Family Member(s) gate metadata：`gate=pre_review_family_member_gate`、`non_submitted_gate=true`、AIR sequence `after_signature_before_review`、SEA manual sequence `after_manual_customs_notice_before_review`。
- `viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts`
  - 增加 runner alias assertions，覆盖 goods/currency/courier drift points。
  - 增加 `selected_port_customs_flow` 不出现在 applicant field names 的断言。
  - 更新 Family Member(s) gate assertions，证明它是 shared non-submitted pre-Review gate，而不是只依赖 AIR signature page 的 gate。
- `viza-be/agent-backend/scripts/ph-etravel/official-options.ts`
  - 本轮只读核对；未发现需要修改的 options drift。

### 未在 PH-B 范围内修改的 runner/frontend gaps

- PH-C runner 仍可存在 legacy/internal plan keys：`has_goods_to_declare`、`has_currency_to_declare`、`bsp_authorization_number`、`customs_signature_file`。PH-B schema 不把这些 seed 成 applicant questions；请求 PH-C 保持这些为 internal/legacy optional 或 action-required bridge，不把它们升级为 official applicant schema。
- PH-D/frontend 仍需按 schema metadata 表达：
  - `selected_port_customs_flow` 是派生 flow metadata，不应显示成用户问题。
  - Family Member(s) gate 是 Review 前独立 gate，不是 ordinary nested family fields。
  - SEA manual customs path 不应显示 AIR electronic customs/signature required UI。
- 主协调者/PH-A 仍需补：
  - final `Submit` / official reference / independent QR / recovery result 官方闭环。
  - 其他 SEA port/customs combinations；当前只 verified 一个 manual-forms SEA passenger route。
  - Positive electronic customs/currency autofill selectors 与 requiredness/final acceptance evidence。

### 测试结果

- Attempted：`cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`
- Result：未执行到测试体；Vitest 加载 config 时尝试写入 repo 内临时文件并被本地权限拒绝：
  - `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend/vitest.config.ts.timestamp-1785586124275-c89b4f56e35a18.mjs'`
- 按协调者要求，本轮未请求审批、未升级权限重跑。
- Passed：`git diff --check -- viza-be/agent-backend/scripts/ph-etravel/form-fields.ts viza-be/agent-backend/scripts/ph-etravel/official-options.ts viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts docs/philippines-launch-worklogs/PH-B.md`。

## 第七轮 AIR positive customs/currency selector evidence schema audit（2026-08-01）

本轮不浏览官网；已读取 `docs/philippines-launch-coordination.md` 第 19 节、PH-A 最新 worklog、`docs/philippines-etravel-arrival-field-contract.md`、PH-C/PH-D 最新尾部，并执行只读 `git status --short`。只修改 PH-B 独占 schema/test/worklog 文件；未修改 runner、frontend、协调总览、其他 worklog、migration、seed、部署或 commit。

### 本轮是否收到 PH-A 新证据

收到部分新证据：PH-A 已记录 AIR positive customs/currency 的 live-visible selector/control evidence，包括 General Declaration 12 项 indexed controls、Other goods Add Item 行、Currency Declaration owner/recipient fields、currency item Add Item 行、BSP date、source/purpose checkbox arrays、Other detail、physical/courier branch、attachment widget 与 signature canvas。

未收到 requiredness closure：PH-A 明确记录多数控件 “no visible HTML required attr observed”，且没有 final Submit/reference/QR；因此本轮只提升 `official_key`、`official_control_type`、repeat/modal/table metadata 与 selector evidence，不把 positive 子字段改成 `required: true`，继续保持 `evidence_level=needs_review_requiredness`。

### Schema/test 更新

- `viza-be/agent-backend/scripts/ph-etravel/form-fields.ts`
  - Customs checklist `customs_checklist_1..12` 增加 official indexed key：`check_lists.0.response` ... `check_lists.11.response`，control type `radio_pair`，selector evidence `confirmed_live_visible_air_positive`。
  - Goods positive fields 增加 AIR live-visible selector metadata：
    - `goods_total_currency` -> `amount_of_goods_acquired.currency`，radio。
    - `goods_total_amount` -> `amount_of_goods_acquired.amount`，text。
    - `goods_item_description` / `goods_item_quantity` / `goods_item_value` 标记 `official_group_key=items[]`、`modal_behavior=Add Item repeat row`、official row labels。
  - Currency positive fields 增加 official key/control metadata：
    - owner N/A -> `owner_details_not_applicable`。
    - owner fields -> `owner_business_name`、`owner_first_name`、`owner_middle_name`、`owner_last_name`、`owner_suffix`、`owner_occupation`、`owner_country_code`、`owner_street`、`owner_postal_code`。
    - recipient fields -> `recipient_business_name`、`recipient_first_name`、`recipient_middle_name`、`recipient_last_name`、`recipient_suffix`、`recipient_occupation`、`recipient_country_code`、`recipient_street`、`recipient_postal_code`。
    - currency item row -> `currency_name`、`monetary_instrument_name`、`amount` with Add Item repeat row metadata。
    - `bsp_authorization_date` -> date picker。
    - source/purpose arrays -> `currency_sources` / `transport_purposes` checkbox lists；Other fields -> `currency_source_other` / `transport_purpose_other`。
    - transfer method -> `physical_or_shipped` radio；physical branch -> `no_of_days_in_philippines`、`last_travel_to_philippines`；courier branch -> `courier_name`、`airway_bill_no`、`airway_bill_date`。
  - 新增 `currency_owner_suffix` 与 `currency_recipient_suffix`，因为 PH-A live evidence 已显示 owner/recipient suffix combobox；二者均非必填，仍受 currency positive branch 条件控制。
  - 保持 `travel_document`、`customs_signature_file`、result-only fields、runner internal bridge keys 不进入 applicant schema。
- `viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts`
  - 增加 checklist indexed official key/control/selector evidence assertions。
  - 增加 goods total/items official key、control type、repeat group、modal/table behavior assertions。
  - 增加 currency owner/recipient/item/source/purpose/physical/courier official key assertions。
  - 增加 owner/recipient suffix coverage。
  - 继续证明 positive 子字段 `required=false` 且 `evidence_level=needs_review_requiredness`。
- `viza-be/agent-backend/scripts/ph-etravel/official-options.ts`
  - 本轮只读核对；未发现需要修改的 options drift。

### 继续等待 PH-A / Coordinator 证明的 gaps

- General Declaration：12 项 stable backend ids/payload ids 仍未闭合；当前只把 UI indexed controls `check_lists.{n}.response` 作为 selector evidence。
- Other goods：Add Item repeat row已可见，但空值/缺 row 是否阻断、最大行数、金额格式和 final acceptance 仍需 validation evidence。
- Currency owner/recipient：字段 key/control 已可见；N/A、business vs person、first name/last name 组合、country/address/postal requiredness 仍需 validation evidence。
- Currency items：row fields 已可见；currency option value、monetary instrument value、至少一行 requiredness、金额格式/final acceptance 仍需 closure。
- Source/purpose arrays：DOM values 已观察；是否至少一项必填、Other detail 是否必填仍需 validation evidence。
- Physical/courier branch：branch children key/control 已观察；requiredness 和 date/number validation 仍需 closure。
- Attachments/signature：attachment widget visible，但 MIME/size/required condition 未闭合；signature canvas required 只在 signature page appears 的 AIR/electronic flow verified，不是 universal SEA，也不是 `customs_signature_file` 上传要求。
- Final Submit/reference/QR/result recovery 仍未验证；Review/Summary 或 Submit button visibility 不能当 submitted success。

### 测试结果

- Attempted：`cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`
- Result：未执行到测试体；Vitest 加载 config 时尝试写入 repo 内临时文件并被本地权限拒绝：
  - `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend/vitest.config.ts.timestamp-1785587172960-bad4d2ddd6537.mjs'`
- 按协调者跟进要求，本轮未等待审批、未请求审批、未升级权限重跑。
- Passed：`git diff --check -- viza-be/agent-backend/scripts/ph-etravel/form-fields.ts viza-be/agent-backend/scripts/ph-etravel/official-options.ts viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts docs/philippines-launch-worklogs/PH-B.md`。

## 第八轮 AIR positive canonical selector evidence 消化（2026-08-01）

本轮不浏览官网；已读取 `docs/philippines-launch-coordination.md` 第 19.3 节、PH-A 最新 AIR positive evidence 段、`docs/philippines-etravel-arrival-field-contract.md` 最新 selector evidence，以及 PH-B 当前 schema/tests。只修改 PH-B 独占 schema/test/worklog 文件；未修改 runner、frontend、协调总览、其他 worklog、migration、seed、部署或 commit。

### 消费结果

- PH-A evidence 已正式落盘并由协调总览第 19.3 节确认完成；本轮将“草案 selector metadata”收紧为 canonical selector evidence。
- 12 项 General Declaration：
  - `customs_checklist_1..12` 继续是 VIZA semantic flat keys。
  - official indexed selectors 明确为 `check_lists.0.response` through `check_lists.11.response`，control type `radio_pair`，observed values `true/false`。
  - stable backend checklist ids beyond visible index 仍未验证；没有改成 aggregate boolean。
- Other goods：
  - official modal selectors 明确为 `description`、`quantity`、`amount`。
  - metadata 记录 empty modal validation：`Description Required`、`Quantity Required`、`Amount in USD Required`。
  - table behavior 记录为 Add Item repeat row；saved row columns `Quantity` / `Description` / `Amount in USD` / `Action`。
  - page-level no-row blocking after deleting row 未复现，保留 `needs_review_not_reproduced_after_delete`。
- Currency item：
  - official modal selectors 修正为 `currency_id`、`monetary_instrument_id`、`amount`。
  - metadata 记录 empty modal validation：`Currency Required`、`Monetary Instrument Required`、`Amount Required`。
  - metadata 记录 page validation：`At least have 1 item`。
  - complete currency/monetary instrument option lists 仍 `needs_review`。
- Currency owner/recipient：
  - owner/recipient selectors confirmed：`owner_business_name`、`owner_first_name`、`owner_middle_name`、`owner_last_name`、`owner_suffix_name`、`owner_occupation`、`owner_country_code`、`owner_street`、`owner_postal_code` and matching `recipient_*` selectors。
  - `currency_owner_suffix` / `currency_recipient_suffix` official keys corrected to `owner_suffix_name` / `recipient_suffix_name`。
  - Owner N/A live checkbox still lacked stable name；schema now records `official_key_candidate=owner_details_not_applicable` and `stable_selector_evidence_level=needs_review` instead of treating it as fully closed。
  - owner/recipient full requiredness and third-party condition remain `needs_review_requiredness`。
- Source/purpose arrays：
  - official arrays remain `currency_sources` and `transport_purposes` with values `SALARY/BUSINESS/OTHER` and `LEISURE/MEDICAL/PAYABLES/EDUCATION/OTHER`。
  - Other detail selectors `currency_source_other` and `transport_purpose_other` now record empty validation `Required` and conditional `validated_required_when` metadata。
  - base source/purpose requiredness is recorded as supported by page validation text, but not promoted to unconditional DB `required=true`。
- Physical/courier branch：
  - official transfer selector remains `physical_or_shipped` with values `is_physically_transferred_by_person` and `is_shipped_thru_courier_service`。
  - physical child selectors `no_of_days_in_philippines` and `last_travel_to_philippines` remain visible/selector-confirmed, but empty validation remains `needs_review`。
  - courier child selectors `courier_name`、`airway_bill_no`、`airway_bill_date` now record observed empty validation `Required` with `validated_required_when=currency_transport_method === is_shipped_thru_courier_service`。
- Attachments/signature/result:
  - no `travel_document` / attachment file requirement was added；attachment requiredness/file input remains open。
  - `customs_signature` remains canvas/pad based where signature page appears；no `customs_signature_file` applicant field added。
  - final `Submit`、official reference、QR、result/recovery fields remain non-applicant result/runtime items and are not seeded。

### Tests updated

- `ph-etravel-arrival-card-schema.test.ts` now covers:
  - checklist indexed selectors and selector evidence。
  - Other goods modal selectors, empty validation messages, repeat row/table behavior, and still-open no-row page blocking。
  - currency modal canonical selectors `currency_id` / `monetary_instrument_id` / `amount`, empty validation messages, and `At least have 1 item` page validation。
  - source/purpose official checkbox arrays, Other detail required validation metadata, and option values。
  - physical/courier branch selectors, courier required validation metadata, and physical branch still-open validation。
  - still-open gaps: Owner N/A stable selector, owner/recipient full requiredness, attachment requirements, complete option lists, final reference/QR/result fields。

### Requiredness boundary

- No positive customs/currency field was changed to unconditional `required: true`。
- Verified empty validation is represented as metadata on the exact observed modal/branch controls only。
- Schema requiredness remains conservative: `evidence_level=needs_review_requiredness` for positive customs/currency subfields unless PH-A provided a specific observed validation message for that control/branch。

### 接口请求

- PH-C：can consume canonical selectors for AIR positive autofill behind fail-closed/action-required gates: `check_lists.*.response`、goods modal `description/quantity/amount`、currency modal `currency_id/monetary_instrument_id/amount`、source/purpose arrays、Other details、`physical_or_shipped`、courier children。Do not assume Owner N/A stable selector or physical branch empty requiredness.
- PH-A/Coordinator：still need attachment requiredness/file input, Owner N/A stable selector, owner/recipient requiredness, physical branch empty validation, complete currency/monetary option lists, and final Submit/reference/QR/result/recovery.
- PH-D：frontend should expose structured fields conditionally, but must not present selector visibility or Review/Summary as submitted success, and must not require attachment/customs signature file globally.

### 测试结果

- Attempted：`cd viza-be/agent-backend && npx vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`
- Result：未执行到测试体；Vitest 加载 config 时尝试写入 repo 内临时文件并被本地权限拒绝：
  - `EPERM: operation not permitted, open '/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend/vitest.config.ts.timestamp-1785587725920-712c40db930638.mjs'`
- 按协调者要求，本轮未等待审批、未请求审批、未升级权限重跑。
- Passed：`git diff --check -- viza-be/agent-backend/scripts/ph-etravel/form-fields.ts viza-be/agent-backend/scripts/ph-etravel/official-options.ts viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts docs/philippines-launch-worklogs/PH-B.md`。

## 第十三轮 ordinary arrival applicant-question/schema coverage manifest（2026-08-04）

> 已读取适用 AGENTS、协调总览第 26 节、arrival field contract 与 PH-A/B/C/D 最新记录；本轮不浏览官网，不接触真实申请人资料、账号秘密或官方 draft，不运行 migration、seed、部署或 final Submit。只修改 PH-B 独占 schema/test/worklog；`official-options.ts` 仅核对，无 options 变更。

### 完整 ownership manifest

- 新增 `PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST`。它从当前 `PH_ETRAVEL_FORM_FIELDS` 派生每个 schema field 的 persona、transport、official page、条件与 evidence level，并为所有未进入 schema 的合同项显式分配 owner。
- 因此既有 36-control canonical coverage 与 E11 SEA electronic positive coverage 都必须被 manifest 覆盖；新 schema field 也不能绕过该映射。
- 已覆盖的 schema applicant surfaces：registration/profile、AIR/SEA travel、transit、destination、health、family counts、Other Travel Details、electronic customs confirmation、12 项 checklist、Other goods rows、currency owner/recipient/items/source/purpose/physical/courier groups，以及 conditional canvas signature。
- 非 schema ownership 也明确写入：account email/OTP/password 为 runtime；profile photo、family selected members/relationship 为 profile-owned；photo/file contract、residence cascade、special flight 与未实证 health branches 为 unsupported；privacy/review/submit/family gate 文案为 static action；reference/QR 为 result。

### 条件合同修正

- manifest 审计发现五个 Other Travel Details fields 没有明示 electronic flow 条件，可能泄漏到 SEA manual forms path。
- 基于 E6 manual notice 与 E8/E10 electronic Other Travel Details evidence，`accompanied_under_18_count`、`accompanied_18_plus_count`、`checked_baggage_count`、`handcarry_baggage_count`、`first_time_visiting_philippines` 现均限于 `ELECTRONIC_CUSTOMS_FLOW`；manual SEA 不再暴露它们。
- No path 可到 Other Travel Details，但 General/Currency positive controls仍通过 `has_baggage_or_currency_to_declare === yes` 及其 checklist descendants 限制；physical/courier 继续互斥且仅在 currency positive branch 出现。

### 不作推断的边界

- 未提升任何未知 requiredness 或 option value；manifest 的 `needs_review` 只是证据状态，不改变表单必填。
- privacy copy、OTP/password、Summary/Submit、reference/QR、attachment upload 与 `customs_signature_file` 不成为 applicant schema fields。
- crew/cruise 仍为 ordinary v1 diverted/unsupported，AIR/SEA、manual/electronic、No/Yes 与 post-signature positive Family/Summary 不相互外推。

### 唯一待消费的 PH-A option delta

- PH-A 完成 canonical option evidence 后，PH-B 只需更新 `official-options.ts` 的已证实 display/value/source metadata 与本 manifest/options regression assertions；不需要改本轮已冻结的 ownership、page、branch 或 requiredness 合同，除非 PH-A 同时给出新的条件或验证证据。

### 测试结果

- Passed：TypeScript static parse，输出 `ph-manifest-static-parse-ok:2`。
- Passed：静态 manifest coverage 检查，输出 `ph-manifest-static-coverage-ok:8`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check 尝试写临时文件时返回 `EPERM: operation not permitted`；未请求审批、未重试、未安装依赖。
- Passed：`git diff --check -- viza-be/agent-backend/scripts/ph-etravel/form-fields.ts viza-be/agent-backend/scripts/ph-etravel/official-options.ts viza-be/agent-backend/src/tests/ph-etravel-arrival-card-schema.test.ts docs/philippines-launch-worklogs/PH-B.md`。

## 第十四轮 E13-E17 options/result/coverage delta（2026-08-04）

> 已读取适用 AGENTS、协调总览第 31 节、arrival field contract E13-E17 和 PH-A/B/C/D 最新记录；本轮不浏览官网、不接触真实资料或账户状态，不运行 migration、seed、部署或 final Submit。只修改 PH-B 独占 schema/options/test/worklog 文件。

### 已消费的官方证据

- **E13 verified public: purpose / occupation / monetary instrument small lists**
  - `PH_ETRAVEL_PURPOSE_OPTIONS` 固定为官方 arrival endpoint 的 16 个 `code`/label 对。
  - `PH_ETRAVEL_OCCUPATION_OPTIONS` 固定为官方 endpoint 的 15 个 `code`/label 对。
  - `PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS` 固定为官方 endpoint 的 16 个 numeric `id`/`name` 对；VIZA value 现为 stringified `id` `"1".."16"`，不是显示标签。
  - 三份小列表均逐项携带 `verified_public` 和 E13 endpoint source metadata；tests 对完整 value/label、唯一 value 和 source 做回归断言。
- **E13/E14 verified public: large dynamic response contracts**
  - countries、currencies 和 SEA ports 不再固化当前完整大列表。`PH_ETRAVEL_COUNTRY_OPTIONS`、`PH_ETRAVEL_SEA_PORT_OPTIONS` 为空，schema 改为引用 `PH_ETRAVEL_DYNAMIC_OPTION_SOURCES` 的 endpoint/query/response contract。
  - countries identity 为 `code`；currency identity 为 numeric `id`；SEA destination 与 disembarking port identity 均为 `code`，label `name` 可以重复，不能按 label 合并。
  - `destination_port_code` 使用 filtered `transportation_type=SEA` source；`disembarking_port_code` 使用 E14 observed unfiltered source。两字段保持不同 schema field、official key 和 source contract。
  - port response 的 `with_custom_declaration` 只被标注为动态 metadata；明确不推导 applicant requiredness，也不单独决定 customs path。
- **E17 canonical result/coverage audit**
  - 结果语义统一为 `result.reference_qr_render`；旧 `result.qr_artifact` 只作为该 manifest entry 的 `legacy_aliases`，不再是独立 result row，更不可能成为 applicant question/file。
  - 新增 E17 audit metadata：111 canonical rows，51 confirmed live，19 verified public，41 needs review，8 unsupported/diverted；它是审计计数，不把未支持、runtime、static 或 result surfaces 提升为 schema。
  - manifest regression 显式验证 profile photo、residence cascade、AIR special-flight、未实证 health、attachment 均无 schema field 且仍为 `needs_review`；OTP/privacy/Summary/Submit/reference/QR render 都不是 applicant answers。

### Schema contract changes

- `currency_item_currency` 现记录 dynamic currencies source、`id` identity、`name_not_unique` label 和 `verified_public_dynamic_source`。它仍 `required=false`，`evidence_level=needs_review_requiredness`；动态 option evidence 不关闭 requiredness。
- `currency_monetary_instrument` 现记录 official `monetary_instrument_id` numeric value contract 与 `verified_public` complete small list；它仍 `required=false`，不把 selector/list evidence 误解为 page completion requiredness。
- SEA positive coverage 的 post-signature result placeholder 更新为 canonical `result.reference_qr_render`；SEA manual、SEA electronic No 与未观察 SEA paths 仍不继承 electronic-positive fields/signature requirements。

### 仍冻结的证据边界

- Owner N/A stable selector、owner/recipient full requiredness、physical branch empty validation、Other goods no-row page blocking、attachment file input/MIME/size/requiredness、final Submit/reference/QR/recovery 继续 `needs_review`。
- `with_custom_declaration` 未进入 applicant schema，也不能使 `destination_port_code` / `disembarking_port_code` 或 electronic customs fields 全局必填。
- SEA non-disembarking、other-port customs variants、post-signature positive Family/Summary 和最终结果闭环仍需 path-specific evidence；不得以 E13/E17 public data 外推。

### 接口请求

- **PH-C runner**：消费 large-list dynamic contracts 时按 code/id identity 保存，不按可重复 label 反查；保持 `with_custom_declaration` 为 runtime metadata，不能将其转为 required gate。结果消费应使用 `result.reference_qr_render`，接受 `result.qr_artifact` 仅作 legacy input alias。
- **PH-D frontend**：动态 countries/currencies/SEA ports 应查询/缓存官方 contract，不能依赖 schema 中的空静态 list；destination/disembarking ports 必须分 field、分 source。不要把 result/reference/QR、OTP/privacy 或 unsupported residence/AIR/health branches渲染成 applicant questions。
- **PH-A/coordinator**：后续只需补 option response freshness/versioning、path-specific validation/requiredness、attachments 和 final result closure；这些证据才可能改变当前 `needs_review`，而非 E13/E17 list/result evidence 本身。

### 验证结果

- Passed：schema/options static parse：`./node_modules/.bin/tsc --noEmit --target ES2022 --module commonjs --moduleResolution node --resolveJsonModule --esModuleInterop scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Passed：schema test/static coverage compile：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。同时将 test snapshot scan 的既有 JSON union inference 收窄为 `unknown[]`，不改变任何 schema assertion。
- Attempted static runtime manifest check via `tsx`; blocked before evaluation by `EPERM` while creating `/var/folders/.../T/tsx-...pipe` IPC socket. No approval request or retry.
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check attempted `pnpm install` and failed opening repo `_tmp_...` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限。
- Passed：`git diff --check` after the final worklog update.

## 第十五轮 E18 synthetic scenario/schema readiness map（2026-08-04）

> 已读取适用 AGENTS、协调总览第 31 节、arrival field contract E17/E18 和 PH-A/B/C/D 最新记录。本轮只消费 synthetic stop-before-submit runbook；没有浏览官网、创建/恢复草稿、接触真实资料或秘密，也没有运行 migration、seed、部署、付款或 final Submit。只修改 PH-B 独占 schema/test/worklog；`official-options.ts` 复核后无须变更。

### 41 项 needs-review 的场景归属

- `PH_ETRAVEL_E18_SYNTHETIC_SCENARIO_READINESS` 是纯 schema readiness map，不含任何合成值、申请人数据、session/runtime data 或浏览器动作。
- E17 的 41 项 `needs_review` 被机械断言为**恰好一次**分配：S0=3、S1=16、S2=7、S3=5、S4=1、S6=4、S7=3、S8=2；总数 41 且无重复。
- S5 明确是 SEA electronic-Yes signature 后路径 P0 观察，不拥有 E17 41-row count；它不能借用 SEA manual 或 electronic-No 的 Family/Summary 证据。
- 所有 S0-S8 都标记 `planned_only=true`、`launch_ready=false`。这是未来 PH-A controlled observation 的归属，不是现有字段/requiredness 已被验证的声明。

### 当前 schema readiness 与最小后续 delta

| 场景 | 当前 schema readiness | Evidence 回来后 PH-B 的最小动作 |
| --- | --- | --- |
| S0 Account boundary | 无 schema field；email/OTP/password 仍 runtime。 | 无；永久排除 `visa_form_fields`。 |
| S1 Profile/residence | `registration_for`、ordinary traveller/profile basic fields、country/address fields存在；photo 与 PH residence cascade 仍 profile-owned/unsupported。 | 仅补已观察的 residence cascade 或 photo control metadata；没有 file input/format/size/requiredness 不创建 photo document field。 |
| S2 AIR/destination | airline/flight、same-residence、AIR Transit children存在；special-flight 仍 unsupported。 | 仅在取得 live key、condition 和 validation 后加 special-flight branch；dynamic airline/flight option source不硬编码。 |
| S3 Health | recent-travel/country/symptom fields存在；negative-antigen 与 bats/animals未支持。 | 仅为实测 controls 添加 exact Yes condition/validation；不把 health branch默认开启。 |
| S4 SEA false/manual | `is_disembarking` 和 manual notice存在且路径隔离。 | 仅在 false/unchecked 与 manual gate 同时实测后收窄 visibility metadata；不把 manual变为电子海关。 |
| S5 SEA Yes continuation | signature、Family gate 已有 path metadata；positive post-signature仍 P0。 | 只更新 Family/Summary sequence metadata；绝不把 signature pixels、captcha、submit runtime data 放进 schema。 |
| S6 Currency/attachments | declaration gate、Owner N/A、BSP date存在；attachment 是 unsupported。 | 只有获得 stable file input、MIME、size/count、requiredness 后才可讨论 attachment field；Owner N/A/BSP不提前提升 required。 |
| S7 acknowledgement | customs information acknowledgement 与 signature declaration在 schema；final certification仍 static/non-schema。 | 只提升被实测为 control 的项目；不能把法律文案凭空改成 checkbox。 |
| S8 result/recovery | 无 schema field；reference/QR render 是 result metadata，`qr_artifact` 仅 legacy alias。 | 无；即使另获结果证据，仍保持 applicant schema 排除。 |

### 回归断言

- schema test 现在验证：全部 41 个 canonical `needs_review` semantic keys 只有一个 E18 scenario owner；所有 scenario 都非 launch-ready；S1 profile/residence、S2 special-flight、S3 health、S6 attachment 保持 non-schema/unsupported；S5 不占 41-row coverage。
- AIR、Health、SEA manual/electronic、currency/BSP 与 S7 acknowledgement 的现有 `showIf`/evidence metadata 受断言保护，避免分支泄漏或由计划场景升级 requiredness。
- S8 断言 `official_reference`、`reference_qr_render`、`qr_artifact` 不进 `PH_ETRAVEL_OFFICIAL_FIELD_NAMES`；manifest 中 QR only 是 `result.reference_qr_render`，保留 `result.qr_artifact` legacy alias。

### 仍 fail-closed 的 P0

- S1 profile/photo/residence、S2 AIR special/transit、S3 health positive、S4 SEA explicit-false、S5 SEA electronic-Yes post-signature、S6 currency/attachment、S8 final result/recovery 都不因 E18 runbook 而变为 launch-ready。
- 不改变已知/未知 requiredness；不把 account/Summary/result/QR、signature pixels、attachment data、CAPTCHA 或 family runtime array 建模成 applicant fields。

### 验证结果

- Passed：schema/test static compile：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check attempted `pnpm install` and failed opening repo `_tmp_64732_5bf6285734350e78cb57c3bc9b73f2e3` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限或重试。
- Passed：`git diff --check` after this worklog update；另对未跟踪的 PH-B worklog 执行 `git diff --no-index --check /dev/null`，无 whitespace 输出（exit `1` 仅表示与空文件存在差异）。

## 第十六轮 E19 S1 first live profile evidence consumption（2026-08-04）

> 已读取适用 AGENTS、协调总览第 32 节、arrival field contract E19/S1 段和 PH-A/B/C/D 最新记录。本轮只消费 PH-A 的受控空白 Personal Information 观察；没有浏览官网、处理账号/OTP/CAPTCHA/文件/签名或真实资料，未运行 migration、seed、部署、付款或 final Submit。只修改 PH-B 独占 schema/test/worklog；`official-options.ts` 复核后无本轮变更。

### E19 已消费的 live evidence

- `passport_holder_type` 保持 official key `nationality` 与 ordinary-v1 值 `FILIPINO` / `FOREIGNER`；新增 E19 live labels `PHILIPPINE PASSPORT Holder` / `FOREIGN PASSPORT Holder`、radio control 和 default Filipino 使 omitted-persona validation 不可归因的 metadata。没有扩大 persona 支持范围。
- five S1 profile rows 记录为 `confirmed_live_E19`：
  - `first_name`：official text key，blank Foreigner error `First Name Required`；保留 `required=true`。
  - `middle_name`：官方 label 明示 optional；保持 `required=false`。
  - `last_name`：官方 label 明示 optional；修正为 `required=false`，不再沿用旧的无证据必填。
  - `suffix`：official key candidate `extension_name`，label 明示 optional；保持 `required=false`，完整 option list 仍 `needs_review`。
  - `sex`：official key `gender`、React select，blank Foreigner error `Sex Required`；保持 `required=true`。
- `profile.photo_url` 仍是 `profile_owned`，不进入 `visa_form_fields`。新增 manifest metadata 仅说明 E19 在空白 Filipino 与 Foreigner 页都出现 `Required` marker；仍没有 file input、accept/MIME、size/count、upload/server acceptance 或可创建的 photo file field 证据。

### E18 S1 accounting

- contract audit 更新为 111 canonical：56 confirmed live、19 verified public、36 needs review、8 unsupported/diverted。
- S1 的 five observed rows 从 `canonical_needs_review_keys` 移至 `confirmed_live_keys`；S1 仍 `planned_only=true`、`launch_ready=false`。
- S1 尚未关闭：`registration.application_for` field-specific validation/official submitted key、`traveller.passenger_type`、profile photo upload contract、mobile、country/residence以及 PH residence cascade/address branches。它们继续等待 PH-A S1b，且不改变 requiredness。
- `FOR OTHER` 只记录为 E19 observed label/path；`registration_for` 继续带 `launch_gate=needs_review_not_a_runner_authorization`。PH-C runner preflight 不应因这次 profile observation 解除 launch gate。

### Regression coverage

- tests verify E19 nationality values/labels/key/control, five profile fields' live selector/requiredness metadata, `last_name=false`, suffix option incompleteness, and sex validation evidence。
- tests verify photo remains profile-owned/non-schema with the narrow blank-page gate and unknown file contract。
- tests verify S1's five confirmed keys are no longer among the 36 unique E18 needs-review rows, while S1 itself remains non-launch-ready; mobile/residence remain unclosed。

### PH-A / PH-C / PH-D interface

- **PH-A S1b**：only evidence that can change PH-B next is mobile underlying key/country cascade/field validation; foreign/PH residence controls/cascade/options/requiredness; and photo input/MIME/size/count/server acceptance. A visible photo `Required` marker alone is not a file contract.
- **PH-C**：may consume only the two observed blank errors (`First Name Required`, `Sex Required`) as path-scoped client evidence. Keep `FOR OTHER`, photo, mobile, residence and all later scenarios blocked by preflight.
- **PH-D**：may show the established optionality for middle/last/suffix and required labels for first/sex, but must keep photo upload and S1 completion action-required; no verified-success or document requirement inference.

### Verification

- Passed：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check attempted `pnpm install` and failed opening repo `_tmp_70452_87fb41860d76a431ed2514b2d2a15259` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限或重试。
- Follow-up：`git diff --check` completed successfully in the round-21 final verification below.

## 第二十一轮 E21 profile/mobile/residence public-bundle schema consumption（2026-08-04）

> 已读取适用 AGENTS、协调总览第 35 节、arrival field contract E21 和 PH-A/B/C/D 最新记录。本轮只消费 zero-login public-bundle wiring evidence；没有打开官网页面、session、草稿或 API write，没有处理真实资料、秘密、文件、签名、付款或 final Submit。只修改 PH-B 独占 schema/test/worklog；`official-options.ts` 无本轮变更。

### Evidence count and S1 accounting

- Canonical counts 对齐为 111 total：56 `confirmed_live`、19 `verified_public_bundle`、36 `needs_review`、8 diverted/unsupported。
- E21 没有关闭新的 live/server gap；S1 仍 `planned_only=true`、`launch_ready=false`。此前 E19 closing 的 five name/sex rows 保持 closed；photo、mobile 和 7 residence rows 仍属于 S1 的 36 项 review ownership。

### E21 client-only contract written to schema

- 新增 `PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21`，集中记录以下 public client wiring，所有项显式保留 server contract `needs_review`：
  - `photo_url`：profile Yup requires non-empty value；uploader 写 URL、delete 清空 URL；`auth_with_mobile` config 决定 file-only 或 camera+file trigger。generic component 的 `5,242,880` byte default 只记录为 library default，绝不是 PH profile MIME/size/count/upload/server rule。
  - `mobile_number`：flat key、fixed/preferred `ph`、mask、searchable chooser、returned number remove-spaces；profile Yup 未包含它，也未发现独立官方 `mobile_country_code` payload key。
  - residence：`country_code === PH`（不是 FILIPINO/FOREIGNER）控制 PH cascade；country change clears `region_code`/`province_code`/`municipality_code`/`barangay_code`/`street`/`street_two`；province->region、municipality->barangay endpoints 和 street/street_two client required/optional wiring均记录为 public client evidence。
- 为避免把 static client Yup 写成申请完成或 server acceptance：`mobile_number`、`country_of_residence`、`residence_address_line1` 在 schema 中保持 `required=false`，携带 client-requiredness 与 server-unknown metadata；`street_two` 保持 optional。现有 `mobile_country_code` 没有被新增或视为官方 E21 key，已降级为 non-blocking pre-existing VIZA field。
- `passport_holder_type` E21 on-change clear graph (`traveler_type`/`occupation_type`) 已记录；residence branch 明确不依赖 passport holder。FOREIGNER/FILIPINO 不会泄漏或清空 PH residence cascade。

### Ownership boundaries

- `profile.photo_url` 继续 `profile_owned`，不是 `visa_form_fields` 普通 text/file field，也不是 upload-result/runtime field。manifest 仅记录 profile URL delete/wiring 与 file contract unknown。
- `mobile_number`、country/street fields 的 manifest persistence boundary 是：`FOR_ME` 可写 profile route；`FOR_OTHER` 仅进入 registration payload。两种路径都不是 account secret/runtime，也不表示 registration server waiver。
- 无 photo `accept`/MIME/size/count、native input、crop/camera success、upload timing、server acceptance；无 mobile live format/requiredness/server country key；无 residence live option values/timing/errors/server requiredness 被推断。

### Regression coverage

- tests assert the 56/19/36/8 counts, photo wiring boundary, generic 5 MB default non-rule, mobile no-separate-country-key marker, country-clear graph, PH-only cascade endpoints, `street`/`street_two` official keys and client-only requiredness metadata。
- tests assert residence branch is `country_code === PH`, not passport holder type; non-PH does not receive an invented PH cascade schema branch。
- tests assert profile/mobile/residence persistence boundary remains separated from account/runtime/result fields and no photo file/upload result is seeded。

### Interfaces and remaining review

- **PH-A**：S1 live follow-up only needs rendered mobile blank/format behavior, two residence branches and real option/error behavior, plus a separately permitted normal photo chooser observation. No content/path/server upload inference from E21.
- **PH-C**：client endpoints and clear graph are selector preparation only; do not upload, automate mobile/residence, or relax preflight on bundle-only evidence.
- **PH-D**：show photo upload and mobile/residence validation as action-required/review-gated. Do not display generic widget default as a PH rule or render a standalone mobile country-code question as official.

### Verification

- Passed：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check attempted `pnpm install` and failed opening repo `_tmp_79532_95b4d0644be3b65149d9192f31a60107` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限或重试。
- Passed：`git diff --check` completed successfully after this worklog update.

## 第二十五轮 E1-E26 schema / option / condition contract hardening（2026-08-13）

> 范围：仅 `PH_ETRAVEL_ARRIVAL_CARD`。开始前已读取适用 AGENTS、协调总览、field contract（E1-E26）和 PH-A 至 PH-F 最新记录。没有浏览官网、调用 API、使用真实资料、OTP/Cookie/密码/密钥、执行 seed/migration/deploy/final Submit 或改动 runner/frontend/协调总览/其他 worklog。本轮指令禁止任何 Git 操作，因此未执行 `git status`、`git diff` 或 `git diff --check`。

### 已加固的跨层 schema 合同

- 新增稳定导出 `PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_MANIFEST`：它从当前全部 schema rows 派生每项 VIZA field、official key 状态、控件类型、中文标签、可见条件、已知 clear 关系、static/dynamic/unknown option 合同、requiredness evidence、fail-closed enforcement 和 owner。新 seed row 因而不能绕过该清单。
- 新增 `PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_SCOPE`：field contract 是 119 records（111 canonical + 8 diversion），当前 `visa_form_fields` schema 只有 69 rows，故有 50 条属于 profile/runtime/static/result/unsupported 或仍未建模的合同记录。该差额被 machine-checkable 地暴露，不能用虚构 applicant questions 填平；这也解释本轮为何不把 account/OTP/Turnstile/signature canvas/Summary/reference/QR 添加为 schema fields。
- 为官方 payload key 的合法复用建立 `PH_ETRAVEL_OFFICIAL_KEY_REUSE_CONTRACT`：仅允许互斥 AIR/SEA 的 `origin_port` / `departure_date` / `arrival_date` / `transit_port`，以及互斥住宿分支的 `destination_upon_arrival_in_philippines`。任何其他重复 official key 都是测试失败的合同漂移；没有 E1-E26 key 证据的字段保持 `official_key_status=needs_review`，不猜 key。
- 所有缺少明确 requiredness evidence 的 schema row 都在 manifest 标为 `needs_review_fail_closed`，跨层 enforcement 固定为 `do_not_infer_required_or_optional`。这不会把 public-bundle selector、label 或现有 seed boolean 偷换成服务器 required/optional 证明；已明确的 live/client evidence 仍保留原字段 metadata。
- `customs_signature` 继续作为电子海关路径、Review 前的 canvas gate（official key `signature`、不是 file upload），但在 applicant ownership manifest 改为 `static_action` / `applicant_answer=false`。它不会变成一般申请问题、`customs_signature_file` 或 universal SEA requirement。`customs_signature_declaration` 与 Family no-companion gate 同样保持 non-applicant action。
- 增加 `runtime.turnstile_captcha` 的 explicit runtime manifest row。account/email/OTP/password、Turnstile/CAPTCHA、profile upload、Summary/final Submit、official reference 和 QR render 均不进入 `visa_form_fields` 或 applicant answer manifest。

### E1-E26 路径与 option 边界

- Filipino/Foreigner、AIR/SEA、transit、Residence/Hotel/Travel Port、Health Yes children、Family、baggage、12 项 customs、goods rows、currency owner/recipient/item/source/purpose/physical/courier、declaration 与 special crew/cruise diversion 继续由既有 manifest 的 persona/transport/page/condition 归属覆盖；本轮 tests 以 parity manifest 约束全部当前 schema rows，而非以 label 猜 payload。
- 未改 `official-options.ts` 或 snapshot：E1-E26 没有给出可安全新增的完整官方 options snapshot。countries/currencies/ports/hotels/flights 等大集合继续只消费已记录的 dynamic source/query/response 合同；未知 code 不硬编码。
- SEA manual/electronic、SEA no-declaration/positive、SEA non-disembarking、signature/attachment、Family/Summary/result 继续为 path-specific evidence；本轮没有把 AIR evidence 外推到所有 SEA，也没有因 E25 public-bundle chain 提升 server requiredness、attachment contract 或 result success。
- E26 的唯一 photo 增量已落为 `live_file_control` metadata：normal single-file image control 可见，但 managed-browser policy 在选择前停止。`profile.photo_url` 仍是 profile-owned，不进入 applicant schema；accept/MIME、size、content、上传成功和 server acceptance 均仍是 `needs_review`。

### 新增回归断言

- manifest 与 `PH_ETRAVEL_OFFICIAL_FIELD_NAMES` 一一对应、schema field 无重复、每项有 type/中文 label/condition/requiredness evidence。
- confirmed official key 必须非空；重复 key 只能落入上述互斥 reuse contract；unknown key 必须是 fail-closed。
- `needs_review_fail_closed` 一律禁止跨层从 seed value 推断必填或可选。
- signature canvas 为 static action，Turnstile runtime、OTP/password、privacy、upload/result/QR/Summary/final action 均不能转成 applicant field。

### 验证

- Passed（最终修改后复跑）：定向 TypeScript static compile：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Passed（最终修改后复跑）：`cd viza-be/agent-backend && npm run type-check`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：pnpm dependency status check attempted `pnpm install` then failed opening repo `_tmp_72025_01a783d71f0e33c86cdac48cd62ab5da` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限或重试。
- Not run：`git diff --check`，因为本轮上级指令明确禁止任何 Git 操作。

### 待消费增量 / 接口

- **PH-A**：仅在新的受控 live/server evidence 明确给出 official key、option code、required/error、clear callback、file accept/size/count 或 final-result semantics 时，PH-B 才更新对应 manifest/field metadata；selector visibility 本身不关闭 requiredness。
- **PH-C / PH-D**：消费 `PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_MANIFEST` 的 `requiredness.cross_layer_enforcement`、`option_contract`、condition 和 owner；不得回退使用裸 `required`、label、port metadata 或 runtime state 推断 payload/页面/提交行为。

## E26 onboarding Personal Information screenshot delta（2026-08-14）

- 修正字段 metadata：Sex canonical values 为 `MALE` / `FEMALE`；Citizenship 与 Birth/Passport Issuing Authority 均保留 country `code`，但前者显示 `nationality`/demonym，后两者显示 country `name`。护照 holder default `FILIPINO` 只作 UI evidence。Occupation 仅确认 select 存在，未改完整列表。
- 更新定向 schema assertions，并修正 E26 profile-photo single-file-control evidence 的旧测试字符串；未记录申请人值。
- Passed：定向 TypeScript static compile、`npm run type-check`。
- Blocked：direct focused Vitest 在加载 `vitest.config.ts` 时试图写临时 bundled config，报 `EPERM`，未执行测试体；未安装依赖、请求审批或重试。

## Travel Registration / PH residence schema alignment（2026-08-15）

- 接管并审查已有本地 PH schema 改动；保留 `registration_for`（`FOR_ME`/`FOR_OTHER`）、AIR/SEA transport、锁定且 required 的 arrival-only `flight_type`，并明确 `DEPARTURE` 属独立产品。`registration_data_privacy_affidavit_consent` 是 required 的 VIZA audit checkbox，`official=false` 且 `exclude_from_official_payload=true`。
- 新增 PH-residence `province_code`、`municipality_code`、`barangay_code` schema fields，只在 `country_of_residence === PH` 显示；country/province/municipality clear graph 已记录，`region_code` 仍是 province metadata 的派生值，不伪造独立控件。非 PH 继续保留 line 1 与 optional line 2。
- 三个行政区均只使用 E21 已证实的动态 endpoint/code identity；没有静态 option 或额外 query/response 字段猜测。客户端 required wiring 与未知 server requiredness 分开标记。
- Passed：focused TypeScript static compile（schema/options/test）。Blocked：direct focused Vitest 在加载 config 时写临时 bundle 报 `EPERM`，测试体未执行；未安装依赖、请求审批或重试。

## 第二十三轮 E23 Health public-bundle schema consumption（2026-08-04）

> 已读取适用 `AGENTS.md`、协调总览第 37 节、arrival field contract E23 与 PH-A/PH-B/PH-C/PH-D 最新记录。本轮只消费 PH-A 的 zero-login Health public-bundle evidence；没有浏览官网、session、草稿、写 API、申请人资料、文件、签名、付款或 final Submit。只修改 PH-B 的 schema/options/test/worklog。

### 已对齐的 Health 合同

- `with_negative_antigen` 现为当前组件的条件化 applicant question：official key `with_negative_antigen`、boolean `true`/`false` radio，只在 `is_fully_vaccinated !== true && calculated_age_from_birth_date >= 15` 时显示。年龄和疫苗状态只是 inherited display predicate，不新增成 schema question；Antigen change 对 `is_with_history_exposure=false` 的客户端写入仅记录为 clear/wiring metadata。
- 最近旅行、接触患病者、生病三个主问题均用 Health 专用 boolean Yes/No values；分别记录 E23 client control/key boundary、Yup required 线索、以及 server requiredness/payload/acceptance `needs_review`。`meta.with_recent_travel_history` 只被标记为 public client control path，不被误写成 server payload rename。
- recent-travel Yes child `visited_country_30d` 对齐 `visited_countries` 多选、countries dynamic source、`code` identity / `name` label、无 component-local country exclusion、No 时清空。sick Yes child `sickness_symptom` 对齐 `sickness_symptoms`、官方 dynamic endpoint、`code`/`name` 投影、min-one client rule与 parent change 清空。
- Health schema fields 本轮一律保留 `required=false` 并带 client-vs-server metadata：E23 的 static Yup 不是 live error 或 server acceptance 证据。五项 E18 S3 live/server gaps 仍全部 review-gated。
- `is_fully_vaccinated`、`is_single_dosage`、`birth_date`、empty `health_declaration` 都未被创建为 Health applicant questions。`bats or sick animals` 仍只是一条 translation resource 文本：manifest 标记为 non-applicant static copy，未生成 form field、official key、option 或 validation。

### Path isolation and regression coverage

- tests 断言当前 Health component 没有 `transport_type` 或 `passport_holder_type` 的 field condition，且 ordinary Health schema ownership 固定为 `AIR_OR_SEA_ORDINARY_PASSENGER`；这不声称 live AIR/SEA、Filipino/Foreigner parity，只防止 VIZA 从 E23 伪造 component-local 分流。
- tests 覆盖 Antigen vaccine/age predicate、所有 boolean values、recent/sick Yes child 条件、parent false/change clear、countries/symptoms dynamic source、official client key 与未确认 payload key 的分离，并确保 bats/animals 不进入 `PH_ETRAVEL_OFFICIAL_FIELD_NAMES`。
- S3 readiness 保持 `planned_only=true` / `launch_ready=false`。E23 只将已存在的 client selector/condition/clear 图落盘，不改变 E17 56/19/36/8 evidence accounting。

### 仍需接口与受控证据

- **PH-A S3**：仍需以 synthetic Health answers 单独观察 Antigen age/vaccine eligibility、required marker/error、任何 document/upload surface；recent-travel 和 sick Yes/No 的 rendered error、selected-option interaction、实际 AIR/SEA/persona parity及 server acceptance。bats/animals 只有在未来组件出现真实 control 后才可重新评估。
- **PH-C**：不得根据 E23 static handler 所省略的 fields 猜测官方 serialization，也不得自动化 Health positive branches；继续在 live/server parity 前 fail closed。
- **PH-D**：countries/symptoms 只能显示为其各自 Yes child，clear wiring 仅为 UI hint；不可将 Antigen、bats/animals 或 client Yup 描述为 launch-ready/server validation。

### 验证

- Passed：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check attempted `pnpm install` and failed opening repo `_tmp_88932_d496c03545154b70ab26ccca4a0cac7a` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限或重试。
- Passed：final static compile and `git diff --check` completed after this worklog update.

## 第二十四轮 E24 SEA explicit-false/manual public-bundle schema consumption（2026-08-04）

> 已读取适用 `AGENTS.md`、协调总览第 38 节、arrival field contract E24 与 PH-A/PH-B/PH-C/PH-D 最新记录。本轮只消费 PH-A 的 zero-login SEA public-bundle evidence；没有浏览官网、session、草稿、写 API、申请人资料、文件、签名、付款或 final Submit。只修改 PH-B 的 schema/test/worklog；`official-options.ts` 无需本轮改动。

### E24 SEA 客户端合同

- `is_disembarking` 现对齐为 official boolean checkbox，public label `Are you disembarking?`，client default `false`。它只在 `transport_type === SEA && flight_type === ARRIVAL` 出现；切换 AIR 或 DEPARTURE 会写回 `false`。该 default/clear 仍是 client-only metadata，explicit-false live continuation、requiredness 和 server acceptance 均为 `needs_review`。
- SEA arrival stay subtree 统一绑定 truthy `is_disembarking === true`：falsey state 隐藏 `stay_location_type`、Residence/Hotel/Port children 与 `disembarking_port_code`。Residence/Hotel 条件不再因 stale `destination_type` 在 falsey SEA path 泄漏。E24 未发现 checkbox 本身的独立 clear callback，因此没有编造 payload/clear 规则。
- 三个 SEA key 明确保持分离：`is_disembarking`、voyage destination `destination_port_code`（VIZA `sea_port_of_entry` alias）和 `disembarking_port_code`（truthy `TRAVEL_PORT` child）。后两者不互为 alias；disembarking source 无 `transportation_type` filter，voyage destination source 保持 SEA-filtered dynamic contract。
- `with_custom_declaration` 继续完全排除申请人 schema。E24 metadata 只记录 regular array 的 nested `registration.travel_port.with_custom_declaration` page gate 与 customs hook 的 top-level source shape；不能 derived/alias/persist。它既不是 port -> manual/electronic mapping，也不证明 regular `/wizard/me` 与 declaration shortcut `/wizard/declaration` 的实际 route selection、page reachability或 server acceptance。

### 回归边界

- tests 断言 `is_disembarking` 只在 SEA ARRIVAL 可见，AIR/DEPARTURE clear 回 false；falsey SEA state 不显示 destination subtree，truthy SEA `TRAVEL_PORT` 才显示 disembarking port。
- tests 断言 AIR/SEA、ARRIVAL/DEPARTURE 条件隔离，两个 port official key/source contract 独立，`with_custom_declaration`、`selected_port_customs_flow` 与任何 guessed manual/electronic flag 均不能成为 applicant form field。
- S4 仍 `planned_only=true`、`launch_ready=false`。E24 仅闭合 public default/visibility/clear 的静态证据；E6 manual 和 E8/E9 electronic live paths 不被彼此或 falsey gate 外推。

### 接口与未闭合证据

- **PH-A S4**：仍需独立 ordinary SEA ARRIVAL live path，观察 unchecked/explicit-false 后的下一服务端页面；再比较两种 SEA port/metadata 状态的实际 rendered page。记录 label/selector/route 即止，禁止 final Submit。只有该证据可处理 false continuation、manual notice、actual port mapping与 route selection。
- **PH-C**：必须依 rendered page content 分支，并区分 `/wizard/me` 与 `/wizard/declaration`；不得用固定 `wizard_page` 或 `with_custom_declaration=false` 推断 E6 manual notice。false path 和 server acceptance 继续 fail closed。
- **PH-D**：仅在实际 disembarking branch 显示 SEA stay/destination；不得从 static page-array promise universal customs, Family 或 signature sequence。

### 验证

- Passed：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check attempted `pnpm install` and failed opening repo `_tmp_93076_a5813592af1c28a22b5bc4cf314da101` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限或重试。
- Passed：final `git diff --check` completed after this worklog update.

## 第二十二轮 E22 AIR/destination public-bundle schema consumption（2026-08-04）

> 已读取适用 `AGENTS.md`、协调总览第 36 节、arrival field contract E22 与 PH-A/PH-B/PH-C/PH-D 最新记录。本轮只消费 PH-A 的 zero-login public-bundle 证据；没有浏览官网、session、草稿、写 API、申请人资料、文件、签名、付款或 final Submit。只修改 PH-B 的 schema/options/test/worklog。

### 已落地的 AIR 与目的地合同

- `airline_name` 保持 VIZA 别名，但 official key 明确为 `travel_company_code`；`flight_number` official key 仍为 `flight_number`。两者记录 E22 dynamic source、airline change 对 normal flight / special detail / `destination_port_code` 的 client clear graph，以及 flight option 的 `travel_port_code` metadata 依赖。
- 新增 path-scoped `flight_number_special`：仅在 `transport_type === AIR && flight_number === SPECIAL FLIGHT` 显示，official key 为 `flight_number_special`，记录 uppercase、客户端 min length 5 和客户端分支 required 线索。它保持 `required=false` / `server_requiredness=needs_review`。
- `air.is_special_flight` 已从 unsupported applicant answer 改为 `runtime` derived UI state：它只表达 `flight_number === SPECIAL FLIGHT`，不占 official payload key、不进入 applicant field、也不发送 boolean。manifest 的 special-flight canonical answer 只对应 `flight_number_special`。
- `return_date` 条件收窄为：AIR 仅 `FOREIGNER + (POV001|POV007)`，SEA 保留已实测的 `POV001` path。E22 renderer/Yup minimum 的分歧和所有 server requiredness 仍明确 `needs_review`，所以 field 本身不阻断。
- `with_transit` 记录 official `name/id=with_transit` 及“toggle 不清空既有 child value”；AIR Transit children 使用 `transit_port_code` / `transit_destination_country_code` 官方 key、countries excluding `PH` 的客户端来源线索，但没有升格成服务端必填。
- `destination_type` 明确 AIR 与 SEA-disembarking 的显示边界和四项 client clear graph。Residence 的 same-as checkbox 对齐 `is_destination_same_as_permanent_address`，只记录 profile-display address 写入/false 清空 `destination_upon_arrival_in_philippines` 的客户端行为。
- Hotel 的唯一官方 shared value key 为 `destination_upon_arrival_in_philippines`；它记录 `/api/v1/common/hotels` 动态 source、`name` label 和无稳定 hotel code 的证据。原 `destination_hotel_address` 被降为 VIZA product alias，未声称 E22 official input key。
- AIR destination port 记录 transport-filtered dynamic source 与 `with_custom_declaration` runtime metadata。metadata 既不是 applicant field，也不能选择 AIR electronic/manual customs path。AIR Transit airport 收窄为 E22 public-bundle 的四个静态 code；这是 selector evidence，不是动态 option acceptance 或服务端规则。

### 证据和 P0 保持 review

- E22 只证明 public client wiring。E18 S2 的七项 `needs_review` 仍为：`air.airline_code`、`air.flight_number`、`air.is_special_flight`、`air.special_flight_number`、`destination.same_as_residence`、`destination.transit_port_code`、`destination.transit_destination_country_code`。
- 因而所有对应 schema fields 都将 `required=false`，并用 `client_requiredness=public_bundle_only` / `server_requiredness=needs_review` 区分客户端 Yup 与未观测的 rendered error、response values 和 server acceptance。没有猜 airline/flight/hotel/port dynamic option values。
- S2 仍 `planned_only=true`、`launch_ready=false`。本轮没有改变 SEA manual/electronic 条件、signature/family gate、customs/currency、附件或 result-only 的既有限制。

### 回归覆盖与接口

- 新增/更新 schema assertions：Special Flight 没有 boolean payload、`flight_number_special` 的 sentinel/key/format boundary、AIR/SEA return-date condition、Transit/Residence/Hotel 分支隔离与 clear graph、四个官方 Transit selector code、AIR hotel/port dynamic sources，以及 `with_custom_declaration` 不推导 customs flow。
- **PH-A S2 controlled live**：仍需记录实际 airline/flight/hotel option values、Special Flight render/required error、flight-to-port effect、Residence edit behavior、Transit required errors及 selected-value/server acceptance；只有这些可以关闭七项 S2 gap。
- **PH-C**：可准备 E22 dynamic endpoint/clear graph，但 airline/flight/hotel option 缺失必须 fail closed；不得用 `with_custom_declaration` metadata 推定 AIR customs flow。
- **PH-D**：可呈现 Special Flight derived branch 和 destination clear behavior；所有 AIR required/server state 继续 review-gated。

### 验证

- Passed：`./node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --resolveJsonModule --esModuleInterop src/tests/ph-etravel-arrival-card-schema.test.ts scripts/ph-etravel/form-fields.ts scripts/ph-etravel/official-options.ts`。
- Attempted：`cd viza-be/agent-backend && pnpm vitest run src/tests/ph-etravel-arrival-card-schema.test.ts`。
- Blocked before test body：`pnpm` dependency status check attempted `pnpm install` and failed opening repo `_tmp_85476_f390a2a74545693395090b4a7d33efb3` with `EPERM: operation not permitted`。未安装依赖、未请求审批、未升级权限或重试。
- Passed：`git diff --check` completed successfully after this worklog update.

## AIR Travel Details dropdown/API contract follow-up（2026-08-15）

- Consumed the already-recorded PH-A AIR dropdown evidence and public API contract only; no browser or official-site request was made. `purpose_of_travel` keeps the E13 official 16-code snapshot. `traveller_type` remains restricted to the ordinary AIR passenger product boundary; crew is not promoted from an unobserved/currently unsupported variant.
- Removed static arrival bindings for `airline_name` and `port_of_entry`. They now expose only their verified dynamic contracts: `travel_company_code` from `/api/v1/common/travel_companies?transportation_type=AIR`, then `flight_number` from `/api/v1/common/flight_numbers?travel_company_code={code}`, and `destination_port_code` from AIR-filtered travel ports. Submitted identity remains the API `code`/`flight_number`, never the display name. The legacy airline snapshot is still used by the independent departure schema and was not changed.
- `origin_country` now records the public-bundle `PH` exclusion plus client-only requiredness; its server requiredness stays `needs_review`. Hotel remains the dynamic name/region/city contract with no proven stable hotel code. Transit keeps its official country/port/date keys and PH exclusion; the separately evidenced fixed AIR-destination Transit port codes remain unchanged.
- Added regressions that dynamic arrival airline/AIR-port option arrays are empty, dynamic sources remain present, and origin-country exclusion/requiredness cannot be mistaken for server validation.
- Remaining PH-A evidence request: capture the current AIR traveller-type dropdown values and API response/selected-value behavior for airline, parented flight, AIR port, hotel and transit. Until then, dynamic list contents, live required errors, option acceptance and server rules remain `needs_review`; no display label may be substituted for a code.
- Validation: focused static TypeScript compilation passed. Focused Vitest did not reach a test body because Vite could not create `vitest.config.ts.timestamp-*.mjs` in this restricted environment (`EPERM`); no dependency install, approval request or retry was made.

## SEA Travel Details page 0 live UI capture（2026-08-15）

> Scope: the independently verified SEA draft's `Travel Details - Philippine Arrival (via SEA)` page 0 on `etravel.gov.ph`; draft locator, account and all field values were deliberately omitted. I expanded dropdowns and temporarily selected then cleared `VESSEL PASSENGER` and Transit. I did not use Next, Cancel, save or submit. No native `required`/`aria-required` attribute, HTML pattern/min/max/maxlength, or validation error was visible; this is **not** proof of optionality or server acceptance.

| Order | live field label | key/control | visible state and condition | VIZA match |
| --- | --- | --- | --- | --- |
| 1 | Purpose of Travel | headless combobox; `purpose_of_visit_code` | visible initially; 16 labels below; code not exposed in DOM | `purpose_of_travel` confirmed |
| 2 | Traveller Type | react-select (no stable HTML name) | visible initially; `VESSEL CREW`, `VESSEL PASSENGER`; option code not exposed | `traveller_type` confirmed; crew remains outside ordinary-v1 support |
| 3 | Vessel Name | text; `vessel_name` | visible initially | `vessel_name` confirmed |
| 4 | Voyage Number | text; `flight_number` | hidden with empty Traveller Type; appears only after temporary `VESSEL PASSENGER`, then was cleared again | `voyage_number` is a VIZA alias; official key confirmed as `flight_number` |
| 5 | Country of Origin | headless combobox; `origin_country_code` | visible initially; 249 display labels, no Philippines; DOM option code unavailable | `origin_country` confirmed |
| 6 | Seaport of Origin | text; `origin_port` | visible initially | `seaport_of_origin` confirmed |
| 7 | Date of Departure | text/date control; `departure_date` | visible initially; no format/range exposed | `voyage_departure_date` alias confirmed |
| 8 | With Transit (Connecting Voyage)? | checkbox; `with_transit` | initial checked state `false`; checking adds Transit Country/Seaport/Date; unchecking restored initial state | `with_transit` confirmed |
| 9 | Seaport of Destination | headless combobox; `destination_port_code` | visible initially; 53 display labels below; option code unavailable | `sea_port_of_entry` alias confirmed |
| 10 | Date of Arrival | text/date control; `arrival_date` | visible initially; no format/range exposed | `voyage_arrival_date` alias confirmed |

- `is_disembarking`, stay/destination children, hotel/residence, customs controls and signature did not render in either the initial state or the temporary `VESSEL PASSENGER` state on this page. They remain unobserved for this page/path; this page does not prove their absence in later SEA branches.
- Transit child keys rendered only while checked: `transit_country_code` (headless combobox), `transit_port` (text), `transit_date` (text/date). Transit Country showed the exact same 249-label set as Country of Origin and likewise excluded Philippines. No child code, default, required error, clear behavior beyond hide-on-uncheck, or server rule was observed.

### Full dropdown display inventory (codes unavailable in page DOM)

- **Purpose of Travel (16):** OFW; Business/Professional; Convention/Conference; Education/Training/Studies; Government/Official Mission; Health/Medical Reason; Holiday/Pleasure/Vacation; Incentive; Meetings; Others; Religion/Pilgrimage; Returning Resident; Trade Fair/Exhibition; Transit; Visit Friends/Relatives; Work/Employment.
- **Traveller Type (2):** VESSEL CREW; VESSEL PASSENGER.
- **Country of Origin / Transit Country (same 249, Philippines absent):** Afghanistan; Åland Islands; Albania; Algeria; American Samoa; Andorra; Angola; Anguilla; Antarctica; Antigua and Barbuda; Argentina; Armenia; Aruba; Australia; Austria; Azerbaijan; Bahamas; Bahrain; Bangladesh; Barbados; Belarus; Belgium; Belize; Benin; Bermuda; Bhutan; Bolivia (Plurinational State of); Bonaire, Sint Eustatius and Saba; Bosnia and Herzegovina; Botswana; Bouvet Island; Brazil; British Indian Ocean Territory; Brunei Darussalam; Bulgaria; Burkina Faso; Burundi; Cabo Verde; Cambodia; Cameroon; Canada; Cayman Islands; Central African Republic; Chad; Chile; China; Christmas Island; Cocos (Keeling) Islands; Colombia; Comoros; Congo (Republic of the); Congo (Democratic Republic of the); Cook Islands; Costa Rica; Côte d'Ivoire; Croatia; Cuba; Curaçao; Cyprus; Czech Republic; Denmark; Djibouti; Dominica; Dominican Republic; Ecuador; Egypt; El Salvador; Equatorial Guinea; Eritrea; Estonia; Ethiopia; Falkland Islands (Malvinas); Faroe Islands; Fiji; Finland; France; French Guiana; French Polynesia; French Southern Territories; Gabon; Gambia; Georgia; Germany; Ghana; Gibraltar; Greece; Greenland; Grenada; Guadeloupe; Guam; Guatemala; Guernsey; Guinea; Guinea-Bissau; Guyana; Haiti; Heard Island and McDonald Islands; Vatican City State; Honduras; Hong Kong; Hungary; Iceland; India; Indonesia; Iran; Iraq; Ireland; Isle of Man; Israel; Italy; Jamaica; Japan; Jersey; Jordan; Kazakhstan; Kenya; Kiribati; North Korea; South Korea; Kuwait; Kyrgyzstan; Lao People's Democratic Republic; Latvia; Lebanon; Lesotho; Liberia; Libya; Liechtenstein; Lithuania; Luxembourg; Macao; Macedonia (the former Yugoslav Republic of); Madagascar; Malawi; Malaysia; Maldives; Mali; Malta; Marshall Islands; Martinique; Mauritania; Mauritius; Mayotte; Mexico; Micronesia (Federated States of); Moldova (Republic of); Monaco; Mongolia; Montenegro; Montserrat; Morocco; Mozambique; Myanmar; Namibia; Nauru; Nepal; Netherlands; New Caledonia; New Zealand; Nicaragua; Niger; Nigeria; Niue; Norfolk Island; Northern Mariana Islands; Norway; Oman; Pakistan; Palau; Palestine, State of; Panama; Papua New Guinea; Paraguay; Peru; Pitcairn; Poland; Portugal; Puerto Rico; Qatar; Réunion; Romania; Russian Federation; Rwanda; Saint Barthélemy; Saint Helena, Ascension and Tristan da Cunha; Saint Kitts and Nevis; Saint Lucia; Saint Martin (French part); Saint Pierre and Miquelon; Saint Vincent and the Grenadines; Samoa; San Marino; Sao Tome and Principe; Saudi Arabia; Senegal; Serbia; Seychelles; Sierra Leone; Singapore; Sint Maarten (Dutch part); Slovakia; Slovenia; Solomon Islands; Somalia; South Africa; South Georgia and the South Sandwich Islands; South Sudan; Spain; Sri Lanka; Sudan; Suriname; Svalbard and Jan Mayen; Swaziland; Sweden; Switzerland; Syrian Arab Republic; Taiwan; Tajikistan; Tanzania, United Republic of; Thailand; Timor-Leste; Togo; Tokelau; Tonga; Trinidad and Tobago; Tunisia; Turkey; Turkmenistan; Turks and Caicos Islands; Tuvalu; Uganda; Ukraine; United Arab Emirates; United Kingdom of Great Britain and Northern Ireland; United States Minor Outlying Islands; United States of America; Uruguay; Uzbekistan; Vanuatu; Venezuela (Bolivarian Republic of); Vietnam; Virgin Islands (British); Virgin Islands (U.S.); Wallis and Futuna; Western Sahara; Yemen; Zambia; Zimbabwe; Kosovo.
- **Seaport of Destination (53):** Basco Batanes; Boracay Seaport; Calayan Island; Casulian Island; Claveria; Coron; DAVAO TORIL FISHPORT COMPLEX; El Nido; Holiday Ocean Marina, IGACOS; Lal-lo Seaport; Macapagal Port Terminal (MPT); Macapagal Port Terminal Landbase (MPTL); Mahatao Port; Manila South Harbor; Ochid Island; Port of Aparri; Port of Bacolod; Port of Basco; Port of Bataan (PHBTN); Port of Batangas (PHBTG); Port of Bislig; Port of Bohol; Port of Bongao; Port of Cagayan de Oro; Port of Calbayog; Port of Camiguin; Port of Cebu (PHCEB); Port of Currimao (ONRI); Port of General Santos; Port of Iligan; Port of Iloilo (PHILO); Port of Irene; Port of Laoag; Port of Legazpi; Port of Legazpi; Port of Masinloc; Port of Pangasinan; Port of Puerto Princesa; Port of Sasa, Davao Seaport; Port of Sta Cruz; PORT OF SUBIC BAY FREEPORT-LANDBASE (SOS); Port of Surigao; Romblon; Salomague Port; San Fernando International Seaport; San Fernando, Luzon (PHSFE); Siargao; Subic Bay (PHSFS); Subic Bay Yacht Club; Subport of Sual; Tabacco Seaport; Tacloban Seaport; Zamboanga Port.

### Evidence limits and next gate

- All page-DOM dropdown `value` attributes and stable submitted option codes were absent from the exposed option nodes. Do not map labels to codes from this capture; keep the existing public API source contract as the only code authority.
- Defaults were intentionally not read from populated draft inputs. The only state safely observed and restored was `with_transit=false`; the Traveller Type control was restored to its empty placeholder after condition testing.
- No requiredness/error/date-bound verification was attempted because it requires advancing the wizard, which is out of scope. **Waiting for user per-page acceptance before any later SEA page is inspected.**

## Health Declaration screenshot contract（2026-08-15）

- Consumed the user-provided AIR/SEA-common Health screenshots only; no official-site access. Recorded the false-declaration public-health warning as static copy, not an applicant field.
- The three base Yes/No questions are now required: recent travel history, exposure history, and sickness history. Their server acceptance remains `needs_review`.
- Recent-travel Yes now requires at least one `visited_countries` row; each row uses the complete dynamic official countries source, including Philippines, with Add/Delete metadata. No clears the group. Sickness Yes now requires one or more checkbox symptoms; No clears the group. The snapshot-confirmed symptom subset is the 15 displayed labels/codes only, not the prior 17-item static response.
- Exposure has no derived child field. No claim was made about a missing positive branch beyond the screenshot.
- Focused static TypeScript compilation and `git diff --check` passed. Focused Vitest did not reach a test body because Vite could not create `vitest.config.ts.timestamp-*.mjs` in this restricted environment (`EPERM`); no install, approval request or retry was made.

## E42-E45 General/Currency Declaration contract（2026-08-16）

- Replaced the shared goods `items[]` abstraction with distinct Q3-Q12 repeat groups. Each positive Q3-Q12 answer owns `Description`, `Quantity`, and `Amount in USD`; Q1/Q2 own no goods rows. The total-goods PHP/USD selector now shares the one observed Amount control. A positive displayed amount records the E42 client rule requiring at least one Q3-Q12 Yes, while row-saving and server enforcement remain `needs_review`.
- E43/E45 are applied narrowly: AIR Q3-Q12-positive renders the attachment-plus-signature variant, but a blank attachment plus valid signature can continue to Family. No attachment applicant/file field was added or made required. SEA attachment behavior and server acceptance remain fail-closed `needs_review`; the existing signature canvas gate remains separate.
- Currency preserves the E44 structure without upgrading unknown requiredness: owner/recipient fields stay non-required, currency and monetary-instrument repeat rows remain structured, and Currency plus the 16 Monetary Instrument entries submit API numeric `id` values. The physical-transfer `no_of_days_in_philippines` and `last_travel_to_philippines` evidence now covers the observed AIR and SEA electronic-positive physical branch only.
- E45 also confirms `owner_details_not_applicable` as the Owner N/A key and an empty-state client toggle; populated-value clearing, country-combobox disable behavior, courier behavior, BSP positive trigger, source/purpose minimums, and server acceptance remain `needs_review`. Current live `Other` visibility conflicts with earlier wiring, so both legacy child keys remain review-gated rather than being removed.
- Focused static TypeScript compilation passed. Focused Vitest was blocked before test execution because Vite could not create `vitest.config.ts.timestamp-*.mjs` (`EPERM`); no approval, install, or retry. `git diff --check` is run after this worklog update.

## Philippines country-scoped runner claim closure（2026-08-17）

- Closed the existing [`0149_runner_country_claim.sql`](/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend/drizzle/0149_runner_country_claim.sql) diff: `claim_runner_country_job` now rejects every country except `philippines`, has a Philippines queued-job index, and atomically performs lease recovery, pause/cap checks, advisory locking and `SKIP LOCKED` under service-role-only permission. No migration was executed.
- `worker.ts` sends `RUNNER_JOB_COUNTRY=philippines` (and `PH`) through that RPC only. The unset-country shared query/CAS behavior remains unchanged; existing non-Philippines scoped behavior also remains on its prior path.
- Passed: filtered RPC contract test (1/1), worker-target test (8/8), and `npm run type-check` in `submission-service`.
- The broader two-file test command had one unrelated existing failure in the official-fee migration assertion (`queue claimers use skip locked ... for update` against `0118_official_fee_queue_isolation.sql`); the new runner claim assertion passed. `git diff --check` was run after this entry.
- Production approval remains required to apply the migration and deploy/configure a Philippines worker; no deploy, commit or queue/official action occurred.

## E46 schema/options closure（2026-08-17）

- Consumed current E46 public-option evidence in PH-B owned schema/options only. Arrival Purpose now exposes the current 15 official `code` values and filters out stale `POV999` / `Others`; requiredness and persona effects remain review-gated.
- AIR flight dynamic options now use official response `code` as identity and `name` as label, with `travel_company_code` as parent and `travel_port_code` as metadata. The schema records that the current endpoint has no `flight_number` response property.
- SEA destination port remains dynamic/code-only; `destination_port_code` and `disembarking_port_code` stay distinct, and duplicate `Port of Legazpi` labels are recorded as evidence that label recovery is forbidden. `with_custom_declaration` remains metadata only.
- Verified existing Health/customs/family contracts stayed aligned: Health symptoms are the 15 screenshot-confirmed checkbox values; Q1/Q2 have no goods rows; Q3-Q12 each have their own repeatable item rows; attachment requiredness and unconfirmed option/requiredness stay fail-closed.
- Focused validation passed: static TypeScript compile for PH schema/options/test; `./node_modules/.bin/vitest run src/tests/ph-etravel-arrival-card-schema.test.ts` (35/35). `git diff --check` is run after this entry.

## E49 schema/options correction（2026-08-18）

- Consumed PH-A E49. Purpose fallback/options now match the official UI-shaped source: 16 current arrival codes including `POV999` / `Others`; submitted value remains official `code`, display remains `name`, and purpose requiredness/persona filtering stays path-specific.
- Added purpose dynamic-source metadata for `/api/v1/common/purpose_of_visits` with `paginate=0&q=&order_by=name&status_by=asc&for_arrival=1`; the older no-filter 15-row E46/E47 result is marked superseded for UI option contracts.
- SEA `destination_port_code` stays code-only and label recovery remains forbidden for duplicate `Port of Legazpi` (`TP120` / `LEGAZPI`). `with_custom_declaration` is recorded only as official port page-branch metadata: manual path excludes electronic customs fields; electronic path keeps the existing electronic customs/signature contract and still verifies rendered page content.
- Remaining blockers: same-draft only-port-change proof, `VESSEL CREW`, `is_disembarking=false`, SEA destination-stay variants, SEA electronic-positive post-currency parity, final Submit/reference/QR/recovery.
- Focused validation passed: static TypeScript compile for PH schema/options/test; `./node_modules/.bin/vitest run src/tests/ph-etravel-arrival-card-schema.test.ts` (35/35). `git diff --check` is run after this entry. No migration, deploy, commit, push, frontend, submission-service, field-contract, coordination, or other worklog edits.
