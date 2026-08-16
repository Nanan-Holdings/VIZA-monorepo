# PH-D Worklog：前端、队列、QR 结果与发布门禁

> 第一轮状态：已完成审计，2026-08-01（Asia/Singapore）。此文件仅 PH-D 可更新。

## 审计范围与读取材料

- 协调与边界：`AGENTS.md`、`docs/AGENTS.md`、`docs/philippines-launch-coordination.md`、`docs/philippines-launch-worklogs/PH-A.md`、`PH-B.md`、`PH-C.md`、本文件初始版。
- 适用子目录规则：`viza-fe/internal-website/app/client/arrival-cards/AGENTS.md`、`viza-fe/internal-website/features/ph-etravel/AGENTS.md`、`viza-fe/internal-website/app/client/application/AGENTS.md`、`viza-fe/internal-website/app/api/applications/AGENTS.md`、`viza-fe/internal-website/app/api/submissions/AGENTS.md`、`viza-fe/internal-website/app/actions/AGENTS.md`、`viza-fe/internal-website/components/application-steps/AGENTS.md`。
- 前端入口/表单/状态：`app/client/arrival-cards/philippines/page.tsx`、`app/client/application/long-form/page.tsx`、`features/ph-etravel/date-window.ts`、`lib/submission-queue.ts`、`lib/submission-result.ts`、`lib/application-submission-display.ts`。
- 队列与结果 API：`app/api/applications/[id]/retry-submission/route.ts`、`cancel-submission/route.ts`、`submission-status/route.ts`、`submission-artifact/route.ts`、`arrival-card-new-application/route.ts`、`features/arrival-cards/server/create-new-application.ts`。
- 结果 UI：`app/client/application/_components/result-cards/SubmissionStatusStep.tsx`、`WaitingCard.tsx`、`FailureCard.tsx`。
- 只读参考的 schema 字段：`viza-be/agent-backend/scripts/ph-etravel/form-fields.ts`。
- 本轮未浏览或触发菲律宾官网；官方事实沿用协调文档记录的 `https://etravel.gov.ph` FAQ/资料政策。

## 已验证事实

1. 菲律宾 arrival 入口只有 redirect：`/client/arrival-cards/philippines` 直接跳到 `/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true`。没有独立 landing、资格问卷或特殊身份分流。
2. PH eTravel 被 `isDigitalArrivalCardApplication()` 和 `submitModeForPrimaryApplicationAction()` 归入默认 `live_assisted`；前端开关 `NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED !== "false"`，API 开关 `PH_ETRAVEL_LIVE_SUBMISSION_ENABLED !== "false" && NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED !== "false"`，均为默认开启语义。
3. 72 小时逻辑存在：`evaluatePhEtravelSubmissionWindow()` 用 arrival date - 3 天作为 earliest date；`retry-submission` 对 PH 读取 `flight_arrival_date` / `flight_departure_date`，arrival 用抵达日，departure 分支也在同函数里但本轮不审计。
4. 提交入口会先 `saveAllDynamicDrafts()`，再检查 required field，调用 `/api/applications/{id}/retry-submission` 进行 server enqueue；页面可乐观进入 status step，刷新/重开由 `submission-status` 读取 durable application/queue 状态，不会因为轮询本身重新入队。
5. retry enqueue 使用 `enqueue_submission_retry` RPC，返回 `reused_existing` / `superseded_count`，这是首次 submit 和失败 retry 的主要去重/复用机制。是否 DB 约束完全防并发，需要主协调者/DB owner 提供 RPC 定义与事务证据。
6. cancel 只允许 pending/scheduled 类状态，PH 包括 `phetravel_live_assisted_scheduled`、`phetravel_live_assisted_pending`、`phetravel_dry_run_pending`；processing 后返回 409，不会取消已被 worker 领取的任务。
7. 状态接口能返回 `scheduled`、`queued`、`running`、`needs_user_action`、`failed`、`stalled`、`completed`，并带 queue id/current_stage/error/result。刷新/重开应能恢复状态页。
8. PH result 复用 `DigitalArrivalCardResultCard`。它显示 reference、QR artifact、官方截图 artifact、官方入口、重新申请按钮；artifact 下载通过 `submission-artifact` 做登录/owner 校验并校验 path 包含 applicationId。
9. 重新申请会创建新 application，只复制稳定身份/护照/联系方式等答案；不复制行程、住宿、健康、海关、官方 reference/QR，符合 arrival-card 重复提交边界。
10. 失败 UI `FailureCard` 会显示通用错误和 retry；但 fallback 分支仍可能直接 `<pre>` 展示 `errorMessage`，仅对部分浏览器启动错误做文案清洗。PH 的官方原始错误、provider/current_stage、内部 code 是否被脱敏，当前前端不能保证。
11. Review 停止/stop-before-submit 如果以 `stopped_at_review` / `action_required` 写入，前端会进入 `needs_user_action` 或通用 result/failure 分支；但 PH 没有专属“已到官网 Review，未最终提交”的文案，用户可能误解为普通失败或人工动作。
12. 当前用户文案未完整满足三件事：eTravel 免费、不是签证、不保证菲律宾边检准入。入口页无文案；最终确认只说会创建真实官网提交任务；成功页只说官网确认提交和保存截图。
13. scheduled 默认文案仍硬编码 SG/ICA：`WaitingCard` 和 `submission-status` fallback 会说 “SG Arrival Card / ICA”。PH scheduled result 自带 summary 时可能覆盖，但无 message 或 queue fallback 时会误导用户。
14. 成功判定不严格依赖 official reference + 独立 QR。`DigitalArrivalCardResultCard` 对 PH 的 `successful = result.submitted && status === "submitted"`；如果没有 QR，仍显示“eTravel 提交成功”。现有测试还显式固定“PH reference + screenshot、qrCodes=[] 即成功”。
15. `isDigitalArrivalCardResult()` 接受 `PH_ETRAVEL_DEPARTURE_CARD`，结果卡和 retry/cancel 均混入 departure；本轮 arrival-only 发布需要在 UI/测试中隔离，避免 departure 证据被误当 arrival。

## 用户状态矩阵

| 状态/场景                               | 当前用户体验                                                                                                       | 当前重复入队/重复提交风险                                     | 结论                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------- |
| 入口                                    | 直接进 long-form，未先说明免费/非签证/不保证入境，未分流机组/外交/9(e)/official passport                           | 无入队                                                        | P0 文案与 eligibility 缺口               |
| 动态表单                                | 读取 DB fields，包含旅客、航程、转机、住宿、健康、行李、海关、货币/声明等字段；条件显示由 shared dynamic form 处理 | 保存草稿不入队                                                | 字段 parity 交给 PH-B/PH-A；前端路径存在 |
| 提前填写，超过 72 小时                  | retry API 生成 scheduled result + scheduled queue                                                                  | active scheduled 可被 RPC 复用/取消；需 RPC 事务证据          | 逻辑存在，PH 文案不稳                    |
| 点击提交                                | 默认 live_assisted，乐观进入状态页；worker 未接会显示 queued/running                                               | 前端按钮 loading 可防双击；真正并发依赖 RPC                   | 需 DB/RPC 幂等门禁                       |
| 页面刷新/重开                           | `submission-status` 读 application + 最新 queue，不会重新 post retry                                               | 轮询不入队                                                    | 基本通过                                 |
| scheduled cancel                        | 可取消 PH scheduled/pending，应用回 draft                                                                          | processing 后不能取消                                         | 基本通过，需 PH 文案                     |
| processing                              | WaitingCard 三阶段进度，显示 current_stage/message                                                                 | 不重新入队                                                    | 可用，但阶段文案通用                     |
| action-required / Review stop           | 通用 needs_user_action/FailureCard，PH 无专属 Review 停止解释                                                      | retry 可重新入队，可能触发新官方记录，取决于 runner 幂等      | P1                                       |
| failed                                  | FailureCard 显示错误和“提交” retry                                                                                 | RPC supersede/insert；需事务证据                              | P1，错误脱敏不足                         |
| submitted + reference + QR              | 显示 reference、QR、下载 QR、官方入口、重新申请                                                                    | 已完成时 retry API `alreadySubmitted` 阻止同 application 重试 | 可作为目标成功态                         |
| submitted + reference/screenshot、无 QR | 当前仍显示成功，截图可能作为确认图                                                                                 | 用户可能登机前缺 QR；也可能掩盖 runner artifact 缺失          | P0                                       |
| QR/artifact recovery                    | 重开页可用 stored artifact path 经 authenticated API 下载                                                          | 不入队                                                        | 基本可用                                 |
| 重新申请                                | 新建 application，只复制稳定资料                                                                                   | 新 application 可合法新队列                                   | 基本通过                                 |

## Desktop/Mobile 验收矩阵

| 验收项                 | Desktop                                       | Mobile                  | 当前证据/缺口                        |
| ---------------------- | --------------------------------------------- | ----------------------- | ------------------------------------ |
| PH arrival 入口首屏    | 未验证浏览器；代码仅 redirect                 | 未验证浏览器            | 缺 Playwright smoke                  |
| 动态表单条件显示       | 未跑 UI；字段条件存在                         | 未跑 UI                 | 需 PH-B/PH-D 第二轮补 desktop/mobile |
| 最终确认按钮与禁用状态 | 代码可根据 env/required 禁用                  | 未视觉验证              | 默认 live 开启是门禁问题             |
| scheduled 等待卡       | UI 有取消按钮                                 | responsive grid 通用    | 文案 SG/ICA 风险                     |
| processing 进度        | 三阶段通用                                    | `sm:grid-cols-3` 可堆叠 | 未截图验证                           |
| success QR/reference   | QR 固定 36x36 rem 视图，按钮 `sm:grid-cols-2` | 理论可堆叠              | PH 无 QR 仍成功，需先修              |
| failed/retry           | 通用卡可堆叠                                  | 表单控件通用            | PH 错误脱敏/专属文案缺               |

## P0 缺口

1. **PH 成功门槛错误**：PH 无独立 QR 仍可显示成功；不满足“official reference + QR 同时存在才成功”。当前测试 `renders a stored Philippines success... qrCodes: []` 还把该行为固定下来。第二轮必须改 `DigitalArrivalCardResultCard` / `SubmissionStatusStep` 判定，并增加 PH 缺 reference 或缺 QR 均 failed/awaiting-recovery 的测试。
2. **发布开关默认开启冲突**：前端/API `PH_ETRAVEL_LIVE_SUBMISSION_ENABLED` 默认 true，而协调文档指出 worker `PH_ETRAVEL_STOP_BEFORE_SUBMIT` 默认停止，live job 可能到 Review 后以失败结束。发布前必须改成 fail-closed 或建立单一语义开关。
3. **入口缺 eligibility 分流和法定边界文案**：普通旅客、机组、外交/official/service passport、9(e) 等特殊身份无前置分流；用户未被明确告知 eTravel 免费、不是签证、不保证边检准入。
4. **scheduled/status fallback 错国家**：PH scheduled 可能显示 SG/ICA 文案，不可发布。

## P1 缺口

1. **Review stop/action-required 无 PH 专属真实呈现**：如果 runner 停在 Review 或 CAPTCHA/OTP/Turnstile/account checkpoint，前端只是通用等待/失败/人工动作，不能清楚说明“未最终提交/需 VIZA 处理/需重新申请”。
2. **错误脱敏不完整**：`FailureCard` 对未知错误直接 `<pre>` 输出，PH official/provider/stack/PII 脱敏依赖上游，前端没有 allowlisted user message。
3. **幂等证据不完整**：前端使用 RPC 是正确方向，但本轮未读取 DB function/migration；不能证明并发双击、两设备 retry、worker 重领不会重复官方提交。
4. **departure 混入 arrival UI 类型**：结果卡、retry/cancel helper 接受 `PH_ETRAVEL_DEPARTURE_CARD`；arrival-only 发布证据需隔离，避免误测/误发布。
5. **PH retry 文案过于泛化**：failed 后按钮只叫“提交”，没有解释是否会恢复 QR、重新抓取 reference，还是新官方提交。

## P2 缺口

1. `ACTIVE_SUBMISSION_QUEUE_STATUSES` 内有重复 `tdac_dry_run_pending`，非 PH 阻断但说明共享清单需要整理。
2. PH success 页说“保存下方官方确认页截图；如果本次记录包含独立 QR...”会弱化 QR 必需性，需改为 QR 优先且缺 QR 不成功。
3. `startAgain` 文案是“再次提交”，建议改成“为下一次入境创建新 eTravel”，降低在同一趟行程重复官方记录的误解。
4. 当前未建立监控面板链接或前端 runbook；只能从 queue/status API 推断。

## 发布门禁矩阵

| 门禁                   | 必须满足                                                                            | 当前状态             |
| ---------------------- | ----------------------------------------------------------------------------------- | -------------------- |
| Live 开关              | 前端/API/worker 单一 fail-closed 语义；stop-before-submit 不能被 UI 表述为成功      | 未通过               |
| 成功标准               | PH arrival 必须 referenceNumber/confirmationNumber + 独立 QR artifact；截图只能辅助 | 未通过               |
| 免费/非签证/不保证入境 | 入口、最终确认、成功页至少各一次清楚文案                                            | 未通过               |
| Eligibility            | 普通旅客支持；特殊身份分流或阻断，不误填                                            | 未通过，等 PH-A      |
| 72 小时                | 超窗 scheduled，窗口内 pending；past date reject；文案菲律宾化                      | 部分通过             |
| Idempotency            | RPC/DB 事务证明 active job 复用、completed 不重试、worker 不二次官方提交            | 部分通过，等 DB/PH-C |
| QR recovery            | 重开/刷新可下载 QR；缺 QR 进入 recovery/failed，不成功                              | 部分通过             |
| 错误安全               | 用户只见 allowlisted message，不见 provider/stack/raw official/PII                  | 未通过               |
| Desktop/mobile         | 入口、form、scheduled、processing、failed、success QR 截图验证                      | 未通过               |
| 监控/回滚              | queue 状态、OTP/CAPTCHA/Review/QR 捕获率监控；关闭 live 后保留提前填写              | 未通过               |

## 第二轮 frontend/release 修改路径（不实施）

1. `app/client/arrival-cards/philippines/page.tsx`：改为轻量 eligibility/边界入口或在跳转前进入 PH 专属说明页；至少覆盖免费、非签证、不保证入境、特殊身份分流。
2. `app/client/application/long-form/page.tsx`：PH final confirmation 文案加入免费/非签证/不保证入境；`PH_ETRAVEL_LIVE_ASSISTED_ENABLED` 改为显式 `"true"` 才启用，或接入主协调者定义的统一发布变量。
3. `app/api/applications/[id]/retry-submission/route.ts`：PH live retry env 改 fail-closed；scheduled result 带 applicant-safe PH 文案；arrival-only 下拒绝 departure 或明确隔离。
4. `app/api/applications/[id]/submission-status/route.ts` 与 `WaitingCard.tsx`：按 country/visaType 生成 scheduled/running fallback 文案，移除 PH 下 SG/ICA 文案。
5. `SubmissionStatusStep.tsx` / `DigitalArrivalCardResultCard`：新增 PH `hasOfficialReference && hasQrArtifact` 成功门槛；缺 QR/reference 时显示 recovery/failed/action-required，不显示 ShieldCheck；截图可下载但不得替代 QR。
6. `FailureCard.tsx` 或 PH 专属 result card：对 PH error code 做 allowlist 映射，隐藏 raw official/internal 细节。
7. `app/client/application/_components/result-cards/__tests__/DigitalArrivalCardResultCard.test.tsx` 与 `app/api/applications/[id]/submission-status/route.test.ts`：改掉“PH 无 QR 成功”测试，新增缺 QR、缺 reference、scheduled PH 文案、completed alreadySubmitted、cancel pending、processing 不可 cancel 的覆盖。

## 第二轮测试清单（不实施）

- Unit：`features/ph-etravel/__tests__/date-window.test.ts`、PH result card success/missing-QR/missing-reference、PH scheduled status fallback、retry/cancel API mocks。
- API：`retry-submission` PH arrival open/scheduled/past/invalid dates；env disabled 403；completed application returns `alreadySubmitted`；concurrent retry RPC mock returns reused job。
- UI desktop/mobile Playwright：入口 eligibility、long-form required/conditional fields、final confirmation disclaimer、scheduled cancel、processing refresh、failed retry、success QR download、reopen recovery。
- Regression：确保 SG/MY/TH/VN arrival result cards仍通过；台湾正在修改的 shared files 合并后重跑相关 shared result-card tests。

## 测试结果

- 命令：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts app/client/application/_components/result-cards/__tests__/DigitalArrivalCardResultCard.test.tsx 'app/api/applications/[id]/submission-status/route.test.ts' --testTimeout=15000`
- 通过：PH date-window 3/3；PH option-labels 3/3；submission-status route 9/9。
- 失败：DigitalArrivalCardResultCard suite 11 个中 4 个失败，错误为 React “Rendered fewer hooks than expected”；同 suite 中 PH 专项测试通过但验证的是 `qrCodes: []` 仍显示成功，这是本审计标记的 P0 行为缺口。
- 未运行：官方流程、部署、migration、seed、Playwright desktop/mobile、真实 Browserbase/OTP/Turnstile/QR 捕获。

## 接口请求

1. PH-A：确认特殊身份（机组、外交/official/service passport、9(e)、其他豁免）官方路径与前端应分流文案。
2. PH-B：确认 schema 是否应加入显式 eligibility/特殊身份字段，及 PH arrival 是否官方要求 profile photo/customs signature。
3. PH-C：确认 runner 成功写入合同是否保证 reference + 独立 QR；确认 Review stop、QR recovery、重复 worker 领取和 known reference recovery 的状态写法。
4. 主协调者/DB owner：提供 `enqueue_submission_retry` RPC 的事务/唯一性定义，确认 active/scheduled/pending/processing/completed 幂等边界。
5. Release owner：定义 PH_ETRAVEL live/stop-before-submit 单一开关、生产默认值、监控指标和一键回滚步骤。

## 剩余不确定性

- 未获取当前菲律宾官网页面的实时字段/特殊身份证据；不对官方 parity 下结论。
- 未证明 worker 最终提交幂等；本文件只审计前端/API 可见行为。
- 当前工作区有大量台湾并行修改和 shared frontend dirty 文件，本轮全部只读；第二轮 PH-D 必须在主协调者解冻后重新检查 `git status --short`。

## 第二轮：无冲突 frontend P0 修复

> 第二轮状态：已完成 PH-D 可写范围内修复与离线验证，2026-08-01（Asia/Singapore）。未部署、未收费、未触发菲律宾官网真实流程。

### 重新读取与边界确认

- 已重新读取 `docs/philippines-launch-coordination.md` 第 10-13 节、全部 PH worklog、PH-A canonical contract `docs/philippines-etravel-arrival-field-contract.md`、当前 `git status --short`。
- 适用 AGENTS 已复核：根目录、`docs/`、`viza-fe/`、`viza-fe/internal-website/`、`app/client/`、`app/client/application/`、`app/client/arrival-cards/`、`features/ph-etravel/`、`app/api/applications/`。
- 工作区仍有台湾和共享 frontend dirty 文件；本轮未修改禁止文件，未修改 runner/schema/package 文件。

### 本轮改动

- `app/client/arrival-cards/philippines/page.tsx`：从直接 redirect 改为 PH 专属 eligibility 入口。
- `features/ph-etravel/eligibility.ts`：新增普通 AIR/SEA passenger 支持判断；crew、cruise、special registration、foreign diplomat/dignitary、9(e)、diplomatic/official/service passport 均分流为 unsupported；集中维护官方入口 URL 和免费/非签证/不保证准入文案。
- `features/ph-etravel/PhilippinesArrivalEligibilityPage.tsx`：新增中英 eligibility 选择页；普通旅客进入 `PH_ETRAVEL_ARRIVAL_CARD` long-form，unsupported 身份引导官方 eTravel；首屏明确展示 eTravel 免费、不是签证、不保证菲律宾边检准入。
- `features/ph-etravel/status.ts`：新增 PH live fail-closed helper、72 小时 scheduled applicant-safe 文案、用户状态文案、错误 allowlist/sanitizer、刷新不重复入队契约。
- `app/client/application/long-form/page.tsx`：仅 PH live 开关改为 `NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED === "true"` 才启用；PH final confirmation 文案加入免费/非签证/不保证准入；PH live warning 明确刷新/重开只查状态、不创建新的官网任务。
- `app/api/applications/[id]/retry-submission/route.ts`：仅 PH eTravel live 判断改为 server+client env 都显式 `"true"` 才允许；PH scheduled result 使用 PH 专属 72 小时文案；PH live disabled 返回 allowlisted applicant-safe error。
- 新增/扩展 PH 定向测试：eligibility、入口页文案和 cruise 分流、live disabled/enabled、scheduled copy、past date、错误脱敏、刷新不重复入队契约。

### 第二轮用户状态矩阵

| 状态/场景                  | 第二轮后行为                                                                                                                           | 重复入队/重复官方提交判断                                  | 剩余缺口                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| 入口                       | 先进入 PH eligibility 页；普通 AIR/SEA passenger 可继续；crew/cruise/special/diplomat/9(e)/diplomatic/official/service passport 被分流 | 无入队                                                     | 需后续接 schema/runner guard，防深链绕过                        |
| 免费/非签证/不保证准入     | 入口页与 PH final confirmation 已展示；scheduled helper 也包含                                                                         | 无入队                                                     | 成功 result card 文案仍在共享冻结项                             |
| live disabled              | 前端/API 均 fail-closed，只有相关 PH env 明确 `"true"` 才允许 live enqueue                                                             | disabled 时 API 403，不入队                                | 需 release owner 确认生产 env 与 worker stop-before-submit 语义 |
| 提前填写 >72h              | API scheduled result 使用 PH eTravel 72h 文案，无 SG/ICA                                                                               | scheduled queue 仍依赖 RPC 复用                            | shared WaitingCard fallback 仍冻结未改                          |
| past date                  | PH date-window 返回 `past`，错误 allowlist 给 applicant-safe 文案                                                                      | 不应入队                                                   | API route 已有 reject；需 route-level mock 测试后续补           |
| queued/processing          | PH status helper 定义 queued/processing/action_required/failed/submitted/qr_recovery 文案                                              | 状态轮询 helper 明确不创建 queue                           | 共享结果卡/状态卡尚未接入 helper                                |
| 刷新/重开                  | PH final warning 和 helper 明确 status polling 不创建新官网任务                                                                        | 页面刷新不 POST retry；retry endpoint 才创建/复用 job      | DB/RPC 幂等证据仍等 owner                                       |
| failed/retry               | PH error sanitizer/allowlist 已建立，API live-disabled 使用它                                                                          | retry endpoint 可创建/复用 job                             | FailureCard 仍共享冻结，未接入 PH sanitizer                     |
| submitted + reference + QR | 目标成功态仍要求 reference + QR                                                                                                        | completed application 仍由既有 API 阻止同 application 重试 | 共享 result card 尚未修“无 QR 成功”                             |
| submitted 缺 QR/reference  | 本轮不改共享 result card，仍为冻结 P0                                                                                                  | 可能误导用户                                               | integration request 已保留                                      |

### 第二轮 P0/P1/P2 缺口

| 优先级 | 缺口                                    | 第二轮状态                                                               |
| ------ | --------------------------------------- | ------------------------------------------------------------------------ |
| P0     | PH live 默认开启冲突                    | 已在 frontend/API 可写范围内改为 fail-closed；待 release/worker env 统一 |
| P0     | 入口无 eligibility/边界文案             | 已修：新增 PH eligibility 页和中英边界文案                               |
| P0     | PH scheduled fallback 可能 SG/ICA       | PH scheduled helper/API result 已修；共享 WaitingCard fallback 仍冻结    |
| P0     | PH 无 QR 仍显示成功                     | 未修，按任务要求冻结 shared result card，只留接口请求                    |
| P1     | Review stop/action-required PH 专属呈现 | helper 已定义文案；共享状态卡未接入                                      |
| P1     | 错误脱敏不完整                          | PH sanitizer/allowlist 已建；FailureCard 共享接入冻结                    |
| P1     | 幂等证据不完整                          | 前端刷新契约已测试；RPC/DB/worker 幂等仍等 owner/PH-C                    |
| P2     | “再次提交/重新申请”文案                 | 未改，共享 result card 冻结                                              |

### 第二轮测试结果

- 通过：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/eligibility.test.ts features/ph-etravel/__tests__/eligibility-page.test.tsx features/ph-etravel/__tests__/status.test.ts features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts --testTimeout=15000`
- 结果：5 个测试文件通过，16 个测试通过。
- 通过：`npx eslint app/client/arrival-cards/philippines/page.tsx features/ph-etravel/PhilippinesArrivalEligibilityPage.tsx features/ph-etravel/eligibility.ts features/ph-etravel/status.ts ... 'app/api/applications/[id]/retry-submission/route.ts' app/client/application/long-form/page.tsx`
- eslint 结果：0 errors；测试文件因项目 ignore 规则产生 4 个 ignored-file warnings。
- 未通过：`npm run type-check` 被非 PH/禁止修改范围挡住：`TwResultCard.tsx` 缺 `submitted` 状态、`lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index、`scripts/capture-travel-city-coverage-screenshots.ts` 缺 `playwright` 类型。
- 未运行：Playwright desktop/mobile、部署、真实官方 eTravel、runner/schema、支付、migration。

### 第二轮发布门禁

| 门禁                   | 第二轮状态                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| PH live fail-closed    | 前端/API 可写范围通过；需 release owner 配置生产 env                    |
| Eligibility 分流       | 前端入口通过；需 schema/runner/API 深链 guard 后续接入                  |
| 免费/非签证/不保证准入 | 入口和 final confirmation 通过；result card 文案待共享集成              |
| 72 小时 scheduled      | PH helper/API 文案通过；共享 waiting fallback 待解冻                    |
| 刷新不重复入队         | helper/文案测试通过；DB/RPC 并发证据待 owner                            |
| 成功 reference + QR    | 未通过，冻结在 shared result card integration                           |
| 失败/Review 真实呈现   | helper 已准备；共享 FailureCard/StatusStep 接入待解冻                   |
| Desktop/mobile 截图    | 未通过，需后续可运行浏览器 smoke                                        |
| 监控/回滚              | 未通过，需 release owner 提供 live env、queue metrics、rollback runbook |

### 冻结的共享集成项

- `SubmissionStatusStep.tsx`、`DigitalArrivalCardResultCard` / shared result card：PH submitted 必须同时有 official reference 和独立 QR；缺任一项显示 QR recovery/action-required/failed，不得成功。
- `WaitingCard.tsx` / `submission-status` fallback：PH scheduled/running 文案不得出现 SG/ICA。
- `FailureCard.tsx`：接入 PH error allowlist/sanitizer，禁止 raw provider/stack/official/PII 进入 applicant UI。
- result card CTA：将“再次提交”语义改为“为下一次入境创建新 eTravel”，避免同一趟行程重复官方记录。

### 第二轮接口请求

1. PH-A/PH-B：确认是否需要把 eligibility choice 写入 schema，或在 long-form/API 层添加 PH arrival 深链 guard，防用户绕过入口页直接进入普通 passenger 表单。
2. PH-C：确认 runner 对 unsupported identity、Review stop、QR recovery、missing reference/missing QR 的状态码和 result payload 合同，以便接入 `createPhEtravelUserStatusMessage()`。
3. DB owner：提供 `enqueue_submission_retry` RPC 的唯一性/事务定义，证明并发 retry、刷新、两设备操作不会重复官方提交。
4. Shared frontend owner：解冻 result/status/failure card 后接入 PH reference+QR 成功门槛、PH scheduled fallback、PH sanitizer。
5. Release owner：确认生产变量必须同时设置 `PH_ETRAVEL_LIVE_SUBMISSION_ENABLED=true` 和 `NEXT_PUBLIC_PH_ETRAVEL_LIVE_SUBMISSION_ENABLED=true` 才启用；给出关闭 live 后保留提前填写/queued 状态恢复的回滚步骤和监控指标。

## 第二轮退回修正：allowlist、SEA 日期与冲突标注

> 状态：已完成有条件退回修正，2026-08-01（Asia/Singapore）。仍未修改共享 result/status 卡，未部署，未触发真实官方流程。

### 修正内容

- `features/ph-etravel/status.ts`：`phEtravelUserFacingError()` 改为真正 allowlist。只有 `phetravel_missing_date`、`phetravel_invalid_date`、`phetravel_departure_after_arrival`、`phetravel_arrival_date_past`、`live_disabled` 返回定制文案；任何未知 code 或 raw message 一律返回通用安全文案，不再原样回显。
- `features/ph-etravel/date-window.ts`：新增 `validatePhEtravelTravelDates()`，按 `transport_type` 选择 AIR flight dates 或 SEA voyage dates；SEA 使用 `voyage_departure_date` / `voyage_arrival_date` 作为 72 小时窗口来源。
- `app/api/applications/[id]/retry-submission/route.ts`：PH 专属日期读取改为 `readPhEtravelDateAnswers()`，选择 `transport_type`、flight dates、voyage dates；PH scheduled result 记录 `modeOfTravel` 与 `dateSource`；PH reject 响应通过 `phEtravelUserFacingError()` 输出，不暴露 DB/官方/raw message。
- `features/ph-etravel/__tests__/status.test.ts`：新增未知错误安全测试，覆盖姓名、护照号、官方响应/raw provider 不回显。
- `features/ph-etravel/__tests__/date-window.test.ts`：新增 SEA voyage date unit test。
- `features/ph-etravel/__tests__/retry-submission-ph.test.ts`：新增 PH retry route-level scheduling tests，覆盖 SEA scheduled、window-open submit、past-date reject。

### SEA 日期行为

| 场景            | 输入                                                                              | 行为                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SEA scheduled   | `transport_type=SEA`，`voyage_arrival_date` 距当前超过 72 小时窗口                | 返回 `action=schedule`，`earliestSubmissionDate = voyage_arrival_date - 3 days`，payload 标记 `modeOfTravel=SEA`、`dateSource=voyage` |
| SEA window-open | `transport_type=SEA`，当前日期在 `voyage_arrival_date - 3 days` 到 arrival day 内 | 返回 `action=submit`，使用 voyage departure/arrival dates                                                                             |
| SEA past-date   | 当前日期晚于 `voyage_arrival_date`                                                | 返回 422 `phetravel_arrival_date_past`；API 对用户显示 allowlisted safe message                                                       |
| AIR             | `transport_type` 缺失或非 SEA                                                     | 保持原 AIR 行为，使用 `flight_departure_date` / `flight_arrival_date`                                                                 |

### 退回修正测试结果

- 通过：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/eligibility.test.ts features/ph-etravel/__tests__/eligibility-page.test.tsx features/ph-etravel/__tests__/status.test.ts features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts features/ph-etravel/__tests__/retry-submission-ph.test.ts --testTimeout=15000`
- 结果：6 个测试文件通过，21 个测试通过。
- 通过：变更文件级 `npx eslint ...`，0 errors；测试文件仍因项目 ignore 规则产生 ignored-file warnings。
- `git diff --check`：通过。

### long-form 冲突核对

- `app/client/application/long-form/page.tsx` 在本轮开始时已属于共享 dirty 文件；本轮未回滚或整理其他 owner 的改动。
- PH-D 实际触碰的 PH 行/区块：
  - import `isPhEtravelClientLiveSubmissionEnabled`、`PH_ETRAVEL_REFRESH_POLICY`。
  - `PH_ETRAVEL_LIVE_ASSISTED_ENABLED` 改为显式 true 才启用。
  - `FinalConfirmationPanel` 中 `isPhEtravel` 的中英 safety copy。
  - `hasLiveAssistedTarget` warning 中仅 `isPhEtravel` 的 refresh/reopen 不重复入队提示。
- 请求台湾 owner/主协调者在合并前复核 `long-form/page.tsx` 的并行 dirty diff，确认 PH import/常量/文案区块与台湾任务无冲突。

## 下一轮本地 UI 验证：eligibility desktop/mobile 与安全文案

> 状态：已完成本地只读验证与 PH 专属离线 UI 矩阵测试，2026-08-01（Asia/Singapore）。本轮只新增 `features/ph-etravel/**` 测试并更新本 worklog；未修改共享 result/status、documents、dynamic form、package 或台湾 dirty 文件。

### 重新读取

- 已重新读取 `docs/philippines-launch-coordination.md`。
- 已重新读取全部 PH worklog：PH-A、PH-B、PH-C、PH-D。
- 当前工作区仍显示共享/台湾 dirty 文件；本轮未触碰 `SubmissionStatusStep`、FailureCard、WaitingCard、documents、dynamic form、package 文件。

### 浏览器/截图尝试

- 尝试启动本地 Next 服务：`npm run dev` 因已有 Next dev 锁退出；提示 3000 已有实例。
- 使用 in-app browser 访问 `http://127.0.0.1:3000/client/arrival-cards/philippines`。
- 结果：路由被客户端 auth shell 重定向到 `http://127.0.0.1:3000/client/login`，未展示 eligibility 页面。
- 结论：未绕过认证、未写临时路由、未生成目标页面截图。本轮截图证据不可得；以 PH 专属组件/状态离线测试作为验收证据。

### 新增 UI 矩阵测试

- 新增：`features/ph-etravel/__tests__/eligibility-ui-matrix.test.tsx`。
- 覆盖：
  - 普通 AIR 旅客显示 `Start form`，href 指向 `PH_ETRAVEL_ARRIVAL_CARD`。
  - 普通 SEA 旅客显示 `Start form`，href 指向 `PH_ETRAVEL_ARRIVAL_CARD`。
  - crew、cruise、special、foreign diplomat/dignitary、9(e)、diplomatic/official/service passport 全部分流到官方 eTravel link，且不显示普通表单 `Start form`。
  - 免费、非签证、不保证准入三段中英文案存在；英文句子长度与单词长度受控，作为 responsive/no-overflow 的离线 copy guard。
  - live disabled、SEA scheduled、SEA past-date、未知错误均使用 PH safe copy，不回显姓名/护照号/官方响应。
  - queued/refresh 文案明确 `Refreshing this page checks status only` 且 `does not create another official submission job`，不出现 `may create`。

### 本轮测试结果

- 通过：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/eligibility.test.ts features/ph-etravel/__tests__/eligibility-page.test.tsx features/ph-etravel/__tests__/eligibility-ui-matrix.test.tsx features/ph-etravel/__tests__/status.test.ts features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts features/ph-etravel/__tests__/retry-submission-ph.test.ts --testTimeout=15000`
- 结果：7 个测试文件通过，31 个测试通过。
- 通过：`npx eslint features/ph-etravel/...`，0 errors；测试文件因项目 ignore 规则产生 6 个 ignored-file warnings。

### 本地 UI 验收矩阵

| 验收项                                    | 本轮证据                                                                        | 结论                     |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ------------------------ |
| Desktop eligibility                       | 路由截图被 auth redirect 阻断；组件测试覆盖所有选项                             | 部分通过，缺真实路由截图 |
| Mobile eligibility                        | 路由截图被 auth redirect 阻断；copy length/no long token guard 覆盖移动溢出风险 | 部分通过，缺真实移动截图 |
| 普通 AIR/SEA 可继续                       | `eligibility-ui-matrix.test.tsx` 两条 supported case                            | 通过                     |
| crew/cruise/special/9(e)/外交公务因公分流 | `eligibility-ui-matrix.test.tsx` 六条 unsupported case                          | 通过                     |
| 免费/非签证/不保证准入                    | 入口组件测试 + copy length guard                                                | 通过                     |
| live disabled 安全文案                    | `eligibility-ui-matrix.test.tsx` + `status.test.ts`                             | 通过                     |
| SEA scheduled / SEA past-date             | `retry-submission-ph.test.ts` + UI matrix safe copy assertions                  | 通过                     |
| 未知错误安全文案                          | `status.test.ts` + UI matrix unknown error assertions                           | 通过                     |
| 刷新不宣称新官网任务                      | `createPhEtravelUserStatusMessage("queued")` assertions                         | 通过                     |

### 深链绕过风险

- `/client/arrival-cards/philippines` 入口已有 eligibility 分流，但 `PH_ETRAVEL_FORM_URL` 仍是直接 long-form URL：`/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true`。
- 用户或内部链接仍可直接打开 long-form，绕过 eligibility 入口；本轮权限不允许修改 `long-form/page.tsx` 或 dynamic form 深链 guard。
- 建议后续由主协调者解冻后，在 long-form/API/schema 层增加 PH eligibility answer/guard，或要求 PH-B schema 记录 eligibility choice，并由 PH-C runner 对 unsupported persona 保持 fail-closed。

### 必须等共享文件解冻的项目

- `SubmissionStatusStep` / shared result card：PH success 必须 reference + standalone QR；缺 QR/reference 显示 recovery/action-required/failed。
- `FailureCard`：接入 `phEtravelUserFacingError()`，禁止 raw official/provider/stack/PII。
- `WaitingCard` / submission-status fallback：PH scheduled/running fallback 不得出现 SG/ICA，并接入 PH 72 小时文案。
- `long-form/page.tsx`：需要主协调者/台湾 owner 做冲突复核后，决定是否加深链 guard/eligibility answer gate。

## 官网事实采集：Filipino + SEA 海运入境

> 状态：已完成公开官网只读核实，2026-08-01（Asia/Singapore）。本轮暂停前端、队列、QR 和代码修改；只访问菲律宾政府官方 eTravel 公开页面与公开 Next.js bundle，不登录、不注册、不输入资料、不读取 Cookie/本地会话、不绕过 CAPTCHA/Turnstile、不进入 Review、不触发最终提交。临时截图仅保存在 `/tmp/ph-d-official-screenshots-2026-08-01`，未留在仓库。

### 访问记录

| URL                                                 | 访问日期   | 步骤                       | live visible 观察                                                                                                                                                                                                                                                                                                                                                                                                                                            | 结果                                                                |
| --------------------------------------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `https://etravel.gov.ph/`                           | 2026-08-01 | 首页                       | 标题 `Philippine Travel Information System`；文案 `Simplify your travel with eTravel`、`eTravel is FREE`；按钮 `Click here to Sign In`、`Scan QR Code`；链接 `For Cruise Travel Registration`；语言选项 English/Chinese/Korean/Japanese                                                                                                                                                                                                                      | confirmed                                                           |
| `https://etravel.gov.ph/frequently-asked-questions` | 2026-08-01 | FAQ                        | 说明 eTravel 是 arriving/departing passengers 的 digital single data collection platform；官网唯一地址 `https://etravel.gov.ph`；需 register/update 的人群包含 arriving Filipino and foreign passengers / crewmembers、departing Filipino passengers；except foreign diplomats/dependents、foreign dignitaries/delegation、9(e)、diplomatic and official/service passport；registration/update absolutely free；72 hours (3 days) prior to arrival/departure | confirmed                                                           |
| `https://etravel.gov.ph/search`                     | 2026-08-01 | QR/search 尝试             | 页面返回 404，只有 `Go to Homepage`；未看到 reference/QR recovery 表单                                                                                                                                                                                                                                                                                                                                                                                       | mismatch: 首页有 `Scan QR Code` 按钮，但公开 `/search` route 不可用 |
| `https://etravel.gov.ph/new-travel-declaration`     | 2026-08-01 | 新 travel declaration 直达 | 自动回到 `https://etravel.gov.ph/?sessionExpired=true`；只显示首页公开内容                                                                                                                                                                                                                                                                                                                                                                                   | unobserved: session gate 阻断普通 traveler 表单                     |
| `https://etravel.gov.ph/signin`                     | 2026-08-01 | 登录门                     | 可见 `Email address` text input、`Password` password input、`Forgot Password` link、`Login` submit、`Sign in to eTravel with eGovPH`、`Create an account`、hidden `cf-turnstile-response`                                                                                                                                                                                                                                                                    | confirmed auth/CAPTCHA gate；已停止                                 |

### 当前官方构建与公开 bundle 信号

| 证据                            | 观察                                                                                                                                                                                                                                                                                            | 状态                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `__NEXT_DATA__.buildId`         | `79dfb3348d0a0f2a798c95b2cbd450cc9201257f`                                                                                                                                                                                                                                                      | confirmed                                                          |
| `_buildManifest.js`             | route 包含 `/new-travel-declaration`、`/new-cruise-travel-declaration`、`/wizard/public`、`/wizard/declaration`、`/wizard/sea-special`、`/qr-code`、`/public-qr-code`、`/preparing-qr-code`、`/preparing-public-qr-code`                                                                        | confirmed public bundle                                            |
| `/new-travel-declaration` chunk | 公开脚本出现 `transportation_type === "SEA"` 时清空 `flight_number`，`transportation_type === "AIR"` 或 departure 时清空 `is_disembarking`                                                                                                                                                      | confirmed public bundle；live form unobserved                      |
| `/wizard/public` chunk          | 公开脚本出现 `vessel_name`、`flight_number`、`passenger_type`、`origin_port`、`origin_port_code`、`departure_date`、`arrival_date`、`stay_location_type`、`destination_upon_arrival_in_philippines`、`disembarking_port_code`、`with_transit`、`signature`、customs/currency declaration labels | confirmed public bundle；live form unobserved                      |
| `/wizard/public` chunk          | 公开脚本出现 crew 判断值 `FLIGHT CREW`、`CRUISE CREW`、`VESSEL CREW`，以及 nationality branch `FOREIGNER`                                                                                                                                                                                       | confirmed public bundle；Filipino + SEA live path unobserved       |
| `/wizard/sea-special` chunk     | 公开脚本存在 SEA special wizard route 与 customs declaration steps                                                                                                                                                                                                                              | confirmed public bundle；普通 Filipino + SEA 是否走该 route 未观察 |
| public API option endpoints     | 本轮未调用登录态 API；未导出完整 option/value 列表                                                                                                                                                                                                                                              | unobserved                                                         |

### Filipino + SEA 逐题矩阵

| 顺序 | 页面/主题            | 原始标签/帮助文字                                                                                                                                                                     | 控件类型                                                                                                                              | 必填/显示条件                                           | 可见选项/value                                                      | VIZA 对应字段                                         | 状态                                                                                 |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 0    | 首页/服务说明        | `eTravel is FREE`；`For Cruise Travel Registration`；`Scan QR Code`                                                                                                                   | button/link/select                                                                                                                    | 公开可见，无表单 required                               | English/Chinese/Korean/Japanese；Sign In；Scan QR Code；Cruise link | PH safety copy、official入口、QR recovery link        | confirmed                                                                            |
| 1    | FAQ/适用人群         | `Arriving Filipino and foreign passengers`；`Arriving Filipino and foreign crewmembers`；except diplomats/dependents/dignitaries/delegation/9(e)/diplomatic/official/service passport | static text                                                                                                                           | 公开可见                                                | N/A                                                                 | eligibility 分流                                      | confirmed                                                                            |
| 2    | FAQ/提前填写         | `within 72 hours (3 days) prior to your arrival into or departure from the Philippines`                                                                                               | static text                                                                                                                           | 公开可见                                                | N/A                                                                 | `voyage_arrival_date`/scheduled enqueue 文案          | confirmed                                                                            |
| 3    | 登录门               | `Email address`、`Password`、`Login`、`Sign in to eTravel with eGovPH`、`Create an account`                                                                                           | text/password/button/hidden Turnstile response                                                                                        | 登录态前置；未输入资料                                  | hidden `cf-turnstile-response`                                      | 不适用于 VIZA 用户表单；runner 仍不得绕过 CAPTCHA/OTP | confirmed auth gate                                                                  |
| 4    | 新申报起始页         | Filipino citizen/passport holder 身份题                                                                                                                                               | unobserved                                                                                                                            | 直达 `/new-travel-declaration` 被 session gate 转回首页 | unobserved                                                          | `nationality` / traveler identity                     | unobserved                                                                           |
| 5    | 新申报起始页         | travel type / arrival / sea 选择                                                                                                                                                      | unobserved live；公开 bundle 出现 `ARRIVAL`/`SEA` 条件信号                                                                            | unobserved live                                         | unobserved live                                                     | unobserved live                                       | `transport_type=SEA`、arrival scope                                                  | unobserved live; confirmed public bundle signal |
| 6    | Filipino 专属资料    | Filipino passport/profile/photo 专属问题                                                                                                                                              | unobserved live                                                                                                                       | unobserved                                              | unobserved                                                          | `passport_number`、PH identity/profile fields         | unobserved                                                                           |
| 7    | SEA 船舶             | vessel name                                                                                                                                                                           | unobserved live；公开 bundle 出现 `vessel_name`                                                                                       | unobserved live                                         | unobserved live                                                     | unobserved live                                       | `vessel_name`                                                                        | unobserved live; confirmed public bundle signal |
| 8    | SEA 航次             | voyage number                                                                                                                                                                         | unobserved live；公开 bundle在 cruise route 显示 `VOYAGE NUMBER`，数据 key 为 `flight_number`                                         | unobserved live                                         | unobserved live                                                     | unobserved live                                       | VIZA `voyage_number` must map carefully to official `flight_number` where applicable | unobserved live; confirmed public bundle signal |
| 9    | SEA 日期             | voyage departure / voyage arrival dates                                                                                                                                               | unobserved live；公开 bundle 出现 `departure_date`、`arrival_date`，未确认 voyage label                                               | unobserved live                                         | unobserved live                                                     | unobserved live                                       | `voyage_departure_date`、`voyage_arrival_date`                                       | unobserved                                      |
| 10   | SEA 港口             | origin port / port of entry / disembarking port                                                                                                                                       | unobserved live；公开 bundle 出现 `origin_port`、`origin_port_code`、`disembarking_port_code`                                         | unobserved live                                         | unobserved live                                                     | unobserved live                                       | `seaport_of_origin`、`sea_port_of_entry`、`disembarking_port_code`                   | unobserved live; confirmed public bundle signal |
| 11   | SEA 下船             | disembarking question                                                                                                                                                                 | unobserved live；公开 bundle 出现 `is_disembarking`，且 AIR/departure 时清空                                                          | unobserved live                                         | unobserved live                                                     | unobserved live                                       | `is_disembarking`                                                                    | unobserved live; confirmed public bundle signal |
| 12   | 菲律宾地址/住宿      | destination upon arrival / stay location                                                                                                                                              | unobserved live；公开 bundle 出现 `stay_location_type`、`destination_upon_arrival_in_philippines`                                     | unobserved live                                         | unobserved live                                                     | unobserved live                                       | PH address/stay fields                                                               | unobserved live; confirmed public bundle signal |
| 13   | 旅行目的             | purpose of visit                                                                                                                                                                      | unobserved live；公开 bundle 出现 `purpose_of_visit_code`                                                                             | unobserved live                                         | unobserved live                                                     | 完整 values unobserved                                | `travel_purpose` / `purpose_of_visit_code`                                           | unobserved                                      |
| 14   | 健康                 | health declaration / sick / symptoms / exposure                                                                                                                                       | unobserved live                                                                                                                       | unobserved                                              | unobserved                                                          | unobserved                                            | health fields                                                                        | unobserved                                      |
| 15   | 同行人               | family member                                                                                                                                                                         | unobserved live；公开 bundle 出现 `family_member`、`family-member-wizard` route                                                       | unobserved live                                         | unobserved live                                                     | unobserved live                                       | companion/family fields                                                              | unobserved live; confirmed public bundle signal |
| 16   | 行李                 | baggage declaration                                                                                                                                                                   | unobserved live；公开 bundle 出现 customs/baggage step signal                                                                         | unobserved live                                         | unobserved live                                                     | unobserved live                                       | baggage fields                                                                       | unobserved live; confirmed public bundle signal |
| 17   | 海关                 | general declaration                                                                                                                                                                   | unobserved live；公开 bundle 出现 `Wizard.customs_declaration.general_declaration.*`                                                  | unobserved live                                         | unobserved live                                                     | unobserved live                                       | customs general fields                                                               | unobserved live; confirmed public bundle signal |
| 18   | 货币                 | currency declaration                                                                                                                                                                  | unobserved live；公开 bundle 出现 `Wizard.customs_declaration.currency_declaration.*`                                                 | unobserved live                                         | unobserved live                                                     | unobserved live                                       | currency declaration fields                                                          | unobserved live; confirmed public bundle signal |
| 19   | 文件/签名            | declaration attachment and signature                                                                                                                                                  | unobserved live；公开 bundle 出现 `signature`、`signature_source:"PAD"`、`correct_declaration_confirmation`、`data_privacy_agreement` | unobserved live                                         | unobserved live                                                     | attachment/signature rules unobserved                 | `signature`、customs attachment fields                                               | unobserved live; confirmed public bundle signal |
| 20   | Review/声明/最终提交 | Review 前确认、修改、声明或签名步骤                                                                                                                                                   | unobserved；未登录且未提交                                                                                                            | unobserved                                              | unobserved                                                          | unobserved                                            | Review/result integration                                                            | unobserved                                      |
| 21   | QR/recovery          | `Scan QR Code` 首页按钮；`/qr-code` 和 `/public-qr-code` routes 在 build manifest 中存在                                                                                              | button/route signal                                                                                                                   | 未进入 reference/QR 页面                                | `/search` 404；QR scan/recovery form unobserved                     | applicant-facing QR recovery                          | partial: homepage confirmed, recovery unobserved                                     |

### 与当前前端/VIZA 的差异

| 项目                            | 结论                                                                                                                                                                          | 优先级       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Filipino + SEA live form parity | 官方 live 页面被登录/session gate 阻断，本轮不能确认逐页真实题序、required、完整 option values、日期控件、文件规则或 Review 行为；VIZA 不得宣称 full parity                   | P0           |
| SEA voyage dates                | PH-B/PH-D 当前支持 `voyage_departure_date` / `voyage_arrival_date`，但本轮 live 页面未确认官方 label 和 required；公开 bundle 只确认 `departure_date`/`arrival_date` 字段信号 | P0 follow-up |
| Voyage number key               | 公开 bundle/cruise route 显示 `VOYAGE NUMBER` 使用 `flight_number` 数据 key；VIZA 的 `voyage_number` 需要 runner/API 映射复核，避免把语义 alias 当官方 payload key            | P0           |
| SEA disembarking/port           | 公开 bundle 支持 `is_disembarking`、`disembarking_port_code`；live required、港口完整 values、与 `TRAVEL_PORT`/住宿的组合未确认                                               | P1           |
| Filipino 专属问题               | FAQ 只确认 Filipino arriving passenger 需要 register/update；实际 Filipino citizen/passport holder 专属题、photo/document要求未 live 观察                                     | P1           |
| QR recovery                     | 首页确认 `Scan QR Code`，build manifest 确认 QR routes；公开 `/search` 为 404，reference/QR recovery 表单未观察                                                               | P1           |
| Review 前声明/签名              | 公开 bundle 确认 signature/customs declaration step signal；真实 Review 前是否有确认、修改、声明或签名步骤未观察                                                              | P1           |

### 无法进入的页面

- `https://etravel.gov.ph/new-travel-declaration`：无登录态直达会跳到 `https://etravel.gov.ph/?sessionExpired=true`；未观察到 Filipino + SEA 第一道题。
- `https://etravel.gov.ph/wizard/public`、`https://etravel.gov.ph/wizard/declaration`、`https://etravel.gov.ph/wizard/sea-special`：仅从 build manifest/公开 chunk 确认存在；本轮未直接访问受保护 wizard 页面。
- `https://etravel.gov.ph/signin`：显示 email/password/eGovPH sign-in/create account/Turnstile hidden response；按任务要求在认证/CAPTCHA 门停止。
- QR/reference recovery：仅确认首页 `Scan QR Code` 与 QR routes；未观察可输入 reference 或下载 QR 的 applicant-facing 页面。

### 页面刷新/返回观察

- 首页和 FAQ 刷新后公开文字保留；不涉及申报 payload。
- `/new-travel-declaration` 刷新/重开仍停在 `sessionExpired=true` 首页，不创建官方任务。
- Filipino + SEA 表单内返回上一步、字段保留、Review 修改行为均未观察，不能作为已确认能力。

### 本轮结论

- live visible：只确认首页、FAQ、登录门、session gate、公开免费/适用人群/72 小时/官方唯一站点/豁免身份文字。
- official public bundle/API：确认当前 build、route、SEA/vessel/disembarking/customs/signature 的公开脚本信号；未调用登录态 API，未确认完整 option values。
- unobserved：Filipino + SEA 真实逐页表单、所有字段 required、日期与文件规则、港口/船舶完整枚举、健康/同行人/行李/海关/货币 live UI、Review、最终 reference/QR 和 recovery 下载体验。

## 第二轮登录态 special/family/cruise UI 爬取

> 状态：已完成官方登录态只读 UI 核实，2026-08-01（Asia/Singapore）。本轮只更新 PH-D worklog；未修改前端、队列、runner、schema、总览或其他 worklog。未记录账号、邮箱、OTP、Cookie、护照号、真实姓名、截图路径或未脱敏官方响应。未点击最终 Submit；未输入真实资料；未上传文件；未提交真实家庭成员。

### 重新读取

- 已重新读取 `docs/philippines-launch-coordination.md`。
- 已重新读取 PH-A、PH-B、PH-C、PH-D worklog；PH-A 输出较长但本轮重点官方登录态入口、family、cruise 与 PH-D 当前内容均已复核。
- 已复核 `AGENTS.md` 与 `docs/AGENTS.md`。
- 已只读查看当前 VIZA PH frontend：`features/ph-etravel/eligibility.ts`、`features/ph-etravel/status.ts`、`features/ph-etravel/PhilippinesArrivalEligibilityPage.tsx`。

### 证据分级

| 类别                       | 含义                                                                                    | 本轮使用方式                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| live visible               | 官方登录态或公开页面真实可见 UI                                                         | dashboard、cruise 第一页、family member 第一页、ordinary declaration 起始页、FOR OTHER 点击后的同页状态、FAQ |
| official public bundle/API | 官方页面 `__NEXT_DATA__`/公开 build 文案包、route/chunk 信号                            | relationship options、passenger_type values、family member independent declaration notice、wizard route 信号 |
| unobserved                 | 需要 Continue、真实资料、文件上传、法律确认、CAPTCHA/OTP、Review 或最终 Submit 才能确认 | family member 后续页、FOR OTHER Continue 后 route、cruise voyage 选择后的字段、任何最终提交/QR               |

### Dashboard 入口矩阵

| 官方路径/入口                      | live visible 原文                                                   | 控件类型    | 观察结果                                                                | VIZA 结论                                                                      |
| ---------------------------------- | ------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `https://etravel.gov.ph/dashboard` | `New Travel Declaration` / `VIA AIR or SEA (For Cargo Vessel only)` | button      | 普通申报入口明确把 SEA 限定在非邮轮的 cargo vessel 语境；与邮轮入口并列 | VIZA ordinary SEA 文案应保持非邮轮/cargo-vessel 边界；不得暗示 cruise 可用     |
| `https://etravel.gov.ph/dashboard` | `New Cruise Ship (郵輪) Travel Declaration`                         | button      | 邮轮是独立 dashboard 入口，不在普通 `New Travel Declaration` 中         | VIZA 应继续分流 cruise passenger/crew，不进入普通 passenger form               |
| `https://etravel.gov.ph/dashboard` | `Add Family Member`                                                 | link        | 家庭成员是独立 profile wizard 入口                                      | VIZA 普通 arrival 表单不能把未建档 family member 当作普通 FOR OTHER 可直接提交 |
| `https://etravel.gov.ph/dashboard` | `eTravel is FREE`                                                   | static text | 登录态 dashboard footer 仍显示官方免费                                  | VIZA 入口/状态/确认文案继续保留 free notice                                    |

### Cruise Travel Declaration 第一页

| 项目          | live visible / public bundle 观察                                                                                                     | 状态                    | VIZA 映射                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| URL           | 点击 dashboard `New Cruise Ship (郵輪) Travel Declaration` 后进入 `https://etravel.gov.ph/new-cruise-travel-declaration`              | confirmed live visible  | 独立官方路径；不属于 `PH_ETRAVEL_ARRIVAL_CARD` ordinary passenger               |
| 页面标题      | `Cruise Travel Registration`                                                                                                          | confirmed live visible  | VIZA 应显示 cruise 需官方独立路径/人工处理                                      |
| 第一页说明    | `Kindly select your voyage and click continue.`                                                                                       | confirmed live visible  | 邮轮先选 voyage，不显示普通 AIR/SEA 起始页                                      |
| 控件          | `Search...` text input、`Continue` submit button                                                                                      | confirmed live visible  | 不能复用普通 passenger eligibility/form 字段                                    |
| 空结果        | `NO RECORD FOUND!`                                                                                                                    | confirmed live visible  | 无 voyage 时不得继续；未点击 Continue                                           |
| AIR/SEA 差异  | 第一页未显示 AIR/SEA 切换；cruise path 与 ordinary AIR/SEA 并列                                                                       | confirmed live visible  | VIZA `cruise` 必须 unsupported/manual，不应落入 ordinary SEA                    |
| 人员类型      | `__NEXT_DATA__` 文案包包含 `CRUISE CREW`、`CRUISE PASSENGER`，也包含 ordinary `AIRCRAFT PASSENGER`、`VESSEL PASSENGER` 与 crew values | confirmed public bundle | cruise passenger 与 cruise crew 均分流；ordinary passenger 仅 AIR/SEA passenger |
| 后续字段/声明 | 选择 voyage 后的字段、声明、Review 未进入                                                                                             | unobserved              | 不得宣称 cruise 支持                                                            |

### Add Family Member 第一页

| 顺序 | live visible 原始标签/帮助文字                           | 控件类型                                        | 可见 value/options                                              | VIZA 对应                          | 状态                                                        |
| ---- | -------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| 0    | `Fill up your Personal information, let’s get started!`  | static                                          | N/A                                                             | family member profile intro        | confirmed live visible                                      |
| 1    | `Take a photo or upload a file.`                         | upload/photo area                               | file/camera behavior未触发                                      | family profile photo               | confirmed live visible label; file rules unobserved         |
| 2    | `PHILIPPINE PASSPORT Holder` / `FOREIGN PASSPORT Holder` | radio                                           | `nationality=FILIPINO` default checked；`nationality=FOREIGNER` | family member passport holder type | confirmed live visible                                      |
| 3    | `First Name`                                             | text input `first_name`                         | blank                                                           | family member first name           | confirmed live visible                                      |
| 4    | `Middle Name (optional)`                                 | text input `middle_name`                        | blank                                                           | family member middle name          | confirmed live visible                                      |
| 5    | `Last Name (optional)`                                   | text input `last_name`                          | blank                                                           | family member last name            | confirmed live visible; requiredness still needs validation |
| 6    | `Suffix (optional)`                                      | combobox/hidden `extension_name`                | options not expanded                                            | suffix                             | confirmed live visible label                                |
| 7    | `Sex`                                                    | combobox/hidden `gender`                        | options not expanded                                            | sex/gender                         | confirmed live visible label                                |
| 8    | `Birth Date (MM/DD/YYYY)`                                | text/date input `birth_date`                    | MM/DD/YYYY label                                                | birth date                         | confirmed live visible                                      |
| 9    | `Mobile Number`                                          | phone control                                   | country/format not expanded                                     | mobile number                      | confirmed live visible label                                |
| 10   | `Citizenship`                                            | country combobox `nationality_country_code`     | options not expanded                                            | citizenship                        | confirmed live visible                                      |
| 11   | `Country of Birth`                                       | country combobox `country_of_birth_code`        | options not expanded                                            | country of birth                   | confirmed live visible                                      |
| 12   | `Passport Number`                                        | text input `passport_number`                    | blank                                                           | passport number                    | confirmed live visible                                      |
| 13   | `Passport Issuing Authority`                             | country combobox `passport_issued_country_code` | options not expanded                                            | passport issuing country           | confirmed live visible                                      |
| 14   | `Passport Issued Date (MM/DD/YYYY)`                      | text/date input `passport_issued_date`          | MM/DD/YYYY label                                                | passport issue date                | confirmed live visible                                      |
| 15   | `Occupation`                                             | occupation combobox `occupation_code`           | options not expanded                                            | occupation                         | confirmed live visible                                      |
| 16   | `Cancel` / `Next`                                        | buttons                                         | did not click Next                                              | profile step navigation            | confirmed live visible                                      |

### Family member relationship 与独立申报

| 主题                 | 官方公开文案/值                                                                                                                                                         | 证据                                   | VIZA 结论                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| Relationship label   | `Relationship`                                                                                                                                                          | official `__NEXT_DATA__` Field label   | Relationship 控件未在第一页 live visible；后续页未进入              |
| Relationship options | `MOTHER`, `FATHER`, `DAUGHTER`, `SON`, `SISTER`, `BROTHER`, `HUSBAND`, `WIFE`, `COUSIN`, `UNCLE`, `AUNT`, `NEPHEW`, `NIECE`, `GRANDFATHER`, `GRANDMOTHER`, `GRANDCHILD` | official `__NEXT_DATA__` public values | VIZA 若后续支持 family member profile，必须保留这些 official values |
| Family member notice | `Travel declarations will also be generated for the selected family members.`                                                                                           | official `__NEXT_DATA__` public notice | FOR OTHER/伴随家属会生成独立申报，不能只作为一个普通表单字段附加    |
| Dashboard note       | `Please note that both account owners and family members are required to register their travel declarations individually.`                                              | official `__NEXT_DATA__` public notice | VIZA 用户侧需说明每个 family member 需要独立 travel declaration     |
| Live 后续页          | 未输入资料，未点击 Next，未提交 family member                                                                                                                           | unobserved                             | 不得宣称已支持添加家庭成员                                          |

### 普通 New Travel Declaration 起始页与 FOR OTHER

| 项目                | live visible 观察                                                                                                                                                          | 状态                                       | VIZA 结论                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| URL                 | dashboard 点击普通入口进入 `https://etravel.gov.ph/new-travel-declaration`                                                                                                 | confirmed live visible                     | 登录态可进入普通起始页                                                       |
| 72 小时公告         | `You may only register within 72 hours prior to your arrival or departure in the Philippines. Travelers are enjoined to present their eTravel QR code to flight boarding.` | confirmed live visible                     | VIZA scheduled/status copy 对齐                                              |
| Apply-for selection | `FOR ME (Current User)`、`FOR OTHER (Family Member)`                                                                                                                       | buttons                                    | VIZA `registration_for` 需区分 self vs family member                         |
| Transport selection | `AIR`、`SEA`                                                                                                                                                               | buttons                                    | Ordinary flow支持 AIR/SEA，但 dashboard 文案限定 SEA cargo vessel only       |
| Direction selection | `ARRIVAL Entering the Philippines`、`DEPARTURE Leaving the Philippines`                                                                                                    | radio labels；values `ARRIVAL`/`DEPARTURE` | PH arrival scope只支持 ARRIVAL；DEPARTURE 不纳入本产品                       |
| Legal/consent text  | `By clicking "Continue", you agree to our Data Privacy and Affidavit of Undertaking`                                                                                       | link + Continue button                     | 这是继续前法律/隐私确认；本轮未点击 Continue                                 |
| FOR OTHER 点击后    | 点击 `FOR OTHER` 后，当前页未出现可见 family member picker，URL 仍为 `/new-travel-declaration`                                                                             | confirmed live visible                     | family member 选择/route 很可能在 Continue 后发生；本轮未触发，标 unobserved |
| Wizard route        | build manifest/公开 route 已知存在 `/wizard/me`、`/wizard/other`                                                                                                           | confirmed public bundle                    | VIZA 深链/状态不能假设 FOR OTHER 与 FOR ME 完全同路                          |
| Continue 后变化     | 未点击 Continue，避免创建初始官方申报/进入后续确认                                                                                                                         | unobserved                                 | 需要第三轮受控 stop-before-submit 才能确认                                   |

### 官方 FAQ 特殊身份复核

| 身份/主题                             | 官方 FAQ live visible 文案                                              | VIZA 处理建议                                                           |
| ------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| arriving Filipino/foreign passengers  | `Arriving Filipino and foreign passengers` required to register/update  | ordinary Filipino/Foreigner passenger 才进入 `PH_ETRAVEL_ARRIVAL_CARD`  |
| arriving Filipino/foreign crewmembers | `Arriving Filipino and foreign crewmembers` required to register/update | 需要独立 crew path；当前 VIZA ordinary passenger form 必须分流/人工处理 |
| foreign diplomats/dependents          | `except foreign diplomats, and their dependents`                        | 官方例外，VIZA 不应提交普通 passenger form                              |
| foreign dignitaries/delegation        | `foreign dignitaries, and members of their delegation`                  | 官方例外，VIZA 不应提交普通 passenger form                              |
| 9(e) visa holders                     | `9(e) visa holders`                                                     | 官方例外，VIZA 不应提交普通 passenger form                              |
| diplomatic/official/service passport  | `holders of diplomatic and official/service passport`                   | 官方例外，VIZA 不应提交普通 passenger form                              |
| cruise                                | dashboard live visible 独立 `New Cruise Ship (郵輪) Travel Declaration` | cruise passenger/crew 不进入 ordinary passenger form                    |
| 免费/72 小时/QR                       | FAQ 确认 registration/update free、72 hours prior、需保存/下载 QR       | VIZA 文案和状态卡继续保留，不得把 eTravel 表述成签证或保证入境          |

### 对比当前 VIZA frontend eligibility/status

| 项目                                                         | 当前 VIZA 状态                                                                                                                      | 本轮官方 UI 证据后的缺口                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| ordinary AIR passenger                                       | eligibility 支持                                                                                                                    | 仍缺登录态 full flow/Review UI 证据；本轮只确认起始页                                                                              |
| ordinary SEA passenger                                       | eligibility 支持，描述为普通海路旅客且非邮轮                                                                                        | 官方 dashboard 文案为 `VIA AIR or SEA (For Cargo Vessel only)`；VIZA 需要把普通 SEA 边界写得更明确，避免邮轮或非 cargo vessel 误入 |
| crew                                                         | eligibility 分流                                                                                                                    | 与 FAQ/official passenger_type values一致；仍缺 crew 独立官方 path 的第一页证据                                                    |
| cruise                                                       | eligibility 分流                                                                                                                    | 与 dashboard 独立 cruise入口一致；当前处理正确，但后续可把“邮轮先选 voyage”写入人工说明                                            |
| special registration                                         | eligibility 分流                                                                                                                    | route-only/FAQ 仍不足；需要后续 special入口第一页证据                                                                              |
| diplomat/dignitary/9(e)/diplomatic-official-service passport | eligibility 分流                                                                                                                    | 与 FAQ live visible 一致                                                                                                           |
| family member                                                | VIZA eligibility 未解释 Add Family Member 或 individual declaration；long-form 仍可能通过 `registration_for=FOR_OTHER` 进入普通表单 | 需新增用户侧说明/guard：FOR OTHER 需要官方已添加 family member，且每个 family member 独立 declaration；未确认前不应自动提交        |
| status/error copy                                            | `status.ts` 已有 free/not visa/no border、queued刷新不重复、unknown error allowlist                                                 | 缺 family member independent declaration 文案；缺 cruise/cargo vessel专项状态/人工处理文案                                         |
| QR/result shared UI                                          | 仍等共享文件解冻                                                                                                                    | 本轮 FAQ 再次确认用户需 screenshot/download QR；PH success 仍必须 reference + QR                                                   |

### VIZA 支持/不支持/人工处理建议

| 官方路径/人群                                                                                            | 建议                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Ordinary AIR arriving passenger                                                                          | 支持提前填写；live 仍 fail-closed，等 Review evidence                                                   |
| Ordinary SEA arriving passenger                                                                          | 仅支持非邮轮/cargo-vessel ordinary passenger；入口文案需明确                                            |
| Cruise passenger / cruise crew                                                                           | 不支持 ordinary form；分流到官方 cruise path 或人工处理                                                 |
| Flight/vessel crew                                                                                       | 不支持 ordinary passenger form；需独立 crew path/人工处理                                               |
| Special registration                                                                                     | 不支持 ordinary form；需独立 special path/人工处理                                                      |
| Foreign diplomats/dependents、foreign dignitaries/delegation、9(e)、diplomatic/official/service passport | 官方例外；VIZA 应阻断普通提交并引导官方/人工咨询                                                        |
| Family member / FOR OTHER                                                                                | 不应作为“同一个申请里附带家属”处理；需要官方 family profile + individual declaration 证据后再支持自动化 |

### 本轮未触发/未观察

- 未点击 cruise `Continue`，未选择 voyage，未观察 cruise 后续字段、声明、Review 或 QR。
- 未点击 family member `Next`，未输入任何家庭成员资料，未观察 relationship 控件 live page、地址页、保存页或真实 member 创建。
- 未点击 ordinary declaration `Continue`，未创建初始官方申报，未观察 `/wizard/me` 或 `/wizard/other` 的后续页面。
- 未上传文件、未处理法律确认、未触发 CAPTCHA/OTP、未最终 Submit。

### 接口请求

- 请求 PH-D/主协调者后续解冻 frontend 时补：ordinary SEA 文案增加 “not cruise / cargo vessel ordinary passenger only”；family member/IF FOR OTHER 说明每名 family member 需要独立官方申报。
- 请求 PH-A/官方证据 owner 后续补：crew 独立入口、special registration 第一页、cruise 选中 voyage 后第一页、family relationship live page 与 FOR OTHER Continue 后 route 的 stop-before-submit 证据。
- 请求 PH-B/PH-C：family member profile 与 FOR OTHER 不得默认映射成普通 application companion 字段；若支持，需单独 field contract 与 runner flow。

## 主协调者 Review/Summary 同步：Family gate 与 Submit 边界

> 状态：已读取 `docs/philippines-launch-coordination.md` 第 16 节，2026-08-01（Asia/Singapore）。本节仅记录 PH-D frontend/status 影响；未修改代码、总览或其他 worklog。

### 新增官方 Review 事实

| 位置                  | 主协调者观察                                                                                                                                             | PH-D 影响                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Signature 页          | 未签名点击 `Next` 时，官方显示 `Required` 与 `Please make sure to fill out all required fields.`                                                         | 签名 canvas 是 Review 前必填；VIZA 不应把缺签名状态显示为已提交或普通失败                        |
| Signature 后          | 签名通过后不会直接进入 Review，而是进入 `Family Member(s)` 页                                                                                            | PH 前端状态/文案需增加 Review 前 family gate 概念；不能假设 signature 后就是 Summary             |
| Family Member(s) 页   | 文案 `Travel declarations will also be generated for the selected family members.`；无记录时显示 `No Record Found!` 与 `Add Family Member`               | family member/companion 是官方独立 gate；VIZA `FOR_OTHER`/companion 不能当作普通附属字段静默提交 |
| 无 family member 继续 | 官方弹窗：`You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion?`，按钮 `No` / `Yes` | 若 runner 到此停止，应显示“确认无同行/无家属选择”类 action-required，不应显示 submitted          |
| Summary 页            | 标题 `New Travel Declaration Summary`，说明 `Kindly double check the information before submitting.`                                                     | Summary/Review reached 只是待确认状态                                                            |
| Summary 底部          | 最终按钮为 `Submit`                                                                                                                                      | 只有点击最终 Submit 后取得 official reference + QR 才能是 submitted                              |

### PH-D 前端门禁更新

- `review_reached_not_submitted`、`stopped_before_submit`、Family Member(s) gate、Summary page 都必须归类为 action-required / review reached，不能归类为 submitted。
- 用户文案必须明确：“已到官方 Review/Summary” 不等于 “已提交”；最终提交按钮仍是官方 `Submit`。
- 成功页仍必须满足 official reference + QR artifact；只到 Summary、只有签名截图、只有 Review 截图或只有 `Submit` 按钮可见都不能显示成功。
- Failure/Waiting/Status 后续共享集成需新增 PH 专属状态：`family_member_gate` 或 `companion_confirmation_required`，用于解释“没有选择同行人时官方要求确认”。
- 入口/表单文案需补充：若用户为同行 family member 申报，官方可能要求先维护 family member profile，并且每个成员会生成独立 travel declaration。

### 仍被冻结的实现项

- `SubmissionStatusStep` / shared result card 仍需解冻后修：Review/Summary reached 不得显示 submitted。
- `FailureCard` / shared status card 仍需接入 PH allowlisted copy，不回显官方弹窗原文中的任何个人资料。
- Dynamic form / long-form 深链 guard 仍需后续任务：`FOR_OTHER` 与 companion/family member gate 不能绕过 eligibility 直接进入普通自动提交。

## 下一波前端状态语义准备：Review gate、Family gate 与 QR 成功门槛

> 状态：已完成 PH 专属 helper/test 准备，2026-08-01（Asia/Singapore）。本轮不浏览官网；未修改共享 result/status/waiting/failure 文件，未部署、未 migration、未 commit、未批量 git add。

### 重新读取与共享文件判断

- 已读取 `docs/philippines-launch-coordination.md` 第 16 节。
- 已读取 PH-D 最新 worklog。
- 已读取当前 `git status --short`。
- 共享文件不 clean，保持冻结：
  - `viza-fe/internal-website/app/client/application/_components/result-cards/SubmissionStatusStep.tsx`
  - `viza-fe/internal-website/lib/submission-result.ts`
  - `viza-fe/internal-website/app/client/documents/actions.ts`
  - `viza-fe/internal-website/components/dynamic-form-field.tsx`
  - `viza-fe/internal-website/components/dynamic-step-form.tsx`
  - `viza-fe/internal-website/package.json`
  - `viza-fe/internal-website/package-lock.json`
- 因此本轮没有接入 shared result/status/waiting/failure UI；只改 PH 专属 helper/test 与本 worklog。

### 本轮 PH 专属改动

- `features/ph-etravel/status.ts`
  - 新增 `signature_required`、`family_gate`、`companion_confirmation`、`review_reached_not_submitted` 用户状态文案。
  - 新增 `PhEtravelResultEvidence`、`hasPhEtravelOfficialReference()`、`hasPhEtravelIndependentQrArtifact()`、`isPhEtravelSubmittedEvidenceComplete()`、`classifyPhEtravelResultState()`。
  - 明确 `signature_required`、Family Member(s) gate、无 companion 确认、Review/Summary reached、stop-before-submit 都归类为 `action_required`，不是 `submitted`。
  - 明确只有 official reference/confirmation number + independent QR artifact 同时存在，才可归类为 `submitted`；有 reference 无 QR 归为 `qr_recovery`。
- `features/ph-etravel/eligibility.ts`
  - ordinary AIR/SEA 支持文案拆分。
  - ordinary SEA 明确为 non-cruise eTravel path；cruise travel/crew/passenger 必须走官方独立 cruise declaration path。
  - 新增 `PH_ETRAVEL_FAMILY_MEMBER_COPY`，说明 family member 可能需要先建 official profile，且每位 family member 会生成独立 travel declaration。
- `features/ph-etravel/PhilippinesArrivalEligibilityPage.tsx`
  - 普通 SEA 选项说明改为 non-cruise vessel。
  - 入口安全说明区新增 family member independent declaration 文案。
- PH 专属测试：
  - `features/ph-etravel/__tests__/status.test.ts` 覆盖 Review/Family/signature/companion 非 submitted，以及 reference + independent QR 成功门槛。
  - `features/ph-etravel/__tests__/eligibility.test.ts` 覆盖 AIR/SEA 分离 reason code、SEA non-cruise、family member independent declaration copy。
  - `features/ph-etravel/__tests__/eligibility-page.test.tsx` 覆盖页面显示 family member 独立申报和 ordinary SEA non-cruise/cruise 分流文案。

### 本轮测试结果

- 尝试运行：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/eligibility.test.ts features/ph-etravel/__tests__/eligibility-page.test.tsx features/ph-etravel/__tests__/eligibility-ui-matrix.test.tsx features/ph-etravel/__tests__/status.test.ts features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts features/ph-etravel/__tests__/retry-submission-ph.test.ts --testTimeout=15000`
- 未通过启动：Vitest 加载 config 时尝试写入 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs`，当前环境返回 `EPERM: operation not permitted`。
- 按协调者要求，本轮未申请审批、未重试需要审批的命令、未绕过 sandbox；测试状态记录为未运行成功/环境写权限阻断。

### Shared 最小 patch plan（待解冻）

1. `SubmissionStatusStep` / shared result card：
   - 对 PH arrival 调用 `classifyPhEtravelResultState()`。
   - `review_reached_not_submitted`、`stopped_before_submit`、`signature_required`、`family_gate`、`companion_confirmation` 一律显示 action-required/review reached，不显示 submitted。
   - `isPhEtravelSubmittedEvidenceComplete()` 为 false 时禁止成功卡。
2. PH success/result card：
   - official reference/confirmation number + independent QR artifact 同时存在才显示成功。
   - 只有 Review screenshot、Submit button visible、confirmation screenshot 或 reference-only 时显示 recovery/action-required。
3. Waiting/status fallback：
   - scheduled/running PH 文案走 `createPhEtravelUserStatusMessage()` / `createPhEtravelScheduledPortalSummary()`，不得出现 SG/ICA。
   - 增加 `family_gate` / `companion_confirmation` 的等待/人工动作文案。
4. FailureCard：
   - PH 使用 `phEtravelUserFacingError()` allowlist。
   - 未知 raw official/provider/stack/PII 不回显。
5. Dynamic form / long-form：
   - `FOR_OTHER` / family member 需要 eligibility/guard 文案：每位家庭成员会生成独立 declaration，未验证自动化前不应静默提交。
   - ordinary SEA 文案继续标注 non-cruise/cargo-vessel ordinary passenger only。

## 第 17 节 SEA Review evidence 对齐：PH frontend helper/UI 文案

> 状态：已完成 PH 专属 helper/UI/tests 更新，2026-08-01（Asia/Singapore）。本轮只改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog；未浏览官网、未部署、未 migration、未 commit、未批量 git add、未触碰共享 dirty result/status/waiting/failure 文件。

### 开始前读取

- 已读取 `docs/philippines-launch-coordination.md` 第 17 节。
- 已读取 PH-A 最新 SEA Review live evidence：`SEA + ARRIVAL + is_disembarking=true` 已到 `New Travel Declaration Summary`，底部 `Submit` 未点击。
- 已读取 PH-B/PH-C 最新 notes：SEA aliases、customs/manual forms、family gate、signature/Review 非提交边界已同步。
- 已读取当前 `git status --short`：共享 frontend/result/status/package/TW 文件仍 dirty，因此本轮不接入共享 UI。

### 本轮 PH 专属完成项

- `features/ph-etravel/eligibility.ts`
  - ordinary SEA 文案收紧为“已验证 ordinary SEA arrival/disembarking passenger path”。
  - 明确 ordinary SEA 不是 cruise、cruise crew、vessel crew 或其他 official-only route。
  - 新增 `PH_ETRAVEL_SEA_REVIEW_COPY`：
    - `is_disembarking=true` 时才出现 Residence / Hotel / Port destination branch。
    - SEA `Port` branch 对应 travel/disembarking port。
    - 已验证 SEA Review path 显示 manual Baggage/Currency forms notice；前端不得承诺 SEA electronic customs fully automated。
    - 已验证 SEA Review path 在 Review 前无 signature page；signature 文案只能在官网实际停在 signature step 时展示。
- `features/ph-etravel/status.ts`
  - `signature_required` 文案改为 path-specific，不再暗示所有 SEA 都需要签名。
  - 新增 `sea_manual_customs_forms` 用户状态，并归入 Review-not-submitted / action-required 类状态。
  - 继续保持 submitted 成功门槛为 official reference/confirmation + independent QR artifact；Review/Summary、Submit button visible、family/no-companion gate 均不是 submitted。
- `features/ph-etravel/PhilippinesArrivalEligibilityPage.tsx`
  - 仅当选择 ordinary SEA passenger 时显示 SEA live evidence 文案：disembarking、destination branch、manual customs forms、signature non-universal。
  - AIR 页面不显示 SEA-only customs/signature 结论，避免把 SEA 证据套到 AIR 或反向套用。
- PH 专属 tests
  - `eligibility.test.ts` 覆盖 ordinary SEA/disembarking、not cruise/crew、destination branch、manual customs、signature non-universal 文案。
  - `eligibility-page.test.tsx` 覆盖 ordinary SEA 页面可见文案。
  - `eligibility-ui-matrix.test.tsx` 覆盖 SEA UI 文案、manual customs、安全状态 copy。
  - `status.test.ts` 覆盖 `sea_manual_customs_forms` 为 action-required/not submitted，以及 signature 不再是 universal SEA requirement。

### 测试结果

- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无 whitespace error。
- 尝试运行 PH targeted frontend tests：
  - `cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/eligibility.test.ts features/ph-etravel/__tests__/eligibility-page.test.tsx features/ph-etravel/__tests__/eligibility-ui-matrix.test.tsx features/ph-etravel/__tests__/status.test.ts features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts features/ph-etravel/__tests__/retry-submission-ph.test.ts --testTimeout=15000`
  - Result：未进入测试执行；Vitest 加载 config 时写入 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs` 被当前环境拒绝，报 `EPERM: operation not permitted`。
  - 按协调者要求，本轮未请求审批、未升级权限、未绕过 sandbox；测试记录为环境写权限阻断。

### 共享文件仍冻结

本轮没有修改：

- `viza-fe/internal-website/app/client/application/_components/result-cards/SubmissionStatusStep.tsx`
- `viza-fe/internal-website/lib/submission-result.ts`
- `viza-fe/internal-website/app/client/documents/actions.ts`
- `viza-fe/internal-website/components/dynamic-form-field.tsx`
- `viza-fe/internal-website/components/dynamic-step-form.tsx`
- `viza-fe/internal-website/package.json`
- `viza-fe/internal-website/package-lock.json`
- 台湾 dirty 文件或其他 shared result/status/waiting/failure 文件

### Shared 最小 patch plan（第 17 节后更新）

1. Shared result/status cards 解冻后，对 PH arrival 使用 `classifyPhEtravelResultState()`：
   - `review_reached_not_submitted`、`stopped_before_submit`、`family_gate`、`companion_confirmation`、`sea_manual_customs_forms` 一律显示 action-required/recovery，不显示 submitted。
   - `signature_required` 仅作为当前路径实际停在 signature step 的状态，不作为 SEA universal requirement。
2. PH success gate：
   - 必须同时存在 official reference/confirmation number 和 independent QR artifact。
   - Review/Summary reached、Submit button visible、manual forms notice、family/no-companion confirmation 都不能触发 success。
3. PH waiting/failure/recovery copy：
   - scheduled/running/failed 不得出现 SG/ICA。
   - SEA manual customs forms 应提示 manual/action-required，不承诺 SEA electronic customs fully automated。
   - FailureCard 必须继续走 `phEtravelUserFacingError()` allowlist，未知 official/provider/PII/raw message 不回显。
4. Dynamic form/long-form 解冻后：
   - SEA destination branch 必须受 `is_disembarking=true` gate 控制；Port branch 对应 `disembarking_port_code` / travel-disembarking port。
   - AIR `TRANSIT`、AIR electronic customs/signature assumptions 不得套到 SEA。
   - `FOR_OTHER` / family member 继续提示每位 family member 生成独立 declaration，no companion confirmation 是 action-required，不是 submitted。

## 第 19 节 form completeness + shared integration readiness audit

> 状态：已完成 PH frontend form completeness 审计 helper/tests/worklog，2026-08-01（Asia/Singapore）。本轮只改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog；未修改共享 dirty result/status/dynamic/package 文件，未修改总览或其他 worklog，未浏览官网、未部署、未 migration、未 commit、未批量 git add。

### 开始前读取

- 已读取 `docs/philippines-launch-coordination.md` 第 19 节：PH-D 下一波仅准备 PH-only frontend completeness review 和 shared integration plan，冻结共享文件。
- 已读取 PH-A 最新 SEA Review live evidence：`SEA + ARRIVAL + is_disembarking=true` 已到 Summary，未点击 final `Submit`，无 reference/QR。
- 已读取 PH-B/PH-C 最新 worklog：schema/runner 已对齐 SEA live evidence、customs/currency structured contract、reference+QR success gate。
- 已读取 `docs/philippines-etravel-arrival-field-contract.md`：本轮不从台湾逻辑补字段，只按 PH contract/PH-A evidence 分类。
- 已读取当前 `git status --short`：`SubmissionStatusStep.tsx`、`lib/submission-result.ts`、`components/dynamic-form-field.tsx`、`components/dynamic-step-form.tsx`、`package.json`、`package-lock.json` 等共享文件仍 dirty。

### 本轮 PH-only helper/tests

- 新增 `features/ph-etravel/completeness.ts`
  - 定义 `PH_ETRAVEL_FORM_COMPLETENESS_MATRIX`，把前端 completeness 分成：
    - `covered`
    - `ph_only_ready`
    - `shared_unfreeze_required`
    - `official_evidence_required`
  - 覆盖 eligibility、AIR/SEA travel details、destination、health、customs/currency、family gate、signature、Review status、reference+QR success gate。
  - 提供 `getPhEtravelCompletenessByOwner()` 和 `getPhEtravelP0CompletenessGaps()`，供后续 shared result/dynamic 集成前做门禁检查。
- 新增 `features/ph-etravel/__tests__/completeness.test.ts`
  - 锁定 PH-only 已覆盖项：eligibility diversion、family/no-companion gate、path-specific signature、Review-not-submitted、reference+QR success gate。
  - 锁定 shared-unfreeze gaps：AIR fields、SEA vessel/voyage/date/disembarking、SEA destination gate、health、customs/currency structured fields。
  - 锁定 official evidence gaps：positive AIR electronic customs/currency selectors、final Submit/reference/QR/recovery。
  - 明确 result artifacts 不属于 applicant-form answers。

### Form completeness matrix

| Area                                               | 当前 PH frontend 状态                                                                                                            | 分类                  | Severity | 缺口/下一步                                                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligibility / unsupported identities               | PH eligibility page 已分流 crew、cruise、special、diplomat/dignitary、9(e)、diplomatic/official/service passport                 | 已覆盖                | P0       | 继续阻断普通 passenger form；不得把 unsupported route 塞入 ordinary eTravel                                                                 |
| Scope copy                                         | 免费、不是签证、不保证边检准入已在入口；状态 helper 有 PH-only scheduled/error copy                                              | 已覆盖                | P0       | 解冻 result/status 后补到所有结果上下文                                                                                                     |
| AIR travel details                                 | PH-only helper 不渲染 dynamic AIR fields；字段在 shared dynamic form                                                             | 必须等 shared 解冻    | P0       | 对齐 contract：purpose、airline、flight、origin/transit/destination、baggage/conditional branches；不得加台湾字段                           |
| SEA travel details                                 | PH copy 已说明 ordinary disembarking SEA；实际 vessel/voyage/date/disembark 控件在 shared form                                   | 必须等 shared 解冻    | P0       | `vessel_name`、`voyage_number -> flight_number`、`voyage_*date -> departure_date/arrival_date`、`is_disembarking`、`disembarking_port_code` |
| SEA destination                                    | PH copy 已说明 `is_disembarking=true` 才有 Residence/Hotel/Port；实际条件渲染在 shared form                                      | 必须等 shared 解冻    | P0       | Gate `stay_location_type`；SEA 用 `TRAVEL_PORT -> disembarking_port_code`；AIR `TRANSIT` 不得泄漏到 SEA                                     |
| Health                                             | PH-only helper 不渲染 health；contract 有 recent travel/exposure/sick/symptoms，negative antigen/animal exposure 仍 needs_review | 必须等 shared 解冻    | P1       | 只渲染 contract-backed PH health fields；未证实 branch 保持 gated                                                                           |
| Customs/currency                                   | PH status 可显示 SEA manual forms action-required；positive customs/currency structured UI 不在 PH-only helper                   | 必须等 shared 解冻    | P0       | 12 项 checklist、goods items、currency owner/recipient/items/source/purpose/transfer method 必须结构化；不能 aggregate/free-text            |
| Family gate                                        | `family_gate` / `companion_confirmation` 已是 action-required；入口说明每名 family member 独立 declaration                       | 已覆盖                | P0       | Shared form 不得用 counts 伪造 selected family members；profile selection 另案                                                              |
| Signature                                          | `signature_required` 已 path-specific；SEA manual path 不再被强制签名                                                            | 已覆盖                | P0       | Shared documents/form 不得要求 `customs_signature_file` 或 universal SEA signature；仅官网出现 signature page 时处理 pad                    |
| Review-not-submitted                               | `review_reached_not_submitted`、stop-before-submit、family/no-companion、SEA manual customs 均非 submitted                       | 已覆盖                | P0       | Shared result/status 解冻后必须调用 PH helper                                                                                               |
| Submitted success                                  | PH helper 要求 official reference/confirmation + independent QR artifact；reference-only 是 QR recovery                          | 已覆盖；shared 未接入 | P0       | Shared result card 解冻后接入；Review screenshot/Submit visible 不得显示成功                                                                |
| Positive AIR electronic customs/currency selectors | PH frontend 不承诺 full automation；PH-A 仍需 selector/validation evidence                                                       | 必须等 PH-A 官方证据  | P0       | 等 PH-A stop-before-submit selector evidence 后再允许完整 UI/autofill claims                                                                |
| Final Submit/reference/QR/recovery                 | 无官方 final Submit/reference/QR/recovery evidence；PH helper 保持 fail-closed                                                   | 必须等 PH-A 官方证据  | P0       | 未验证前不能 launch submitted-ready                                                                                                         |

### P0/P1 缺口

- P0 shared 解冻：
  - AIR travel details 一对一字段渲染与 official key mapping。
  - SEA vessel/voyage/date/disembarking/destination branch 渲染。
  - Customs/currency structured positive branch UI；不得把 12 项清单和 currency groups 合并成 aggregate text。
  - Shared result/status cards 接入 PH success gate 与 Review-not-submitted 状态。
- P0 官方证据：
  - Positive AIR electronic customs/currency selectors、requiredness、validation。
  - Final Submit、official reference、independent QR、recovery/result page。
  - SEA other port/customs combinations、SEA non-disembarking、possible SEA electronic customs/signature paths。
- P1 shared 解冻：
  - Health declaration完整控件与未证实 branch gating。
  - Document UI 条件化：不要求 unproven profile photo、travel_document、customs_signature_file。

### 测试结果

- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无 whitespace error。
- 尝试运行 PH targeted frontend tests：
  - `cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/completeness.test.ts features/ph-etravel/__tests__/eligibility.test.ts features/ph-etravel/__tests__/eligibility-page.test.tsx features/ph-etravel/__tests__/eligibility-ui-matrix.test.tsx features/ph-etravel/__tests__/status.test.ts features/ph-etravel/__tests__/date-window.test.ts features/ph-etravel/__tests__/option-labels.test.ts features/ph-etravel/__tests__/retry-submission-ph.test.ts --testTimeout=15000`
  - Result：未进入测试执行；Vitest 加载 config 时写入 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs` 被当前环境拒绝，报 `EPERM: operation not permitted`。
  - 按协调者要求，本轮未请求审批、未升级权限、未绕过 sandbox；测试记录为环境写权限阻断。

### Shared 最小 patch plan（completeness 后）

1. Dynamic form 解冻后：
   - 按 field contract 渲染 PH-only conditions；SEA disembarking/destination/customs 不从 AIR 或台湾字段推导。
   - 对没有 flat key 的 PH fields 保持 gated 或等 PH-B schema，不静默隐藏 P0。
2. Result/status 解冻后：
   - PH arrival 调用 `classifyPhEtravelResultState()` / `isPhEtravelSubmittedEvidenceComplete()`。
   - Review/Summary/Submit-visible/manual-forms/family/no-companion/signature-stop 均显示 action-required/recovery，不显示 submitted。
3. Document UI 解冻后：
   - 不默认要求 `customs_signature_file`、`travel_document`、foreign profile photo；signature 是官方 signature pad page 的 path-specific gate。
4. Official evidence gate：
   - 没有 PH-A final Submit/reference/QR/recovery 证据前，不得把任何 PH status 改成 launch-ready submitted success。

## 第 19.3 AIR positive evidence 轻量跟进：completeness 分类调整

> 状态：已完成 PH-only completeness helper/tests/worklog 轻量更新，2026-08-01（Asia/Singapore）。本轮只改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog；未修改共享 dirty result/status/dynamic/package 文件，未改总览或其他 worklog，未浏览官网、未部署、未 migration、未 commit、未批量 git add。

### 读取依据

- 已读取 `docs/philippines-launch-coordination.md` 第 19.3 节。
- 已读取 PH-A 最新 AIR positive evidence：官方已完成 AIR positive electronic customs/currency selector、modal/table 和部分 validation 证据；final Submit/reference/QR 仍未验证。
- 已读取 `docs/philippines-etravel-arrival-field-contract.md` 最新 E7 补充。

### 分类变化

- `Positive AIR electronic customs/currency selectors` 不再归类为纯 `official_evidence_required`。
- 新分类：
  - `Positive AIR electronic customs/currency shared UI integration`
  - owner = `shared_unfreeze_required`
  - severity = `P0`
  - 含义：PH-A 已提供 page order、12 checklist selectors、Other goods modal/table、currency item modal、source/purpose arrays、physical/courier selectors 与 courier required validation；但 shared dynamic form 仍 frozen，runner 仍需 phased gates，PH frontend 不能承诺已完整渲染或全自动提交。
- 继续保留：
  - `Remaining AIR customs/currency official evidence gaps`
  - owner = `official_evidence_required`
  - severity = `P0`

### 仍需官方证据的项

- Attachment requiredness / file input behavior / file size and conditions。
- Owner N/A stable selector。
- Owner/recipient full requiredness conditions。
- Physical branch empty-value requiredness。
- Other goods deleted-row / no-row page-level blocking。
- Complete currency and monetary instrument option lists。
- Final Submit、official reference、independent QR、result/recovery page。

### 本轮 PH-only 更新

- `features/ph-etravel/completeness.ts`
  - AIR positive customs/currency 从“等官方 selector 证据”调整为“shared dynamic form 解冻 + runner phase pending”。
  - 新增 remaining official evidence gaps 行，防止把 E7 selector evidence 误读成 frontend 完整可渲染或 launch-ready。
- `features/ph-etravel/__tests__/completeness.test.ts`
  - 更新 shared-unfreeze 断言，确认 positive AIR electronic customs/currency integration 进入 shared 阻断。
  - 新增断言保留 attachment、Owner N/A、Other goods no-row、complete option lists 等官方证据缺口。

### 测试结果

- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无 whitespace error。
- 尝试运行：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/completeness.test.ts --testTimeout=15000`
- Result：未进入测试执行；Vitest 加载 config 时写入 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs` 被当前环境拒绝，报 `EPERM: operation not permitted`。
- 按协调者要求，本轮未请求审批、未升级权限、未绕过 sandbox；测试记录为环境写权限阻断。

## 第十轮 PH-only 表单展示/条件分支 adapter（2026-08-03）

> 状态：完成 PH-only adapter、定向测试用例和接入说明。本轮仅修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog；未修改 shared dynamic/result/status 文件、package、协调总览或其他 worklog。未浏览官网、未部署、未 migration、未 commit、未批量 git add、未提交官方最终 Submit，也未请求审批。

### 读取与依据

- 已完整读取根目录、`docs/`、`viza-fe/`、`viza-fe/internal-website/` 与 `features/ph-etravel/` 的适用 `AGENTS.md`，以及协调总览、PH-A/PH-B/PH-C/PH-D worklog 和 canonical field contract。
- 按 contract E6/E7/E8/E9：SEA 有 manual Baggage/Currency forms 路径，也有 electronic no-declaration 路径；后者仅证实 `No -> Other Travel Details -> signature -> Family Member(s) -> no-companion confirmation -> Summary`。SEA Customs `Yes`、SEA electronic positive currency、final Submit/reference/QR/recovery 仍不得推断。
- Shared `dynamic-step-form.tsx`、`dynamic-form-field.tsx`、result/status/waiting/failure 文件在开始时仍 dirty；本轮未触碰。

### 新增 presentation adapter

- 新增 `features/ph-etravel/presentation.ts`：`createPhEtravelFormPresentation()` 产生可由未来 shared dynamic form 消费的纯数据 section/field model，不渲染 UI、不创建 queue、不调用官网。
- Model 覆盖：`travel`、`destination`、`health`、`family`、`other_travel_details`、`customs`、`currency`、`signature_review`，以及与申请人问题分离的 `resultFields`。
- 每个字段给出 official key、control、mode 和 gate：
  - `input_when_shared_ready` / `ready_for_shared_integration`：已有 contract-backed selector/field，可待 shared 解冻接入。
  - `manual_review` / `needs_review`：不作为确定的普通输入项；例如 AIR airline/flight requiredness、SEA `is_disembarking` 的路径适用性、Family profile selection、Owner N/A、owner/recipient、physical currency child validation。
  - `official_only` / `official_evidence_required`：不伪造用户表单；例如 SEA electronic Customs `Yes`、SEA electronic positive currency、签名/Family/companion/Summary stop 状态。
  - `result_only`：`result.official_reference`、`result.qr_artifact` 永远不是 applicant answers。

### 条件分支约束

| 条件                 | Adapter 行为                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AIR / SEA            | AIR 才含 airline/flight review gates；SEA 才含 vessel/voyage（Voyage Number official control key = `flight_number`）。                                                                            |
| SEA manual           | 不显示 electronic other-travel-details/customs/currency 输入；显示官方手工 Baggage/Currency forms 阻断，并不要求 universal signature。                                                            |
| SEA electronic `No`  | 仅此已验证 no-declaration 分支显示 Other Travel Details；signature/review 仍为 official-only，非 submitted。                                                                                      |
| SEA electronic `Yes` | 不继承 AIR General Declaration、goods、currency；输出 official-evidence blocker。                                                                                                                 |
| `with_transit=true`  | 才加入 transit country/port/date。                                                                                                                                                                |
| destination          | AIR 可选 Residence/Hotel/Transit；SEA 仅 `is_disembarking=true` 时显示 Residence/Hotel/TRAVEL_PORT，SEA 不泄漏 AIR TRANSIT。                                                                      |
| goods / currency     | AIR positive customs 才有 checklist、goods modal/table；Other Goods true 才加入 row group。Currency yes 后按 physical/courier 显示各自 child fields；未证实 child requiredness 仍 manual-review。 |
| crew / cruise        | eligibility 先分流，adapter 只返回 eligibility blocked section，不建立 ordinary passenger form。                                                                                                  |

### 共享接入最小点（仍冻结，未实施）

1. `components/dynamic-step-form.tsx`：PH 条件下调用 `createPhEtravelFormPresentation()`；只渲染 `input_when_shared_ready`，以 `blockedReason`、`manual_review`、`official_only` 显示人工处理/等待官方证据，而不是生成输入控件。
2. `components/dynamic-form-field.tsx`：按 adapter control 渲染 repeated checklist/goods/currency groups；不得把 `needs_review` / `official_only` 转成 required inputs，也不得引入台湾字段。
3. `SubmissionStatusStep.tsx` / `lib/submission-result.ts`：继续接既有 PH status helpers；adapter 的 `signature_review` 和 `resultFields` 不得覆盖 reference + independent QR success gate。
4. `long-form/page.tsx`：只在 PH eligibility 已确认 ordinary passenger 后使用 adapter；crew/cruise 始终留在官方/人工分流。

### 测试与检查

- 新增 `features/ph-etravel/__tests__/presentation.test.ts`，覆盖：
  - SEA manual 不继承 AIR electronic customs/signature fields；
  - SEA electronic `No` 的 Other Travel Details 与 `Yes` positive branch blocker；
  - AIR transit、stay type、Other Goods 和 currency courier/physical 条件；
  - crew/cruise diversion；
  - reference/QR 是 result-only，signature/Family/companion/Summary 全部 `submitted=false`；
  - needs-review 字段只得到 `manual_review` / `official_only`，不被标为 unconditional input。
- 更新 `shared-integration.ts` / 其测试：future `dynamicStepForm` 接入点改为 `createPhEtravelFormPresentation()`，并要求消费 review/official-only gates。
- 尝试运行：`npx vitest run features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`。
  - 未进入测试体：Vitest 在加载 config 时尝试写入 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs`，当前环境返回 `EPERM`。
  - 按任务约束未申请/等待权限，也未以其他方式绕过。
- `git diff --check -- features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed。

## 第 19.4 shared frontend integration package（PH-only spec）

> 状态：已完成 PH-only shared integration adapter/spec，2026-08-01（Asia/Singapore）。本轮只改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog；未修改 shared dirty result/status/dynamic/package 文件，未改总览或其他 worklog，未浏览官网、未部署、未 migration、未 commit、未批量 git add。

### 开始前读取

- 已读取 `docs/philippines-launch-coordination.md` 第 19.4 节：PH-B/PH-C/PH-D 已消费 PH-A AIR positive selector evidence；final Submit/reference/QR 仍未验证。
- 已读取当前 `git status --short`：`SubmissionStatusStep.tsx`、`lib/submission-result.ts`、`dynamic-step-form.tsx`、`dynamic-form-field.tsx`、documents actions、package files 等仍 dirty/frozen。
- 已读取 PH-D 最新 worklog。

### 本轮 PH-only helper/tests

- 新增 `features/ph-etravel/shared-integration.ts`
  - 定义 `PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE`，供后续 shared 文件解冻后直接消费。
  - 每个 spec 包含：target、sharedFile、entryCondition、helperToUse、requiredBehavior、forbiddenBehavior、releaseGate。
  - 提供：
    - `getPhEtravelSharedIntegrationByGate()`
    - `getPhEtravelSharedIntegrationForTarget()`
- 新增 `features/ph-etravel/__tests__/shared-integration.test.ts`
  - 覆盖 result/status 文件必须接 PH success gate 和 safe error helper。
  - 覆盖 dynamic form 仍 blocked on shared unfreeze，AIR positive customs/currency 是 structured UI integration + runner phase pending。
  - 覆盖 final Submit/reference/QR 仍是 official_evidence_required。
  - 覆盖 integration package 不把 shared dirty/package 修改当作当前可执行工作。
- 更新 `features/ph-etravel/AGENTS.md`
  - 记录 `shared-integration.ts` 是 PH-only adapter/spec metadata，不能在 shared dirty 期间直接改共享文件。

### Shared integration package

| Shared target/file                          | Entry condition                                                           | PH helper/spec to consume                                                                                                                            | Required behavior                                                                                                                                            | Forbidden behavior / copy                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `SubmissionStatusStep.tsx`                  | `country=philippines` + `visaType=PH_ETRAVEL_ARRIVAL_CARD`                | `classifyPhEtravelResultState()`、`createPhEtravelUserStatusMessage()`、`isPhEtravelSubmittedEvidenceComplete()`                                     | Review stop、family gate、companion confirmation、signature stop、SEA manual customs forms 显示 action-required/recovery；reference-only 显示 QR recovery    | 不得因 Review/Summary visible、Submit button visible、截图、manual forms notice 显示 success；不得出现 SG/ICA                   |
| `lib/submission-result.ts`                  | PH result normalization / applicant result card reads `submission_result` | `classifyPhEtravelResultState()`、`hasPhEtravelOfficialReference()`、`hasPhEtravelIndependentQrArtifact()`、`isPhEtravelSubmittedEvidenceComplete()` | PH submitted 必须通过 reference/confirmation + independent QR artifact gate                                                                                  | 不得把 `submitted=true` alone 当 PH success；reference/QR 不进 applicant form answers                                           |
| `FailureCard.tsx`                           | PH failure/action-required/provider error/retry status                    | `phEtravelUserFacingError()`、`createPhEtravelUserStatusMessage()`                                                                                   | 只显示 allowlisted PH error copy 或 generic safe fallback；recoverable stops 用 action-required                                                              | 不回显 raw official/provider/stack/token/name/passport/cookie/OTP/internal path；不出现 ICA/Singapore                           |
| `WaitingCard.tsx`                           | PH scheduled/queued/running/QR recovery                                   | `createPhEtravelScheduledPortalSummary()`、`createPhEtravelUserStatusMessage()`                                                                      | 说明 72 小时 scheduled、刷新不重复入队、QR recovery；保留免费/非签证/不保证准入                                                                              | 不暗示 refresh creates new official task；不出现 SG/ICA                                                                         |
| `components/dynamic-step-form.tsx`          | `PH_ETRAVEL_ARRIVAL_CARD` dynamic form rendering                          | `PH_ETRAVEL_FORM_COMPLETENESS_MATRIX`、`PH_ETRAVEL_SEA_REVIEW_COPY`                                                                                  | 按 PH contract 渲染 AIR/SEA branches；SEA `is_disembarking`、`TRAVEL_PORT -> disembarking_port_code`；AIR positive customs/currency structured UI 解冻后接入 | 不从台湾逻辑推导字段；不把 checklist/goods/currency collapse 成 aggregate/free-text；不把 AIR customs/signature 套到 SEA        |
| `components/dynamic-form-field.tsx`         | PH conditional field controls                                             | `PH_ETRAVEL_FORM_COMPLETENESS_MATRIX`                                                                                                                | schema 暴露后支持 structured repeat/modal-like fields；unverified branches gated                                                                             | 不把 attachment、profile photo、travel document、custom signature file 设为 universal required；不发明 option code/requiredness |
| `app/client/documents/actions.ts`           | PH document requirements/reusable docs                                    | `PH_ETRAVEL_FORM_COMPLETENESS_MATRIX`                                                                                                                | PH attachments/signature 条件化；signature pad 只在官网出现 signature page 时需要                                                                            | 不要求 `customs_signature_file`、`travel_document`、foreign profile photo 全局必填；不把 signature pad 转成 PDF upload          |
| `app/client/application/long-form/page.tsx` | PH live handoff/status/pre-submit copy                                    | `PH_ETRAVEL_BOUNDARY_COPY`、`PH_ETRAVEL_FAMILY_MEMBER_COPY`、`PH_ETRAVEL_SEA_REVIEW_COPY`、`isPhEtravelClientLiveSubmissionEnabled()`                | live fail-closed；提交前说明 eTravel 免费、非签证、不保证准入；ordinary SEA 是 disembarking passenger 且非 cruise/crew                                       | 不默认启用 live；不把 FOR_OTHER/family member 当普通 nested applicant 静默提交                                                  |

### 门槛分类

- `shared_unfreeze_required`
  - Shared result/status/dynamic/documents/long-form 文件 dirty；本轮只准备 PH-only spec，不接入。
  - AIR positive customs/currency structured UI 已从 `official_evidence_required` 转为 `shared_unfreeze_required + runner phase pending`。
  - Full automation 仍 pending；PH-C 当前 positive customs/currency 仍 fail-closed/action-required。
- `official_evidence_required`
  - Final official Submit。
  - Official reference/confirmation。
  - Independent QR artifact。
  - Result/recovery page。
  - Attachment requiredness/file input、Owner N/A stable selector、owner/recipient full requiredness、physical branch empty requiredness、Other goods no-row page-level blocking、complete currency/monetary option lists。

### 成功门槛

- PH submitted success = official reference or confirmation number + independent QR artifact。
- Review/Summary reached、Submit button visible、confirmation screenshot、manual customs forms notice、signature page reached、Family Member(s) gate、no-companion confirmation 都不是 submitted。
- Reference-only = QR recovery / action-required，不得最终成功。

### 测试结果

- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无 whitespace error。
- 尝试运行：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`
- Result：未进入测试执行；Vitest 加载 config 时写入 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs` 被当前环境拒绝，报 `EPERM: operation not permitted`。
- 按协调者要求，本轮未请求审批、未升级权限、未绕过 sandbox；测试记录为环境写权限阻断。

## 第 20/21.4 SEA electronic variant + E9 shared integration update（PH-only）

> 状态：已完成 PH-only helper/tests/worklog 更新，2026-08-01（Asia/Singapore）。本轮只改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog；未修改 shared dirty result/status/waiting/failure/dynamic/package 文件，未改总览或其他 worklog，未浏览官网、未部署、未 migration、未 commit、未批量 git add，未请求审批。

### 开始前读取

- 已读取 `docs/philippines-launch-coordination.md` 第 20 节：SEA electronic variant 已确认存在，E8 停在 signature page；当时 Family/Summary after signature 仍 pending。
- 已读取 `docs/philippines-launch-coordination.md` 第 21.4 节：E9 finalized；SEA electronic no-declaration path 已完成 post-signature stop-before-submit evidence。
- 已读取 PH-A E8/E9 最新 evidence：
  - E8：SEA electronic confirmation -> Other Travel Details -> Signature；普通 SEA dropdown 可见 `VESSEL CREW` / `VESSEL PASSENGER`，但 crew 仍分流；cruise 是 dashboard separate route。
  - E9：SEA electronic no-declaration path page order 为 signature -> Family Member(s) -> no-companion confirmation when no family selected -> `New Travel Declaration Summary`；Summary 底部 final `Submit` 可见但未点击。
  - E9 未生成 official reference、confirmation、QR 或 result/recovery page。
- 已读取当前 `git status --short`：共享 result/status/waiting/failure/dynamic/package 文件仍 dirty/frozen；本轮保持不碰。

### 本轮 PH-only 更新

- `features/ph-etravel/status.ts`
  - 新增 `sea_electronic_signature_required` 用户状态。
  - `classifyPhEtravelResultState()` 将该 code 归为 `action_required`。
  - 文案说明 SEA electronic customs path 停在 signature page 时尚未提交；签名后仍需 Family Member(s)、适用时 no-companion confirmation、Summary、最终 Submit。
- `features/ph-etravel/eligibility.ts`
  - SEA 文案从“单一 disembarking/manual/no-signature path”改成 path-specific：
    - ordinary SEA = verified non-cruise passenger paths。
    - disembarking destination branch 与 electronic variant 分开说明。
    - manual Baggage/Currency forms 与 SEA electronic signature variant 分开说明。
    - crew 可出现在 SEA dropdown，但 VIZA v1 仍分流；cruise 使用官方独立 cruise route。
- `features/ph-etravel/PhilippinesArrivalEligibilityPage.tsx`
  - 普通 SEA panel 现在展示 crew/cruise 分流说明。
- `features/ph-etravel/completeness.ts`
  - SEA travel/destination/customs/signature completeness matrix 改为 path-specific。
  - 新增 `SEA electronic post-signature Family/Summary boundary` covered item：E9 已确认 electronic no-declaration path 的 Family/Summary stop-before-submit 顺序，但仍不是 submitted。
- `features/ph-etravel/shared-integration.ts`
  - Shared integration package 新增 `sea_electronic_signature_required` 接入要求。
  - Dynamic form future patch 明确必须支持 SEA manual forms path 与 SEA electronic customs/signature variant；禁止写成 “all SEA manual / all SEA no signature / SEA fully automated”。
  - Long-form future patch 改为 ordinary SEA verified non-cruise passenger paths，crew/cruise 分流，Review/Summary 不是 submitted。

### 测试更新

- `features/ph-etravel/__tests__/status.test.ts`
  - 覆盖 `sea_electronic_signature_required` 是 action-required。
  - 覆盖文案含 signature page、Family Member(s)、Summary、final Submit，并不显示成功 reference/QR 文案。
- `features/ph-etravel/__tests__/eligibility.test.ts`
  - 覆盖 ordinary SEA non-cruise passenger paths。
  - 覆盖 manual/electronic customs、signature path-specific、crew/cruise 分流文案。
- `features/ph-etravel/__tests__/eligibility-page.test.tsx`
  - 覆盖页面可见 SEA path-specific destination/customs/signature/crew 文案。
- `features/ph-etravel/__tests__/eligibility-ui-matrix.test.tsx`
  - 覆盖 UI 不再承诺 SEA 一律手工或一律无签名。
- `features/ph-etravel/__tests__/completeness.test.ts`
  - 覆盖 E9 Family/Summary boundary 作为 covered/action-required，不是 submitted success。
- `features/ph-etravel/__tests__/shared-integration.test.ts`
  - 覆盖 shared package future patch 必须接 `sea_electronic_signature_required`，并禁止 all-SEA manual/no-signature 文案。

### 当前分类

| Area                                       | Current classification                                                          | PH-D conclusion                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| SEA manual forms path                      | confirmed, action-required                                                      | 可显示 manual Baggage/Currency forms notice，但不能承诺全自动电子海关。                   |
| SEA electronic no-declaration path         | confirmed through E9 stop-before-submit                                         | signature -> Family Member(s) -> no-companion confirmation -> Summary；仍不是 submitted。 |
| SEA electronic positive customs Yes branch | official_evidence_required                                                      | 仍不得假设完全复用 AIR selectors。                                                        |
| Crew in SEA dropdown                       | confirmed visible label from E8                                                 | VIZA v1 unsupported/diverted；不得进入 ordinary passenger submission。                    |
| Cruise                                     | separate official dashboard route                                               | VIZA v1 unsupported/diverted；不得塞进 ordinary SEA passenger form。                      |
| Family/Summary                             | confirmed for AIR, SEA manual selected path, SEA electronic no-declaration path | Review/Summary reached 必须显示 action-required/review reached，不是 success。            |
| Final Submit/reference/QR                  | official_evidence_required                                                      | 无 reference + independent QR 前不得显示 submitted。                                      |

### 共享文件仍冻结 / 最小 patch plan

共享文件解冻后再做，不在本轮实施：

1. `SubmissionStatusStep.tsx`
   - PH 条件：`country=philippines` + `visaType=PH_ETRAVEL_ARRIVAL_CARD`。
   - 接 `classifyPhEtravelResultState()` / `createPhEtravelUserStatusMessage()`。
   - `sea_electronic_signature_required`、signature/family/companion/review/manual customs 均显示 action-required/recovery，不显示 success。
2. `lib/submission-result.ts`
   - PH success gate 必须是 official reference/confirmation + independent QR artifact。
   - Review/Summary/Submit-visible/reference-only 不能成功。
3. `FailureCard.tsx` / `WaitingCard.tsx`
   - 只用 PH allowlist/generic safe copy；不得回显 raw official/provider/PII；不得出现 SG/ICA。
4. `dynamic-step-form.tsx` / `dynamic-form-field.tsx`
   - SEA branch 必须按 official page content 区分 manual forms 与 electronic signature path。
   - 不从台湾逻辑推字段，不把 AIR customs/signature 套到所有 SEA。
5. `long-form/page.tsx`
   - PH copy 使用 verified non-cruise passenger path、crew/cruise 分流、Family independent declaration、free/not visa/no border guarantee、live fail-closed。

### 测试结果

- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无 whitespace error。
- 尝试运行：`cd viza-fe/internal-website && npx vitest run features/ph-etravel/__tests__/status.test.ts features/ph-etravel/__tests__/eligibility.test.ts features/ph-etravel/__tests__/eligibility-page.test.tsx features/ph-etravel/__tests__/eligibility-ui-matrix.test.tsx features/ph-etravel/__tests__/completeness.test.ts features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`
- Result：未进入测试执行；Vitest 加载 config 时写入 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs` 被当前环境拒绝，报 `EPERM: operation not permitted`。
- 按协调者要求，本轮未请求审批、未升级权限、未绕过 sandbox；测试记录为环境写权限阻断。

## 第十一轮消费 PH-A E10：SEA electronic positive through-Currency（2026-08-04）

> 本轮仅修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog；未修改 shared dirty frontend 文件、package、coordination 或其他 worklog。未浏览官网、未部署、未 migration/seed/commit，也未接触真实申请人、OTP、Cookie、密码、密钥、付款或官方 final Submit。

### E10 消费结论

- 协调总览第 23 节和 PH-A E10 证实普通 `SEA + VESSEL PASSENGER` electronic Customs `Yes` 的当前官方顺序已到 Currency：Confirmation Yes -> Other Travel Details -> General Declaration -> Currency Declaration。
- SEA positive 现可与 AIR 共用已观察的结构化展示模型，限于 Currency 之前：Other Travel Details、12 项 `check_lists.*.response`、Other goods row surface、owner/recipient groups、currency item modal/table、source/purpose arrays 与 Other detail、physical/courier branch、BSP date control。
- E10 没有跨过 Currency；SEA positive 的 attachments、signature、Family Member(s)、no-companion confirmation、Summary、final Submit、reference、QR 和 result/recovery 仍为 `official_evidence_required`。E9 的 no-declaration Summary 不得外推为 positive-path evidence。

### PH-only adapter 更新

- `presentation.ts`：
  - SEA electronic `customsDeclaration=yes` 现在显示 Other Travel Details、General Declaration 的 amount/checklist/Other goods 及 Currency section；所有已证实可供 shared 接入的控件保持 `input_when_shared_ready`。
  - `currencyOwnerNotApplicable`、source/purpose `OTHER`、physical/courier、BSP 分别控制 owner/recipient、Other text、transport child fields 与 BSP date，不再全局显示。
  - Owner N/A stable selector、owner/recipient full requiredness、physical child requiredness和 BSP supporting document 仍输出 `manual_review`。
  - SEA manual 仍只显示手工 Baggage/Currency forms 阻断；SEA electronic `No` 不显示 positive General/Currency fields；未知 path 不推断电子字段。
  - SEA positive `signature_review` 显式输出 attachments/signature 的 `official_only` 记录与 post-Currency blocked reason；Family/companion/Summary 仅在实际状态到达时作为 `official_only` action gate。所有 presentation 返回 `submitted=false`，reference/QR 继续仅在 `resultFields` 的 `result_only`。
- `shared-integration.ts`：shared dynamic form 解冻后的最小接入点改为“AIR + SEA electronic Customs Yes through Currency”；明确禁止 SEA manual/SEA electronic No 渲染 positive General/Currency，并要求 post-Currency 继续等 E11 证据。

### 测试更新

- `presentation.test.ts` 新增/更新：
  - SEA electronic Yes 显示 Other Travel Details、12 项 checklist、Other goods、owner/recipient、items、source/purpose Other、courier、BSP，并把 attachments/signature 维持 `official_only`。
  - SEA electronic No 与 SEA manual 不显示 positive General/Currency。
  - Owner N/A 隐藏 owner/recipient；physical/courier child fields 互斥。
  - crew/cruise diversion、未知/needs-review 不伪装、Review gates non-submitted、reference/QR result-only 继续覆盖。
- `shared-integration.test.ts`：断言 E10 through-Currency 接入文字和 SEA manual/No 禁止条件。

### 仍冻结的共享接入

1. `components/dynamic-step-form.tsx`：调用 `createPhEtravelFormPresentation()`；只渲染 `input_when_shared_ready`，其余 mode 显示阻断/人工处理。
2. `components/dynamic-form-field.tsx`：添加 PH structured checklist、Other goods、currency groups，但不能把 `manual_review` / `official_only` 变成 required form inputs。
3. `SubmissionStatusStep.tsx` / `lib/submission-result.ts`：继续只以 official reference/confirmation + independent QR artifact 判 submitted；E10 任何 Currency/attachment/signature/Review 状态均不可成功。

### 验证结果

- `npx prettier --check features/ph-etravel/presentation.ts features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/shared-integration.ts features/ph-etravel/__tests__/shared-integration.test.ts`：passed。
- 新增/修改文件与 PH-D worklog 的 trailing-whitespace scan：passed。
- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed。
- 尝试运行 `npx vitest run features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`：未进入测试体；Vitest 加载 config 时写 `node_modules/.vite-temp/vitest.config.mts.timestamp-...mjs` 被环境以 `EPERM` 拒绝。
- 未请求审批、未升级权限、未绕过此环境限制。

## 第十二轮消费 PH-A E11：SEA positive physical + signature boundary（2026-08-04）

> 本轮仅修改 `viza-fe/internal-website/features/ph-etravel/**` 和本 PH-D worklog。未改 shared dirty frontend、package、coordination 或其他 worklog；未浏览官网、未执行 migration/seed/deploy/commit，也未处理真实资料、OTP、Cookie、密码、密钥、付款或 official final Submit。

### 读取与 E11 结论

- 已读取适用 `AGENTS.md`、协调总览第 24 节、field contract E11，以及 PH-A/PH-B/PH-C/PH-D 最新段。
- E11 确认 SEA electronic positive physical-transfer branch 中：`no_of_days_in_philippines` 和 `last_travel_to_philippines` 均在 physical branch 下 required。
- E11 到达 positive attachments/signature page：显示 upload prompt、642x398 signature canvas，并在 signature 空白时出现 Required。它没有确认 stable file input、MIME、size、count 或 attachment requiredness。
- E11 未跨过签名；positive-path Family Member(s)、no-companion confirmation、Summary、final Submit/reference/QR/result 仍无证据。E9 的 no-declaration Family/Summary 不得外推。

### PH-only adapter / spec 更新

- `presentation.ts`：
  - 仅当 `SEA + electronic_customs + Customs Yes + physical` 时，`currency.days_in_philippines` 与 `currency.last_travel_to_philippines` 以 `input_when_shared_ready` 返回，并带 `requiredWhen=currency.transfer_method === is_physically_transferred_by_person`。
  - courier、electronic No、manual 与未知路径不显示/不要求上述 two physical fields；AIR physical 保持先前 `manual_review` requiredness。
  - attachment 改为 `attachments.upload_rules` 的 `static_notice + official_only`，记录 upload prompt 已见但规则未知；不再把它作为 file-upload applicant question。
  - 已到 signature page 时，`signature.applicant_signature` 为 `signature_pad + action_required`，带 page-reached required condition；它不是文件上传、不是 submitted。
  - positive-path Family/companion/Summary 外部状态仍只产生 `official_only` gate；`submitted=false` 不变，reference/QR 继续 `result_only`。
- `shared-integration.ts`：最小 future patch 增加 physical branch required rule、signature canvas action rule、attachment official-only rule，并禁止非 physical branch 展示 physical fields、禁止把 signature 变成文件上传题、禁止用 E9 关闭 positive Family/Summary gate。

### 测试更新

- `presentation.test.ts` 覆盖 E11 physical required condition、courier/No/manual isolation、attachment static notice、signature action-required、positive Family/Summary official-only、crew/cruise diversion、Review 非成功与 result-only reference/QR。
- `shared-integration.test.ts` 覆盖 E11 physical/signature/E9 boundary 的 future shared integration spec。

### 验证结果

- `npx prettier --check features/ph-etravel/presentation.ts features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/shared-integration.ts features/ph-etravel/__tests__/shared-integration.test.ts`：passed。
- 修改文件与 PH-D worklog 的 trailing-whitespace scan：passed。
- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed。
- 尝试运行 `npx vitest run features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`：Vitest 还未进入测试体即无法在 `node_modules/.vite-temp/` 写配置临时文件，报 `EPERM`。
- 未请求审批、未升级权限、未绕过限制。

## 第十三轮：官方页面/字段顺序 PH-only contract（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。未修改 shared dirty dynamic/result/status 文件、package 文件、协调总览或其他 worklog；未浏览官网，未执行 migration、seed、deploy、commit、真实资料/OTP/Cookie/密码/密钥/付款或 official final Submit。

### 读取与证据边界

- 已读取适用 `AGENTS.md`、协调总览最新第 26 节、arrival field contract 与 PH-A/PH-B/PH-C/PH-D 最新段。
- 第 26 节指定 PH-D 将已证实 AIR/SEA 页面顺序收敛为前端契约；它不授权将 shared dynamic/result/status 文件解冻。
- 所有顺序仅针对 arrival wizard：不把账号、OTP、结果 artifact 或最终 Submit 当作 applicant question。
- AIR Customs `No` 的后续 wizard 顺序没有被独立观察，因此契约只到 Travel -> Health -> Customs Confirmation；续页以 `official_evidence_required` action-only gate 表示，未借用 AIR positive 或 SEA electronic No 的顺序。
- SEA manual 只确认 Travel -> Health -> manual Baggage/Currency forms notice -> Family -> no-companion confirmation -> Summary；未推断固定 wizard page index 或 signature page。
- SEA electronic No 使用 E9 已证实顺序：page 0 Travel -> 1 Health -> 2 Customs Confirmation -> 3 Other Travel Details -> 4 Attachments/Signature -> 5 Family -> no-companion modal -> 6 Summary。Summary/visible Submit 仍不等于 submitted。
- SEA electronic Yes 使用 E10/E11 已证实顺序到 page 6 Attachments/Signature：0 Travel -> 1 Health -> 2 Confirmation -> 3 Other Travel Details -> 4 General -> 5 Currency -> 6 Attachments/Signature。签名后 Family/no-companion/Summary/final Submit/reference/QR 一律仍是 `official_evidence_required`；未把 E9 No 分支外推到 Yes。
- AIR positive 使用 E7 已证实顺序：2 Confirmation -> 3 Other Travel Details -> 4 General -> 5 Currency -> 6 Attachments/Signature -> 7 Family -> Summary 8；Family 无成员时的 confirmation 是 action gate，final Submit/reference/QR 未观察。

### PH-only ordered contract

- 新增 `features/ph-etravel/page-contract.ts`：`createPhEtravelOrderedPageContract()` 从 `createPhEtravelFormPresentation()` 解析字段，按页面只保留字段 key 顺序；它不复制/维护第二套条件显示或 requiredness 逻辑。
- 覆盖五个 consumer-ready path：`air_no_declaration`、`air_positive`、`sea_manual`、`sea_electronic_no` 与 `sea_electronic_yes_through_signature`。
- 每页输出 official title、已观察 wizard index（只在已证实时输出）、section order、按已解析 presentation field 的 field order、conditional field keys、evidence status 和 action-only gates。
- Signature canvas、Family independent declaration、no-companion confirmation、Summary/Submit 都为 action-only，不会成为普通申请答案或成功状态。`result.official_reference` 与 `result.qr_artifact` 仍只在 `resultFields` 且 `result_only`；每条路径均固定 `submitted=false`。
- 更新 `shared-integration.ts`：shared `dynamic-step-form.tsx` 解冻后最小接入为先调用 `createPhEtravelOrderedPageContract()`；只渲染 `presentation.ts` 已解析的 input fields，并将未观察 continuations 显示为安全 action/review gate。不得根据该契约显示 reference/QR、模拟 Submit 或把 signature 变成上传题。
- 更新 PH 模块 `AGENTS.md`，注明 `page-contract.ts` 的单一责任与不复制条件逻辑规则。

### 测试与校验

- 新增 `features/ph-etravel/__tests__/page-contract.test.ts`：覆盖 AIR No 边界、AIR positive 顺序、SEA manual/electronic 隔离、SEA electronic No Family/Summary 顺序、SEA electronic Yes signature boundary、conditional physical/courier isolation、signature/family/summary 非成功及 reference/QR result-only。
- 更新 `shared-integration.test.ts`：断言 future shared dynamic form 必须消费 `createPhEtravelOrderedPageContract()`。
- `npx prettier --check` 先发现此次涉及的 PH 文件存在格式差异，随后对同一允许范围运行 `npx prettier --write`；复查通过。
- `npx vitest run features/ph-etravel/__tests__/page-contract.test.ts features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`：passed，3 files / 20 tests。
- 本轮 Vitest 未再出现先前的 `.vite-temp` `EPERM`；测试真实执行并通过。
- 当前 `git status --short` 显示 shared/package 仍有既存 dirty 项；本轮未触碰它们。

### Shared 解冻后的最小接口

1. `components/dynamic-step-form.tsx` 仅在 `country=philippines` + `visaType=PH_ETRAVEL_ARRIVAL_CARD` 时调用 `createPhEtravelOrderedPageContract(path)`，以 `pages[].fields` 的既定顺序渲染 `input_when_shared_ready` 字段。
2. `pages[].conditionalFieldKeys` 必须继续由 `createPhEtravelFormPresentation()` 的当前分支判断决定显隐；shared 不得自行推断 AIR/SEA、manual/electronic、Customs Yes/No 或 physical/courier。
3. `pages[].actionOnlyGates` 必须渲染为安全的 action/review 提示，不能写入 applicant answers；AIR No continuation 与 SEA positive post-signature 只能等待官方证据。
4. result/status 接入仍需共享文件解冻，且只能通过 official reference/confirmation + independent QR artifact 显示 submitted success。

## 第十四轮：消费 E13 官方选项与 SEA port-flow presentation contract（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。未修改 shared dirty 文件、package、coordination 或其他 worklog；未访问官网、未执行 migration、seed、deploy、commit、真实资料/OTP/Cookie/密码/密钥/付款或 official final Submit。

### E13 输入与安全边界

- 已读取适用 `AGENTS.md`、协调总览第 27 节、field contract E13、PH-A/PH-B/PH-C/PH-D 最新段和当前 `git status --short`。shared dynamic/result/status 与 package 文件仍 dirty，保持不碰。
- E13 的来源是无登录官方公开 bundle/API：arrival purpose 16、occupation 15、monetary instrument 16 为完整小列表；countries 250、currencies 263、SEA `destination_port_code` ports 53 均保留可复取 endpoint/query/schema/count/日期，不复制为前端长期数据表。
- SEA page-0 流向只可由 `destination_port_code` 对应行的 official `with_custom_declaration` 决定。`disembarking_port_code` 是独立的 `TRAVEL_PORT` destination child，绝不可作为 customs flow selector。
- `with_custom_declaration=1` 是公开 bundle 的电子页面序列元数据；`0` 只证明 bundle 不插入该电子序列，不证明所有 0 港口拥有同一完全手工页面、requiredness 或最终可提交行为。两种结果都必须与实际官方页面内容再核对。
- 未知、缺失、重复/非法或超过 24 小时的 snapshot 一律不选择 flow，返回 action/review gate；metadata 不会被升格为 live requiredness、附件规则、签名完成或 submitted 证据。

### PH-only adapter 更新

- 新增 `official-options.ts`：
  - `PH_ETRAVEL_OFFICIAL_OPTION_SOURCES` 记录官方相对 endpoint、`q`/`paginate=0` 与必要过滤参数、official value/label field、retrievedAt 和 evidence class。
  - 仅把 E13 完整小列表写为受测常量：arrival purpose（official `code`）、occupation（official `code` 和 `forArrival`/`forDeparture` metadata）、monetary instrument（numeric `id`）。
  - country/currency/SEA destination port 均为 `dynamic_query` source：country persist `code`，currency persist numeric `id`，不以可能重复的 currency label 作标识。
- 新增 `port-flow.ts`：
  - `PhEtravelSeaDestinationPortSnapshot` 由未来官方 source/provider 注入，并只含 `code`、`label`、`withCustomDeclaration` 与 `retrievedAt`；53 条官方 row 未复制进 PH frontend。
  - `resolvePhEtravelSeaDestinationPortFlow()` 将 `1` 解析为 `electronic_customs`，将 `0` 解析为 `manual_forms_review`，并固定 `requiresActualPageContentConfirmation=true`。
  - 缺少 `destination_port_code`、unknown code、metadata 重复/非法、snapshot 缺失/过期均 fail-closed；无任何 electronic/manual 默认值。
- 更新 `page-contract.ts`：
  - 新增 `createPhEtravelSeaPortOrderedPageContract()`。电子 metadata 需先有 Customs Yes/No 才选择 `sea_electronic_yes_through_signature` 或 `sea_electronic_no`；0 metadata 接入 `sea_manual` 同时附加 manual continuation evidence gate。
  - 当实际官网页面显示与 metadata 预期相反时，返回 `sea.destination_port_flow_mismatch` action-only gate 与空 contract，停止按假设路径渲染/推进。
  - 正向 electronic flow 的 signature 后 Family/Summary 未观察边界、manual Family/Summary 非成功、reference/QR result-only 和 `submitted=false` 沿用第十三轮契约。
- 更新 `shared-integration.ts` 和 PH module `AGENTS.md`：共享 `dynamic-step-form.tsx` 解冻后应消费 `createPhEtravelSeaPortOrderedPageContract()` 与 option-source contract；不得自行缓存/猜测港口 metadata、用 `disembarking_port_code` 分流或将 0/1 当最终 acceptance。

### 测试与验证

- 新增 `official-options.test.ts`：校验三个完整小列表的数量、value/label 唯一性、关键 purpose/instrument/occupation metadata，以及 countries/currencies/SEA ports 仍是可查询 source 而非静态 snapshot。
- 新增 `port-flow.test.ts`：覆盖 port metadata 1/0、missing/unknown/invalid/stale fail-closed、destination/disembarking 隔离、manual/electronic ordered-contract selection、实际页面 mismatch、SEA electronic positive signature 后边界及 result-only reference/QR。
- 保留 `page-contract.test.ts`、`presentation.test.ts`、`shared-integration.test.ts` 路径隔离与 non-success gate 回归。
- `npx prettier --write` 后复查通过。
- `npx vitest run features/ph-etravel/__tests__/official-options.test.ts features/ph-etravel/__tests__/port-flow.test.ts features/ph-etravel/__tests__/page-contract.test.ts features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`：passed，5 files / 28 tests。
- 修改范围与 PH-D worklog 的 trailing-whitespace scan：passed；`git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无输出。

### Shared 解冻后的最小消费接口

1. 官方 source/provider 在每次 refresh 生成 `PhEtravelSeaDestinationPortSnapshot`，保留 retrieval timestamp；shared UI 不持久化一份 53-port 代码常量。
2. UI 仅以 applicant 的 `destination_port_code` 调 `createPhEtravelSeaPortOrderedPageContract()`；`disembarking_port_code` 继续只服务 `stay_location_type=TRAVEL_PORT`。
3. source stale、unknown、invalid、Customs answer missing 或 actual page mismatch 时，显示安全 action/review，不能默认电子/手工，也不能写 applicant answer 或 enqueue。
4. 已得到 page contract 后，shared 仍须仅渲染 `input_when_shared_ready`，把 manual review/official-only/action-only 输出为阻断；最终 success 仍需 independent QR + official reference/confirmation。

## 第十五轮：消费 E14 attachment / Owner N/A presentation contract（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。未修改 shared dirty 文件、package、coordination 或其他 worklog；未访问官网、未执行 migration、seed、deploy、commit、真实资料/OTP/Cookie/密码/密钥/付款或 official final Submit。

### E14 证据与边界

- 已读取适用 `AGENTS.md`、协调总览第 28 节、field contract E14、PH-A/PH-B/PH-C/PH-D 最新段和当前 worktree。shared frontend 继续冻结。
- E14 公开 bundle 只证明：条件 attachment widget 使用 `attachments[]` multi-file state，accept PNG/JPG/JPEG，每个文件在客户端按 5,242,880 bytes / 5.00 MB 检查；它不证明 attachment count、aggregate limit、live requiredness、server-side MIME/size/count 或上传接受。
- attachment widget 的 render condition 与 signature schema requiredness 不同：公开 parent 仅在 `with_something_to_declare` truthy 时渲染 attachment widget，而 signature canvas 仍是独立 action-only gate。通用 `#file` 是 widget markup，不是稳定跨页 selector。
- E14 证明 `owner_details_not_applicable` 是 Currency Declaration 内的 boolean state；true 时清空并禁用 13 个 owner 与 13 个 recipient direct fields，false/uncheck 只重置 boolean。它不证明 stable DOM selector、person/business condition 或 owner/recipient live requiredness。

### PH-only presentation helpers

- 新增 `attachment-contract.ts`：
  - `createPhEtravelAttachmentPresentation()` 只在 AIR positive 或 SEA electronic positive customs context 输出可见的 `official_boundary_notice`；manual、Customs No、unknown SEA path 不显示。
  - contract 明确 `multiple=true`、PNG/JPG/JPEG、`5_242_880` bytes per file，以及 `countRule=unknown`、`aggregateSizeRule=unknown`、`liveRequiredness=unknown`、`serverRules=official_review_required`。
  - `validatePhEtravelAttachmentClientHint()` 仅作客户端 MIME/per-file size hint；不代表可上传、附件数量、服务端结果或提交成功。
- 新增 `owner-na.ts`：
  - `createPhEtravelOwnerNaPresentation()` 只在 AIR positive 或 SEA electronic positive Currency Declaration context 显示 Owner N/A；manual、Customs No 与 non-currency context 均不可见。
  - true 时 `applyPhEtravelOwnerNaNormalization()` 清除已证实的 26 个 owner/recipient official field values，并标记 controls disabled；false 时保留值并保持 requiredness unknown。
  - physical/courier 是独立 currency transport sub-branch，Owner N/A 不修改两者的 requiredness/显示规则。
- 更新 `presentation.ts`：AIR positive 与 SEA electronic positive 已到 signature page 时都输出 `attachments.upload_rules` 的 `static_notice + official_only`。文案只包含 E14 client hint 与未知边界；signature 仍为 `signature_pad + action_required`，不是文件上传题。
- 更新 `shared-integration.ts` / module `AGENTS.md`：shared 解冻后最小消费应调用 attachment/Owner helpers；不得以此解除附件、Owner/recipient、signature 或结果成功门禁。

### Shared 解冻后的最小接口

1. `dynamic-step-form.tsx` 仅在正向 electronic attachment/signature context 调用 `createPhEtravelAttachmentPresentation()`；显示 PNG/JPG/JPEG、5.00 MB per-file 的客户端提示，同时显示 count/live requiredness/server rules 未确认。不得全局要求附件或使用 `#file`。
2. shared currency form 仅在已到 Currency Declaration 且 Owner N/A visible 时调用 `applyPhEtravelOwnerNaNormalization()`；true 清值/禁用，false 不猜 requiredness。不能把 helper 当 runner selector。
3. physical/courier 的现有条件控制保持独立；Owner N/A、附件 hint 与 SEA port metadata 都不代表 official final acceptance。
4. result/status 继续以 official reference/confirmation + independent QR artifact 才可 submitted；signature、Family、Summary、attachment hint 均不构成成功。

### 测试与校验

- 新增 `attachment-contract.test.ts`：覆盖 positive visibility、manual/No/unknown 隔离、PNG/JPG/JPEG 与 5.00 MB exact boundary、过大/非图片拒绝，以及 count/requiredness/server unknown contract。
- 新增 `owner-na.test.ts`：覆盖 26 direct fields true 清空/禁用、false 不清空且 requiredness unknown、manual/No/non-currency 隔离、physical/courier 不耦合。
- 更新 `presentation.test.ts`：AIR positive signature page 的 attachments official-only notice 回归；更新 `shared-integration.test.ts`：future shared helper/禁止项回归。
- `npx prettier --check`：passed。
- `npx vitest run features/ph-etravel/__tests__/attachment-contract.test.ts features/ph-etravel/__tests__/owner-na.test.ts features/ph-etravel/__tests__/official-options.test.ts features/ph-etravel/__tests__/port-flow.test.ts features/ph-etravel/__tests__/page-contract.test.ts features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/__tests__/shared-integration.test.ts --testTimeout=15000`：passed，7 files / 35 tests。
- trailing-whitespace scan 与 `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无输出。

## 第十六轮：消费 E15 动态 wizard / route evidence contract（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。未修改 shared dirty frontend、package、协调总览或其他 worklog；未浏览官网，未执行 migration、seed、deploy、commit、真实资料/OTP/Cookie/密码/密钥/付款或 official final Submit。

### E15 事实与合同边界

- 已读取适用 `AGENTS.md`、协调总览第 29 节、arrival field contract E15、PH-A/PH-B/PH-C/PH-D 最新段和当前 worktree。
- 官方 `wizard_page` 是 `/wizard/me` 根据 travel type、port metadata、declaration/currency state 动态生成的数组索引，不是跨路径稳定步骤 ID。本轮将 ordered page contract 的每个 page 标为 `wizardIndexMeaning=dynamic_path_result`。
- `/wizard/me` regular route 与短 `/wizard/declaration` 分开建模：前者仅 `status=INCOMPLETE` 时在 Summary 前有 Family Member(s)；无成员仍须 no-companion confirmation modal。短 route 不插入 regular Family flow，不能借用其 Family/Summary 顺序。
- SEA electronic positive 已证实到 signature；其后的 regular Family/no-companion/Summary 只可作为静态 bundle expectation，live continuation 仍为阻断。signature 是 action-only canvas；公开 `image/png` data URL 仅描述官方动作，绝不写入 applicant answer、attachment 或成功结果。
- reference/QR 仍只在 `resultFields` 且为 `result_only`；动态 wizard contract 固定 `submitted=false`。

### PH-only adapter / shared 接入准备

- 新增 `features/ph-etravel/wizard-contract.ts`：`createPhEtravelDynamicWizardContract()` 以语义步骤输出 regular 与 short route，附 route-specific evidence tier、可选 observed index 和 action-only 标记。
- regular SEA electronic positive 将 post-signature Family/no-companion/Summary 显示为 `static_bundle_expectation`，同时保留 `sea_positive_post_signature_live_review` gate；`registrationIncomplete=false` 时只保留 static Summary expectation。
- `reviewPhEtravelDynamicWizardObservation()` 对 unknown route、步骤顺序漂移、Family 后必需 modal 缺失及 Summary 提前出现一律输出 review gate，不继续沿用其他路径顺序。
- 更新 `shared-integration.ts`：未来 `components/dynamic-step-form.tsx` 解冻后必须消费 dynamic wizard helper，分别解释 `/wizard/me` 与 `/wizard/declaration`；只能把 numeric index 作为实际观察证据，禁止把 PNG signature data URL 当附件/结果，也禁止绕过上述 review gate。

### 测试与校验

- 新增 `wizard-contract.test.ts`：覆盖 dynamic index evidence、regular/short route 隔离、SEA positive static continuation、unknown route、order mismatch、missing no-companion modal、early Summary，以及 signature 非答案/非成功和 reference/QR result-only。
- 更新 `page-contract.test.ts`：断言所有 ordered pages 的 index 标识均为 dynamic path result。
- 更新 `shared-integration.test.ts`：断言 shared dynamic form future patch 引入 dynamic wizard helper，且明确禁止 short-route Family/Summary 顺序外推。
- `npx prettier --write features/ph-etravel/wizard-contract.ts features/ph-etravel/page-contract.ts features/ph-etravel/shared-integration.ts features/ph-etravel/__tests__/wizard-contract.test.ts features/ph-etravel/__tests__/page-contract.test.ts features/ph-etravel/__tests__/shared-integration.test.ts features/ph-etravel/AGENTS.md`：passed。
- `npx vitest run features/ph-etravel/__tests__/attachment-contract.test.ts features/ph-etravel/__tests__/owner-na.test.ts features/ph-etravel/__tests__/official-options.test.ts features/ph-etravel/__tests__/port-flow.test.ts features/ph-etravel/__tests__/page-contract.test.ts features/ph-etravel/__tests__/presentation.test.ts features/ph-etravel/__tests__/shared-integration.test.ts features/ph-etravel/__tests__/wizard-contract.test.ts --testTimeout=15000`：passed，8 files / 40 tests。
- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无输出。

### Shared 解冻后的最小接口

1. `components/dynamic-step-form.tsx` 在 PH arrival context 先解析 port-flow 与 ordered page contract，再调用 `createPhEtravelDynamicWizardContract({ route, path, registrationIncomplete })`。UI 只消费语义 step，不以固定数字选择页面。
2. live-observed index 只用于记录/比对实际官方路径；static expectation 或 official-review step 只能显示 action/review，不可自动推进、enqueue、模拟 Submit 或标 submitted。
3. 有 `unknown_wizard_route`、`wizard_step_order_mismatch`、`family_no_companion_modal_missing` 或 `summary_appeared_early` 时，shared UI 必须停止并请求人工/官方流程复核。
4. result/status shared files 继续冻结；即使到达 signature、Family、modal 或 Summary，仍必须 official reference/confirmation 加 independent QR artifact 才可显示成功。

## 第十七轮：消费 E16 result / recovery presentation contract（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。未修改 shared dirty frontend、package、协调总览或其他 worklog；未浏览官网，未执行 migration、seed、deploy、commit、真实资料/OTP/Cookie/密码/密钥/付款或 official final Submit。

### E16 更正与证据边界

- 已读取适用 `AGENTS.md`、协调总览第 30 节、arrival field contract E16、PH-A/PH-B/PH-C/PH-D 最新段和当前 worktree。
- E16 纠正了此前过宽的结果假设：公开 bundle 的 `/qr-code` 是从重新读取的 registration `reference_number` 在客户端渲染 QR；没有证据证明 final POST 返回独立 QR 文件、可下载/可打印 artifact 或其可扫描性。
- HTTP 200、导航到 preparing、Summary/Submit 可见、本地 reference-shaped string 或本地 QR 都不是 submitted。只有 authoritative post-submit registration read 提供稳定 `reference_number`，并成功渲染与其一致的 QR，才可显示 `submitted_candidate`；该候选仍固定 `submitted=false`，等待 controlled-live 结果语义核实。
- dashboard/reopen/QR route 仅为 `verified_public_bundle` navigation evidence；download、print、scanability 为 `unknown`。不得向用户承诺这些能力。
- read failure、reference missing、QR render failure/reference mismatch、reopen state mismatch 与 HTTP 200/navigation-only 都进入 `recovery_required`，固定 `noResubmit=true`。恢复只能重读权威 registration，不能自动或引导重复 Submit。

### PH-only adapter / copy / shared 接入准备

- 新增 `features/ph-etravel/result-recovery.ts`：提供 authoritative-source、derived-QR consistency、result state、recovery reason、no-resubmit policy 与 capability evidence contract。
- `status.ts` 改为 re-export result/recovery helpers；用户文案改为 `submitted_candidate` 与 `recovery_required`。手工 SEA、Review 和 action-required 文案均不再称 reference/QR 已保存或可下载。
- `presentation.ts` 保留 reference/QR `result_only`，并明确 QR 是由权威 reference 客户端渲染，非 applicant answer 或独立成功 artifact。
- `completeness.ts` 将 P0 成功门槛更新为 authoritative reference + derived QR consistency，并明确 final Submit、post-submit read、QR scanability 与 recovery 仍为 official evidence gaps。
- `shared-integration.ts` 只更新 PH-only 最小接入说明：未来 `SubmissionStatusStep.tsx` / `lib/submission-result.ts` 解冻后调用 `createPhEtravelResultRecoveryPresentation()`；local/ref-only/200-only/route-open 不可成功，不可重复提交，也不可承诺下载或打印 QR。

### 测试与校验

- `status.test.ts` 覆盖 authoritative source、derived QR reference consistency、200-only/navigation-only、reference missing、render failure、reopen mismatch、local result 非权威、no-resubmit、capability evidence tier，以及 Review/Family/signature non-success。
- `completeness.test.ts` 与 `shared-integration.test.ts` 更新为 E16 result/recovery contract；`eligibility-ui-matrix.test.tsx` 将 ordinary path 的重复英文文案断言限定为存在性，避免选择卡与确认区的同文案产生假失败。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，16 files / 87 tests。
- PH-only code/tests 的旧 independent/downloadable/printable QR success assumption 与旧 helper 名称 scan：无输出；本 worklog 的 E16 之前历史记录保留为已被本节明确 superseded 的审计轨迹。
- trailing-whitespace scan 与 `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无输出。

### Shared 解冻后的最小接口

1. shared status/result adapter 只接收 authoritative post-submit registration read 的 `reference_number`，再传入 derived QR render status/value。它不得接受 final POST 200、navigation、Summary、Submit-visible、本地 reference 或本地 QR 作为结果来源。
2. `submitted_candidate` 只能在 reference 稳定且 derived QR value 一致时出现，且在 E16 live gap 未关闭前不得升级为最终 submitted success；reference missing、render failed/不一致、read failed 或 reopen mismatch 必须显示 `recovery_required`。
3. recovery UI 的唯一自动动作是安全重读状态；`noResubmit=true` 必须阻止 automatic retry、double-submit 和任何“重新提交官网”提示。
4. dashboard/reopen/QR route 仅作为 bundle-observed navigation 提示；download、print、scanability 继续 unknown。共享结果卡、WaitingCard、FailureCard 仍冻结，待 owner 解冻后按此合同接入。

## 第十八轮：消费 E17 111-record frontend coverage parity map（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。未修改 shared dirty frontend、package、协调总览或其他 worklog；未浏览官网，未执行 migration、seed、deploy、commit、真实资料/OTP/Cookie/密码/密钥/付款或 official final Submit。

### E17 parity 结论

- 已读取适用 `AGENTS.md`、协调总览第 31 节、arrival field contract E17、PH-A/PH-B/PH-C/PH-D 最新段和当前 worktree。
- 新增 `features/ph-etravel/coverage-parity.ts`，以 machine-checkable record 记录 111 条 canonical rows：`confirmed_live=51`、`verified_public_bundle=19`、`needs_review=41`。八条 crew/cruise/special/diplomatic/9(e) diversion 单独为 `unsupported_diverted`，不混入 canonical applicant rows。
- 111 条记录分为 `applicant_input`、`profile_owned`、`runtime`、`action_only`、`official_only`、`result_only`；每条均有 path scope、evidence tier、future UI disposition 和 PH helper owner。`auditPhEtravelCoverage()` 检测 duplicate、missing owner、runtime/result UI leak、wrong path 和 needs-review 被启用为 input。
- `profile`、traveller profile/residence、AIR，以及 Health 未闭合分支均输出 profile/eligibility 或 review gate。即使其 semantic category 是 applicant input，shared-ready enabled UI 也不能消费 `needs_review`、profile-owned、runtime/action/result/official-only records。
- E17 canonical result key 为 `result.reference_qr_render`，固定 `result_only`；`result.qr_artifact` 仅作为 non-applicant legacy alias metadata，不是 canonical record、申请问题或用户成功文案。

### Path / helper ownership

- SEA vessel/voyage 不含 AIR；AIR fields 只在 ordinary AIR。Baggage Other Travel Details 不会落入 SEA manual；customs checklist/currency 正向字段不落入 SEA manual；`destination.disembarking_port_code` 不参与 page-0 port-flow selection。
- map 将 travel/AIR 交给 `presentation` + `official-options`，SEA/destination 交给 `presentation` + `port-flow` + `page-contract`，currency 交给 `presentation` + `owner-na` + `attachment-contract`，wizard/status action 交给 `wizard-contract` + `status`，result 交给 `result-recovery`。
- shared integration package 已补最小未来接口：`dynamic-step-form.tsx` 解冻后必须先按 resolved path 取 `getPhEtravelEnabledApplicantCoverage()`；只有 `applicant_input + input_when_shared_ready` 可以渲染。其它 record 一律通过 eligibility/review/action gate 呈现，不可静默补题。

### 测试与校验

- 新增 `coverage-parity.test.ts`：断言 111 行唯一性、`51/19/41` evidence count、8 条 diversion、profile/residence/AIR/Health gate、manual/electronic path isolation、runtime/result exclusion、canonical result/legacy alias boundary，以及 duplicate/missing/wrong-path/leak/review violation audit。
- 更新 `shared-integration.test.ts`：future dynamic form 必须消费 E17 enabled-applicant filter，并明确禁止 legacy `result.qr_artifact` alias、account runtime 或 diverted identity 进入问题/成功能力。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，17 files / 92 tests。
- trailing-whitespace scan 与 `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无输出。

### Shared 解冻后的最小验收

1. dynamic form 在渲染前必须调用 coverage audit，并以 port-flow/route 实际 path 过滤 `getPhEtravelEnabledApplicantCoverage(path)`；unknown path、review record 或 audit issue 都必须停在 gate。
2. profile/residence/AIR/Health P0 未闭合 branch 只能显示 eligibility/review，不可通过 generic dynamic field fallback 变成必填输入。
3. runtime、Family/Summary/signature action、official-only declaration/file boundary、result reference/QR、legacy QR alias 和 diversion records 都不可写入 applicant answers、form schema 或成功 UI。
4. shared status/result files仍冻结；E16 的 authoritative result read + reference-derived QR recovery contract 继续是唯一 result candidate 入口，且没有自动 resubmit。

## 第十九轮：消费 E18 S0-S8 launch-readiness presentation contract（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。未修改 shared dirty frontend、package、协调总览或其他 worklog；未访问官网，未执行 migration、seed、deploy、commit、真实资料/OTP/Cookie/密码/密钥/付款或 official final Submit。

### E18 场景合同

- 已读取适用 `AGENTS.md`、协调总览第 31 节、arrival field contract E17/E18、PH-A/PH-B/PH-C/PH-D 最新段和当前 worktree。
- 新增 `features/ph-etravel/launch-readiness.ts`，把 E17 的 41 条 `needs_review` rows 精确且只一次地分配到 S0-S4、S6-S8：S0 account boundary (P1)、S1 profile/persona/residence (P0)、S2 AIR/destination (P0)、S3 Health (P0)、S4 SEA explicit-false/manual boundary (P0)、S6 currency/attachment (P0)、S7 acknowledgement (P1)、S8 result/recovery (P0)。
- S5 是不重复 canonical row 的 SEA electronic-Yes post-signature P0 path-evidence scenario。它不会借 E9 no-declaration 的 Family/Summary 当作 Yes branch 成功或完整性证据。
- 全部当前场景固定 `state=review`、`authorization=stop_before_submit`、`noResubmit=true`；unsupported identity 输入会得到 `diverted`。`eligible` 仅保留为未来受控证据闭合后的状态类型，当前没有任一 scenario 进入该状态。
- S8 只包含 `result.official_reference`、`result.reference_qr_render`，明确为 result-only 候选与 stop-before-submit。它不授权 final Submit、reload/in-flight retry、二次申请或任何官方结果承诺。

### 前端展示和 shared 接入边界

- 每个 scenario 仅提供简短的中英 review 文案与“需要复核”动作标签；不输出 selector、internal reason、字段值、reference、QR、PII 或技术运行细节。没有 `retry submit` 用户动作。
- `auditPhEtravelLaunchScenarios()` 检测 duplicate scenario、重复 gap 分配、遗漏的 41 条 needs-review、非 needs-review key、unsafe authorization 与 runtime/result 被提升为输入。
- 更新 PH-only `shared-integration.ts`：shared `dynamic-step-form.tsx` 解冻后除 E17 coverage filter 外，还必须消费 `PH_ETRAVEL_LAUNCH_SCENARIOS` / `getPhEtravelLaunchReadiness()`。S0-S8 一律显示安全 gate；不得依赖 PH-C 尚未完成的内部 reason code。

### 测试与校验

- 新增 `launch-readiness.test.ts`：覆盖完整 S0-S8、41 gaps 单次归属、P0 分组、review/diverted 状态、S8 result-only/no-resubmit/nontechnical copy，以及 duplicate/unsafe/non-review audit。
- 更新 `shared-integration.test.ts`：future shared dynamic form 必须消费 scenario readiness helper，并明确禁止将 S0-S8、reference/QR candidate、signature、attachment、Family/Summary 或 review gate 暴露为 retry-submit action。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，18 files / 96 tests。
- trailing-whitespace scan 与 `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed，无输出。

### Shared 解冻后的最小验收

1. shared UI 先做 E17 path filter，再调用 `getPhEtravelLaunchReadiness()`；任何 S0-S8 分支都只能显示 review/diverted state，不能渲染 unresolved applicant input 或调用 retry-submit。
2. S1/S2/S3/S4/S6 的 P0 gaps、S5 post-signature path gap 及 S8 result/recovery 都必须保留 stop-before-submit；S0/S7 P1 boundary 同样不能绕过 account/runtime/acknowledgement 限制。
3. 用户可见 copy 只能使用 scenario 的非技术 review 文案。result/runtime、legacy QR alias、官方路径、selector、reason code、值和申请人资料均不得进入展示。
4. shared status/result files继续冻结；S8 的 reference-derived QR 仍只是 result-only candidate，直至另行授权的 controlled live evidence 闭合。

## 第二十轮：消费 PH-C launch-preflight 安全结果的 PH-only 状态映射（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。已读取适用 `AGENTS.md`、协调总览第 32 节、PH-C 第十八轮、E18 field contract、PH-A/PH-B/PH-C/PH-D 最新段和当前 worktree。未改动 shared dirty status/result/dynamic 文件、queue、runner、backend、package、协调总览或其他 worklog；未访问官网、未执行 migration、seed、deploy、commit、真实资料/账号/OTP/Cookie/密码/密钥/付款或 official final Submit。

### PH-C 安全 preflight -> 前端状态合同

- 新增 `features/ph-etravel/preflight-status.ts`。它只接受版本化、PII-free 的 PH-C 结果 envelope：`contractVersion`、`status`、allowlisted safe code(s)、canonical key(s) 与固定 `officialResubmitAllowed=false`。当前 PH-C 第十八轮 pure output 使用 `status/code/blockingCodes/missingKeys`，但尚未公开版本字段和 frontend 形状；因此真实 shared 接入前，缺少 `contractVersion=ph_etravel_launch_preflight_v1` 或仍使用 `missingKeys` 的结果会安全地落在 review/action-required，绝不被解析成 allowed/success。
- allowlisted code 只在 PH-only 内部映射到 E18：S1 profile/persona/residence/FOR OTHER/unsupported、S2 AIR、S3 Health positive、S4 SEA disembarking/customs flow、S5 SEA electronic-positive continuation、S6 currency/attachment、S8 final result/recovery。S0/S7 没有 PH-C 第十八轮 preflight safe code，仍由原有 runtime/acknowledgement launch-readiness gate 管理。
- `allowed` 仅说明 preflight 未找到当前 blocker；展示模型仍为 `action_required + stop_before_submit + submitted=false + noQueue/noBrowser/noResubmit`。它不授权创建队列、启动浏览器、final Submit、retry 或 result success。`action_required` 同样固定为上述禁止状态；`diverted` 只给出“使用适用官方入口”的非技术文案。
- 对未知 status/code、未知/缺失版本、keys 缺失或重复、code/key 不属于同一映射场景、`officialResubmitAllowed !== false`、额外 raw payload 或 PII-shaped value，一律 fail-closed 到通用 review。用户展示模型不含 canonical key、safe code、selector、internal reason、raw official/provider message 或申请人值；诊断只保留无值的测试型分类，不能进入用户 copy。
- 继续保持 41 个 E17 gap 的唯一归属：adapter 只读取既有 `launch-readiness.ts`，不会新增、复制或把 result/runtime 变成申请题。S8 仍是 `result_only`，reference/QR 仍非成功、更非允许重提的依据。

### PH-only 改动和测试

- 新增 `preflight-status.test.ts`：覆盖 P0 code -> S2/S3/S6、unsupported diversion、allowed 仍 stop-before-submit、版本不匹配、未知 code、缺/重复/out-of-scenario key、错误 resubmit 标记、PII/raw official payload 拒绝，以及 41-gap single-owner readiness 组合。
- 更新 `shared-integration.ts` 和其测试：shared `dynamic-step-form.tsx` 解冻后必须调用 `createPhEtravelPreflightUserPresentation()`；只能消费版本化 safe envelope，且 allowed preflight 不能直接创建 queue/browser 或显示 submitted。未修改该 shared 文件。
- 更新 PH 专属 `AGENTS.md`，标明 preflight adapter 的版本/PII/stop-before-submit 边界。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，19 files / 102 tests。

### Release 门禁与接口请求

1. **PH-C / API contract P0**：在对 frontend 暴露 preflight 前，请提供 versioned envelope：`contractVersion: "ph_etravel_launch_preflight_v1"`、`status`、`code`、`blockingCodes`、`canonicalKeys`、`officialResubmitAllowed: false`；禁止提供/透传 `message`、申请答案、官方文本、PII、selector、token 或 portal/runtime 数据。现有 `missingKeys` 需在 PH-C boundary 内安全规范化为 `canonicalKeys`，不由 shared UI 猜测兼容。
2. **Shared UI 仍冻结**：解冻后先 path/coverage filter，再使用本 adapter 和 E18 readiness；任一解析失败、blocked/diverted 或 allowed 都不得入队、启动浏览器、重试或显示 submitted。shared status/result/dynamic 文件本轮完全未触碰。
3. **官方/发布仍 P0 blocked**：S1-S8 controlled evidence、final Submit、authoritative registration read、stable reference、derived QR validation、ambiguous-submit/reopen recovery、以及 DB atomic RPC 未闭合。S8 必须持续 stop-before-submit，不能因 preflight allowed 或 Review/Summary 可见而放开结果成功。

## 第二十一轮：PH-C v1 launch-preflight envelope 跨层兼容验证（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。已读取适用 `AGENTS.md`、协调总览第 34 节、PH-C 第二十轮和 PH-D 第二十轮记录及当前 worktree。未改 shared dirty status/result/dynamic 文件、queue、runner、backend、package、协调总览或其他 worklog；未访问官网、未执行 migration、seed、deploy、commit、真实资料/账号/OTP/Cookie/密码/密钥/付款或 official final Submit。

### v1 兼容结论

- 对照 PH-C 已发布的 `ph_etravel_launch_preflight_v1`，PH-only adapter 的字段和词表无 drift：`contractVersion`、`status`、optional `code`、`blockingCodes`、`canonicalKeys`、固定 `officialResubmitAllowed=false` 均一致；`allowed` 为空 code/code-list/key-list，`action_required` 与 `diverted` 使用完整 PH-C allowlist。
- 在 `preflight-status.test.ts` 建立 PH-C v1 compatibility fixtures，逐项覆盖 13 个公开 safe codes 及其真实 canonical key 集合，并覆盖 allowed/action-required/diverted 三种 outcome。fixture 对每个 code/key 进入同一 S0-S8 read-only mapping；不读取 backend 模块，也不在 frontend 猜测或兼容 legacy `missingKeys`。
- adapter 现要求 `blockingCodes` 和 `canonicalKeys` 均为 PH-C 的确定性字典序。重复或乱序、错误版本、unknown status/code、缺 key、跨 code/key、`officialResubmitAllowed=true`、extra/raw payload、PII-shaped value 全部 fail-closed 为通用 action-required；不泄露被拒绝的值、code 或 key。
- 三种合法状态及所有非法输入的 user presentation 均固定 `authorization=stop_before_submit`、`submitted=false`、`noQueue=true`、`noBrowser=true`、`noResubmit=true`。`allowed` 仍非 submitted、非 browser/queue/final Submit 权限，S8 result gate 未被绕过。

### Shared 解冻后的最小接入

- 更新 PH-only `shared-integration.ts`：未来 dynamic form/status consumer 必须先验证 versioned、deterministically sorted envelope，再调用 `createPhEtravelPreflightUserPresentation()`；不得把 unknown、重复、乱序或 value-bearing envelope 作宽松兼容，也不得显示 PH-C code/key/diagnostic 或 raw message。
- shared status/result/dynamic 组件继续冻结，本轮未修改。无新增 shared API drift；唯一消费前提是 PH-C 继续保持第 34 节已发布的 v1 exact envelope。

### 测试与校验

- 定向 fixtures 覆盖：完整 v1 field/code/key compatibility、deterministic ordering、allowed/action-required/diverted、unknown/version error、duplicate/out-of-scenario key、unknown code、extra/raw/PII payload、无 queue/browser/retry/success、41 E17 gap 单次归属。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，19 files / 104 tests。
- 中途有一条聚合 fixture 因 key 字典序不符合 PH-C v1 被 adapter 正确拒绝；修正 fixture 排序后通过，未放宽校验。

### 仍阻塞 release

1. Shared frontend 仍冻结；本轮只是 PH-only compatibility verification，不是 status/result/dynamic 接线或 enqueue 开放。
2. 第 34 节的 P0/P1 blockers 不变：S1-S8 controlled evidence、final Submit、authoritative stable reference、derived QR validation、ambiguous/reopen recovery、DB single-transaction RPC 与 worker cutover 均未闭合。
3. PH-C v1 envelope 是 launch gate 的安全状态合同，不是 submitted/result 成功合同；任何 future contract-version 或词表变化都必须先经 compatibility fixture 审核，否则维持 fail-closed。

## 第二十二轮：消费 E21 frontend coverage / profile presentation（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。已读取适用 `AGENTS.md`、协调总览第 35 节、field contract E21 和 PH-D 最新段。未修改 shared dirty status/result/dynamic 文件、queue、runner、backend、package、协调总览或其他 worklog；未访问官网，未执行 migration、seed、deploy、commit、真实资料/账号/OTP/Cookie/密码/密钥/付款或 official final Submit。

### E21 coverage 与 profile/review 合同

- `coverage-parity.ts` 现按 E21 canonical tally 记录 `56 confirmed_live / 19 verified_public_bundle / 36 needs_review / 8 diverted`。五项已有正向 profile evidence 的基本身份记录不再计入 remaining gap；其 profile-owned disposition 未被改成 enabled applicant input。`launch-readiness.ts` 的 S1 同步移除这五个已闭合 gap，因此剩余 36 条 needs-review 仍精确单次归属到 S0-S8。
- 新增 `profile-presentation.ts`，明确记录 `profile.photo_url`、`traveller.mobile_number` 与全部 residence keys 的二层证据：client contract 是 `verified_public_bundle`，live/server evidence 仍为 `needs_review`，展示 mode 固定为 `profile_or_review_gate`。
- FILIPINO/FOREIGNER passport-holder choice 不控制 PH residence branch；只有 residence `country_code === PH` 才显示 region/province/municipality/barangay review gates。未选择/未知 country 保持 unresolved。两种 passport-holder 都不会从 E21 被承诺照片、手机号或地址已被官方接受。
- PH residence clear graph 仅按公开 bundle 记录：country change 清空 region/province/municipality/barangay/street/street-two；province change 清空 municipality/barangay；municipality change 清空 barangay。它不是 live API request、server validation 或 registration acceptance 证据。
- 用户可见 profile gate 持续固定 `stop_before_submit`、`submitted=false`、`noQueue=true`、`noBrowser=true`、`noResubmit=true`。photo client wiring 不展示 5 MB、camera 或 upload acceptance 承诺；mobile preset/mask、address cascade、client required/optional hints 同样不表示官方 server 接受或 requiredness。

### Shared 解冻后的最小接入

- 更新 PH-only `shared-integration.ts`：shared dynamic form 解冻后只能通过 `createPhEtravelProfilePresentation()` 消费 E21 client contract，按 passport-holder 和 residence-country 分支显示 review gate；不得将 widget wiring/client schema 变成普通 applicant question、文件要求、上传规则、成功能力或 enqueue/browser 权限。
- shared status/result/dynamic 组件仍冻结，本轮未修改。

### 测试与校验

- 新增 `profile-presentation.test.ts`：验证 FILIPINO/FOREIGNER 与 PH/foreign residence 分支隔离、PH cascade 清空、照片/mobile 不产生文件/接受承诺，以及 bundle-only gate 的 noQueue/noBrowser/noResubmit/non-submitted。
- 更新 coverage/readiness/preflight/shared-integration tests：断言 E21 `56/19/36/8`、36 gap 单次归属和 future shared profile contract。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，20 files / 108 tests。

### 仍阻塞 release

1. E21 是 zero-login public-bundle evidence，不关闭 photo upload/server acceptance、mobile format/requiredness/server acceptance、residence option values/request timing/server rules或端到端 payload acceptance。
2. shared frontend 继续冻结；没有实装 profile UI、status/result/dynamic 接线、enqueue 或 browser action。
3. S1-S8 controlled evidence、final Submit、authoritative registration read/reference/derived QR/recovery 以及 DB atomic RPC/worker cutover 仍为 release blockers。

## 第二十三轮：消费 E22 AIR/destination presentation 与 coverage（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。已读取适用 `AGENTS.md`、协调总览第 36 节、field contract E22 和 PH-D 最新段。未修改 shared dirty status/result/dynamic 文件、queue、runner、backend、package、协调总览或其他 worklog；未访问官网，未执行 deployment、真实资料或官方 final Submit。

### E22 AIR / destination 纯展示合同

- 新增 `air-destination-presentation.ts`。它将 E22 public-bundle 的 AIR 和 destination wiring 显示为 review-gated contract，不提供可提交表单、queue/browser action 或成功能力。AIR 以外或非 arrival 输入返回 `not_applicable`，不会把 AIR Transit/Hotel/Special Flight 字段套到 SEA。
- `air.is_special_flight` 固定是 derived display state：只有 `flight_number === SPECIAL FLIGHT` 时 active，且明确 `isApplicantAnswer=false`、`excludedFromPayload=["air.is_special_flight"]`。Special Flight 的唯一 detail 使用 official key `flight_number_special`，仍是 live/server review gate；没有新增 boolean applicant answer 或 payload 映射。
- AIR `with_transit=true` 才给出 transit country/port/date review fields；return date 只在 `FOREIGNER + AIR + ARRIVAL + POV001/POV007` static condition 显示。E22 renderer/schema 的 date-min divergence、live requiredness 与 server acceptance 均未被掩盖。
- destination 分支隔离：Residence 显示 same-as-residence/address review fields，Hotel 显示单一 dynamic hotel/address review field，不制造 hotel id；Transit 显示 transit port/country review fields。client clear behavior 已记录，但 airline/flight/hotel/port sources、flight-to-port metadata、实际 control/validation 与 server acceptance 均不作承诺，也不得由 port metadata 推出 AIR customs flow。
- `coverage-parity.ts` 为 E22 AIR/destination records 增加 `clientContractEvidence=verified_public_bundle` 辅助标记；其 canonical `evidenceTier` 仍是 `needs_review`，S2 七项 live/server gap 和 E21 `56/19/36/8` tally 不变。

### Shared 解冻后的最小接入

- 更新 PH-only `shared-integration.ts`：解冻后的 dynamic consumer 必须调用 `createPhEtravelAirDestinationPresentation()`；Special Flight 只能是派生 UI，detail 才使用 `flight_number_special`。Residence/Hotel/Transit、dynamic hotel/port source 和 S2 gaps 继续 review-gated。
- 禁止向 shared UI 发送 `air.is_special_flight`、制造 hotel identifier、从 destination port metadata 推断 AIR customs，或以 E22 bundle evidence 承诺官方 options/requiredness/server acceptance。shared components 本轮未修改。

### 测试与校验

- 新增 `air-destination-presentation.test.ts`：覆盖 Special Flight derived/payload exclusion、AIR/SEA isolation、Transit/return-date condition、Residence/Hotel separation、hotel dynamic-source boundary 与 noQueue/noBrowser/noResubmit/non-submitted gate。
- 更新 coverage/shared-integration tests：验证 E22 seven S2 records 仍为 review gate 但有 client bundle marker，以及 future shared helper 约束。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，21 files / 113 tests。

### 仍阻塞 release

1. E22 没有关闭 S2 的 seven live/server rows：AIR options/flight-to-port metadata/Special Flight validation、Residence composition、Transit rendered validation，以及 dynamic hotel/port/return-date acceptance 都需要 controlled live evidence。
2. Shared frontend 持续冻结；没有实装 dynamic form、status/result、enqueue/browser 或 final Submit。
3. 既有 S1-S8、authoritative result/reference/derived QR/recovery 与 DB atomic RPC/worker cutover release blockers 不变。

## 第二十四轮：消费 E23 Health presentation / coverage（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。已读取适用 `AGENTS.md`、协调总览第 37 节、field contract E23 和 PH-D 最新段。未修改 shared dirty status/result/dynamic 文件、queue、runner、backend、package、协调总览或其他 worklog；未访问官网、未部署、未使用真实资料或官方 final Submit。

### E23 Health PH-only 合同

- 新增 `health-presentation.ts`，将 E23 检出的 Health controls 与 positive branches 统一为 `verified_public_bundle` client contract + `review_gate`。所有 health display 固定 stop-before-submit、non-submitted、noQueue、noBrowser、noResubmit，不产生实际 applicant UI、payload 或官方接受承诺。
- `with_negative_antigen` 只在客户端已知 predicate `not fully vaccinated && age >= 15` 下显示 review state；`is_fully_vaccinated`、`is_single_dosage`、`birth_date` 与空 `health_declaration` 都是 inherited/not-rendered state，不是 Health applicant questions。antigen 的 client callback exposure reset 也仅是 UI hint，不能推断医疗规则、文件要求或 server behavior。
- recent-travel Yes 才显示 countries review branch；recent-travel false 的 client clear 行为只清空该分支。sick Yes 才显示 symptoms review branch；parent sick answer change 的 client clear 行为同样只作 UI hint。动态 countries/symptoms option source、visible required marker、payload handling 和 server acceptance 均未闭合。
- `health.has_exposure_to_sick_person_30d` 与 `health.has_been_sick_30d` 被记录为当前 bundle controls，但持续 client-known/server-unknown。当前 Health component 未见直接 AIR/SEA 或 FILIPINO/FOREIGNER split；adapter 明示该 context 不可由此推断路径 parity。
- `health.exposed_to_bats_or_sick_animals` 仅存在 translation key。adapter 将它标为 `translationOnly`，不生成 confirmed field/control/condition/requiredness 或成功能力。
- coverage parity 为六个实际 E23 bundle controls 增加 `clientContractEvidence=verified_public_bundle`；bats/animals 不加 marker。五个 S3 needs-review rows 与 `56/19/36/8` tally 不变。

### Shared 解冻后的最小接入

- 更新 PH-only `shared-integration.ts`：shared consumer 仅可经 `createPhEtravelHealthPresentation()` 读取 E23 分支，并须保留 antigen vaccine/age、country Yes、symptoms Yes 及全部 server/requiredness review gate。
- 禁止将 vaccine/age inherited state、Health translation text、local validation/clear behavior 当作 applicant answer、server acceptance、launch readiness 或自动 action。shared components 本轮完全未改动。

### 测试与校验

- 新增 `health-presentation.test.ts`：覆盖 antigen vaccine/age predicate、countries/symptoms Yes isolation 与 clear graph、bats/animals translation-only、AIR/SEA/persona unknown boundary、以及 noQueue/noBrowser/noResubmit/non-submitted gate。
- 更新 coverage/shared integration tests：断言 E23 bundle marker 仅落在实际 controls，translation-only key 不被提升。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，22 files / 119 tests。

### 仍阻塞 release

1. E23 不闭合 Health live rendered control/validation、dynamic countries/symptoms options、server payload/acceptance、antigen eligibility/document requirement，或 AIR/SEA/persona route parity。
2. S3 five review rows仍需 controlled live evidence；bats/animals 需要实际 current component/control evidence后才可考虑展示。
3. shared frontend、S1-S8 remaining evidence、final result/reference/derived QR/recovery 与 DB atomic RPC/worker cutover仍为 release blockers。

## 第二十五轮：消费 E24 SEA flow presentation / coverage（2026-08-04）

> 本轮只修改 `viza-fe/internal-website/features/ph-etravel/**` 与本 PH-D worklog。已读取适用 `AGENTS.md`、协调总览第 38 节、arrival field contract E24、PH-A/PH-B/PH-C/PH-D 最新记录和 worktree。未修改 shared dirty status/result/dynamic 文件、queue、runner、backend、package、协调总览或其他 worklog；未访问官网、未部署、未使用真实资料或 official final Submit。

### E24 SEA 静态展示合同

- 新增 `sea-destination-presentation.ts`。它将 `sea.is_disembarking` 显示为仅限 `SEA + ARRIVAL` 的 `verified_public_bundle` client contract，server evidence 始终为 `needs_review`。AIR 或 SEA DEPARTURE 一律 `not_applicable`，不会把该控件套用到其他路径。
- SEA ARRIVAL 下，`is_disembarking !== true` 只保留 disembarking 与 voyage destination 的 review 边界，并静态隐藏 `stay_location_type`、Residence/Hotel/`disembarking_port_code` 子树；`true` 时才按 Residence、Hotel、TRAVEL_PORT 选择相应 child。此为 public renderer visibility，不声称显式 false 可通过 live continuation、被 server 接受，或有可推断的 payload clear 行为。
- `sea.destination_port_code` 与 `destination.disembarking_port_code` 被明确建模为两个独立字段。前者用于动态 metadata 的 public page-array gate；后者仅在已 disembarking 且 `TRAVEL_PORT` 分支下出现。adapter 不把两个 value 互相代用，且标记 E24 未观察到 disembarking checkbox 的独立 clear rule。
- 收紧 `port-flow.ts`：`with_custom_declaration=1/0` 现在只产生 `electronic_sections_inserted` / `electronic_sections_not_inserted` 的动态页面数组事实；不再返回、选择或承诺 `electronic_customs`、`manual_forms_review`、manual notice 或任何 live continuation。缺失、未知、无效或过期 metadata 一律 fail-closed。
- `createPhEtravelSeaPortOrderedPageContract()` 因此不再由 port metadata 生成 SEA ordered customs contract；无论 metadata 为 0 或 1 都返回 action-only `sea.destination_port_dynamic_page_array_review`。既有 AIR/SEA observed page contracts仍只是独立证据合同，不能由 E24 port metadata 自动选择。
- coverage parity 为 `sea.is_disembarking`、`destination.stay_location_type`、`destination.disembarking_port_code`、`sea.destination_port_code` 标记 E24 client bundle evidence；canonical tally 仍为 `56 confirmed_live / 19 verified_public_bundle / 36 needs_review / 8 diverted`，没有将任何 field 升格为 enabled input 或成功能力。
- 所有 E24 presentation states 固定 `authorization=stop_before_submit`、`submitted=false`、`noQueue=true`、`noBrowser=true`、`noResubmit=true`。

### Shared 解冻后的最小接入

- shared dynamic form 解冻后必须通过 `createPhEtravelSeaDestinationPresentation()` 消费 SEA ARRIVAL 的 disembarking/stay subtree，保持 AIR/SEA、ARRIVAL/DEPARTURE 与 falsey/true 分支隔离。
- 只可通过 `createPhEtravelSeaPortOrderedPageContract()` 读取 `with_custom_declaration` 的 public page-array gate；在新增 controlled live evidence 前，禁止依据 destination port 或 metadata 选择 manual/electronic customs、显示后续页面、创建 queue/browser 或继续官方流程。
- 禁止把 `disembarking_port_code` 当作 `destination_port_code` 的 alias；禁止默认未知 port metadata；禁止把 falsey hidden UI、static page construction 或 Summary reachability表述为 live server acceptance/submitted。
- shared status/result/dynamic 组件继续冻结，本轮未修改。

### 测试与校验

- 更新 `port-flow.test.ts`：覆盖 metadata 0/1 仅为 page-array gate、缺失/未知/无效/过期 fail-closed、任何 metadata 不选择 SEA customs contract、AIR/SEA 与 ARRIVAL/DEPARTURE 隔离、falsey/true stay subtree、双 port 独立和所有状态的 noQueue/noBrowser/noResubmit/non-submitted gate。
- 更新 coverage/shared integration tests：验证 E24 client marker 保持 review gate，以及 future dynamic consumer 禁止 port-to-customs-flow 推断。
- `npx prettier --write`：passed。
- `npx vitest run features/ph-etravel/__tests__ --testTimeout=15000`：passed，22 files / 121 tests。

### 仍阻塞 release

1. E24 只关闭 public static default/visibility/page-array wiring。SEA explicit false/unchecked 的 live continuation、server requiredness/payload/acceptance、manual notice、port-to-customs mapping、regular versus shortcut route selection和 Family/Summary state仍需 controlled live evidence。
2. shared frontend 持续冻结；没有实装 dynamic form、status/result、enqueue/browser 或 final Submit。
3. S1-S8 remaining evidence、authoritative post-submit reference/derived QR/recovery 与 DB atomic RPC/worker cutover仍为 release blockers。

## 第二十六轮：PH arrival form / completeness / status-result 接入（2026-08-13）

- 将 PH-only answer normalization 接入 `dynamic-step-form.tsx`：SEA `is_disembarking=false` 清空 stay subtree；已确认的 Health positive child 与 electronic Currency Owner N/A 清空对应答案；AIR 不继承 SEA 清空规则，官方 option value/code 未改写。
- `retry-submission` 对 `PH_ETRAVEL_ARRIVAL_CARD` 先检查 active PH runner job、完整度与 AIR/SEA voyage 72 小时日期；不完整返回跳转用 completeness，日期错误和未知错误只返回 allowlisted 安全文案。当前 `runner_job` producer/dispatch whitelist 没有 `philippines`，因此 live retry 以 `runner_contract_unavailable` fail-closed，绝不写 `submission_queue`、不创建 job、也不提前标记 submitted。
- `submission-status` 已可读取未来 `runner_job(country=philippines)`：scheduled、queued、processing、action-required、failed 和 post-run recovery 均为 PH 安全文案；runner completed 仍是 recovery，不是成功。
- PH result card 现要求 authoritative registration read + stable reference + same-reference rendered QR 才显示提交候选；Review、HTTP 200、跳转、本地 reference/QR、截图均为 action/recovery，且不显示“再次提交”。补充 eTravel 免费、非签证、不保证准入文案。

### Focused 验收

- `npx prettier --check`（本轮 PH helpers、dynamic form、retry/status、result card 及 PH tests）：passed。
- `npx tsc --noEmit` 本轮文件过滤：无 PH 相关错误。
- PH focused Vitest 未运行：Vite 在加载 config 时无法写入既有 `node_modules/.vite-temp`，报 `EPERM`；未安装依赖、未申请权限。

### 真实 blocker

1. `lib/queue/countries.ts` 和 submission-service dispatch 未声明 `philippines`；两者不在本轮可写范围。runner owner 必须同时发布 producer whitelist、consumer dispatch、scheduled-job 消费与原子 active-job contract 后，PH 才能由 fail-closed 改为真正 enqueue。
2. runner 必须写入 `authoritativeRegistration.{read,referenceNumber,derivedQrRenderStatus,derivedQrReferenceValue}`；在此之前结果页不会显示成功。

## 第二十七轮：PH residence / Travel Registration / profile checkpoint 接入准备（2026-08-15）

- 接管并逐行审查 PH-only 临时改动；只修改 `features/ph-etravel/**` 和本 worklog，没有修改 shared dynamic form、状态卡、队列、runner、schema、协调总览或其他 worklog。
- `residence-cascade.ts` 现将官方 `country_code`、`province_code`、`municipality_code`、`barangay_code`、`street`、`street_two` 明确桥接到动态表单字段名。Province -> Municipality -> Barangay 仅保存当前官方 code，Province metadata 唯一导出 `region_code`；父级变更清除所有后代，国家变更也清除 Street/line 2。foreign residence 保持 country + line 1 + optional line 2。缺失项的锚点已修正为实际 `residence_*` 表单字段。
- Travel Registration presentation 现明确展示 `FOR ME (Current User)` / `FOR OTHER (Family Member)`、`AIR` / `SEA`，并固定 `ARRIVAL - Entering the Philippines`；不暴露或保存 `DEPARTURE`。privacy + affidavit 采用单独、可审计的 affirmative consent（版本及时间），实际 schema field 为 `registration_data_privacy_affidavit_consent`；该审计记录不投影到官方 answers/payload。没有有效同意时 `canEnqueue=false`，返回 step-1 field anchor。
- `profile-checkpoint.ts` 增加严格区分 Profile Save 与 registration final Submit 的 presentation。Personal Information Review/save、HTTP success 或 dashboard navigation 永不成为 eTravel submitted；registration 仍要求 authoritative read + stable reference + same-reference QR render。所有 PH-only checkpoint 保持 `noQueue/noBrowser/noResubmit`。

### Shared dynamic form 最小接入说明（未实施）

1. 仅对 `PH_ETRAVEL_ARRIVAL_CARD`：在现有 schema field names 上调用 `applyPhResidenceCascadeFormChange()`；通过同源 read-only options proxy 取得官方 Province/Municipality/Barangay response，再调用 `parsePhResidenceOfficialOptions()`。不得由 label、中文名、correspondence code 或第三方 PSGC 推导提交 code。
2. 将 `getPhResidenceMissingItems()` 和 `normalizePhEtravelTravelRegistration()` 的 missing anchors 合并进完整度面板；未完成或 consent audit 缺失时不得 enqueue。consent audit 必须经认证 server boundary 保存，且不能混入 application answers。
3. 渲染 `PH_ETRAVEL_TRAVEL_REGISTRATION_PRESENTATION`：仅 ARRIVAL locked value、FOR_ME/FOR_OTHER、AIR/SEA 和明确同意控件。Profile Save 使用 `createPhEtravelCheckpointPresentation({ journey: "profile", ... })`；registration final flow 使用 `journey: "registration"`，不得混用 copy 或 success state。

### Focused validation

- `npx prettier --write`（本轮 3 helpers、shared integration spec 和 3 PH tests）：passed。
- PH-only `tsc --noEmit`（上述 helpers/tests）：passed。
- `git diff --check -- viza-fe/internal-website/features/ph-etravel docs/philippines-launch-worklogs/PH-D.md`：passed。
- `npx vitest run`（3 个 PH tests）未启动测试体：Vitest 配置加载时不能写 `node_modules/.vite-temp`，报 `EPERM`。未安装依赖、未请求审批或升级权限。

## 第二十八轮：Health Declaration 截图合同（2026-08-15）

- 仅消费用户提供的完整 Health Declaration 截图；没有访问官网、没有记录任何会话、草稿或申请人值，也没有修改 shared 文件。
- `health-presentation.ts` 现记录截图中的静态 Health notice；三个基础 Yes/No 都是必答：recent travel、exposure to a sick/communicable person、sick in the past 30 days。AIR 与 SEA 使用相同 Health Declaration 页面；passport-holder parity 未由此截图外推。
- recent-travel=Yes 时，合同显示可 Add/Delete 的 `Country(ies) worked, visited and transited in the last 30 days` 行：至少一行、每行必选、官方全量国家来源且包含 Philippines。sick=Yes 时，仅显示截图确认的 15 项 Symptoms 多选，至少选择一项而非全选。两个父题切为 No 都会清除残留 child values。exposure 没有推测任何 child；bats/animals 继续 translation-only。
- `getPhEtravelHealthMissingItems()` 输出三个基础 required 与正向分支 minimum-one 的 PH-only 完整度项；所有状态仍为 stop-before-submit/noQueue/noBrowser/noResubmit，未声称 server payload、选项接受或提交成功。

### Focused validation

- `npx prettier --check`（Health helper、normalizer、shared-integration spec 与 focused tests）：passed。
- PH-only `tsc --noEmit`（上述 Health files/tests）：passed。
- Health-focused Vitest 未启动测试体：Vite 配置加载时无法写入既有 `node_modules/.vite-temp`，报 `EPERM`。未安装依赖、未请求审批或升级权限。

## 第二十九轮：SEA manual customs 官方 PDF 提示（2026-08-16）

- 新增 PH-only `SeaManualCustomsFormsNotice.tsx`。它只在明确 `transportType=SEA` 且 `seaFlow=manual_forms` 时显示两个外部官方 PDF：菲律宾海关行李申报表、菲律宾货币申报表（BSP）。AIR、SEA electronic、未知 SEA path 都不显示。
- 两个链接均保留精确官方 URL，使用 `FileText` 与 `ExternalLink` 图标，标明“外部官方 PDF”，并固定 `target="_blank" rel="noopener noreferrer"`。链接不代理、不缓存、不复制 PDF；外部站点不可用不会影响 VIZA 表单、完整度、入队或页面操作。
- PDF metadata 明确 `isApplicantAnswer=false`、`affectsCompleteness=false`。新增 focused UI test 覆盖路径显示/隐藏、精确 href、安全属性、图标旁的外部 PDF 标识及非完整度边界。
- 本轮未修改任何 shared dirty 文件、队列、schema、协调总览或其他 worklog；shared dynamic/status 未来只能在已经分类为 `SEA + manual_forms` 的提示位置消费该组件。

### Focused validation

- `npx prettier --check`：passed。
- PH-only source `tsc --noEmit`：passed。
- focused Vitest 未启动测试体：Vite 配置加载时无法写入既有 `node_modules/.vite-temp`，报 `EPERM`。未安装依赖、未请求审批或升级权限。

## 第三十轮：E42/E43 General Declaration 展示与完整度（2026-08-16）

- 新增 PH-only General Declaration 合同：Q1/Q2 永不显示 Add Item；Q3-Q12 的每一项 Yes 才各自显示 Description、Quantity、Amount in USD 的 repeatable item group。显示金额为正而 Q3-Q12 全非 Yes 时，完整度返回 Customs General Declaration 定位项。
- Q3-Q12 任一 Yes 会显示 Documents/附件区域；附件的数量、实际必填、上传接受与服务端规则仍是 official/production review gate，**不**列为缺失项或阻止入队。签名仍是已证实的 action-required，缺失时返回 Attachments and Signature。
- Currency Declaration 的 requiredness、option/validation/persistence 继续保持未证实 gate；没有增加猜测字段或选项。
- shared dynamic form 解冻后消费 `createPhEtravelGeneralDeclarationPresentation()` 与 `getPhEtravelGeneralDeclarationMissingItems()`；未修改 shared dirty 文件。

### Focused validation

- `npx prettier --check`（本轮 PH-only helper、presentation、shared integration spec、tests 与 worklog）：passed。
- PH-only source/tests `tsc --noEmit`：passed。
- `git diff --check`：passed。
- `npx vitest run features/ph-etravel/__tests__/general-declaration.test.ts features/ph-etravel/__tests__/presentation.test.ts --testTimeout=15000` 未进入测试体：Vite 配置加载时无法写入既有 `node_modules/.vite-temp`，报 `EPERM`。未安装依赖、未申请权限或升级权限。

### E45 correction

- E45 已确认 AIR 的 Q3-Q12-positive 附件区允许为空；有效签名可普通 Next 到 Family Member(s)。因此 AIR 附件不会显示为必填、不会进入缺失清单或阻止入队。SEA attachment requiredness、upload/server acceptance 与 parity 继续是官方证据/production gate。
- Q1/Q2 继续没有 Add Item；Q3-Q12 每个 Yes 继续显示独立 repeater。新增 PH-only row normalizer：问题改为非 Yes 时清空其隐藏 rows，保留其中的 numeric official IDs 原样，不转换为 label 或自造 code。

### E45 focused validation

- `npx prettier --check`、PH-only source/tests `tsc --noEmit`、`git diff --check`：passed。
- `npx vitest run features/ph-etravel/__tests__/general-declaration.test.ts features/ph-etravel/__tests__/presentation.test.ts --testTimeout=15000` 再次未进入测试体：Vite 无法写入既有 `node_modules/.vite-temp`，报 `EPERM`。未安装依赖、未申请权限或升级权限。
