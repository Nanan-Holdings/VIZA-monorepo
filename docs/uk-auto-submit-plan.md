# UK 标准访客签证 自动提交 — 实施方案（直接对照 France-Visas 模式）

**目标**：用户在我们网站填完 UK wizard → 后端自动登录 gov.uk、把全部 44 页表单填完 → **停在「声明 + £135 付款」页**，把 resume 链接 + application reference 回传给申请人，由本人勾选法律声明并付款。

**结论先行**：UK 后端已具备 France 90% 的结构（session / register / account-loader / resume / payment / finalize / runner / dispatch 注册项都在）。**France 有、UK 缺的唯一关键件是 `normalize.ts`**。其余是把它接进 `runUkHalt`、补齐 wizard 字段、修正几处键名/枚举不匹配、更新过期文档。

---

## 一、France 的模式（被抄对象）

| 环节 | France 文件 | 作用 |
|------|-------------|------|
| 答案归一化 | `src/france-visas/normalize.ts` (`normalizeFvAnswers`) | 把网站存的 seed 字段名 + 通用枚举（`male`/`female`、alpha-2 国家码、ISO 日期）翻译成门户线格式；无法翻译就抛 `NormalizationError` |
| 派工入口 | `src/france-visas/runner.ts` | `export { runFranceHalt as runOne }` |
| 编排 | `src/queue/halt-runners.ts` `runFranceHalt` | `loadProfileAndApp → loadRawAnswers → buildAnswerMap → normalizeFvAnswers → loadFvAccount → fillFranceVisasApplication → status 映射为 halted_before_pay` |
| 账号 | `fv_accounts` 表 + `loadFvAccount` + `registration.ts` | 预注册门户账号（email/password），存加密行 |
| 填表+停 | `run.ts` `fillFranceVisasApplication` | 填草稿→finalize→**停在政府付款前**，返回 `applicationReference` |

UK 已有对应件：`resume.ts`（=run.ts，已填满 44 页 + Documents + Declaration ack，返回 `stopped_at_pay`）、`register.ts`（`uk_accounts`）、`account-loader.ts` `loadUkAccount`、`runner.ts`（`runUkHalt as runOne`）、`halt-runners.ts` `runUkHalt`、`payment.ts`、`finalize.ts`、`country-submissions/registry.ts` UK 项。`page-bindings.ts` 已为全部 44 步（含我们之前补的 `immigrationStatus`）写好 filler。

---

## 二、真正的差距（按工作量排序）

### 差距 1 —— 缺 `src/uk/normalize.ts`（核心，必做）

`runUkHalt` 现在把 `loadFieldAnswers` 的原始答案**直接**塞进 `resumeUkApplication`，没有 France 那层归一化。而 wizard 存的键/值与 `page-bindings.ts` filler 期望的 seed 字段名**对不上**：

| wizard 存的（`uk/config.ts`） | filler 期望的（`page-bindings.ts`） | 问题 |
|------|------|------|
| `home_address_line1` | `home_address_line_1` | 键名 |
| `home_country` | `home_address_country` / `_label` | 键名 |
| `telephone_number` | `phone_number` | 键名 |
| `passport_date_of_issue` / `_expiry` | `passport_issue_date` / `passport_expiry_date` | 键名 |
| `sex` = `"Male"`/`"Female"` | `a["sex"]==="male"` 才映射，否则落 `Unspecified` | 枚举大小写 |
| `purpose` | filler 读 `purposeOfVisitForVV` 对应的 label | 值→label 映射 |
| `marital_status` 七枚举 | filler 内有 `map[...]`，需逐一核对 | 值映射 |
| `country_of_nationality` / `country_of_birth` | filler 用 `_label` 优先；需确认存的是 alpha-2 还是国名 | 国家码↔label |

**做法**：照抄 `france-visas/normalize.ts`，新建 `src/uk/normalize.ts`：
- `normalizeUkAnswers({ answers, profile, application, ukOverrides }) → Record<string,string>`（输出 = `page-bindings` 期望的 seed 键/值）
- 复用 `buildAnswerMap`（已在 halt-runners）
- 键名重映射 + 枚举翻译（sex→`male`/`female`；国家码→门户 label via 现成的 country lookup；日期→门户分段格式由 filler 的 `ukFillDateSplit` 处理，保证传 ISO）
- 任何拿不准的值 → 抛 `UkNormalizationError`（仿 `NormalizationError`），`runUkHalt` 捕获后转 `NeedsHumanError`

### 差距 2 —— 把 normalize 接进 `runUkHalt`（必做，~10 行）

把 `runUkHalt` 改成 France 形态：

```
const { applicantId, profile, application } = await loadProfileAndApp(applicationId);
const answerMap = buildAnswerMap(await loadRawAnswers(applicationId));
let answers;
try { answers = normalizeUkAnswers({ answers: answerMap, profile, application }); }
catch (err) { if (err instanceof UkNormalizationError) throw new NeedsHumanError(`uk: ${err.message}`); throw err; }
const account = await loadUkAccount(applicantId);
if (!account) throw new NeedsHumanError("uk: no uk_accounts row provisioned");
const result = await resumeUkApplication({ resumeUrl: account.row.resume_url, password: account.password, email: account.row.email, answers }, { headless: true, runId });
// stopped_at_pay | halted_before_pay → HALTED；failed → RetryableRunnerError
```
（现有 `runUkHalt` 已是这个骨架，只需插入 normalize + 用 `loadRawAnswers`/`buildAnswerMap` 取代 `loadFieldAnswers`。）

### 差距 3 —— wizard 字段缺口（中等，决定填充完整度）

UK wizard 只收 ~49 个键，而 44 页表单需要更多 filler 输入（fillers 缺值会跳过 → 该页留空 → 申请人在 review 补）。**鉴于已选「停在声明/付款，本人 review」边界，留空可接受**，但建议至少补这些高频必填，减少人工：
- `immigration_status`（居住国身份，我们核对时发现的真实步骤）
- 联系页：`email_owner`、`has_alternative_email`、电话 purpose/type
- 财务：`planned_spend_gbp`、`monthly_outgoings_gbp`、`paying_for_visit`
- 家庭：`has_dependants`、父母信息、`family_in_uk`
- 旅行史：英国/特定国家/世界旅行的明细
- 申报详情：拒签/移民违规/犯罪的展开

对照基准用 seed：`agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`（registry 里登记的 schemaFiles）。normalize 的输出键必须与 seed `field_name` 一致。

### 差距 4 —— 账号供给链路确认（必查）

`register.ts` 提交会**创建真实 UKVI 账号**，受 `UK_REGISTER_COMMIT=1` 门控；需确认：注册 worker 在 wizard 完成后被触发 → 拿到 UKVI 发来的 resume 链接（经 inbox：`appl-*@haggstorm.com` alias）→ 写 `uk_accounts(email, password, resume_url)`。`runUkHalt` 依赖这行存在。需打通「wizard 完成 → 入队注册 → 入队 resume 填表」的派工顺序。

### 差距 5 —— 前端把 resume 链接交回申请人（必做）

填表停在付款后，`stopped_at_pay` 返回 `portalUrl`(=resumeUrl) + `applicationReference`。前端需有一处「您的申请已填好，请点此核对声明并支付 £135」入口（展示 resume 链接 + reference）。对照 France 回传 `applicationReference` 给用户的现有 UI。

### 差距 6 —— 清理过期文档/注释（小）

- `orchestrator.ts` 顶部注释、`registry.ts` line 337 `notes`、`docs/visa-packages-status.md`（UK 仍写 Phase 2 / post-auth not mapped）均已过期 → 更新为 Phase 3（填满停付款）。
- `registry.ts` UK 项 `mapperFiles` 加入 `src/uk/normalize.ts`。

---

## 三、改动清单

| 文件 | 动作 |
|------|------|
| `src/uk/normalize.ts` | **新建**，照抄 `france-visas/normalize.ts` 结构 |
| `src/uk/errors.ts` | 加 `UkNormalizationError` |
| `src/queue/halt-runners.ts` `runUkHalt` | 接入 normalize + `loadRawAnswers`/`buildAnswerMap` |
| `src/uk/index.ts` | 导出 `normalizeUkAnswers` |
| `viza-fe/.../wizards/uk/config.ts` | 修键名 + 枚举值（line1→line_1、home_country→home_address_country、sex 小写、phone 等），补差距3字段 |
| 前端 review/支付交接 UI | 展示 resume 链接 + reference |
| `country-submissions/registry.ts` | `mapperFiles` 加 normalize；更新 notes |
| `docs/visa-packages-status.md` | UK → Phase 3 |

---

## 四、验证（合并进任务收尾）

1. `cd viza-be/submission-service && npm run type-check`；wizard 改动后 `cd viza-fe/internal-website && npm run type-check`。
2. `normalize.ts` 单测：喂 wizard 形态答案，断言输出键/值匹配 filler 期望（仿 France `__tests__`）。
3. 用 `UK_REGISTER_COMMIT` 不开 的 QA 模式跑 `register.ts`（填表不提交）验证选择器仍命中。
4. 在测试账号上跑一次 `resumeUkApplication`（headless=false）确认 44 页填满并停在 Pay；核对截图。
5. 端到端：建一个 draft application → 入队 → 确认 `applications.status` 流转 + resume 链接回传。

---

## 五、需要你拍板的点

1. **wizard 是否扩字段**（差距3）：A) 现在就补全高频必填，减少人工；B) 先只做 normalize + 现有字段，缺的留空让申请人 review 时补。
2. **账号池策略**（差距4）：每个申请实时注册 UKVI 账号，还是预置账号池？这关系到 `UK_REGISTER_COMMIT` 上线与速率/风控。
3. 是否需要我**直接开始实现差距 1+2**（normalize + 接线，纯后端、风险最低的核心闭环），其余分批？
