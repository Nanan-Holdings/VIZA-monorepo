# 台湾 Online Entry Permit 上线协调文档

**状态：** 授权方称 CAPTCHA 服务已实施；本地台湾 runner 测试已通过，但**尚未完成真实提交验收，不能上线**。当前 P0 阻断为：VIZA 前端仍把刚提交的台湾任务作为 `submission_queue` dry-run 处理，实际消费后得到 `unsupported (TW)`；正确的官网自动填表入口是 `runner_job` → `tw/runner` → `runTwHalt`，但生产/本地启动日志仍显示 `TW_OFFICIAL_LOGIN_ADAPTER` 缺失（`missing_adapter`）。legacy real-submit 开关未获部署确认、`submitted` 未强制要求官方回执。台湾自动 tracking 尚未实现。
**创建日期：** 2026-08-01
**产品：** `taiwan` / `TW_ENTRY_PERMIT` — 旅居海外或港澳的大陆地区人民来台观光入境许可证。
**唯一状态负责人：** 主协调者。本文档对并行执行者只读；每个执行者只更新自己的独立 worklog，避免同时编辑同一文件。

## 1. 发布定义与不可跨越的边界

本产品不是签证知识页，也不是即时生效的到达卡。它是需移民署审核、核准后另行付款的正式入境许可申请。

已确定的自动化边界：

- 仅在获授权 CAPTCHA 服务已经部署、且全部 P0 发布阻断关闭后，才可处理 CAPTCHA 并点击官方“确认资料”。
- 不在无官方回执的情况下把结果写为 `submitted`。
- 不代替申请人完成审核后的官方付款。
- 不创建或保存不存在的台湾官网持久账号；官方流程是一次性邮箱 OTP 会话。

**发布前必须选择且实现一种可验证的交接模型：**

1. `人工协助会话`：VIZA 操作员在受控浏览器中填至 CAPTCHA，由申请人或操作员在同一会话完成明确授权后的人工交接；或
2. `用户可接续远程会话`：保留同一远程浏览器会话，并向申请人提供安全、短时有效的接续链接；或
3. `资料包模式`：不运行官网自动填写，只交付已核验的资料/文件清单与官方入口，且 UI 不声称已在官网填完。

当前实现不满足上述任一模型：runner 在服务器无头浏览器中填完后关闭 session，结果页却要求用户另开官网继续。这是发布阻断项 `TW-G0`。

## 2. 已完成且已确认的能力

- `TW_ENTRY_PERMIT` package、目的地入口、动态表单、结果卡、队列 dispatch 和台湾 runner 均已存在。
- 动态表单真实渲染链路已确认：`long-form` → `dynamic-step-form` → `dynamic-form-field`；不是旧 `WizardShell`。
- 台湾申请表目前为简体中文单列；英文姓名转大写，中文姓名失焦简转繁。
- 资格类别影响 Documents 步骤；申请人只看到对应的一份资格证明文件要求。
- 官方网页的实际会话顺序已走查：同意条款 → 递送地点 → 邮箱 OTP → 单页长表单 → CAPTCHA + “确认资料”。
- runner 使用真实 DOM `name` 属性和资料上传逻辑，停点意图为 CAPTCHA 前。

## 3. 发布阻断项（必须逐项关闭）

| ID | 阻断项 | 当前证据 | 唯一负责人范围 | 完成证据 |
|---|---|---|---|---|
| TW-G0 | VIZA 提交入口能可靠入队台湾 live worker | **未关闭**：前端 `supportsLiveAssisted` 白名单不含台湾，且 queue helper 没有台湾 provider/live status；结果卡与后端契约冲突 | 前端/集成负责人 | 从 VIZA 的正式提交按钮产生非空 queue job id，provider、mode、stage 与 worker 消费记录一致，并有 API 回归测试 |
| TW-G1 | 授权 CAPTCHA 服务的部署与审计边界 | **未关闭**：代码已有台湾识别、重试与提交路径；授权方称已实施，但仓库不能证明生产密钥/服务已配置 | 台湾 runner/部署负责人 | 受控部署确认服务配置存在且不泄露密钥；一笔授权 smoke 证实可到达官方回执，且不持久化 CAPTCHA 明文 |
| TW-G2 | 迁移 `0123` 已由授权人员在共享 Supabase 成功执行 | **已关闭（2026-08-01）**：授权人员在 `viza-production` 先执行 `0122` 补齐基础规则，再执行 `0123`；验证得到 10 条规则、`eligibility_supporting_document_1..4` 存在、旧通用 key 已移除 | 数据库负责人（人工执行） | 已保存的 Supabase SQL Editor 验证截图；后续部署前再跑一次只读查询留档 |
| TW-G3 | 表单 seed、数据库字段、官方 DOM 映射一致 | `apply.ts` 标注官方必填 `householdRevoked` 尚未进入 seed；资格值通过 runner 临时转换 | Schema负责人 | 字段对照表、单元测试、真实页面 smoke 证明每个必填字段均被处理或明确阻断 |
| TW-G4 | 完整端到端受控 smoke | 静态测试通过，但未验证真实 OTP、资料、CAPTCHA、官方回执和状态查询 | QA负责人 | 脱敏的 queue 时间线、官方回执存在性、持久化结果与一次状态查询证据；不得记录敏感值 |
| TW-G5 | 商业发布链路确认 | package migration 已有，但线上 package、价格、支付、购买后可见性未在交接中证实 | 发布负责人 | 已售产品可从目的地选择到付款、申请、Documents、状态页；或明确标为仅邀请测试 |
| TW-G6 | 受控官方登录 provider 已在部署启动时实际注册 | **未关闭**：TW-A 已实现 fail-closed 接口和测试，但 `createTwOfficialLoginProviderFromEnvironment()` 当前只读取进程内 registry；仓库中尚无非测试的启动/bootstrap 调用注册真实 adapter | 台湾 runner/部署负责人 | 受控部署启动时注册的 adapter、密钥库引用、登录 OTP 回调、一次真实 smoke 到 CAPTCHA 前的脱敏证据 |
| TW-G7 | 申请表邮箱 OTP parser 与真实官方邮件一致 | **已关闭（2026-08-01）**：脱敏 fixture 覆盖官方发件人、主题、验证码标签及保留混合大小写的约 15 位 token；focused tests 已通过 | 台湾 runner负责人 | 继续在真实 smoke 中确认邮件送达与 30 分钟时限 |
| TW-G8 | 官方回执是 `submitted` 的强制证据 | **未关闭**：runner 在 CAPTCHA 页面消失后即可返回 `submitted`；case number/确认页证据是可选的，可能误报成功 | 台湾 runner/集成负责人 | `submitted` 需原子持久化至少一项官方回执证据；缺失时应为可恢复失败 |
| TW-G9 | 台湾状态追踪 | **未关闭**：没有台湾状态查询 runner、解析器、定时任务、数据模型或通知；现有 tracking schema 仅限越南 | 台湾 tracking 负责人 | 台湾查询合同、持久化、worker/scheduler、UI 与一次受控查询证据 |
| TW-G10 | VIZA 台湾长表单题目/必填合同需与官网真实题目对齐 | **源码/测试合同已复核通过，production 视觉复核仍阻断；local 表单主体已恢复**：TW-C 已修复台湾中文题目优先级，补齐/修正 `household_revoked`、旅行证件/护（证）照、侨居身份证、现职/经历、公司/职称、台湾人民配偶、港澳或海外地址、在台地址、其他国籍、政治机关/团体声明等 TW 专属文案；seed 已将 `company_name`、`job_title` 改为官网必填；台湾地址组 required/optional/conditional 合同已加测试固定；TW-A 复核后的剩余项也已处理并由 TW-A 源码/测试复核通过：`kin_father_status`、`kin_mother_status` required，父/母其他亲属字段 optional，`occupation_experience` 仅 `current_occupation === 62`（退休）时条件显示/必填，自由业/其他业/无不触发。TW-A 并行收口后复查：local canonical 与多层 `amp;` URL 已渲染台湾表单第一步，production canonical / 多层 `amp;` / 带 applicationId URL 仍只显示 portal 导航且 `input/select/textarea=0`。 | 部署/路由/环境负责人；TW-C/TW-03 若后续视觉或官网提交前校验发现字段差异再接回 | production VIZA long-form 可渲染台湾表单；TW-A 在不写草稿或经授权测试数据填充后复核后续字段题目与 required 标记 |

## 4. 可并行工作包与文件所有权

执行者开始前必须阅读本文档。并行 AI 不得修改本协调文档；每个工作包在第 4.2 节拥有一个独立 worklog 文件。其他 AI 可随时读取全部 worklog，主协调者负责把确认后的结论合并回本文档。

| 工作包 | 可并行 | 允许改动 | 禁止改动 | 交付/验收 |
|---|---:|---|---|---|
| TW-01 架构决策与 UX 规格 | 是 | `docs/taiwan-launch-coordination.md`（仅主协调者）、新增决策文档 | 所有产品代码 | 选定 G0 的一种交接模型；写清用户、操作员、OTP、浏览器会话、超时与隐私责任 |
| TW-02 Runner 合规边界 | 是 | `viza-be/submission-service/src/tw/**`、对应台湾测试 | 前端、数据库迁移、通用 CAPTCHA 模块 | 关闭 G1；runner 在选定的交接模型中保持同一会话或改为不产生误导结果；`npm run type-check` + 台湾 focused tests |
| TW-03 Schema/资料一致性 | 是 | `seed-tw-entry-permit-form-fields.ts`、`0123` 后续非执行性修正、台湾 schema tests | runner、前端、任何共享数据库执行 | 关闭 G3；提供 seed/DOM/文件 requirement 对照与验证命令 |
| TW-04 前端发布体验 | 依赖 TW-01 | 台湾专属结果卡、台湾提交路由、台湾 copy/tests | runner、迁移、共享动态表单文件（除非明确转交） | UI 文案与实际交接模型一致；没有“另开空白官网可继续”的错误路径 |
| TW-05 受控数据库操作与验证 | 依赖 TW-03 | 仅由授权人员在 Supabase Dashboard/受控 pipeline 执行；验证记录写入本文件 | 不让自动化代理直接写共享 DB | 关闭 G2；回滚/恢复方案明确 |
| TW-06 E2E/发布 QA | 依赖 TW-02、TW-03、TW-04、TW-05 | 测试、QA 文档、非生产 fixture | 产品逻辑、生产 DB | 关闭 G4、G5；含失败恢复、OTP 超时、缺少资料、每个资格类别、无最终提交验证 |
| TW-07 集成与发布 | 最后 | 共享入口、feature flag、发布清单 | 其他工作包私有文件 | 全量相关 type-check/test、部署配置审核、回滚开关、发布说明 |

### 冲突预防规则

- `TW-02` 是唯一能修改 `viza-be/submission-service/src/tw/**`、`src/queue/halt-runners.ts` 中台湾专属段落，以及与台湾结果映射直接相关的 submission-service 测试的工作包。不得改动 `halt-runners.ts` 中其他国家段落。
- `TW-03` 是唯一能修改台湾 seed 和台湾相关 migration 文件的工作包。
- `TW-04` 是唯一能修改 `TwResultCard` 与台湾前端提交体验的工作包。
- 数据库执行不是代码工作包：只允许被你指定的人工/受控发布负责人完成。
- 共享入口、环境变量、package 版本、migration 执行、合并与部署只能由 `TW-07` 处理。
- 其他未提交改动属于既有工作，任何工作包不得重置、覆盖或顺带格式化。
- 所有并行 AI 禁止执行 `git stash`、`git checkout`、`git switch`、`git reset`、`git rebase`、`git merge`、`git commit` 或批量 `git add`。最终提交只由集成负责人完成。
- 禁止运行会改写整包文件的 formatter、自动修复 lint、依赖升级或无关 `npm install`；只运行不会修改文件的检查和 focused tests。
- 开始并行前，主协调者必须保存当前 `git status --short` 和台湾相关 diff 作为基线；结束时逐文件核对，避免把本次任务前已有改动误算成 AI 产出。

### 4.1 第一波：可立即同时执行（不等待产品交接方式的选择）

下面四个任务可交给四个不同 AI 同时执行。它们刻意只调查、测试或修改各自私有文件；均不得运行 migration、不得改动 feature flag、不得部署、不得点击台湾官网“确认资料”。

| 指派 | 任务 | 专属文件范围 | 不能碰的范围 | 产出 |
|---|---|---|---|---|
| `TW-A` | **Runner 合规与会话审计**：核对 TW runner 与 `src/tw/AGENTS.md`，移除/隔离 CAPTCHA 自动求解路径；明确 session 被关闭的位置、可否安全保留或恢复，以及最小可行的交接实现设计。 | `viza-be/submission-service/src/tw/**`、`src/queue/halt-runners.ts` 的台湾专属段落、台湾 submission-service 测试 | 前端、DB migration、共享 captcha client、`halt-runners.ts` 其他国家段落 | 可集成补丁 + focused tests + 交接设计说明；不实现任何未批准的远程接管服务 |
| `TW-B` | **Schema/官方 DOM/材料合同审计**：逐项比对 seed、`normalize.ts`、真实 DOM mapping、`document_requirements` 和条件逻辑；修复只属于 schema 的缺口，并列出需要人工执行的 DB 项。 | `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`、台湾 migration、台湾 schema tests | runner、前端、实际 Supabase | 对照矩阵 + 单元测试；特别确认 `householdRevoked`、资格类别编码、每类资料要求 |
| `TW-C` | **前端真实体验审计**：从目的地到表单、Documents、提交状态、结果卡做本地/测试环境 smoke；找出所有与“服务器 session 关闭”冲突的文案和入口，但在交接模型未定前只提交审计和测试，不修改行为。 | 新增台湾前端测试、`docs` 中的体验审计记录 | 现有前端生产逻辑、runner、DB | 可重跑的 smoke 清单、截图/失败证据、需要在 TW-04 修改的精确文件清单 |
| `TW-D` | **发布/QA 审计**：检查 product package、价格、checkout、应用可见性、权限、错误恢复、数据/OTP 同意和观测需求；输出内测与公开发布 checklist。 | 新增 `docs` QA/发布文档；只读检查其他代码 | 所有产品代码、数据库、部署配置 | 可执行的发布 checklist、风险分级、回滚清单 |

**第一波汇合规则：**四个 AI 只能在自己的文件范围内产生变更；不得自行提交。每人更新第 4.2 节指定的独立 worklog 后交付结果。主协调者确认产品交接模型后，才创建第二波的 `TW-04` 实现任务。

### 4.2 并行 AI 状态入口（每人只写自己的文件）

#### TW-A — Runner 合规与会话审计

- Worklog：`docs/taiwan-launch-worklogs/TW-A.md`
- 本协调文档：只读

#### TW-B — Schema/官方 DOM/材料合同审计

- Worklog：`docs/taiwan-launch-worklogs/TW-B.md`
- 本协调文档：只读
- 迁移 `0123` 不得由 AI 执行

#### TW-C — 前端真实体验审计

- Worklog：`docs/taiwan-launch-worklogs/TW-C.md`
- 本协调文档：只读
- 最终交接模型未确定，因此本波不改产品行为

#### TW-D — 发布/QA 审计

- Worklog：`docs/taiwan-launch-worklogs/TW-D.md`
- 本协调文档：只读
- 公开发售 vs 邀请内测未确定

### 4.3 第二波：只有第一波汇合和交接方式决策后才开始

| 指派 | 任务 | 前置条件 | 唯一负责人范围 |
|---|---|---|---|
| `TW-E` | 实现经批准的前端交接体验与准确文案 | TW-A、TW-C 完成；你已选择交接模型 | 台湾前端结果卡、提交路由、台湾专属文案与测试 |
| `TW-F` | 执行受控数据库迁移并做线上数据验证 | TW-B 完成；你授权人工/CI 执行 | Supabase Dashboard 或受控发布流水线；不由 AI 直接写库 |
| `TW-G` | 集成、端到端演练、feature flag 与发布 | TW-A/B/C/D/E/F 完成 | 共享入口、环境变量、发布配置、集成测试和回滚 |

### 4.4 第三波：授权账号自动填表（当前开始）

**阶段目标：** 使用受控的授权官网登录账号完成登录与所需 OTP，然后自动填写和上传资料，逐项验证官网实际值，并准确停止在 CAPTCHA 前。不得处理 CAPTCHA 或点击最终提交。`TW-G2` 数据库规则已在 production 验证完成。

| 指派 | 任务 | 唯一文件范围 | 验收标准 |
|---|---|---|---|
| `TW-A` | 授权账号登录 + OTP runner 接入 | `viza-be/submission-service/src/tw/**`、`src/queue/halt-runners.ts` 台湾段、台湾 runner 测试、自己的 worklog | 受控环境配置后不会使用 noop/`skipped` 登录；账号凭据和 OTP 绝不进代码/日志；登录、表单 OTP、逐字段验证、上传、CAPTCHA 前停点均有 focused tests 和可操作的 runbook |
| `TW-B` | 生产数据合同与页面预检 | 台湾 seed、台湾 schema tests、台湾数据合同/预检 docs、自己的 worklog | 代码/production 的 10 条材料规则、字段合同、条件材料和 runner 依赖可复核；给出真实 smoke 的逐项预检与预期证据，不操作共享 DB、不触碰 runner |
| `TW-C` | 前端状态、失败恢复与受控 QA | 台湾前端结果/状态/材料测试、台湾 QA runbook、自己的 worklog | 用户能看到准确状态和安全失败原因；Documents 对 4 个资格类别有覆盖；写清操作员在真实 smoke 中如何开始、观察、停止和记录，不承诺 CAPTCHA/提交 |

**第三波统一规则：**

- 不执行 migration、部署或真实官方最终提交。
- 不把账号、密码、OTP、Cookie、storage state、申请人资料或截图原件写入 Git、测试、日志或 worklog。
- 真实官方 smoke 只由授权操作员用安全测试资料执行；AI 只能交付代码、测试、脱敏 runbook 和验收清单。
- 每位执行者开始前阅读本总览和全部 worklog；只更新自己的 worklog。
- 第三波结束后由主协调者审查 diff、跑 focused tests，并由你执行一次真实登录至 CAPTCHA 前的受控 smoke。

## 5. 发布门槛

### 内测（邀请制）

TW-G0 至 TW-G4 全部关闭；功能开关默认关闭；只有经同意的测试申请人；不自动提交、不识别 CAPTCHA、不付款。

### 公开可售

在内测门槛外，还必须关闭 TW-G5：商品/价格/退款说明、适用对象和资格限制、人工责任边界、隐私与 OTP 同意、客服和失败恢复路径均可验证。

## 6. 状态日志（只由主协调者写入）

| 时间 | 更新 | 影响 | 下一步 |
|---|---|---|---|
| 2026-08-01 | 根据 2026-07-31 handoff 建立上线协调文档；发现 runner session 关闭与用户“另开官网继续”之间的断链。 | 公开上线不可开始；先决策 TW-G0。 | 你选择交接模型和发布范围（内测/公开）后，分派 TW-01 至 TW-07。 |
| 2026-08-01 | 发现 `src/tw/AGENTS.md` 禁止 CAPTCHA 求解，但 `src/tw/captcha.ts` 仍调用 2captcha 并写入验证码。 | 合规边界自相矛盾；TW-G1 阻断。 | TW-02 移除该行为并更新相关类型、UI 与测试。 |
| 2026-08-01 | 产品方向确认：有授权官网登录账号，可代表申请人提交和查询；当前官网登录和最终提交均有 OTP，且存在 CAPTCHA。 | 本阶段不实现 CAPTCHA 解题或最终提交；目标改为稳定的授权账号登录、OTP 会话、官网表单预填、文件上传、字段/回执校验，并在 CAPTCHA 前停止。 | 原 TW-A/B/C/D chat 继续各自范围；待获得官方 CAPTCHA 豁免/API 后再启动自动提交与 tracking 集成。 |
| 2026-08-01 | 授权人员已在 `viza-production` 手工执行 `0122`、`0123` 并验证台湾 `document_requirements` 共 10 条；资格材料已拆为 `_1..4`，旧通用 key 不存在。 | TW-G2 数据库阻断关闭；Documents 和 runner 可以依赖类别专属材料 key。 | 在部署环境跑一次只读复核；继续完成真实授权登录和 CAPTCHA 前 live smoke。 |
| 2026-08-01 | 第三波代码审查与复跑完成：runner 19 项、schema 7 项、前端 14 项 focused tests 全部通过；fail-closed、字段/文件校验、Documents 类别覆盖、前端安全状态和 QA runbook 均已落地。 | 自动填表的静态质量门槛通过。发现 `TW-G6`：登录 provider registry 只在测试中被注册，尚未接入真实受控部署 bootstrap，因此当前 production worker 会安全停止而不会实际登录。 | 实现并部署受控 provider adapter，随后由授权操作员执行一次真实登录至 CAPTCHA 前 smoke。 |
| 2026-08-01 | 授权操作员提供脱敏前的真实台湾官方邮箱验证邮件截图作为人工证据；未将真实验证码写入仓库。 | 证实申请表邮箱 OTP 为约 15 位字母数字 token、30 分钟有效；推翻现有 4–8 位纯数字 extractor 假设，新增 TW-G7。该邮件不是授权官网登录 OTP 样本。 | TW-A 修复 parser 与测试；另行采集脱敏的官网登录 OTP 样本以实现 TW-G6 adapter。 |
| 2026-08-01 | 授权操作员提供官网邮箱验证入口截图：页面只有邮箱输入、寄送验证码按钮和图形 CAPTCHA；没有账号/密码登录字段。CAPTCHA 在寄送验证码之前。 | 修正先前“先登录/OTP、再到 CAPTCHA”的错误顺序：无 CAPTCHA 豁免/API 时 runner 无法取得申请表 OTP，无法自动进入表单。新增 TW-G8；TW-G6 的官网登录 adapter 暂停，除非存在另一条经授权的独立账号入口。 | 向移民署/授权方确认 API、CAPTCHA 豁免或允许的合作方通道；否则改为资料预检/人工官网流程。 |
| 2026-08-01 | 授权方称 CAPTCHA 服务已在部署环境实施；当前代码已具备台湾图形 CAPTCHA 识别、重试与“确认资料”提交路径，且台湾 focused tests 27/27 通过。未读取或记录任何密钥。 | 静态实现已就绪，但这不是生产验收证据；TW-G8 仍需一笔经授权、脱敏的真实受控流程确认服务配置、官网页面选择器、提交回执和状态追踪均正常。 | 授权操作员以安全测试申请执行一次完整受控 smoke；保存脱敏的开始时间、结果状态、官方申请编号/回执存在性与追踪查询结果。 |
| 2026-08-01 | TW-E/F/G 集成审查：前端 queue、运行时 adapter bootstrap、官方回执判定和 fail-closed tracking 合同已有定向测试；前端相关 30/30、台湾/registry 59/59 通过。 | 不可据此上线：TW-E 将 live 前端开关写为默认放行，须改成显式启用；TW-F 只有 adapter 加载框架，部署中尚无经确认的真实官方 adapter；TW-G 尚无官方状态查询 URL/字段，tracking 正确地停在 `provider_unavailable`。submission-service 全量 type-check 还被一个无关的菲律宾测试类型错误阻断。 | 先修正台湾前端开关为 fail-closed；由发布负责人提供/部署已批准 adapter；取得官方状态查询合同后实现真正查询，再执行一次真实受控 smoke。 |
| 2026-08-01 | TW-A 使用已登录 Chrome 进入台湾官网真实新增申请表并审计题目；VIZA 线上 long-form 页面本次只显示 portal 导航，未能视觉复核，故以当前 long-form 题目源码合同对照；随后补充 required/optional 对照。 | 新增 TW-G10：部分字段文案/必填合同仍未与官网一致，尤其通用护照题目覆盖台湾旅行证语义、公司/职称官网必填但 seed 选填、户口状态中文覆盖、政治机关/团体声明和亲属父母必填提示。台湾地址组 required 合同基本一致，`tw_contact_road` 主要是文案问题。未提交官网申请、未触发 CAPTCHA、未改 submission-service。 | 交给 TW-C/TW-03 修正 `viza-fe/internal-website/lib/bilingual-schema-contract.ts`、台湾 seed 和台湾前端配置，并补字段合同测试；修复后再做 VIZA long-form 视觉复核。 |
| 2026-08-01 | TW-C 修复台湾长表单中文题目优先级：`TW_ENTRY_PERMIT` 字段若命中人工字段表，则先使用 `FIELD_NAME_ZH_OVERRIDES`，避免数据库坏 `validation_rules.label_zh` 覆盖 `tw_contact_city`、`tw_contact_building_number`、`tw_contact_mobile_not_applicable` 等官方/人工文案。 | 台湾 long-form 不再显示“联系人城市 / 联系人号码 / 联系人 / Tw Contact Road”等机器翻译或坏 metadata 文案；韩国、越南、英国、法国等非台湾字段仍保持原有 `label_zh` 优先逻辑。 | 继续由 TW-C/TW-03 补齐剩余台湾字段合同与视觉复核；本次未改 submission-service 或自动提交逻辑。 |
| 2026-08-01 | TW-C 继续修复 TW-G10：补齐台湾专属字段中文，避免共享 `passport_number`/`other_passport_number` 等字段污染其他国家；seed 将 `company_name`、`job_title` 改为 required；旧 TW wizard config 同步官网题目；新增 bilingual/前端/seed regression tests。 | TW-G10 主要文案与明确必填差异已落地，focused tests 通过。仍需复核 `occupation_experience` 是否只应退休时强制，以及父/母亲属区标题星号是否代表字段级必填。 | 请 TW-A 用 VIZA long-form 重新做视觉复核；TW-A/TW-03 若能触发官方提交前校验，再确认 `occupation_experience` 与亲属区 required 合同。 |
| 2026-08-01 | TW-A 复核 TW-C 修复：源码合同显示台湾坏翻译已被 TW 专属文案覆盖，`company_name`、`job_title` 已为 required，台湾地址 required/optional/conditional 合同正确；但 VIZA 生产 long-form 带/不带授权测试 applicationId 均只显示 portal 导航，未渲染表单主体，无法完成视觉确认。 | `occupation_experience` 仍未关闭：官网可见证据只明确退休提示，未证实自由业/其他业/无也必填。父/母亲属区进一步定位为 `存歿` 状态字段级 required 风险：官网控件带 `aria-required` 与星号，而 VIZA `kin_father_status` / `kin_mother_status` 仍 optional。 | 交回 TW-C/TW-03 处理或用提交前校验确认 `occupation_experience` 与父/母 `存歿` required 合同；由部署/环境负责人提供可渲染 VIZA long-form 后再做最终视觉复核。 |
| 2026-08-01 | TW-C 处理 TW-A 复核后的剩余字段合同：`kin_father_status`、`kin_mother_status` 改为 required；父/母其他亲属字段保持 optional；`occupation_experience` 从自由业/其他业/无/退休触发收窄为仅退休 `current_occupation === 62` 触发。 | TW-G10 的代码字段合同差异已处理并有 focused tests；未改 submission-service、CAPTCHA、部署、migration 或数据库。 | 请 TW-A 在可渲染 VIZA long-form 环境中重新视觉复核；若官方提交前校验显示更多亲属字段必填，再由 TW-C/TW-03 精确补合同。 |
| 2026-08-01 | TW-A 复核 TW-C 最新字段合同：源码与 focused tests 确认 `kin_father_status` / `kin_mother_status` required、父/母其他字段 optional、`occupation_experience` 仅退休 `current_occupation === 62` 触发且自由业不触发；agent-backend 台湾 schema 8/8、前端台湾/双语合同 16/16 passed。 | TW-G10 字段合同复核通过；仍不能关闭视觉验收，因为 production 与本地当前 long-form 都只显示 portal 导航，`inputCount=0`，未渲染表单主体。 | 转给部署/路由/环境负责人解决 long-form 不渲染；页面可渲染后再由 TW-A 做最终视觉复核。 |
| 2026-08-01 | TW-G 定位 long-form 不渲染表单主体：入口 URL 若携带 HTML 转义后的 `&amp;visaType=TW_ENTRY_PERMIT`，Next `useSearchParams()` 读取到的是 `amp;visaType`，导致 long-form 未拿到显式台湾 `visaType`，转而依赖用户 package/默认流程；本地与 production 都可能只显示 portal 导航且 `inputCount=0`。已在 long-form 参数读取层兼容 `amp;` 前缀，并新增 focused regression test；未访问台湾官网、未部署、未运行 migration。 | 属于 route/query parsing 集成阻断；不是台湾字段合同、官方查询、CAPTCHA、付款或 tracking 问题。代码修复后，本地构建/部署环境应能取到 `country=taiwan` + `visaType=TW_ENTRY_PERMIT` 并加载台湾 DB-driven 表单。 | 发布负责人部署该前端修复后，请 TW-A 用 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` 重新做视觉复核；若 production 未部署最新代码，仍会复现旧行为。 |
| 2026-08-01 | TW-G 继续定位 long-form 不渲染：TW-A 新复核包含 `&amp;amp;visaType` 双重转义 URL，上一轮 helper 只覆盖一层 `amp;`；已扩展为最多 3 层 `amp;` 前缀兼容并补测试。另确认本地 3000 已有 `internal-website` Next dev 进程持有 `.next/dev/lock`，直接无 Cookie 请求 long-form 返回 `307 /client/login`，因此无有效 VIZA session 的视觉复核只能验证 auth proxy，不会进入表单。 | 根因更新为两部分：route query escaping 仍需覆盖双重转义；无登录/旧 dev 进程会造成“只见 portal/login 外壳、0 inputs”的环境阻断。未发现台湾字段合同或 tracking/migration 相关问题。 | 本地请停止现有 Next dev 进程后重启 `npm run dev -- --port 3000`；视觉复核必须使用有效 VIZA client session，并优先使用未 HTML 转义的 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`。production 需要部署本次前端修复后再复核。 |
| 2026-08-01 | TW-G 启动 TW-A 提交入口修复后的本地集成运行：前端 API 已用 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true` 重启，submission-service 已用 `RUNNER_JOB_COUNTRY=taiwan` 且关闭 legacy queue polling 启动，`/ready` 返回 ready，worker active。 | 本地服务层已就绪；当前 shell 未提供真实 `TW_OFFICIAL_LOGIN_*` adapter，worker 启动为 `missing_adapter` fail-closed，但普通台湾邮箱入口不依赖该 adapter。尚未观察到 `/api/applications/{id}/retry-submission` 或 `runner_job(country=taiwan)`。 | 用户重新点击台湾提交/重试按钮后，TW-G 继续观察 retry-submission API、runner_job 入库与 worker 消费；若进入台湾官网，仍不得付款、不得手动处理 CAPTCHA、无官方回执不得标记 submitted。 |
| 2026-08-01 | TW-A 在用户回复“好了”后重新做只读视觉复核：production 与 local 均分别检查 `amp;visaType` 形态和 canonical `&visaType` 形态。四次检查页面均只显示 portal 导航，`input/select/textarea=0`，未渲染台湾表单主体。 | TW-G10 字段合同仍按源码/测试通过，但视觉验收仍未完成；不能确认字段文案/required 的实际页面展示，也不能进入填测试申请或提交入队前检查。 | 继续交给 TW-G/部署/路由/环境负责人处理 long-form 主体不渲染；待页面出现台湾表单控件后再由 TW-A 复核字段文案和 required 标记。 |
| 2026-08-01 | TW-C 并行处理 long-form 空白的前端 layout/gating 分支：确认 session 检查不是永久卡死点，但 `/client` layout 的 pending about-me form request gate 会在显式台湾 long-form 前阻塞 children，导致只显示 portal 导航/加载壳。已让 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`（含 `amp;visaType` 形态）跳过该 form-request gate，并补 focused regression tests。 | 显式台湾 long-form 视觉复核不再被 about-me form request gate 挡住；仍保留登录门禁和 profile/application 加载错误。未改 runner、submission-service、DB、migration、部署、CAPTCHA 或提交逻辑。 | 部署/本地重启包含本前端修复后，请 TW-A 重新复核 canonical 与 `amp;` 两种 URL；若仍 `input/select/textarea=0`，继续查 schema 数据加载、auth/profile 返回或部署版本。 |
| 2026-08-01 | TW-A 并行收口后重新只读视觉复核：local canonical 与多层 `amp;` URL 均已渲染台湾 long-form 第一页，`input/select/textarea=3`，可见 `Delivery Location`、护照资料上传、`所在洲别*`、`受理使领馆/代表处*`；production canonical、多层 `amp;` 和带 applicationId URL 仍只显示 portal 导航且 `input/select/textarea=0`，未跳 `/client/login`。 | local 证明 route params、layout gate 与 DB 数据链路已至少恢复到能显示台湾表单；production 仍未部署最新前端或仍有线上环境阻断。后续字段文案/required 的完整视觉抽查尚未完成，因为只读边界下不点击会 autosave 的 DB form 步骤。 | 部署负责人更新 production 后 TW-A 再复核；若要完整视觉抽查后续字段，需要使用授权测试草稿/测试数据并允许页面步骤导航或先由前端提供不写入的预览模式。 |
| 2026-08-01 | TW-C 修复台湾 long-form required badge 差异：`mainland_id_number` 改为显示时 required、勾选“无大陆身份证号码”后隐藏豁免；前端 normalization 对旧 DB rows 兜底 `mainland_id_number`、`company_name`、`job_title` 三个 TW 字段 required，避免本地/production 数据仍为 `required=false` 时显示普通 `选填`。focused tests 已覆盖 stale DB rows、DynamicStepForm badge 和 validation。 | 台湾第二步中 `大陆身份证号码`、`公司名称及单位全衔或学校名称`、`职称` 不应再显示普通 `选填`；未改 runner、submission-service、DB、migration、部署、CAPTCHA 或提交逻辑。 | 部署/本地重启包含本前端修复后，请 TW-A 用授权测试草稿复核第二步实际 badge；生产数据仍建议后续受控同步 seed 合同，但页面显示已不依赖重新 seed。 |
| 2026-08-01 | TW-C 修复台湾地址与条件 required 展示：新增台湾县市→区/乡/镇/市 mapping（繁体展示，官网县市顺序，含高雄市新興區/前金區/苓雅區/鹽埕區等），`tw_contact_district` 改为依 `tw_contact_city` 联动 select；新增 `required_when` 前端校验用于 `tw_local_phone` 在勾选无手机时变必填；其他国籍护（证）照三字段触发后均 required；父/母 `存殁` 加 TW-only required 兜底，父/母其他亲属字段仍 optional。focused tests 27/27、台湾 schema tests 9/9 通过；agent-backend type-check 通过，internal-website type-check 仍只被无关 Travel 错误阻断。 | 台湾地址不再让区乡镇市自由手填；默认手机必填/市内电话选填，勾选无手机后手机隐藏且市内电话必填；`所具其他国籍为`、`他国护（证）照号码`、`他国护（证）照有效期限` 在触发时不显示普通选填；`父 — 存殁`、`母 — 存殁` 不再因旧 DB rows 显示选填。未改 runner、submission-service、DB、migration、部署、CAPTCHA 或提交逻辑。 | 本地重启/部署包含本前端修复后，请 TW-A 视觉复核地址联动、电话反向必填、其他国籍条件组和父/母存殁 badge；生产数据仍建议后续受控同步 seed 合同，但页面显示已不依赖重新 seed。 |
| 2026-08-01 | TW-A 在用户称“我提交了”后做只读 VIZA 侧状态确认：`6f64272e...6308` 已从 draft 变为 `processing`，`submission_result_status=waiting`，产生 1 条 `submission_queue` row，但该 row 为 `tw_dry_run_pending` / `taiwan_overseas_cn_entry_permit_dry_run` / `dry_run`；`application_documents=3`，已有 `photo`、`mainland_travel_document`、当前资格类别对应的 `eligibility_supporting_document_1`。 | 这不是台湾官网真实提交，也没有 official receipt / 官方编号 / TW result payload。仍发现提交前阻断：`household_revoked` 未保存，且当前条件触发的 `mainland_id_card_scan` 缺失。VIZA 状态页线上仍只显示 portal 导航外壳，无法视觉确认状态主体。 | 先补齐缺字段/缺材料并确认 production long-form/status 页面可渲染；只有 live flag、材料、字段和用户授权都到位后，才能触发真实官网流程。遇到 OTP/CAPTCHA/最终提交前必须停下来确认。 |
| 2026-08-01 | TW-G 继续巡检 long-form：本地 Chrome 登录态下当前台湾 application 会因 `submission_result_status=waiting` 默认打开确认/status step，初始控件数为 0；展开第一组并进入 `Delivery Location` 后已渲染字段页，`input=2`、`select=1`，可见 `所在洲别*`、`受理使领馆/代表处*`、护照上传。production 同 URL 仍只有 portal nav，`h1/h2/input/select/textarea=0`。本轮还补了 layout 最终 render gate，让台湾显式 long-form 在 session 验证通过后不再被 about-me gate 挡住；focused tests 31/31 passed。 | 本地字段页阻断已收敛：0 控件可能是当前申请处于确认/status step，而不是字段合同失败。production 未显示台湾标题/状态卡/字段信号，判断为未部署最新前端或线上旧构建/环境仍在挡；当前机器无 Vercel 登录态，无法直接部署或确认生产构建。 | 发布/Vercel 负责人部署 `internal-website` 当前前端并确认授权测试窗口的 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`；用户补齐 `household_revoked` 与 `mainland_id_card_scan` 后，TW-A 重新做 production 视觉复核，并在字段页而非确认页统计控件。真实 adapter 仍需发布/安全负责人提供批准名称、allow-list 与 module ref，不得伪造。 |
| 2026-08-02 | TW-G 完成 `viza-internal` production 发布：确认既有 Vercel project `viza-internal` / Project ID `prj_GUFPqF0Ir6oWOsxMwX9ezfi3bJ7W` / Root Directory `viza-fe/internal-website`，alias 包含 `app.viza.it.com`；已添加 production env `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`；部署 `dpl_Girf2SGESHv4qpecsh6yUbjTDJD6` Ready 并 aliased 到 `https://app.viza.it.com`。Production DOM 进入 `Delivery Location` 后显示 `中国台湾台湾入境许可证`、`所在洲别*`、`受理使领馆/代表处*`，`input=2`、`select=1`。 | 前端 route/layout gate 阻断关闭，production 已不再只是 portal shell。但 production `visa_form_fields` 仍未完全同步 TW-C 最新 seed：`household_revoked` 缺失；`tw_contact_district` 仍是 text 且缺县市联动规则；`tw_local_phone` 缺反向 required_when；`mainland_id_number`、`company_name`、`job_title`、`kin_father_status`、`kin_mother_status` 在 DB 中仍为 `required=false`（部分可由前端兜底显示，但 seed 仍旧）。 | 交回 TW-A 复核 production 页面主体与 `Delivery Location` 可见性；同时交给 TW-C/DB 发布负责人同步 production 台湾 seed/DB 字段合同，尤其补 `household_revoked` 与地址/电话/父母 required 元数据。同步后再做完整字段视觉验收和真实 smoke 前检查。 |
| 2026-08-02 | TW-C 已按 Supabase 安全边界只读核对 production `visa_form_fields`，确认 `TW_ENTRY_PERMIT` 当前 91 rows，核心旧元数据仍存在：`household_revoked` 缺失、`tw_contact_district` 为 text、`tw_local_phone` 缺反向 required、`mainland_id_number`/`company_name`/`job_title`/`kin_father_status`/`kin_mother_status` 为 `required=false`，`occupation_experience` 仍是旧多职业触发。已新增 `0124_tw_entry_permit_form_fields_metadata_sync.sql`，用 `ON CONFLICT (visa_type, field_name)` 幂等 upsert 28 个台湾字段元数据；测试锁定无 `DELETE FROM`、不碰 answers/documents/document_requirements、只含 `TW_ENTRY_PERMIT`。 | 生产写入尚未执行；这是待授权的受控同步包。focused tests 通过：后端台湾 schema 10/10、前端台湾 focused 28/28、agent-backend type-check 通过；internal-website type-check 仍被无关 Travel 错误阻断。 | 主协调授权后，由受控 DB 发布负责人执行 `0124` 并保存执行前 snapshot、执行后验证 SQL；随后 TW-A 重新做 production long-form 视觉复核。 |
| 2026-08-03 | 用户明确批准执行 `0124` production 同步后，TW-C 在 `viza-production` / `oyjxdzsoejraedqghndi` 先做只读预检：`TW_ENTRY_PERMIT` 字段元数据为 91 rows，目标字段状态匹配预期旧状态；随后执行 `viza-be/agent-backend/drizzle/0124_tw_entry_permit_form_fields_metadata_sync.sql`。执行返回 `tw_entry_permit_form_fields_metadata_rows_upserted=28`。 | Production 写入成功且验证全部通过：`TW_ENTRY_PERMIT` 总行数变为 92；`household_revoked` 已新增为 required radio；`tw_contact_district` 已为 select 且带 `taiwan_districts_by_city`；`tw_local_phone` 已带无手机时 required 的 `required_when`；`mainland_id_number`、`company_name`、`job_title`、`kin_father_status`、`kin_mother_status` 均为 required；`occupation_experience` 已收窄为退休 `current_occupation === 62` 触发。未读取申请答案/材料/密钥/OTP/Cookie，未部署、未提交官网、未处理 CAPTCHA、未付款。 | 请 TW-A 重新做 production long-form 视觉复核，重点确认 `household_revoked`、地址联动、电话反向必填、第二步 required badge、父/母存殁 required 和退休经历触发的真实渲染。 |
| 2026-08-05 | TW-G 将台湾测试路径收口到 France/Vietnam 风格正式 runner：`fillTwEntryPermitApplication` 增加默认关闭的 `stopBeforeFinalSubmit`，拆分最终 CAPTCHA solve/fill 与 `確認資料` 点击，新增 typed checkpoint 和脱敏 contract fixture；无 job CLI 复用 `runTwHalt` 的 load/normalize/docs/generated alias 准备逻辑。正式 no-job pre-submit E2E 已通过：entry、email OTP、terms/photo/delivery、77 个字段/控件、3 个材料、final CAPTCHA solve/fill 全部完成，状态 `ready_to_submit`，checkpoint `captcha_boundary`。 | 修复了 pre-submit 发现的三个正式链问题：`/apply` 页面 CAPTCHA 控件存在导致过早停、台湾城市 code 到官网 label 的 select fallback、kinship indexed controls scope 过窄。未创建 runner_job，未写 production submission result，未点击官方最终 `確認資料`，未取得回执，未付款。focused tests 64/64、scoped typecheck、`git diff --check` 均通过。 | 代码/E2E 侧可进入下一步：主协调若要真实最终提交，需明确授权创建且仅创建 1 条新的台湾 runner_job，并允许该 job 写 production 运行状态/官方回执；付款仍需单独禁止/确认。 |
| 2026-08-05 | 按用户要求改为英国式申请人最终确认：台湾正式 runner 填写、上传、校验并解 final CAPTCHA 后，保留同一 Browserbase 会话，写入短时 applicant handoff；VIZA 结果卡显示“打开已填写的台湾官网”，仅申请本人可经 authenticated API 取得 Live View，用户亲自点击官网 `確認資料`。runner 同时监听该会话，只有捕获官方回执才写 `submitted`。 | 本地实现完成；submission-service typecheck、后台 focused 27/27、前端 focused 9/9、`git diff --check` 通过。未执行 `0129_tw_applicant_live_handoff.sql`，未部署，未改 production env，未创建 runner_job，未访问官网或最终提交。全量前端 typecheck 仍仅有既存 PH eTravel/Travel/Playwright 错误。 | 上线前需单独批准并执行 0129 migration、配置台湾 Browserbase handoff env、部署前后端；之后仅创建一条批准的台湾 runner_job 做真实交接 smoke，用户在 Live View 亲自最终提交。 |
| 2026-08-03 | TW-A 回报 production long-form 视觉复核通过后，TW-G 做下一阶段只读 readiness：测试 application `6f64272e-1af6-4a48-8525-fcabc5276308` 仍未保存 `household_revoked`，且 `mainland_id_card_scan` 不存在；当前条件扫描还列出一组缺字段 key（见 TW-G worklog），未输出个人答案或材料内容。`runner_job` 表只读可访问且当前无 Taiwan jobs。 | `READY_FOR_SAFE_RUNNER_JOB_SMOKE` 仍 BLOCKED：本机 `/ready` 不可达，未见 submission-service 监听；`RUNNER_JOB_COUNTRY=taiwan` 与 `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false` 无法在运行进程中验证；可见 `TW_OFFICIAL_LOGIN_ADAPTER` / allow-list / module 均未配置，adapter 未 approved/loaded，fail-closed。未创建 runner_job、未触发 retry、未访问台湾官网、未处理 OTP/CAPTCHA、未付款、未部署、未写 DB。 | 用户/申请负责人补齐 `household_revoked` 与 `mainland_id_card_scan` 并复核剩余缺字段 key；部署/runtime 负责人启动 submission-service 并证明 `/ready`、`RUNNER_JOB_COUNTRY=taiwan`、legacy queue disabled；安全/runtime 负责人提供经批准的 Taiwan official-login adapter 配置后，再交回 TW-G 做只读 readiness 复核。 |
| 2026-08-03 | TW-C 新增“申请完整性与缺失材料导航”：新增 `GET /api/applications/{id}/completeness`，用真实 `visa_form_fields` 条件逻辑与 `document_requirements` 生成安全缺失清单；确认页显示“还缺 X 项信息、Y 份材料”，可一键跳到 long-form 字段或 Documents 上传卡；台湾 `retry-submission` 在 `insertTaiwanRunnerJob` 前重查完整性，不完整时返回 `422 application_incomplete`。 | focused tests 29/29 passed。覆盖条件字段未触发不列出、触发为空列出、`mainland_id_card_scan` 材料导航、补齐后清单清零、有缺失项不创建台湾 `runner_job`、非台湾通用材料规则不受影响。internal-website type-check 仍被既有无关 Travel/Playwright 错误阻断；本次未部署、未写 DB、未创建 runner_job、未进入台湾官网、未处理 OTP/CAPTCHA、未付款。 | TW-G/发布负责人部署 `internal-website` 当前前端后，请 TW-A 用 production 测试申请 `6f64272e-1af6-4a48-8525-fcabc5276308` 视觉复核 `household_revoked` 与 `mainland_id_card_scan` 的缺失清单和导航；清单清零前不得启动真实 runner smoke。 |
| 2026-08-03 | TW-A 官网只读核对确认 `householdRevoked` 只在 `traveller.applyQualification=5` 且 `overseaOfficeId=50/51` 时显示；TW-C 已修复 VIZA 合同为 `eligibility_category=2 && embassy_office in [50,51]` 才显示/必填，并同步 seed、旧 TW wizard config、动态表单/完整性测试、runner normalize/apply。已准备 `0125_tw_household_revoked_conditional_metadata.sql`，但未执行 production 写入。 | 当前新加坡递送地 + 留学生测试申请不应再因缺 `household_revoked` 被阻断；`mainland_id_card_scan` 等其他缺失仍需独立处理。focused tests 通过：internal-website 台湾相关 45/45、agent-backend 台湾 schema 11/11、submission-service Taiwan normalize 11/11；agent-backend/submission-service type-check 通过，internal-website type-check 仍只被既有 Travel/Playwright 错误阻断。未部署、未创建 runner_job、未进入台湾官网、未处理 OTP/CAPTCHA、未付款。 | 需要用户再次明确批准后，才可由受控 DB 发布负责人执行 `0125` production metadata correction；执行后请 TW-A/TW-G 重新只读确认测试申请完整性清单不再包含 `household_revoked`，再继续 runner readiness。 |
| 2026-08-03 | TW-C 根据用户提供的资格 4 官网附件截图，将 `TW_ENTRY_PERMIT` Documents 合同准备为截图口径：资格 4 红星材料 `mainland_travel_document`、`eligibility_supporting_document_4`、`mainland_id_card_scan` 为必需材料；同表非红星材料 `hk_macau_id_scan`、`other_nationality_passport_scan`、`other_supporting_document` 进入独立“情形适用材料”，不再混入泛化“可选补充材料”。已准备 `0126_tw_eligibility_4_document_requirements.sql`，但未执行 production 写入。 | 前端 Documents/完整性检查/runner 前材料守门已按资格 4 同步；focused tests 通过：internal-website Documents+completeness 14/14，agent-backend 资格 4 SQL/runner material focused 2/2，submission-service normalize 11/11，submission-service type-check 通过。internal-website type-check 仍被既有 Travel/Playwright 错误阻断；agent-backend 全文件 schema test 仍有既有受理单位 option 期望过旧阻断。未部署、未写 production DB、未创建 runner_job、未进入台湾官网、未处理 OTP/CAPTCHA、未付款。 | 需主协调/用户另行授权后才可执行 `0126` production metadata sync；执行后请 TW-A 做 production Documents 视觉复核，重点确认资格 4 三个红星材料在必需材料、三个非红星材料在情形适用材料。另需确认“旅居香港/澳门”是否可安全等同 `embassy_office=50/51`，以及日本住民票是否需要新增触发字段。 |
| 2026-08-05 | TW-G 完成 applicant live-handoff production rollout：执行 `0129` 并验证新栏位/索引；部署 Fly `viza-runner-taiwan`，`/health`、`/ready`、数据库、Taiwan country scope、legacy disabled、consumer、Browserbase/2Captcha 均 ready；部署 Vercel `dpl_5vUYZMSyYm8af9ZAtraGB8K6jPzf` 并 alias 到 `app.viza.it.com`，生产 handoff API 未登录返回预期 401。readiness 通过后经 canonical enqueue 创建恰好 1 条 `maxAttempts=1` Taiwan job。 | 唯一 job 被正式 runner 消费后在 `terms` checkpoint fail closed：官网条款 checkbox 点击后未变为 checked。终态 failed 1/1、lease cleared、Taiwan active jobs=0、handoff=0、无 official receipt、未标记 TW submitted。未点击官网最终 `確認資料`，未付款，未创建第二 job/retry。 | 交回 Taiwan runner 负责人针对当前官网条款 checkbox DOM 做脱敏诊断、最小修复与 focused regression；任何新的真实 job 必须重新取得明确授权。 |
| 2026-08-05 | TW-G 根据 production 失败证据确认官网条款为 `<input id="confirm" type="checkbox">`，旧 `locator.check(force)` 点击后 checked 仍为 false。正式 `terms-modal.ts` 已增加 native input、关联/包裹 label、DOM click 与 input/change 同步的有限恢复链；每次都重新读取并要求 checked 稳定，失败时绝不点击底部 `確定`。terms tests 12/12、Taiwan focused 87/87、typecheck/build 通过；修复已部署到现有 Fly Taiwan worker，两台机器与 `/ready` 全绿。 | 新授权的唯一 `maxAttempts=1` job 已通过 terms 并到达 applicant live handoff：`needs_user_action` / `stopped_at_captcha`，handoff queued，同一 Browserbase session 等待申请人；当前仍无 official receipt、未标记 TW submitted。助手未点击官网最终 `確認資料`，未付款，也未创建额外 job/retry。 | 申请人应在 `app.viza.it.com` 的台湾申请结果页点击“打开已填写的台湾官网”，并由本人点击官网最终 `確認資料`；交接有效至 2026-08-05 20:26（新加坡时间）。runner 仅在捕获官方回执后写 submitted。 |
| 2026-08-06 | TW-G 在 production completeness、正式 normalization（140 answers）、3/3 材料、关键台湾映射、active jobs/handoffs=0 全部通过后，通过 canonical `enqueueRunnerJob` 创建唯一 `maxAttempts=1` Taiwan job（脱敏 `17a6c0e0...`）。 | 正式 runner 已完成自动 OTP/CAPTCHA、全部字段与材料、官网 validation gate，并于 22:30:58 SGT 到达 applicant handoff、停在最终确认前。交接在 22:59:39 到期且无官方回执，job 随后 fail-closed 为 failed 1/1；lease cleared、handoff abandoned、active jobs/handoffs=0、未标记 submitted、未付款。 | 本轮禁止 retry/第二 job，已停止。若以后需要新的 applicant handoff，必须创建一条新的单次 job；不得复用本次已过期 Browserbase session。 |
| 2026-08-07 | TW-G 再次通过 production completeness、正式 preparation、3/3 材料及 active jobs/handoffs=0 门禁后，经 canonical helper 创建唯一 `maxAttempts=1` Taiwan job（脱敏 `27533349...`）。 | 正式 worker 已到达 `applicant_handoff_before_final_confirmation`；handoff `queued`，application result `stopped_at_captcha`，有效至 2026-08-07 11:11:27 SGT。无 official receipt、未 submitted、未付款。 | 申请人立即在 `app.viza.it.com` 台湾申请结果/状态页点击“打开已填写的台湾官网”，亲自检查并执行官网最终确认；助手不代点。 |
