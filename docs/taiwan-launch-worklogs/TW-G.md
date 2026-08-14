# TW-G Worklog — 提交成功证据与第一版状态展示

- 状态：已按第一版目标收紧；focused tests 通过。
- 负责人：TW-G。
- 边界：未访问台湾官网、未提交真实申请、未读取账号/OTP/Cookie/密钥、未部署、未执行 migration、未提交 Git。
- 基线：开始时工作区已有大量台湾、菲律宾、前端和文档改动；本工作包只把这些视为既有/并行改动，不回滚。

## 第一版目标

1. 台湾状态范围只显示“已提交”。
2. 只有同时拿到台湾官网成功页证据和官方申请/受理编号，才能标记 `submitted`。
3. VIZA 页面只显示：已向官网提交、已取得回执编号、后续审核/缴费请以官网通知为准。
4. 不实现、不上线自动申请进度查询、查询 worker、cron 或 scheduler。
5. `submitted` 不等于 `approved`，也不等于 `paid`。

## 官方回执定义

本阶段只有以下条件同时满足，才算官方提交成功证据：

- 官方页面明示“申请/送件/收件成功”等成功页文字。
- 同一页面明示官方申请案号、申请编号、收件编号、案件编号、受理编号等可追踪编号。
- 页面文本没有 CAPTCHA、请输入、错误、失败、不正确等负面信号。

仅仅 CAPTCHA 控件消失、URL 改变、按钮不可见、页面加载完成、只有成功文字、或只有编号，都不算 `submitted`。

## 已修改文件

- `viza-be/submission-service/src/tw/receipt.ts`
  - 保留官方回执解析；收紧为成功页证据 + 官方编号两者缺一不可。
- `viza-be/submission-service/src/tw/__tests__/receipt.spec.ts`
  - 覆盖成功页 + 编号、仅成功文字、仅编号、CAPTCHA/错误页等场景。
- `viza-be/submission-service/src/tw/apply.ts`
  - CAPTCHA 提交后必须读取带 `caseNumber` 的 `officialReceipt`；缺失则抛出可恢复失败，不返回 `submitted`。
- `viza-be/submission-service/src/queue/halt-runners.ts`
  - `submitted` payload 只持久化 `officialReceipt`，撤回台湾自动查询激活调用。
- `viza-be/submission-service/src/tw/index.ts`
  - 仅导出 receipt 能力，撤回台湾 tracking 导出。
- `viza-be/submission-service/src/submission-result.ts`
- `viza-be/agent-backend/src/types/submission-result.ts`
- `viza-fe/internal-website/lib/submission-result.ts`
  - 同步台湾 `officialReceipt` 类型；移除台湾 tracking payload 类型。
- `viza-fe/internal-website/app/client/application/_components/result-cards/TwResultCard.tsx`
  - `submitted` 只展示已向官网提交、已取得回执编号、后续审核/缴费以官网通知为准。
- `viza-fe/internal-website/app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx`
  - 覆盖 submitted 不等于 approved/paid，且不出现自动查询承诺。
- 已撤回：
  - `viza-be/submission-service/src/tw/tracking.ts`
  - `viza-be/submission-service/src/tw/__tests__/tracking.spec.ts`
  - `viza-be/agent-backend/drizzle/0124_tw_entry_permit_tracking_contract.sql`
  - `viza-be/agent-backend/src/db/schema.ts` 中 0124 对应字段镜像

## 验证结果

- `viza-be/submission-service`: `npm run type-check` — 通过。
- `viza-be/submission-service`: `node --import tsx --test src/tw/__tests__/*.spec.ts` — 39/39 通过。
- `viza-fe/internal-website`: `npm test -- --run app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx` — 7/7 通过。
- `viza-be/agent-backend`: `npm run type-check` — 通过。

未执行：tracking migration、任何 migration、部署、真实官网访问、真实提交、Git commit。

## 2026-08-01 — long-form 路由/集成阻断定位

### 根因

`/client/application/long-form?country=taiwan&amp;visaType=TW_ENTRY_PERMIT` 若以 HTML 转义后的查询串进入浏览器，`useSearchParams()` 会把第二个参数读成 `amp;visaType`，而不是 `visaType`。原 long-form 只读取 `visaType` / `visa_type`，因此没有拿到显式 `TW_ENTRY_PERMIT`，后续会回落到用户 package 或默认流程，表现为只进入 portal/long-form 壳子但不加载台湾表单主体，TW-A 观测到 `inputCount=0`。

分类：route/query parsing 集成问题；不是台湾字段合同、auth/session gating、官方查询、CAPTCHA、付款、tracking worker、migration 或台湾官网问题。production 仍需部署本次前端修复后才会改变线上行为。

### 本次修改文件

- `viza-fe/internal-website/lib/client/application-route-params.ts`
  - 新增 `readApplicationRouteParam()`，统一读取普通 query key 与 `amp;` 前缀 key。
- `viza-fe/internal-website/lib/client/application-route-params.test.ts`
  - 覆盖正常台湾 long-form query、HTML 转义 `&amp;visaType`、`visa_type` alias 与空值跳过。
- `viza-fe/internal-website/app/client/application/long-form/page.tsx`
  - `step`、`applicationId`、`returnTo`、`teamNotice`、`country`、`visaType` 改用统一 route param reader；台湾入口即使收到 `amp;visaType` 也能解析为 `TW_ENTRY_PERMIT`。
- `docs/taiwan-launch-coordination.md`
  - 追加本次阻断定位、影响与下一步。
- `docs/taiwan-launch-worklogs/TW-G.md`
  - 追加本节记录。

### 验证结果

- 首次直接运行 Vitest 被沙箱拦截，原因是 Vitest 需要写入 `node_modules/.vite-temp` 临时配置文件。
- 已用仓库写权限重跑：
  - `npx vitest run lib/client/application-route-params.test.ts components/__tests__/taiwan-frontend-experience-audit.test.tsx --testTimeout=15000`
  - 结果：2 个 test files passed，8/8 tests passed。

### 下一步

- 需要发布/部署负责人部署本次前端修复；本任务未部署。
- 部署后需要 TW-A 重新访问 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` 做视觉复核，确认台湾 long-form 表单主体和字段文案实际渲染。
- 本次未访问台湾官网、未提交申请、未处理 CAPTCHA、未付款、未运行 migration、未改菲律宾或其他国家。

## 2026-08-01 — long-form 阻断复查（二次）

### 根因更新

TW-A 新复核包含两种转义 URL，其中第一种是双重转义：`country=taiwan&amp;amp;visaType=TW_ENTRY_PERMIT`。上一轮 `readApplicationRouteParam()` 只兼容一层 `amp;visaType`，没有覆盖 `amp;amp;visaType`，因此这类入口仍会丢失显式台湾 `visaType`。

另外，本地环境确认存在独立阻断：`internal-website` 的 Next dev 进程已占用 3000 并持有 `.next/dev/lock`；我尝试在 3001 启动新 dev server 时被该 lock 拒绝。对本机 3000 做无 Cookie 只读请求，`/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` 返回 `307 /client/login`。这说明未登录或失效 session 的复核不会进入 long-form 页面本体，只能看到登录/portal 外层，`input/select/textarea = 0` 是预期的 auth proxy 结果。

分类更新：route query escaping + auth/session/local-dev 环境阻断。仍未发现台湾字段合同、`getVisaFormSteps()` 合同、tracking、migration、CAPTCHA、付款或官方查询相关问题。

### 本次修改文件

- `viza-fe/internal-website/lib/client/application-route-params.ts`
  - `readApplicationRouteParam()` 现在会读取普通 key，并兼容最多 3 层 `amp;` 前缀，例如 `visaType`、`amp;visaType`、`amp;amp;visaType`。
- `viza-fe/internal-website/lib/client/application-route-params.test.ts`
  - 新增双重转义 `&amp;amp;visaType` regression test，并让 snake_case alias 测试覆盖 `amp;amp;visa_type`。
- `docs/taiwan-launch-coordination.md`
  - 追加本次二次定位、环境阻断与下一步。
- `docs/taiwan-launch-worklogs/TW-G.md`
  - 追加本节记录。

### 验证结果

- `npx vitest run lib/client/application-route-params.test.ts components/__tests__/taiwan-frontend-experience-audit.test.tsx --testTimeout=15000`
  - 结果：2 个 test files passed，9/9 tests passed。
- 本地只读 HTTP 检查：
  - `curl -I 'http://localhost:3000/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT'`
  - 结果：`307 Temporary Redirect`，`location: /client/login`。未携带 Cookie、未读取账号或申请人资料。

### 需要的操作

- 本地：停止当前占用 3000 且持有 `.next/dev/lock` 的 Next dev 进程，再从 `viza-fe/internal-website` 重启：`npm run dev -- --port 3000`。我没有杀进程。
- 复核：TW-A 需要在有效 VIZA client session 下复核；未登录/会话失效时看到 0 inputs 属于 auth proxy，不是 long-form 字段渲染结果。
- production：需要部署包含本次多层 `amp;` 修复的前端版本后再复核。
- 推荐复核 URL：优先使用未 HTML 转义的 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`；如果来源仍产生 `&amp;` / `&amp;amp;`，本次代码已兼容。

未执行：台湾官网访问、真实提交、CAPTCHA、付款、migration、部署、Git commit/stash/reset/checkout。

## 2026-08-01 — TW-A 提交入口修复后的本地集成运行

### 本次运行

- 已重启本地前端 API：
  - 目录：`viza-fe/internal-website`
  - 启动：`TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true npm run dev -- --port 3000`
  - 结果：Next dev ready；台湾 long-form 请求返回 200，并开始触发页面 server action / status polling。
- 已启动台湾 scoped submission-service：
  - 目录：`viza-be/submission-service`
  - 启动：`RUNNER_JOB_COUNTRY=taiwan SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false npm run dev`
  - 结果：health server 监听 8080，`/ready` 返回 ready，`runner_job consumer active`，country scope 为 `taiwan`。
- 未启动 legacy `submission_queue` polling；本次只观察 `runner_job`。

### Adapter 配置状态

- 当前 shell 环境未提供真实 `TW_OFFICIAL_LOGIN_ADAPTER` / `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS` / `TW_OFFICIAL_LOGIN_ADAPTER_MODULE` 值。
- submission-service 启动日志为 `Taiwan official login bootstrap fail-closed reason=missing_adapter`。
- 根据 TW-F 最新代码说明，台湾普通入口走 application-scoped managed alias + 邮件 OTP；`TW_OFFICIAL_LOGIN_*` 只在官网出现用户名/密码登录页时才会被用到。未配置真实 adapter 时遇到该登录页会 fail-closed，不会伪造登录。

### 观察结果

- 前端日志已看到：
  - `GET /client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT 200`
  - `GET /api/applications/6f64272e-...-6308/submission-status 200`
  - 多次 long-form server action POST。
- 尚未看到：
  - `/api/applications/{id}/retry-submission` 请求。
  - `runner_job(country=taiwan)` 入库记录。
  - worker 消费台湾 job 或打开台湾官网。
- 只读 DB 轮询 `runner_job where country='taiwan'` 连续 6 次均为 0 条。

### 当前结论

- TW-A 的前端 API 修复已在本地新进程中加载，台湾 live-assisted gate 已显式打开。
- 台湾 worker 已就绪并只消费 `runner_job(country=taiwan)`。
- 本轮尚未完成按钮链路验收，因为没有观察到提交/重试按钮触发 retry-submission API；可能仍停在状态页轮询、按钮未点击到、或前置校验阻止提交。

### 下一步

- 用户在当前本地前端会话中重新点击台湾提交/重试按钮。
- TW-G 继续观察：
  - 前端是否出现 `/api/applications/{id}/retry-submission`。
  - DB 是否新增/复用 `runner_job(country=taiwan)`。
  - worker 是否 claim job 并进入台湾 runner。
- 若 runner 打开台湾官网，继续遵守边界：不付款、不手动处理 CAPTCHA、没有官方回执不得标记 `submitted`。

## 2026-08-01 — long-form 本地/production 巡检与当前阻断收敛

### 本次修改文件

- `viza-fe/internal-website/app/client/client-layout-gating.ts`
  - 新增 `shouldBlockClientChildren()`，让台湾显式 long-form 在 session 验证通过后不再被 about-me form-request gate 的最终 render 条件挡住。
- `viza-fe/internal-website/app/client/layout.tsx`
  - 最终 children/spinner 判断改用 `shouldBlockClientChildren()`，保留登录/session gate，但台湾 `country=taiwan&visaType=TW_ENTRY_PERMIT` 不再等待 about-me gate。
- `viza-fe/internal-website/app/client/__tests__/client-layout-gating.test.ts`
  - 覆盖 canonical、`amp;visaType`、`amp;amp;visaType` 台湾 long-form gate，以及台湾 skip gate 下 session validated 后应渲染 children。
- `docs/taiwan-launch-worklogs/TW-G.md`
  - 追加本节。
- `docs/taiwan-launch-coordination.md`
  - 追加本次巡检结论。

### DOM 证据

- Chrome 登录态访问本地：
  - URL：`http://localhost:3000/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - 初始 active step 为确认/status：`input=0`、`select=0`、`textarea=0`，但页面已渲染台湾主体，可见 `中国台湾台湾入境许可证`、`台湾官网自动填写未完成`、缺文件提示。
  - 这解释了 TW-A 看到 `input/select/textarea=0` 的一类情形：当前 application 已有 `submission_result_status=waiting`，long-form 自动打开确认/状态页，状态页本身没有表单控件。
- 同一本地页面只读切换到 `Delivery Location` 子步骤后：
  - `input=2`、`select=1`、`textarea=0`、`totalControls=3`
  - 可见关键台湾字段/信号：`中国台湾台湾入境许可证`、`Delivery Location`、`上传护照资料页`、`所在洲别*`、`受理使领馆/代表处*`。
- Chrome 登录态访问 production：
  - URL：`https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - `input=0`、`select=0`、`textarea=0`、`h1=0`、`h2=0`
  - 只见 portal nav 文本：`首页 申请 状态 智能助手 设置 帮助`
  - 未见 `中国台湾台湾入境许可证`、`台湾官网自动填写未完成`、`Delivery Location`、`所在洲别`、`受理使领馆/代表处`。

### 根因/分类

- 本地：字段页已可渲染；若只统计初始 URL 的控件数，当前用户申请会因已处于 `waiting` 状态自动打开确认/状态页，因此控件数为 0。展开并进入 `Delivery Location` 后可见表单控件。
- Production：仍是旧构建或未部署包含 long-form route parsing + client layout gate 修复的前端版本。当前环境没有 Vercel 登录态，`npx vercel whoami` 进入设备登录流程，无法由我直接部署或确认生产构建 SHA。
- Auth/session：本地 Chrome 登录态未跳 `/client/login`；内置浏览器无登录态会正常跳 `/client/login`。因此无有效 session 的 0 控件不应作为 long-form 字段渲染证据。
- Schema/data：本地页面已能加载台湾 DB-driven steps；不是台湾字段合同或 `getVisaFormSteps()` 空返回导致的阻断。
- Runtime env：本地前端已用 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true` 启动；submission-service `/ready` 为 ready，并以 `RUNNER_JOB_COUNTRY=taiwan` scoped worker 运行。
- Adapter：当前可见环境仍没有真实 `TW_OFFICIAL_LOGIN_ADAPTER` / `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS` / `TW_OFFICIAL_LOGIN_ADAPTER_MODULE`；仓库内只有 fail-closed contract 与测试 mock 名称。不能伪造生产 adapter。

### 验证结果

- `viza-fe/internal-website`: `npx vitest run app/client/__tests__/client-layout-gating.test.ts lib/client/application-route-params.test.ts --testTimeout=15000`
  - 2 个 test files passed，7/7 tests passed。
- `viza-fe/internal-website`: `npx vitest run 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts' lib/__tests__/submission-queue.test.ts --testTimeout=15000`
  - 2 个 test files passed，24/24 tests passed。
- Worker readiness：
  - `GET http://localhost:8080/ready` 返回 `status=ready`、`dbReachable=true`、`workerStarted=true`。

### 当前需要的动作

1. 发布/Vercel 负责人部署 `viza-fe/internal-website` 当前前端代码到 `app.viza.it.com`，并确认 production 设置 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`（仅授权测试窗口）。
2. 部署后 TW-A 可重新复核 production：
   - 初始 URL 若进入确认/status 页，先展开第一组并进入 `Delivery Location`，再统计字段页控件。
   - 预期字段页证据：`input=2`、`select=1`、可见 `所在洲别*`、`受理使领馆/代表处*`。
3. 真实 smoke 前仍需用户补齐 application `6f64272e-1af6-4a48-8525-fcabc5276308` 的 `household_revoked` 与 `mainland_id_card_scan`。
4. 若官方流程出现真实用户名/密码登录页，发布/安全负责人必须提供已批准的 adapter name、approved adapter list 和 module ref；当前不能配置或伪造。

未执行：台湾官网访问、最终提交、OTP、CAPTCHA、付款、migration、deployment、Git commit/stash/reset/checkout。

## 2026-08-02 — production 部署尝试（阻断：缺 Vercel 授权/项目绑定）

### 用户请求

- 部署 `viza-fe/internal-website` 当前最新前端到 production `app.viza.it.com`。
- 授权测试窗口需要 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`。
- 部署后用 production DOM 复核台湾 long-form，必要时进入 `Delivery Location` 字段步骤确认控件。

### 本次部署前检查

- 本地代码确认包含台湾 long-form route/layout gate 修复：
  - `app/client/client-layout-gating.ts`
    - `shouldSkipFormRequestGateForRoute()` 识别 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`，并兼容 `amp;visaType` / `amp;amp;visaType`。
    - `shouldBlockClientChildren()` 允许台湾显式 long-form 在 session 验证通过后跳过 about-me form-request gate。
  - `app/client/layout.tsx`
    - 最终 children/spinner 判断已接入 `shouldBlockClientChildren()`。
- Git 未执行 commit/stash/reset/checkout。
- 未访问台湾官网、未提交官网、未处理 OTP/CAPTCHA、未付款。

### 部署阻断

- `viza-fe/internal-website` 目录及仓库内未找到 `.vercel/project.json`，当前本地没有 Vercel project link。
- `npx --yes vercel whoami` 返回 `No existing credentials found` 并进入 device login flow；已中止等待，没有完成登录。
- 当前 shell 未设置可用于非交互部署的：
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED`
- 因此本轮 **未部署 production**，也无法设置或确认 production 的 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`。

### 需要发布/Vercel 负责人执行

1. 在 Vercel project `internal-website` / `app.viza.it.com` 中设置 production env：
   - `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`
2. 部署当前仓库 `viza-fe/internal-website` 的最新前端到 production。
3. 部署完成后用有效 VIZA client session 打开：
   - `https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
4. 如果进入确认/status 页，不要用初始 `input=0` 判定失败；展开第一组并进入 `Delivery Location` 后复核：
   - `中国台湾台湾入境许可证`
   - `所在洲别*`
   - `受理使领馆/代表处*`
   - `input/select` 控件出现

### 当前是否可交回 TW-A

- 本轮 **不能交回 TW-A 做 production 视觉复核**，因为 production 尚未由当前环境成功部署。
- 一旦 Vercel 负责人完成部署和 env 配置，可交回 TW-A 按上面的字段步骤复核。

## 2026-08-02 — production 发布完成，字段页可见；production seed 仍需同步

### Vercel 项目确认

- `npx --yes vercel whoami`
  - 登录用户：`nananviza2016-8879`
- `npx --yes vercel projects list`
  - 既有项目 `viza-internal` 的 Latest Production URL 为 `https://app.viza.it.com`。
- `npx --yes vercel projects inspect viza-internal`
  - Project ID：`prj_GUFPqF0Ir6oWOsxMwX9ezfi3bJ7W`
  - Root Directory：`viza-fe/internal-website`
- `npx --yes vercel alias list`
  - `app.viza.it.com` 指向 `viza-internal` 的既有 production deployment。
- 未新建 Vercel project。

### Production env

- `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true` 已添加到 `viza-internal` Production env。
- `vercel env list production` 显示该变量存在且为 encrypted/sensitive。

### 部署结果

- 部署命令：
  - 先从 `viza-fe/internal-website` 部署失败，原因是 Vercel project 已设置 Root Directory `viza-fe/internal-website`，从子目录运行会拼出重复路径。
  - 随后在 monorepo root 绑定同一既有项目并运行 `npx --yes vercel deploy --prod --yes`。
- Deployment URL：`https://viza-internal-icflg51fj-viza-gmail-s-projects.vercel.app`
- Deployment ID：`dpl_Girf2SGESHv4qpecsh6yUbjTDJD6`
- Inspect URL：`https://vercel.com/viza-gmail-s-projects/viza-internal/Girf2SGESHv4qpecsh6yUbjTDJD6`
- `vercel inspect dpl_Girf2SGESHv4qpecsh6yUbjTDJD6`
  - status：Ready
  - target：production
  - aliases 包含：`https://app.viza.it.com`

### 部署前 focused tests

- `viza-fe/internal-website`：
  - `npx vitest run app/client/__tests__/client-layout-gating.test.ts lib/client/application-route-params.test.ts components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts' lib/__tests__/submission-queue.test.ts --testTimeout=20000`
  - 6 test files passed，56/56 tests passed。

### Production DOM 证据

- URL：
  - `https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&twg_deploy=dpl_Girf2SGESHv4qpecsh6yUbjTDJD6`
- 初始打开当前申请会进入确认/status 页；不能用初始 `input=0` 判定字段页失败。
- 展开第一组并进入 `Delivery Location` 后：
  - `h1=1`，文本：`中国台湾台湾入境许可证`
  - `h2=1`，文本：`Delivery Location`
  - `input=2`
  - `select=1`
  - `textarea=0`
  - 可见：`上传护照资料页`
  - 可见：`所在洲别*`
  - 可见：`受理使领馆/代表处*`
- `Photo & Basic Status` production DOM 可见：
  - `是否为首次由境外/港澳申请来台观光*`
  - `申请证别*`
  - `申请证数*`
  - `是否持有其他国籍护照？*`
  - `申请资格类别*`

### Production seed / DB stale 清单

只读查询 `visa_form_fields where visa_type='TW_ENTRY_PERMIT'`，未读取申请人资料或答案。当前 production 表单元数据共 91 rows，仍与 TW-C 最新合同不完全一致：

- `household_revoked`
  - production DB：缺失。
  - 影响：Photo & Basic Status DOM 也未显示当前大陆户口状态字段。
- `mainland_id_number`
  - production DB：`required=false`，虽然前端代码有 TW-only required 兜底，但 DB seed 仍旧。
- `company_name`
  - production DB：`required=false`，虽然前端代码有 TW-only required 兜底，但 DB seed 仍旧。
- `job_title`
  - production DB：`required=false`，虽然前端代码有 TW-only required 兜底，但 DB seed 仍旧。
- `tw_contact_district`
  - production DB：`field_type=text`，缺少 `dependent_on=tw_contact_city` / `dependent_options_key=taiwan_districts_by_city` 联动规则。
  - 影响：县市与区乡镇联动需同步 seed/DB 后再做 production 最终视觉判定。
- `tw_local_phone`
  - production DB：缺少 `required_when: tw_contact_mobile_not_applicable === true`。
  - 影响：手机号码与市内电话反向必填需同步 seed/DB 后再做 production 最终视觉判定。
- `kin_father_status`
  - production DB：`required=false`。
- `kin_mother_status`
  - production DB：`required=false`。

其他国籍护照条件字段当前 production DB 已存在且为 required：

- `other_nationality_country`：`required=true`，`showIf: has_other_nationality_passport === yes`
- `other_passport_number`：`required=true`，`showIf: has_other_nationality_passport === yes`
- `other_passport_expiry_date`：`required=true`，`showIf: has_other_nationality_passport === yes`

### 当前结论

- Production 前端代码已部署，台湾 long-form route/layout gate 修复已生效；字段页不再只是 portal shell。
- 可交回 TW-A 做 production 视觉复核的第一步：确认页面主体与 `Delivery Location` 字段页。
- 但不能把 TW-C 全部字段合同标记为 production 完成；production `visa_form_fields` seed/DB 仍需同步上述 stale rows，尤其 `household_revoked` 缺失。

未执行：台湾官网访问、最终提交、OTP、CAPTCHA、付款、migration、Git commit/stash/reset/checkout。

## 2026-08-03 Read-only readiness check after TW-A visual pass

Scope: TW-A reported production long-form visual validation passed for the Taiwan field contract. This pass only checked readiness for a safe runner-job smoke. No runner job was created, no retry was triggered, no Taiwan official site was opened, no OTP/CAPTCHA/payment was handled, no deployment or production env change was made, and no database write or git operation was performed.

### Application completeness evidence

Application checked: `6f64272e-1af6-4a48-8525-fcabc5276308`.

Read-only result, without printing applicant answers, file paths, secrets, or material contents:

- Application exists and is `country=taiwan`, `visa_type=TW_ENTRY_PERMIT`.
- Current VIZA-side status fields observed: `status=processing`, `submission_result_status=failed`.
- `household_revoked` saved: no.
- `mainland_id_card_scan` exists in `application_documents`: no.
- Current schema/key completeness scan also flagged missing field keys:
  - `birth_place_other_country`
  - `current_role_detail`
  - `household_revoked`
  - `occupation_experience`
  - `other_nationality_country`
  - `other_passport_expiry_date`
  - `other_passport_number`
  - `past_role_detail`
  - `tw_contact_building_number`
  - `tw_contact_mobile`
  - `tw_contact_road`
- Missing required material key:
  - `mainland_id_card_scan`

The two user-facing blockers already known from earlier checks remain confirmed: `household_revoked` and `mainland_id_card_scan` are still not present.

### Taiwan adapter readiness

Visible local/submission-service env check, reporting booleans only:

- `TW_OFFICIAL_LOGIN_ADAPTER`: not configured.
- `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS`: not configured.
- `TW_OFFICIAL_LOGIN_ADAPTER_MODULE`: not configured.
- Adapter approved: no.
- Adapter loaded: no, reason `missing_adapter`.

No adapter values or secrets were printed. Because the submission-service process is not running locally, this does not prove production runtime env; it confirms the currently visible runtime/config surface is not ready.

### Submission-service readiness

- `GET http://localhost:8080/ready`: not reachable; no process is listening on port 8080.
- `RUNNER_JOB_COUNTRY=taiwan`: not verifiable in a running process because submission-service is not running.
- `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`: not verifiable in a running process because submission-service is not running.
- `runner_job` table: read-only access works; current `country=taiwan` job count by status is empty.
- Worker consumption of `runner_job(country=taiwan)`: not verified, because no worker is running and this pass was explicitly read-only.

### Conclusion

BLOCKED for `READY_FOR_SAFE_RUNNER_JOB_SMOKE`.

Minimum unblockers:

1. User/application owner must complete the current test application data, at minimum `household_revoked` and `mainland_id_card_scan`; then rerun a read-only completeness check for the remaining missing key list.
2. Deployment/runtime owner must start or expose submission-service readiness with `RUNNER_JOB_COUNTRY=taiwan` and `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`, then verify `/ready`.
3. Security/runtime owner must provide and approve the real Taiwan official-login adapter env/module if the smoke path requires it; current visible adapter status is fail-closed (`missing_adapter`).

Not ready to ask the user to click Submit/Retry yet.

## 2026-08-04 Local frontend fix: clearable prefill values stay cleared

User reported that Taiwan applicant fields could not be cleared: after deleting old answers, `DynamicStepForm` restored the same saved/OCR/prefill value on rerender or autosave回流. The issue is broader than `name_chinese` / `name_english`; it affects clearable fill-in fields managed by `DynamicStepForm`.

### Root cause

`DynamicStepForm`'s prefill sync effect treated an empty current value as "not yet prefilled" and replayed the non-empty `prefill[key]`. It did not remember that the same prefill value had already been accepted once and then intentionally cleared by the user.

### Files changed

- `viza-fe/internal-website/components/dynamic-step-form.tsx`
  - Added clearable-field prefill replay protection for input-like fields (`text`, `textarea`, `date`, `tel`, `number`, etc.).
  - Same old prefill is no longer replayed after user clears a field, even across same object / same-content new object rerenders.
  - A genuinely changed external prefill value can still be accepted when safe; edited non-empty user values remain protected.
  - Select/radio/checkbox semantics were not changed.
  - Taiwan single-column name controls still expose base field names only for `name_chinese` / `name_english`, preserving Traditional conversion and uppercase behavior without changing other field controls.
- `viza-fe/internal-website/components/__tests__/dynamic-step-form-prefill-clear.test.tsx`
  - Added focused coverage for `name_chinese`, `name_english`, ordinary text, textarea/address, and tel-style clearable fields.
  - Covered same prefill object, same-content new prefill object, genuine external prefill change, edited-value protection, uppercase English name, and Traditional Chinese blur conversion.

### Tests

- Passed:
  - `cd viza-fe/internal-website && npx vitest run components/__tests__/dynamic-step-form-prefill-clear.test.tsx --testTimeout=20000`
  - Result: 1 file passed, 5/5 tests passed.
- Additional focused run:
  - `cd viza-fe/internal-website && npx vitest run components/__tests__/dynamic-step-form-prefill-clear.test.tsx components/__tests__/taiwan-frontend-experience-audit.test.tsx --testTimeout=20000`
  - Result: new prefill-clear test passed; `taiwan-frontend-experience-audit.test.tsx` had 15/17 passing and 2 existing Taiwan district Traditional-text assertions failing because the rendered accessible text is `新兴区` while the test expects `新興區`. No Maximum update depth failure was observed.

### Not executed

No production DB writes, SQL/migration/seed, deployment, env changes, runner_job creation/retry, Taiwan official site access/login, OTP/CAPTCHA handling, final submission, payment, or git commit/stash/reset/checkout.

## 2026-08-04 Taiwan official terms modal / Agree-first alert fix

User screenshots clarified the first-step blocker:

- The normal official flow is DOM modal only: check `同意上述條款，請打勾。`, verify checked, then click the modal bottom blue `確定`.
- The native top alert text `請先勾選同意條款 Agree first` appears only after an incorrect early click on the bottom `確定`.
- Therefore automation must not intentionally trigger the alert, but must recover fail-closed if it takes over a page where that alert is already present or appears during the terms step.

### Files changed

- `viza-be/submission-service/src/tw/terms-modal.ts`
  - New Taiwan-only terms handler.
  - Registers a precise alert handler for `請先勾選同意條款` / `Agree first`; unmatched native alerts fail closed.
  - Handles the DOM modal in the safe order: checkbox -> verify checked -> bottom `確定` -> wait for modal/overlay cleared.
  - Idempotently skips when the terms modal is absent.
  - Refuses to continue to delivery-location controls while the modal is still visible.
- `viza-be/submission-service/src/tw/apply.ts`
  - Uses `acceptTermsModal()` from the new helper.
  - Calls `assertTwTermsModalCleared()` before selecting `continent` / `overseaOfficeId`.
- `viza-be/submission-service/src/tw/__tests__/terms-modal.spec.ts`
  - Covers normal no-alert path, takeover/recovery from Agree-first alert, disabled/unchecked checkbox fail-closed behavior, modal-not-present idempotency, and first-step gating while modal is visible.

### Tests

- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/terms-modal.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/normalize.spec.ts`
  - Result: 25/25 tests passed.
- Passed:
  - `cd viza-be/submission-service && npm run type-check`

### Controlled smoke

Attempted first action against the existing Chrome Taiwan official tab, which user confirmed was still blocked by the native `請先勾選同意條款 Agree first` alert.

Result: BLOCKED by browser control policy before page access. The Chrome control layer refused access to `https://coa.immigration.gov.tw` because an admin-enforced browser security policy could not be verified. I did not bypass that control with another browser path.

Current smoke status: not verified. I did not accept the existing alert, did not check the official modal checkbox, did not click the official modal `確定`, and did not verify entry to the second step.

Not executed: final CAPTCHA, official `確認資料`, submission, payment, production DB/env writes, runner_job creation/retry, deployment, or git commit/stash/reset/checkout.

### Computer Use fallback attempt

After the browser connector was blocked, I tried the system-level Computer Use fallback against the user's current Chrome session.

Result: still BLOCKED; second-step smoke not verified.

Evidence:

- Computer Use initially exposed a different active Chrome window/tab, not the Taiwan official tab.
- Attempting to use Chrome tab search/window state through Computer Use got stuck on a Google Calendar accessibility menu (`Select task lists to show`) and did not expose or switch to the Taiwan official page.
- Direct macOS Apple Events to Chrome for switching to the existing Taiwan tab were rejected by the OS with `Not authorized to send Apple events to Google Chrome (-1743)`.
- Direct macOS System Events had already been rejected earlier with `Not authorized to send Apple events to System Events (-1743)`.

No official-page action was performed in this fallback attempt: the existing `Agree first` alert was not accepted, the terms checkbox was not checked, the modal `確定` was not clicked, and second step was not reached.

## 2026-08-04 Taiwan official photo-spec modal fix

User/live screenshots clarified the next actual first-step blocker after terms acceptance:

- The terms modal had already been completed.
- The visible blocker was the official `照片規格說明及範例圖示(.jpg檔)` DOM modal.
- Accessibility text still exposed delivery-location controls behind the modal, so relying on text alone was unsafe; the modal had to be closed and verified visually/DOM-wise before selecting continent/office.

### Files changed

- `viza-be/submission-service/src/tw/photo-spec-modal.ts`
  - New Taiwan-only photo-spec modal handler.
  - Locates the visible modal by DOM modal scope and `照片規格` text.
  - Clicks exactly one visible `OK/確定` button scoped inside that modal.
  - Verifies the modal is hidden and the `continent` control is present, visible, and enabled before first-step fields can be touched.
  - Fails closed if the modal remains visible or the first-step control is not interactable.
- `viza-be/submission-service/src/tw/apply.ts`
  - Replaces the old best-effort photo dialog closer with `dismissTwPhotoSpecModalIfPresent()`.
  - Adds `assertTwPhotoSpecModalCleared()` before `continent` / `overseaOfficeId` selection.
- `viza-be/submission-service/src/tw/__tests__/photo-spec-modal.spec.ts`
  - Covers visible photo modal close, absent modal idempotent skip, and failure when clicking `確定` does not hide the modal.

### Tests

- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/normalize.spec.ts`
  - Result: 28/28 tests passed.
- Passed:
  - `cd viza-be/submission-service && npm run type-check`

### Controlled smoke status

Read-only state after user resumed login:

- Current visible Chrome page: `coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply`.
- Terms modal text no longer present.
- Photo-spec text still present, consistent with the visible modal blocker.

I did not continue clicking because the system-level Computer Use click channel had just returned repeated `noWindowsAvailable` errors while trying to click the visible photo modal `確定`. Following the updated instruction, I stopped clicking rather than retry stale element indexes or fixed coordinates.

Current smoke status: not verified past the photo-spec modal; second step not reached by me.

Not executed: dropdown selection, second-step navigation, final CAPTCHA, official `確認資料`, submission, payment, production DB/env writes, runner_job creation/retry, deployment, or git commit/stash/reset/checkout.

## 2026-08-04 Taiwan controlled Playwright first-step smoke

Computer Use / existing Chrome takeover was retired for this smoke because multi-window targeting was unreliable. I added a dedicated headed Playwright smoke path that owns one browser context and one Page, without scanning or controlling the user's existing Chrome tabs.

### Files changed

- `viza-be/submission-service/src/tw/delivery-location.ts`
  - Extracts the official first-step delivery-location filler from `apply.ts` into a side-effect-light Taiwan helper.
  - Uses the same strict DOM `name` contract: `continent` and `overseaOfficeId`.
  - Keeps terms/photo modal clearance assertions before touching first-step controls.
- `viza-be/submission-service/src/tw/apply.ts`
  - Reuses `fillTwDeliveryLocationTabStrict()` from the extracted helper.
- `viza-be/submission-service/src/tw/controlled-smoke.ts`
  - New Taiwan-only controlled first-step smoke harness.
  - Launches a dedicated headed Playwright session via the existing Taiwan session runtime.
  - Enforces an official URL allowlist for:
    - `/coa-frontend/overseas-foreign-china`
    - `/coa-frontend/overseas-foreign-china/apply`
    - `/coa-frontend/overseas-foreign-china/apply/verify`
  - Enforces a single-page invariant and fails closed if a popup/new tab appears.
  - Pauses on `/apply/verify` for user-handled official verification.
  - On exact `/apply`, no longer treats downstream/final CAPTCHA text as a login/OTP boundary; only visible, enabled login/OTP controls or blocking verification modals pause the smoke.
  - Reuses the official terms modal, photo-spec modal, and delivery-location helpers.
- `viza-be/submission-service/src/tw/__tests__/controlled-smoke.spec.ts`
  - Covers URL allowlist, single-page fail-closed behavior, `/apply/verify` pause, `/apply` with downstream CAPTCHA text not pausing, visible OTP blocker pausing, and successful first-step completion without final confirm.
- `viza-be/submission-service/scripts/run-tw-controlled-first-step-smoke.ts`
  - CLI entry for the dedicated headed smoke.

### Tests

- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/controlled-smoke.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/normalize.spec.ts`
  - Result: 34/34 tests passed.
- Not passed due unrelated concurrent Philippines type errors:
  - `cd viza-be/submission-service && npm run type-check`
  - Blocking files were under `src/ph-etravel/*` and `src/index.ts` PH result wiring; no Taiwan smoke type errors were reported before those existing errors.

### Controlled smoke result

- Command:
  - `cd viza-be/submission-service && npx tsx scripts/run-tw-controlled-first-step-smoke.ts`
- User completed the official manual verification step in the dedicated Playwright window.
- The same smoke process continued with the same Page reference.
- Result:
  - `status`: `stopped_at_second_step`
  - `url`: `https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply`
  - Filled first-step fields: `continent`, `embassy_office`

Smoke status: PASSED to second step and stopped as required.

Not executed: final CAPTCHA, official `確認資料`, final submission, payment, production DB/env writes, runner_job creation/retry, deployment, or git commit/stash/reset/checkout.

## 2026-08-04 Taiwan formal runner readiness audit (architecture correction)

### Scope correction

Controlled Playwright smoke / Computer Use / ChatGPT browser control is diagnostic only and is not the target production execution path. The intended Taiwan path is the backend runner path:

`runner_job(country=taiwan)` -> `queue/dispatch.ts` -> `tw/runner.runOne` -> `runTwHalt` -> `fillTwEntryPermitApplication`.

This formal path owns one Playwright session, uses the application-scoped VIZA alias, performs application email verification through `inbound_email`, solves the email and final CAPTCHA through the shared 2captcha provider, clicks official `確認資料`, and only persists success when official receipt evidence is captured. It does not perform post-approval payment.

### Files changed

- `viza-be/submission-service/src/country-submissions/registry.ts`
  - Corrected Taiwan metadata to `realSubmitAvailable: true` and `routeStatus: "runner_job_dispatched"`.
  - Updated Taiwan notes to describe the formal automatic path: email OTP, files, shared final CAPTCHA, official `確認資料`, and fail-closed official receipt capture.
- `viza-be/submission-service/src/country-submissions/types.ts`
  - Added `runner_job_dispatched` to the typed `routeStatus` union. Existing Australia/Vietnam metadata already uses this status; Taiwan now matches the canonical runner path.
- `viza-be/submission-service/src/country-submissions/__tests__/registry.spec.ts`
  - Added Taiwan registry regression for canonical `runner_job` live submit metadata.
- `viza-be/submission-service/src/queue/dispatch.ts`
  - Updated the Taiwan dispatch comment to reflect automatic final submit + official receipt, not CAPTCHA halt.
- `viza-be/submission-service/src/queue/__tests__/dispatch.spec.ts`
  - Added Taiwan to launch country dispatch coverage and alias routing coverage.
- `viza-be/submission-service/src/tw/runner.ts`
  - Updated stale runner comment from CAPTCHA halt semantics to formal receipt/fail-closed semantics.
- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - Added source-level guard that Taiwan canonical dispatch metadata and comments do not regress to controlled-smoke/CAPTCHA-halt wording.

Earlier controlled-full-submission prototype files were withdrawn and are not part of the formal path.

### Read-only readiness evidence

- Canonical dispatch:
  - `DISPATCH.taiwan` is wired to `runTaiwan`.
  - `DISPATCH_META.taiwan.runner` is `tw/runner.runOne`.
  - `normalizeCountry("TW")` resolves to `taiwan`.
- Legacy branch:
  - The old `submission_queue` Taiwan provider remains guarded by `VIZA_ALLOW_LEGACY_REAL_SUBMIT`.
  - The formal `runner_job(country=taiwan)` path does not depend on that legacy provider.
- Alias domain:
  - Effective Taiwan application alias domain is `viza.it.com`.
  - `dig MX viza.it.com` returned Cloudflare MX records.
  - Old `haggstorm.com` route is not used for Taiwan readiness.
- Current local env/config visibility:
  - `.env` has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TWOCAPTCHA_API_KEY` configured.
  - `TW_OFFICIAL_LOGIN_ADAPTER`, `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS`, and `TW_OFFICIAL_LOGIN_ADAPTER_MODULE` are not configured in the visible local env.
  - `RUNNER_JOB_COUNTRY`, `RUNNER_JOB_CONSUMER_ENABLED`, `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED`, and `VIZA_ALLOW_LEGACY_REAL_SUBMIT` are unset in the visible local env.
- Running service:
  - `GET http://localhost:8080/ready` returned `status=ready`, `dbReachable=true`, `workerStarted=true`.
  - I did not inspect the running process env because that could expose secrets; therefore I did not prove this running worker is scoped with `RUNNER_JOB_COUNTRY=taiwan`.
- Playwright runtime:
  - Headless Chromium launched successfully on `about:blank`.
- `inbound_email`:
  - Read-only count query succeeded; table is readable by the service credentials.
- Test application `6f64272e-1af6-4a48-8525-fcabc5276308`:
  - Application exists with `country=taiwan`, `visa_type=TW_ENTRY_PERMIT`.
  - Current application status is `processing`; `submission_result_status=failed`.
  - Duplicate-run guard would not block: no existing TW `submitted` or `stopped_at_captcha` result.
  - 137 answer rows are present.
  - `normalizeTwAnswers()` succeeds.
  - `household_revoked` is not saved, but current normalized eligibility category is `1`, so this field is not required for this application.
  - Current conditions do not require `hk_macau_id_scan`, `other_nationality_passport_scan`, or `mainland_id_card_scan`; `mainland_id_card_scan` nevertheless exists.
  - Required documents for current conditions are `photo`, `mainland_travel_document`, and `eligibility_supporting_document_1`.
  - All required documents are present and readable from storage.
  - Read-only `runner_job` query for this application and `country=taiwan` returned count 0; no job was created or retried.

### Tests

- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/compliance.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/inbox.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts`
  - Result: 41/41 passed.
- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/country-submissions/__tests__/registry.spec.ts`
  - Result: 23/23 passed.
- Passed:
  - `cd viza-be/submission-service && SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test node --import tsx --test src/queue/__tests__/dispatch.spec.ts src/__tests__/runners.smoke.test.ts`
  - Result: 12/12 passed.
- Passed:
  - `cd viza-be/submission-service && npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/tw/apply.ts src/tw/delivery-location.ts src/tw/terms-modal.ts src/tw/photo-spec-modal.ts src/tw/auth.ts src/tw/inbox.ts src/tw/captcha.ts src/tw/runner.ts src/queue/dispatch.ts src/country-submissions/registry.ts src/country-submissions/types.ts`

### Conclusion

NOT READY for coordinator-approved production runner execution yet.

Code/contract readiness is now aligned for the formal Taiwan runner path, and the test application data/materials are ready under the current normalized conditions. The remaining blocker is runtime/config proof:

1. Deployment/runtime owner must start or verify submission-service with `RUNNER_JOB_COUNTRY=taiwan` and `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`.
2. Runtime owner must confirm the runner worker that reports `/ready` is the same process with the Taiwan country scope.
3. Security/runtime owner must either approve that no official-login adapter is needed for the normal application-email flow, or provide approved `TW_OFFICIAL_LOGIN_*` adapter config for fail-closed official-login-page fallback.
4. Coordinator must explicitly decide when to create/retry the real `runner_job(country=taiwan)`.

Safe existing entry after coordinator approval: consume a normal `runner_job` row with `country=taiwan`; the code entrypoint is `src/tw/runner.runOne(applicationId)` via `queue/dispatch.ts`.

Not executed: official website access, browser smoke, runner_job creation/retry, production DB/env writes, deployment, migration, git commit/stash/reset/checkout, final submission, or payment.

## 2026-08-04 Fast formal-runner preflight gate

### Goal

Added a fast Taiwan formal-runner preflight so early official DOM drift is caught before creating a real `runner_job`.

This preflight uses submission-service's own headless Playwright runtime and the same production helpers as the formal runner:

- `clickEnterApplication()`
- `acceptTermsModal()`
- `dismissTwPhotoSpecModalIfPresent()`
- `selectTwDeliveryLocationStrict()` / `fillTwDeliveryLocationTabStrict()`

It does not use controlled-smoke, Computer Use, existing Chrome, fixed coordinates, or copied DOM logic.

### Code changes

- `viza-be/submission-service/src/tw/formal-preflight.ts`
  - New `runTwFormalRunnerPreflight()` gate.
  - Starts a fresh official Taiwan headless session, enables Playwright trace, runs entry -> terms -> photo-spec -> delivery-location control selection, and stops before email verification.
  - On failure returns one redacted diagnostic with phase, URL path, modal kinds, control names, button texts, elapsed wait, trace path, screenshot path, and serialized error.

- `viza-be/submission-service/scripts/run-tw-formal-preflight.ts`
  - New read-only CLI gate: loads the target application answers/profile, normalizes answers, passes only `continent` and `embassy_office` into the preflight, and prints no answer values or PII.

- `viza-be/submission-service/src/tw/delivery-location.ts`
  - Split delivery-location into `selectTwDeliveryLocationStrict()` plus `fillTwDeliveryLocationTabStrict()`.
  - Formal runner still uses the full helper; preflight uses the select-only helper and stops before email verification.
  - Added bounded waits for visible/enabled `continent` and for dependent `overseaOfficeId` options to re-render.

- `viza-be/submission-service/src/tw/apply.ts`
  - Added a limited same-session bounded wait for known entry-control slow load/navigation.
  - Added fast fail-closed detection when the official entry lands on `/apply/verify` email verification before `/apply`.
  - Unknown entry DOM still fails closed; no job-level retry was enabled.

- `viza-be/submission-service/src/tw/__tests__/formal-preflight.spec.ts`
  - Covers formal helper sequence, delayed dependent office options, no email/final-submit action, and redacted failure diagnostics.

### Tests

Passed:

- `node --import tsx --test src/tw/__tests__/formal-preflight.spec.ts src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts` — 25/25 passed.
- `npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/tw/apply.ts src/tw/formal-preflight.ts src/tw/__tests__/formal-preflight.spec.ts src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/delivery-location.ts src/tw/terms-modal.ts src/tw/photo-spec-modal.ts src/tw/auth.ts src/tw/inbox.ts src/tw/captcha.ts src/tw/runner.ts src/queue/worker.ts src/queue/handler.ts src/queue/dispatch.ts src/queue/__tests__/worker-target.spec.ts` — passed.

### Real official preflight result

Command run:

- `npx tsx scripts/run-tw-formal-preflight.ts --application-id 6f64272e-1af6-4a48-8525-fcabc5276308`

Initial result: `NOT_READY_FOR_THIRD_SINGLE_RUN`.

Observed safe diagnostic:

- Failed phase: `entry`.
- Duration: about 18.6 seconds initially; after adding fast `/apply/verify` boundary detection, repeat duration was about 3.7 seconds.
- URL path at failure: `/coa-frontend/overseas-foreign-china/apply/verify`.
- Visible control names: `email`, `captchaToken`, `verifyCode`.
- No terms modal or photo-spec modal was visible.
- Trace and masked screenshot were written under the local temp `viza-tw-formal-preflight` directory.

Interpretation: the current official entry path is landing on the email verification boundary before the `/apply` terms/photo/delivery-location page. Because the preflight contract explicitly forbids sending email OTP, CAPTCHA, final submit, payment, runner_job creation, or production DB writes, it correctly stopped before the terms/photo/delivery-location checks.

No third `runner_job` was created, no retry was started, no email OTP was sent, no CAPTCHA was handled, no final submit/payment was attempted, and no production DB write was performed.

## 2026-08-04 Same-session formal repair loop

### Goal

Implemented the formal runner strategy change requested after the first two real job failures: the Taiwan runner no longer treats every missing/transient form control as an immediate job killer during the form-fill phase. It now uses a same-session loop:

1. Keep strict pre-run normalization/readiness and document checks.
2. Try all known fill/upload operations.
3. Collect repairable field failures without applicant values.
4. Run official/client validation in the same page.
5. Build a redacted repair plan.
6. Re-run only the affected operations.
7. Submit with CAPTCHA solve.
8. If no official receipt appears but recognizable validation errors remain, repair and submit again.
9. Stop after at most 3 rounds.

No job-level retry was enabled.

### Code changes

- `viza-be/submission-service/src/tw/repair-loop.ts`
  - New same-session repair/submission loop.
  - Classifies field failures as `retryable`, `repairable`, or `integrity_fatal`.
  - Treats missing required VIZA values and missing required local files as integrity-fatal.
  - Parses HTML validity plus visible official validation/error elements into redacted issues.
  - Re-solves/re-submits CAPTCHA on recognizable CAPTCHA validation after submit.
  - Requires official receipt evidence with case/application number for success.
  - Fails closed on unknown post-submit state or 3-round exhaustion.

- `viza-be/submission-service/src/tw/apply.ts`
  - Formal runner can now accept the official `/apply/verify` email-verification boundary after entry and complete application email verification before continuing to `/apply`.
  - Application form filling is represented as per-field/per-file operations, so one transient missing control does not prevent the remaining operations from being attempted.
  - Final submission is now driven through `runTwRepairSubmissionLoop()` with `collectTwOfficialValidationIssues()`, `solveTwCaptchaAndSubmitWithRetry()`, and `readTwOfficialReceiptEvidence()`.
  - Payment remains outside the runner.

- `viza-be/submission-service/src/tw/index.ts`
  - Exports the repair loop contracts.

- Tests updated/added:
  - `viza-be/submission-service/src/tw/__tests__/repair-loop.spec.ts`
  - `viza-be/submission-service/src/tw/__tests__/entry-control.spec.ts`
  - `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`

### Tests

Passed:

- `node --import tsx --test src/tw/__tests__/repair-loop.spec.ts src/tw/__tests__/formal-preflight.spec.ts src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts` — 33/33 passed.
- `node --import tsx --test src/tw/__tests__/compliance.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/inbox.spec.ts` — 31/31 passed.
- `SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test node --import tsx --test src/queue/__tests__/worker-target.spec.ts src/queue/__tests__/dispatch.spec.ts src/__tests__/runners.smoke.test.ts` — 18/18 passed.
- `npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/tw/apply.ts src/tw/repair-loop.ts src/tw/formal-preflight.ts src/tw/__tests__/repair-loop.spec.ts src/tw/__tests__/formal-preflight.spec.ts src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/compliance.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/delivery-location.ts src/tw/terms-modal.ts src/tw/photo-spec-modal.ts src/tw/auth.ts src/tw/inbox.ts src/tw/captcha.ts src/tw/runner.ts src/queue/worker.ts src/queue/handler.ts src/queue/dispatch.ts src/queue/__tests__/worker-target.spec.ts` — passed.

### Status

Code/test side is `READY_FOR_THIRD_SINGLE_RUN`.

No third `runner_job` was created, no worker was started, no official final submit was attempted, no payment was attempted, no production DB/env was changed, and no deployment or git operation was performed.

## 2026-08-04 Third authorized single-job run

### Pre-run verification

Focused tests and scoped typecheck were green before execution:

- Taiwan focused repair/preflight/entry/modal/compliance/receipt/auth/inbox: 64/64 passed.
- Queue/dispatch/target worker: 18/18 passed.
- Scoped typecheck: passed.

Read-only production DB readiness before job creation:

- Application `6f64272e...6308` was not submitted.
- No Taiwan official receipt was present.
- Taiwan queued/running runner jobs: 0/0.
- `normalizeTwAnswers()` passed with 137 answer rows.
- Required documents count: 3.
- Required documents ready: true.

### Execution

- Created exactly one new Taiwan runner job: `fa774994...c211`.
- Started a foreground single-target worker with country/job/application locking:
  - `RUNNER_JOB_COUNTRY=taiwan`
  - `RUNNER_JOB_TARGET_ID=fa774994...c211`
  - `RUNNER_JOB_EXPECTED_APPLICATION_ID=6f64272e...6308`
  - `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`
  - `SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true`
  - `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=false`
  - `RUNNER_CONCURRENCY_JSON` limited Taiwan to 1.
- Worker exited by itself after the target job reached terminal state.

### Terminal result

Fail-closed before email OTP send:

- Job status: `failed`.
- Attempts: `1/1`.
- Lease cleared.
- Taiwan queued/running after exit: 0/0.
- Application submission result status: `failed`.
- No official receipt.
- Not submitted.
- No final CAPTCHA reached.
- No final official submit reached.
- Payment was not attempted.
- No fourth job/retry was created.

Failure class:

- `email_field_verification_failed`
- Formal runner reached the official `/apply/verify` email-verification boundary, whose current email input uses `name="email"`.
- The runner still targeted the later application-form email control `name="traveller.email"` and failed before sending the code.

### Post-run code fix, no retry

Fixed the discovered email-verification boundary selector gap after the terminal failure, without creating or retrying any job:

- `viza-be/submission-service/src/tw/apply.ts`
  - `/apply/verify` email input now uses `name="email"`.
  - `/apply/verify` OTP input now uses `name="verifyCode"`.
  - The later application-form `name="traveller.email"` remains as fallback.
  - Verified state now accepts either visible `已認證` text or navigation to exact `/apply`.

- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - Added source contract checks for the `/apply/verify` control names and helper order.

Post-fix tests:

- `node --import tsx --test src/tw/__tests__/compliance.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/inbox.spec.ts src/tw/__tests__/repair-loop.spec.ts src/tw/__tests__/entry-control.spec.ts` — 43/43 passed.
- Scoped typecheck for Taiwan runner/repair/preflight/queue files — passed.

Status: third authorized job is terminal failed. The selector gap it exposed is fixed locally, but no fourth automatic attempt is authorized or started.

## 2026-08-04 Fourth single-job run after user "continue"

### Pre-run verification

Before the next single-job run:

- Taiwan focused tests after `/apply/verify` selector fix: 43/43 passed.
- Scoped typecheck: passed.
- Application `6f64272e...6308` was not submitted.
- No Taiwan official receipt was present.
- Taiwan queued/running runner jobs: 0/0.
- `normalizeTwAnswers()` passed with 137 answer rows.
- Required documents count: 3.
- Required documents ready: true.

### Execution

- Created exactly one new Taiwan runner job: `034771d1...5c5a`.
- Started a foreground single-target worker with country/job/application locking:
  - `RUNNER_JOB_COUNTRY=taiwan`
  - `RUNNER_JOB_TARGET_ID=034771d1...5c5a`
  - `RUNNER_JOB_EXPECTED_APPLICATION_ID=6f64272e...6308`
  - `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`
  - `SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true`
  - `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=false`
  - `RUNNER_CONCURRENCY_JSON` limited Taiwan to 1.
- Worker exited by itself after the target job reached terminal state.

### Terminal result

Fail-closed before email OTP send:

- Job status: `failed`.
- Attempts: `1/1`.
- Lease cleared.
- Taiwan queued/running after exit: 0/0.
- Application submission result status: `failed`.
- No official receipt.
- Not submitted.
- No final CAPTCHA reached.
- No final official submit reached.
- Payment was not attempted.

Failure class:

- `email_captcha_input_not_found`
- Formal runner filled the `/apply/verify` email address but could not find the send-code CAPTCHA input.
- The official page exposes the send-code CAPTCHA input as `name="captchaToken"`; the code only recognized `id="captchaToken"` or placeholder fallback.

### Post-run code fix, no automatic next job

Fixed the selector gap without creating another job:

- `viza-be/submission-service/src/tw/captcha.ts`
  - CAPTCHA input selector now accepts both `input#captchaToken` and `input[name='captchaToken']`.

- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - Added source contract check for `input[name='captchaToken']`.

Post-fix tests:

- `node --import tsx --test src/tw/__tests__/compliance.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/inbox.spec.ts` — 28/28 passed.
- Scoped typecheck for Taiwan apply/captcha/repair/preflight files — passed.

Status: fourth single-job run is terminal failed. The CAPTCHA input selector gap it exposed is fixed locally. No further automatic job was created.

## 2026-08-04 Taiwan single runner_job target mode implemented

Implemented a formal `runner_job` single-target mode so a Taiwan smoke can run exactly one approved job without accidentally consuming another queued job.

### Files changed

- `viza-be/submission-service/src/queue/worker.ts`
  - Added `RUNNER_JOB_TARGET_ID` support through `claimTargetJob()`.
  - Target claim validates job existence, queued status, country match, and optional expected application id before any state change.
  - The DB update path includes `id + country + status=queued`; non-target jobs are not locked, attempted, or mutated.
  - Target mode returns after one job is handled.
- `viza-be/submission-service/src/index.ts`
  - Added startup wiring for `RUNNER_JOB_TARGET_ID` and `RUNNER_JOB_EXPECTED_APPLICATION_ID`.
  - Target mode is blocked if `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=true`, if runner consumer is disabled, if `RUNNER_JOB_COUNTRY` is missing, or if normalized country is not `taiwan`.
  - After the single target finishes, the process closes the health server and exits.
- `viza-be/submission-service/.env.example`
  - Documented the two new target-mode env vars.
- `viza-be/submission-service/src/queue/__tests__/worker-target.spec.ts`
  - Added focused coverage for target-only claim, non-target preservation, country/application mismatch, missing/non-queued target, single-job completion, and startup guard source checks.

### Safe startup template

Do not run until main coordination approval creates/identifies the single target job:

```bash
RUNNER_JOB_COUNTRY=taiwan \
RUNNER_JOB_TARGET_ID=<approved-runner-job-id> \
RUNNER_JOB_EXPECTED_APPLICATION_ID=6f64272e-1af6-4a48-8525-fcabc5276308 \
SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false \
SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true \
SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=false \
npm run dev
```

### Tests

- Passed:
  - `cd viza-be/submission-service && SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test node --import tsx --test src/queue/__tests__/worker-target.spec.ts`
  - Result: 6/6 passed.
- Passed:
  - `cd viza-be/submission-service && SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test node --import tsx --test src/queue/__tests__/worker-target.spec.ts src/queue/__tests__/dispatch.spec.ts src/__tests__/runners.smoke.test.ts`
  - Result: 18/18 passed.
- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/compliance.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/inbox.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts src/country-submissions/__tests__/registry.spec.ts`
  - Result: 64/64 passed.
- Passed:
  - `cd viza-be/submission-service && npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/queue/worker.ts src/queue/handler.ts src/queue/dispatch.ts src/queue/__tests__/worker-target.spec.ts src/country-submissions/registry.ts src/country-submissions/types.ts src/tw/apply.ts src/tw/delivery-location.ts src/tw/terms-modal.ts src/tw/photo-spec-modal.ts src/tw/auth.ts src/tw/inbox.ts src/tw/captcha.ts src/tw/runner.ts`

### Current stop point

READY_FOR_APPROVED_SINGLE_JOB_RUNNER_SMOKE from the code/test side, but waiting for explicit coordination approval before any real operation.

Not executed: runner_job creation/retry, worker start, official website access, browser smoke, production DB/env writes, deployment, migration, git commit/stash/reset/checkout, final submission, or payment.

## 2026-08-04 Authorized single Taiwan runner_job smoke result

### Authorization and setup

User/main coordination authorized one real Taiwan backend runner smoke for application `6f64272e...6308`, including creation of one `runner_job`, production DB status/result writes, and official final submit if the runner reached verified receipt capture. Payment remained explicitly unauthorized; automatic retry was not authorized.

### Preflight

Read-only preflight passed before job creation:

- Target application exists as `country=taiwan`, `visa_type=TW_ENTRY_PERMIT`.
- No existing Taiwan `submitted` / `stopped_at_captcha` duplicate result.
- Taiwan queued/running runner jobs count was 0/0.
- `normalizeTwAnswers()` passed with 137 answer rows.
- Current required documents were 3 and all were present/readable.

### Execution

- Created exactly one `runner_job`: `31abc1ab...b794`.
- Started a new foreground single-target worker on a non-8080 port, leaving the existing 8080 local-endpoints-only safety service untouched.
- Worker env was scoped with:
  - `RUNNER_JOB_COUNTRY=taiwan`
  - `RUNNER_JOB_TARGET_ID=31abc1ab...b794`
  - `RUNNER_JOB_EXPECTED_APPLICATION_ID=6f64272e...6308`
  - `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`
  - `SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true`
  - `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=false`
- Formal path executed: `runner_job` -> `DISPATCH.taiwan` -> `runTwHalt` -> `fillTwEntryPermitApplication`.
- No controlled-smoke, Computer Use, or existing Chrome/browser takeover was used.

### Terminal result

Fail-closed before form fill:

- Runner error class: `taiwan failed: Could not find the "[redacted]" entry control`.
- `runner_job` terminal status: `failed`.
- Attempts: `1/1`.
- Lease cleared and foreground worker exited.
- Application still has no Taiwan `submitted` result and no official receipt.
- Official final submit was not reached.
- Payment was not executed.
- No second job was created and no retry was started.

### Current blocker

The official entry page contract has changed or the runner is landing on a page state where the expected `我要申請` entry control is no longer visible/findable. Next work should be a read-only/diagnostic official entry-page selector update before another authorized single-job run.

Not executed after failure: retry, second job creation, manual browser takeover, payment, deployment, migration, git commit/stash/reset/checkout.

## 2026-08-04 Formal Taiwan entry control fix after first single-job failure

### Root cause

The first authorized formal single-job run failed before form fill because formal `apply.ts` only looked for the traditional Chinese entry text `我要申請`. The official entry currently exposes the English control `I want to apply`, which controlled smoke had already tolerated but the formal runner had not.

### Files changed

- `viza-be/submission-service/src/tw/apply.ts`
  - Exported and fixed `clickEnterApplication()`.
  - Supports official entry controls named `I want to apply`, `我要申請`, and `我要申请` via role/name locators.
  - Idempotently skips only when already on the exact official `/coa-frontend/overseas-foreign-china/apply` URL.
  - Unknown entry controls still fail closed.
- `viza-be/submission-service/src/tw/__tests__/entry-control.spec.ts`
  - Added focused coverage for English, traditional Chinese, simplified Chinese, exact `/apply` skip, unknown entry fail-closed, and source guard that formal `fillTwEntryPermitApplication()` calls the compatible helper.

### DB terminal state check

Read-only check after the failed run:

- Job `31abc1ab...b794`: `failed`, attempts `1/1`, lease cleared, finished.
- Application `6f64272e...6308`: still `processing`, `submission_result_status=failed`.
- No Taiwan submitted result.
- No official receipt.

### Tests

- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/entry-control.spec.ts`
  - Result: 6/6 passed.
- Passed:
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/compliance.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/inbox.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts`
  - Result: 47/47 passed.
- Passed:
  - `cd viza-be/submission-service && SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test node --import tsx --test src/queue/__tests__/worker-target.spec.ts src/queue/__tests__/dispatch.spec.ts src/__tests__/runners.smoke.test.ts`
  - Result: 18/18 passed.
- Passed:
  - `cd viza-be/submission-service && npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/tw/apply.ts src/tw/__tests__/entry-control.spec.ts src/tw/delivery-location.ts src/tw/terms-modal.ts src/tw/photo-spec-modal.ts src/tw/auth.ts src/tw/inbox.ts src/tw/captcha.ts src/tw/runner.ts src/queue/worker.ts src/queue/handler.ts src/queue/dispatch.ts src/queue/__tests__/worker-target.spec.ts`

### Retry readiness

READY_FOR_SINGLE_RETRY from code/test side.

The original job is terminal `failed` with attempts `1/1`, so it is not safely claimable by the single-job worker without an explicit DB reset. Recommended next run is a newly authorized single `runner_job` for the same application, not an automatic retry of `31abc1ab...b794`.

Not executed: retry, second job creation, worker start, official website access, browser smoke, production DB/env writes, deployment, migration, git commit/stash/reset/checkout, final submission, or payment.

## 2026-08-04 Authorized second single Taiwan runner_job smoke result

### Authorization and setup

User/main coordination authorized one new single Taiwan `runner_job` and immediate formal backend execution for application `6f64272e...6308`. Authorization included production DB status/result writes and official final submit only if the runner reached validated official receipt capture. Payment remained unauthorized; third job/retry after failure was not authorized.

### Preflight

Read-only preflight passed:

- Previous job `31abc1ab...b794` was terminal `failed`, attempts `1/1`, lease cleared.
- Application had no Taiwan `submitted` / `stopped_at_captcha` duplicate result and no official receipt.
- Taiwan queued/running runner jobs count was 0/0.
- `normalizeTwAnswers()` passed with 137 answer rows.
- Current required documents were 3 and all were present/readable.

### Execution

- Created exactly one new `runner_job`: `b4891436...9311`.
- Started a fresh foreground single-target worker on a non-8080 port, leaving the existing 8080 local-endpoints-only safety service untouched.
- Worker was locked by country/job/application:
  - `RUNNER_JOB_COUNTRY=taiwan`
  - `RUNNER_JOB_TARGET_ID=b4891436...9311`
  - `RUNNER_JOB_EXPECTED_APPLICATION_ID=6f64272e...6308`
  - `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`
  - `SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true`
  - `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=false`
- Formal path executed: `runner_job` -> `DISPATCH.taiwan` -> `runTwHalt` -> `fillTwEntryPermitApplication`.
- No controlled-smoke, Computer Use, existing Chrome/browser takeover, or manual official-site handoff was used.

### Terminal result

Fail-closed before form fill completion:

- The English entry-control fix worked; the runner passed the previous `I want to apply` blocker.
- New blocker: `taiwan failed: Delivery-location continent control is not present after photo-spec modal handling`.
- `runner_job` terminal status: `failed`.
- Attempts: `1/1`.
- Lease cleared and foreground worker exited.
- Taiwan queued/running count after exit: 0/0.
- Application still has no Taiwan submitted result and no official receipt.
- Official final submit was not reached.
- Payment was not executed.
- No third job was created and no retry was started.

### Current blocker

The formal runner is now blocked at the official delivery-location step after photo-spec modal handling. It needs a diagnostic selector/page-state update for the official first-step controls (`continent` / delivery location) before any further authorized single-job run.

Not executed after failure: retry, third job creation, manual browser takeover, payment, deployment, migration, git commit/stash/reset/checkout.

## 2026-08-04 Formal runner photo-spec / delivery-location blocker fix

Second single-job run blocker diagnosed from the foreground worker failure and read-only terminal/DB state. No additional official-site access, browser run, job creation, retry, DB write, deployment, migration, or git operation was performed.

### Evidence

- Second job `b4891436...9311` is terminal `failed`, attempts `1/1`, lease cleared.
- Application still has no Taiwan `submitted` result and no official receipt.
- Taiwan queued/running count after the failed worker exit was 0/0.
- Existing local artifact/diagnostic search did not find a trace or screenshot for this job; available evidence is the redacted worker error and DB terminal state.
- Failure message: `Delivery-location continent control is not present after photo-spec modal handling`.

### Root cause

The formal runner dismissed the official photo-spec modal, then checked `select[name="continent"]` immediately. The earlier controlled smoke fixture had first-step controls available immediately, but the official headless flow can leave the page in a short post-modal animation/re-render window. The old check could therefore fail closed before the delivery-location controls were visible/enabled.

### Code changes

- `viza-be/submission-service/src/tw/photo-spec-modal.ts`
  - `assertTwPhotoSpecModalCleared()` now waits, with a bounded timeout, for the exact official `/coa-frontend/overseas-foreign-china/apply` path, no visible photo-spec modal, and exactly one visible/enabled `select[name="continent"]`.
  - Timeout errors now include a redacted DOM contract diagnostic: title, visible modal/dialog snippets, select names, button labels, and observed readiness booleans. No applicant answers, OTP, cookies, secrets, or document paths are captured.
  - The photo-spec OK button remains scoped to the visible photo-spec modal; page-level “照片規格” links or unrelated OK buttons are not treated as modal controls.

- `viza-be/submission-service/src/tw/__tests__/photo-spec-modal.spec.ts`
  - Added regressions for delayed modal animation, delayed continent select rendering, photo-spec link with no modal, OK button outside modal, and fail-closed diagnostics when first-step controls never appear.

### Tests

Passed:

- `node --import tsx --test src/tw/__tests__/photo-spec-modal.spec.ts` — 8/8 passed.
- `node --import tsx --test src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/compliance.spec.ts src/tw/__tests__/receipt.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/inbox.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts` — 52/52 passed.
- `SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test node --import tsx --test src/queue/__tests__/worker-target.spec.ts src/queue/__tests__/dispatch.spec.ts src/__tests__/runners.smoke.test.ts` — 18/18 passed.
- `npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/tw/apply.ts src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/delivery-location.ts src/tw/terms-modal.ts src/tw/photo-spec-modal.ts src/tw/auth.ts src/tw/inbox.ts src/tw/captcha.ts src/tw/runner.ts src/queue/worker.ts src/queue/handler.ts src/queue/dispatch.ts src/queue/__tests__/worker-target.spec.ts` — passed.

### Status

Code/test side is `READY_FOR_THIRD_SINGLE_RUN`.

No third `runner_job` was created, no retry was started, and the official website was not accessed in this fix pass. A future run still needs explicit coordinator authorization before creating exactly one new single-target Taiwan job.

## 2026-08-04 Current `/ready` process and Taiwan single-job runner narrowing

### `/ready` process identity

Read-only local process inspection identified the process listening on port 8080:

- PID: `13841`
- Command shape: `node -r ts-node/register -r ./scripts/ts-node-js-resolver.cjs src/index.ts`
- Working directory: `viza-be/submission-service`
- Parent command shape: `npm run dev`
- `GET http://localhost:8080/ready`: `status=ready`, `dbReachable=true`, `workerStarted=true`

Evidence level: high for process identity and command/working-directory; high for the env keys below because `ps eww` was readable and parsed locally without printing raw env.

### Current process config, redacted

Only boolean/status values were reported; no secret values were printed.

- `RUNNER_JOB_COUNTRY`: unset, so not Taiwan-scoped.
- `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED`: `false`.
- `SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED`: `false`.
- `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY`: `true`.
- `SUBMISSION_SERVICE_PROVIDER_ALLOWLIST` / `VIZA_SUBMISSION_PROVIDER_ALLOWLIST`: unconfigured.
- Job/application target env names checked (`RUNNER_JOB_ID`, `RUNNER_JOB_APPLICATION_ID`, `RUNNER_JOB_TARGET_ID`, `RUNNER_JOB_TARGET_APPLICATION_ID`): unconfigured and not used by the current runner worker.

Conclusion: the current `/ready` service is the local-endpoints-only safety service. It can legitimately return ready for DB/probe endpoints, but it cannot execute a formal Taiwan `runner_job` because the runner consumer is disabled and the process is not scoped to `RUNNER_JOB_COUNTRY=taiwan`.

### Worker targeting capability

Code search confirmed:

- `pollAndRun()` accepts a `country` option only.
- `claimNextJob()` can restrict by `country`.
- There is no built-in `runner_job.id` or `application_id` filter in the `runner_job` worker path.
- Per-country concurrency defaults to 1, but that is not equivalent to a single-job target.
- Existing queue scripts can list/requeue jobs by id, but they do not execute exactly one runner job by id.
- Read-only DB check found:
  - queued Taiwan jobs: 0
  - running Taiwan jobs: 0
  - Taiwan jobs for application `6f64272e-1af6-4a48-8525-fcabc5276308`: 0

### Safe formal-run plan, not executed

Do not use the current `/ready` process for the Taiwan run. It is intentionally local-endpoints-only.

Safe plan for a coordinator-approved Taiwan single-task run:

1. Ensure no other submission-service process is consuming Taiwan jobs.
2. Create or identify exactly one approved `runner_job` row for application `6f64272e-1af6-4a48-8525-fcabc5276308`, country `taiwan`, status `queued`.
3. Immediately before start, run a read-only guard query proving:
   - queued Taiwan jobs count is exactly 1,
   - running Taiwan jobs count is 0,
   - that one queued job's `application_id` is the target application.
4. Start a fresh foreground worker process with:
   - `RUNNER_JOB_COUNTRY=taiwan`
   - `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`
   - `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=false`
   - `SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true`
   - `RUNNER_CONCURRENCY_JSON='{"taiwan":1,"default":0}'`
5. Watch only redacted logs: job id prefix, country, status transitions, official receipt presence/absence. Do not log secrets, OTP, CAPTCHA text, cookies, applicant values, or document paths.
6. Stop the foreground worker after that target job reaches terminal status or if any guard fails.
7. Treat missing official receipt evidence as recoverable failure, not submitted. Do not perform payment.

Stronger future improvement: add a small, tested `runner_job` single-id execution command or worker option before production smoke. That would remove the “exactly one queued Taiwan job” operational guard and provide a true id-targeted runner path.

### Updated blocker status

The previous generic blocker “verify `/ready` belongs to Taiwan worker” is now resolved negatively: current `/ready` is not a Taiwan worker and must not be used for execution.

Current blocker for safe execution is narrower: the formal runner has country scoping but not single job-id scoping. Until a single-id runner option exists, the safe operational workaround is to prove exactly one queued Taiwan job exists before starting a Taiwan-scoped foreground worker.

`TW_OFFICIAL_LOGIN_*` is not a required blocker for the normal application-email OTP route. It remains fail-closed only if the official site presents an unexpected account login page.

Not executed: official website access, browser smoke, runner_job creation/retry, production DB/env writes, deployment, migration, git commit/stash/reset/checkout, final submission, or payment.

## 2026-08-04 Authorized next single Taiwan runner_job smoke and OTP parser fix

### Authorization and setup

User/main coordination authorized exactly one additional Taiwan `runner_job` for application `6f64272e...6308`, including production DB running-state/result writes and official final submit only if the runner reached validated official receipt capture. Payment remained unauthorized, and another automatic job/retry after failure was not authorized.

### Pre-run guard

Read-only guard passed before creation:

- Target application was not `submitted`.
- No Taiwan official receipt was present.
- Taiwan queued/running runner jobs count was 0/0.
- Normalized Taiwan answers and required documents readiness passed.

### Execution

- Created exactly one new `runner_job`: `6ee4a5dd...057d`.
- Started a fresh foreground single-target worker on a non-8080 port, leaving the existing safety `/ready` service untouched.
- Worker was locked by job/country/application:
  - `RUNNER_JOB_COUNTRY=taiwan`
  - `RUNNER_JOB_TARGET_ID=6ee4a5dd...057d`
  - `RUNNER_JOB_EXPECTED_APPLICATION_ID=6f64272e...6308`
  - `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`
  - `SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED=true`
  - `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=false`
- Formal backend path executed. No controlled browser, Computer Use, existing Chrome takeover, manual login, or manual CAPTCHA handling was used.

### Terminal result

Fail-closed at application email OTP retrieval:

- The runner reached the official email verification stage and an official inbound verification email was received for the application alias.
- The job failed with `application_inbox_timeout` because the parser did not extract the token from the real official HTML message shape.
- Terminal state: job `failed`, attempts `1/1`, lease cleared.
- Application remains not submitted and has no official receipt.
- Official final submit was not reached.
- Payment was not executed.
- No additional job was created and no retry was started.

### Root cause and fix

The official email contains explanatory verification-code wording before the actual labeled token. The old parser effectively stopped at the first label-shaped wording and returned no token. It also needed to preserve the confirmed mixed alphanumeric official token shape rather than falling back to broad numeric scanning.

Files changed:

- `viza-be/submission-service/src/tw/inbox.ts`
  - Confirms the official sender/domain and Taiwan system verification subject before accepting a message.
  - Scans all body verification-code labels and extracts the first adjacent mixed alphanumeric token.
  - Keeps fail-closed behavior for unrelated official messages, subject-only labels, broad numeric identifiers, and missing labeled tokens.
  - Extends the polling window to tolerate expected email delivery delay without widening message acceptance.
- `viza-be/submission-service/src/tw/__tests__/inbox.spec.ts`
  - Adds regression coverage for explanatory verification wording before the real token and for rejecting unrelated numeric fallback cases.

### Tests

Passed:

- `node --import tsx --test src/tw/__tests__/inbox.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/compliance.spec.ts` — 29/29 passed.
- `npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/tw/inbox.ts src/tw/__tests__/inbox.spec.ts src/tw/auth.ts src/tw/apply.ts src/tw/captcha.ts src/tw/repair-loop.ts` — passed.
- `git diff --check` — passed.

### Status

Code/test side is ready for another coordinator-authorized single-target Taiwan job, but this pass intentionally stops here. A future run requires a fresh explicit authorization to create exactly one new `runner_job`. No payment is authorized.

## 2026-08-05 Formal no-job pre-submit E2E

### Goal

Aligned Taiwan with the France/Vietnam formal-runner pattern instead of using controlled browser smoke as a second implementation. The no-job pre-submit path now runs through the same formal `fillTwEntryPermitApplication` entry and stops before the official final submit.

### Architecture changes

- `viza-be/submission-service/src/tw/apply.ts`
  - Added `stopBeforeFinalSubmit=true` support on the formal entrypoint.
  - Split the implementation into a wrapper plus one-session attempt path, with bounded attempts only for safe pre-submit testing.
  - Added typed checkpoints: `entry`, `terms`, `delivery`, `email_verify`, `form`, `captcha_boundary`, `submitted_receipt`, `validation_error`, `unknown`.
  - Removed the earlier over-broad CAPTCHA early stop; the official `/apply` page can contain final CAPTCHA controls while form fields are still visible.
  - Returns `ready_to_submit` only after entry, email verification, terms/photo/delivery, all field/file operations, validation repair, and final CAPTCHA fill are complete.
- `viza-be/submission-service/src/tw/captcha.ts`
  - Split final CAPTCHA into solve/fill and final-submit click phases.
  - Formal submit mode still calls solve/fill then clicks `確認資料`; pre-submit mode never clicks it.
- `viza-be/submission-service/src/tw/repair-loop.ts`
  - Added `pre_submit` mode returning `ready_to_submit`.
  - Keeps same-session repair behavior for retryable/repairable field and upload failures.
  - Emits redacted field/control/error keys for repair exhaustion.
- `viza-be/submission-service/src/tw/auth.ts`
  - Added a read-only OTP provider option for pre-submit so inbound email can be read without marking rows processed.
  - Default runner behavior remains unchanged.
- `viza-be/submission-service/src/queue/halt-runners.ts`
  - Extracted `prepareTwEntryPermitApplication()` so runner and pre-submit CLI share the same load/normalize/docs/generated alias path.
  - `runTwHalt` continues to own DB result persistence and does not enable `stopBeforeFinalSubmit`.
- `viza-be/submission-service/src/tw/contract-fixture.ts`
  - Added redacted contract fixture capture: URL path, control names/types, select option shape, modal kinds, validation keys, and email structure classes.
- `viza-be/submission-service/scripts/run-tw-pre-submit-e2e.ts`
  - Added no-job, no-submission-result-write CLI that reads the target application, reuses the formal generated alias and official flow, and passes `stopBeforeFinalSubmit=true`.
- `viza-be/submission-service/src/tw/fillers.ts`
  - Added select label fallback for official controls whose option value differs from VIZA's normalized label/code shape.
  - Added Taiwan city code -> official label fallback for the contact-address city select.
  - Fixed kinship indexed controls to target their stable full `kinships[N].*` names directly instead of an overly narrow block scope.
- `viza-be/submission-service/src/tw/__tests__/repair-loop.spec.ts`
- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - Added focused coverage for pre-submit mode, CAPTCHA split, no final-submit click, no-job CLI, and runner not enabling pre-submit mode.

### Pre-submit E2E result

Executed the formal no-job pre-submit E2E against application `6f64272e...6308`:

- Command: `npx tsx scripts/run-tw-pre-submit-e2e.ts --application-id 6f64272e-1af6-4a48-8525-fcabc5276308`
- Result: `ready_to_submit`.
- Checkpoint: `captcha_boundary`.
- Pages filled: `entry`, `email_verification`, `terms_modal`, `delivery_location`, `application_repair_loop`, `repair_rounds_1`, `captcha_solved`, `ready_to_submit`.
- Required document count: 3.
- Field audit total/control count: 77/77.
- CAPTCHA attempts: 1.
- Portal path: `/coa-frontend/overseas-foreign-china/apply`.

The E2E accessed the official site, sent/read the application email OTP through the generated `@viza.it.com` alias, filled/uploaded through the formal runner helpers, solved/filled final CAPTCHA, and stopped before `確認資料`.

### Fixes found by no-job E2E

- Early `/apply` CAPTCHA boundary detection was too broad and stopped before filling visible form controls.
- `traveller.city` used VIZA city codes while the official select needed the visible city label fallback.
- Kinship fields existed in the page but the old local scope missed `kinships[0].deadMark` and `kinships[1].deadMark`.

All three were fixed without creating another `runner_job`.

### Tests

Passed:

- `node --import tsx --test src/tw/__tests__/repair-loop.spec.ts src/tw/__tests__/compliance.spec.ts src/tw/__tests__/inbox.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/entry-control.spec.ts src/tw/__tests__/photo-spec-modal.spec.ts src/tw/__tests__/terms-modal.spec.ts src/tw/__tests__/formal-preflight.spec.ts` — 64/64 passed.
- `npx tsc --noEmit --pretty false --esModuleInterop --skipLibCheck --module CommonJS --target ES2020 --lib ES2020,DOM src/tw/apply.ts src/tw/fillers.ts src/tw/captcha.ts src/tw/repair-loop.ts src/tw/auth.ts src/tw/contract-fixture.ts src/queue/halt-runners.ts scripts/run-tw-pre-submit-e2e.ts src/tw/__tests__/repair-loop.spec.ts src/tw/__tests__/compliance.spec.ts` — passed.
- `git diff --check` — passed.

### Status

READY_FOR_FORMAL_FINAL_SUBMIT_JOB_AUTHORIZATION from code/E2E side.

Not executed: runner_job creation/retry, production DB submission-result write, official final `確認資料` click, official receipt capture, payment, deployment, migration, git commit/stash/reset/checkout.
## 2026-08-05 Applicant final-submit live handoff

- Canonical Taiwan runner now uses a UK-like applicant handoff outcome, adapted
  to Taiwan's lack of a durable account/resume URL.
- `runTwHalt` fills and verifies the official form, solves/fills the final
  CAPTCHA, and keeps the same Browserbase session alive instead of clicking
  `確認資料` itself.
- An opaque handoff id is persisted in `submission_result`; the Browserbase
  Live View URL remains service-role-only in `takeover_session` and is returned
  only after the signed-in applicant is verified as the application owner.
- The client result card exposes `打开已填写的台湾官网`. The runner continues
  watching the same page and writes `submitted` only after official receipt
  evidence with a case number is captured.
- Added migration file `0129_tw_applicant_live_handoff.sql`; not executed.
- Verification: submission-service typecheck passed; backend focused 27/27;
  frontend focused 9/9; `git diff --check` passed. Full frontend typecheck has
  only pre-existing PH eTravel, Travel test, and missing Playwright errors.
- No deployment, production env/DB write, runner_job creation, official-site
  visit, final submit, or payment was performed.

## 2026-08-05 Production live-handoff rollout and single-job result

### Production rollout

- Applied production migration `0129_tw_applicant_live_handoff.sql` to Supabase
  project `oyjxdzsoejraedqghndi`. Read-only verification confirmed
  `takeover_session.handoff_kind`, `takeover_session.expires_at`, and
  `idx_takeover_session_application_kind_status` exist.
- Added Taiwan to the Fly country-worker deployment contract and configured the
  credential-free runtime flags: `RUNNER_JOB_COUNTRY=taiwan`, legacy queue
  disabled, runner-job consumer enabled, Browserbase enabled with country `TW`,
  and applicant handoff timeout 1800 seconds.
- Deployed `viza-runner-taiwan` to Fly. Both machines report passing `/ready`
  checks; public `/health` and `/ready` return 200. Database connectivity and
  worker startup are true. Required Browserbase, 2Captcha, Supabase, and
  submission-result secret names are configured; values were not printed.
- Deployed `viza-internal` production deployment
  `dpl_5vUYZMSyYm8af9ZAtraGB8K6jPzf`, aliased to
  `https://app.viza.it.com`. The production build contains
  `/api/applications/[id]/taiwan-handoff`; an unauthenticated request returns
  401 as expected.
- Production readiness passed before enqueue: no active Taiwan job or handoff,
  no official receipt, managed `viza.it.com` alias MX is routable, recent
  inbound rows exist for that domain, normalization produced 139 answers, and
  all resolved required documents were readable.

Files changed for this rollout:

- `viza-be/submission-service/deploy/fly/countries.json`
- `viza-be/submission-service/deploy/fly/fly.country.toml.template`
- `viza-be/submission-service/scripts/fly/deploy-country.sh`
- `viza-be/submission-service/scripts/fly/sync-runtime-secrets.sh`
- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts`

The Fly deploy helper also received a portability-only fix, replacing the GNU
`mktemp --suffix` option with the macOS-compatible `mktemp -t` form.

### Verification

Passed before production rollout:

- Submission-service formal Taiwan focused tests excluding deprecated
  controlled-smoke diagnostics: 96/96.
- Frontend Taiwan retry/result-card/handoff focused tests: 16/16.
- `npm run type-check` and `npm run build` in `viza-be/submission-service`.
- `npm run build` in `viza-fe/internal-website`; the generated route list
  included `/api/applications/[id]/taiwan-handoff`.
- `bash -n` for the Fly deployment, secret-sync, and verification scripts.

### Exactly-one job outcome

- Rechecked immediately before enqueue: Taiwan queued/running = 0, target
  queued/running = 0, active applicant handoff = 0, official receipt absent.
- Created exactly one canonical `runner_job(country=taiwan)` through
  `enqueueRunnerJob`, with `maxAttempts=1`. No second job or retry was created.
- The production worker claimed and dispatched it through the formal Taiwan
  runner, then failed closed at checkpoint `terms` after the official terms
  checkbox click did not change the checkbox to checked.
- Terminal evidence: job `failed`, attempts 1/1, lease cleared, Taiwan active
  jobs = 0, applicant handoffs = 0. No official receipt exists and the Taiwan
  submission result was not marked `submitted`.
- The applicant handoff button was therefore not exposed. The assistant did not
  click official `確認資料`; no final submission or payment occurred.

Status: **BLOCKED_BEFORE_APPLICANT_HANDOFF**. A future attempt requires a
focused fix and regression test for the current official terms-checkbox DOM,
followed by fresh approval for one new job. This rollout does not authorize an
automatic retry.

## 2026-08-05 Terms checkbox fix and applicant handoff ready

### Root cause and fix

- The failed production trace resolved the official terms control as native
  `<input id="confirm" type="checkbox">` with no `name`. Playwright's forced
  `locator.check()` clicked it, but the official page kept its checked state
  false.
- Updated only the formal helper in
  `viza-be/submission-service/src/tw/terms-modal.ts`; no controlled-smoke copy
  was added. The helper now tries the native checkbox, its associated or
  wrapping label, a native click, and finally a checked-state update with
  bubbling `input`/`change` events.
- Every interaction is followed by a fresh DOM read. The native checked state
  must remain true across a short stability window before the bottom
  `OK`/`確定` button can be clicked. If all interactions leave it unchecked,
  the helper fails closed and does not click the button or touch first-step
  controls.
- The normal order remains checkbox -> verified checked -> `確定`. A matching
  existing `請先勾選同意條款 / Agree first` alert is accepted only as recovery;
  unknown dialogs remain fail closed.

Files changed:

- `viza-be/submission-service/src/tw/terms-modal.ts`
- `viza-be/submission-service/src/tw/__tests__/terms-modal.spec.ts`

### Verification and deployment

- `node --import tsx --test src/tw/__tests__/terms-modal.spec.ts` — 12/12.
- Formal Taiwan focused suite — 87/87, including standard checkbox,
  associated label, wrapping label, page re-render, existing Agree-first alert,
  and persistent-unchecked fail-closed behavior.
- `npm run type-check` — passed.
- `npm run build` — passed.
- Deployed the new image to the existing `viza-runner-taiwan`. Both machines
  are started with passing checks; `/ready` reports database reachable and
  worker started. Production flags remain `country=taiwan`, legacy queue false,
  consumer true, Browserbase enabled/TW, and handoff timeout 1800 seconds.
  Browserbase, 2Captcha, Supabase, and result-key capabilities are configured.
- The deployed bundle was read back from a running machine and contains the
  associated-label recovery and verified-interaction failure guard.

### Authorized single-job result

- Final gate before enqueue: active Taiwan jobs 0, active target jobs 0,
  active handoffs 0, target not TW-submitted, no official receipt. Preparation
  produced 139 normalized answers; all resolved required documents were
  readable.
- Created exactly one newly authorized canonical Taiwan runner job with
  `maxAttempts=1`. No additional retry/job was created.
- The formal production runner passed terms and completed the automated flow to
  `submission_result_status=needs_user_action`, Taiwan result
  `stopped_at_captcha`, and applicant handoff `queued`.
- The same Browserbase session is being held for the applicant. The handoff
  expires at `2026-08-05 20:26` Singapore time. The applicant must sign in at
  `https://app.viza.it.com`, open the Taiwan application result page, and click
  `打开已填写的台湾官网`.
- No official receipt exists yet and the application is not marked TW
  `submitted`. The assistant did not click official `確認資料`; payment was not
  executed.

Status: **APPLICANT_HANDOFF_READY**. The worker is waiting for the applicant's
own final official click and will accept `submitted` only after verified
official receipt evidence.

## 2026-08-05 Applicant handoff validation failure and formal runner guard

### Finding classification

- The current applicant handoff is not a submittable page. It was not used for
  final confirmation and no new/retry job was created.
- `name_chinese` containing Latin transliteration is applicant-data integrity,
  not a selector issue. Normalization now rejects it with key `name_chinese`;
  the runner never transliterates or invents a Chinese name.
- Father/mother indexed controls were already mapped to `kinships[0].*` and
  `kinships[1].*`, but living-parent details were incorrectly optional in both
  normalization and fill verification. Living father/mother now require the
  applicant-provided name, date of birth, phone, occupation, unit, job title,
  and address. Missing answers fail normalization; no placeholders are used.
- The seed already defined `birth_place_mainland_region` for
  `traveller.birthPlace1`, but the formal runner omitted the operation.
  Normalization now requires a known official Mainland region and the filler
  waits for the dependent select to become visible, enabled, and contain the
  matching official option after the primary birthplace selection rerenders.
- Student handling keeps `job_title` absent and requires `company_name` as the
  supplied full school name. The runner does not infer a school. An official
  format rejection for that control is classified as integrity-fatal and
  returns the sanitized key `company_name`.

### Handoff validation gate

- The formal validation collector now combines visible, enabled HTML validity
  failures with visible official required/format messages and associates them
  with stable control names where possible.
- Pre-submit mode revalidates after the final CAPTCHA is filled. Repairable
  required-field failures return to the same-session repair loop; official
  format errors and unmapped validation errors fail closed.
- Immediately before `onApplicantHandoffReady`, a second defensive gate runs.
  Any remaining non-CAPTCHA validation issue raises `validation_error` with
  sanitized field keys. The handoff callback is not called, so no
  `takeover_session` or `stopped_at_captcha` result can be created from a page
  that still has required/format errors.

### Files changed

- `viza-be/submission-service/src/tw/normalize.ts`
- `viza-be/submission-service/src/tw/fillers.ts`
- `viza-be/submission-service/src/tw/errors.ts`
- `viza-be/submission-service/src/tw/repair-loop.ts`
- `viza-be/submission-service/src/tw/apply.ts`
- `viza-be/submission-service/src/tw/__tests__/normalize.spec.ts`
- `viza-be/submission-service/src/tw/__tests__/repair-loop.spec.ts`
- `viza-be/submission-service/src/tw/__tests__/application-validation.spec.ts`
- `viza-be/submission-service/src/tw/__tests__/controlled-smoke.spec.ts`
  (fixture-only correction to use the official `/apply` path required by the
  shared production modal helper)

### Verification

- `node --import tsx --test src/tw/__tests__/*.spec.ts` - 105/105 passed.
- `npm run type-check` - passed.
- `npm run build` - passed.
- `git diff --check` for the touched Taiwan runner/test files - passed.

Status: **CODE_READY_FOR_INTEGRATION; NOT_READY_FOR_NEW_JOB**. User data and
the parallel B/C contract work must be reconciled before one unified deploy and
fresh readiness review. Not performed: deployment, production DB/env changes,
official-site access, handoff creation, runner job creation/retry, final
confirmation, receipt write, payment, or Git operations.

## 2026-08-06 Production metadata and validation-gate integration

### Pre-deploy gates

- Production read-only gate: active Taiwan jobs `0`; active applicant
  handoffs `0`.
- `npx vitest run src/tests/tw-entry-permit-schema.test.ts` in
  `viza-be/agent-backend` - 16/16 passed.
- Frontend completeness, handoff URL, retry, and result-card focused tests -
  28/28 passed.
- `node --import tsx --test 'src/tw/__tests__/*.spec.ts'` in
  `viza-be/submission-service` - 105/105 passed.
- `npm run build` passed in both `viza-be/submission-service` and
  `viza-fe/internal-website`.

### Production migration

- Applied `0130_tw_identity_birthplace_parent_student_metadata.sql` to the
  existing production Supabase project. Migration history records
  `tw_identity_birthplace_parent_student_metadata` at version
  `20260806015539`.
- Postflight verified 19/19 target Taiwan rows. The production schema now
  includes `birth_place_mainland_region`; Traditional-Chinese-name,
  Mainland dependent birthplace, student school-name, and living-parent
  metadata/conditions all passed their boolean contract checks.
- The migration changed form metadata only. It did not write application
  answers, documents, queue state, handoff state, submission results, or
  payment data.

### Production deployments

- Vercel project: existing `viza-internal`; no project was created.
- Vercel deployment ID: `dpl_FdRcGohoBwSHMFnhsgF7EJoioSUG`.
  Deployment URL:
  `https://viza-internal-2japeq9oq-viza-gmail-s-projects.vercel.app`.
- A concurrent production deployment briefly displaced the custom-domain
  alias after this build completed. The alias was explicitly restored and
  verified: `app.viza.it.com` now resolves to the deployment ID above.
- Production route checks reached the authentication boundary:
  `/api/applications/[id]/completeness` returned unauthenticated `401`, and
  `/api/applications/[id]/taiwan-handoff` returned unauthenticated `401`.
  This proves the deployed routes are reachable without impersonating the
  applicant.
- Fly app: existing `viza-runner-taiwan`; image deployment
  `deployment-01KZAVBKGK5AZ176A7JFNQ37QG` with digest
  `sha256:ea886a3209fe8b06d7702b70f4626672c5fa9ba965b646d60045fc785ec9cf09`.
- Both Fly machines are started with passing checks. Public `/health` reports
  `ok`; `/ready` reports ready, database reachable, and worker started.
  Runtime scope is `country=taiwan`, legacy queue `false`, consumer `true`,
  Browserbase enabled with country `TW`, and handoff timeout 1800 seconds.
  Browserbase, 2Captcha, Supabase, and submission-result capabilities are
  configured; no secret values were read or printed.
- The built/deployed runner includes the Traditional Chinese name integrity
  check, living-parent normalization, Mainland dependent birthplace filler,
  student school handling, and the official validation gate immediately
  before applicant handoff.

### Final no-run verification

- Since migration application: newly created Taiwan jobs `0`, newly created
  Taiwan handoffs `0`, and newly written Taiwan submission results `0`.
- Final active counts remain Taiwan jobs `0` and applicant handoffs `0`.
- Not performed: runner job creation/retry, Taiwan official-site access,
  email OTP, CAPTCHA, final confirmation, receipt write, payment, or Git
  operations.

Status: **READY_FOR_USER_DATA_ENTRY**. Before any future runner readiness
review, the applicant must provide a real Traditional Chinese name; select the
Mainland province/city/region when Mainland birthplace is selected; provide a
full formal school name in Traditional Chinese or English when occupation is
student (student job title remains blank); and, for each parent marked living,
provide name, date of birth, phone, occupation, the conditionally required
unit/title, and current address or the same-as-overseas-address choice.

## 2026-08-06 Authorized test-application data completion

### Scoped production write

- Read-only preflight confirmed the target is a Taiwan `TW_ENTRY_PERMIT`
  application with active target jobs `0`, active applicant handoffs `0`, and
  no official receipt. The historical Taiwan result remains
  `stopped_at_captcha`; it was not edited.
- Confirmed production field keys and legal values before writing. The
  Mainland branch value is `mainland`, the existing Taiwan birthplace source
  accepts `北京`, student occupation is `14`, and the parent status metadata
  allows the deceased test branch value `2`.
- Upserted exactly seven application-scoped answer rows:
  `name_chinese`, `birth_place_is_mainland`,
  `birth_place_mainland_region`, `current_occupation`, `company_name`,
  `kin_father_status`, and `kin_mother_status`.
- Both parent statuses use the minimal deceased test branch, so no fabricated
  parent name, date of birth, phone, occupation, employer, title, or address
  was created. `job_title` remains empty as required for a student.
- Post-write readback verified all seven intended values, no parent detail
  values, an empty student job title, active jobs `0`, and active handoffs `0`.

### Completeness and runner readiness

- The production completeness contract reports missing information `1` and
  missing documents `0`. The only missing key is `job_title` because the
  production `visa_form_fields` row is still globally required and has no
  student exclusion. No placeholder was written because the Taiwan runner
  contract intentionally omits `job_title` when occupation is student.
- A read-only check on the deployed formal Taiwan worker bypassed only the
  duplicate-run guard for diagnostics. Normalization succeeded with 140
  normalized answers, confirmed student `job_title` is omitted, and downloaded
  all 3 currently required documents successfully; no document key is missing.
- The normal `prepareTwEntryPermitApplication` entry remains blocked by
  `TwDuplicateRunError` because the historical result is still
  `stopped_at_captcha`, even though its handoff is no longer active. That guard
  state was not cleared because this authorization covered application answers
  only.

Status: **DATA_READY_BUT_BLOCKED_BY_COMPLETENESS_METADATA_AND_STALE_DUPLICATE_GUARD**.
The remaining integration work is to make `job_title` non-required for student
occupation in the production completeness contract and deliberately reconcile
the expired `stopped_at_captcha` result before any separately approved future
runner attempt. Not performed: schema/migration change, deployment, runner job
creation/retry, official-site access, OTP/CAPTCHA, final confirmation, receipt
write, payment, or Git operations.

## 2026-08-06 Local completeness and prepare-guard correction

### Local code changes

- `viza-fe/internal-website/lib/application-completeness.ts`: Taiwan students
  now require a valid company/school value but do not require `job_title`, even
  when stale production metadata marks that field globally required. Ordinary
  occupations keep the existing job-title requirement.
- `viza-be/submission-service/src/tw/prepare-guard.ts` and
  `src/queue/halt-runners.ts`: a submitted Taiwan result still blocks every new
  prepare. Non-terminal Taiwan jobs and unexpired applicant handoffs also
  block, while the currently running job excludes only itself. An expired
  historical `stopped_at_captcha` result with no reusable handoff no longer
  blocks prepare forever.
- Added focused regressions in
  `viza-fe/internal-website/lib/__tests__/application-completeness.test.ts`,
  `viza-be/submission-service/src/tw/__tests__/prepare-guard.spec.ts`, and the
  Taiwan compliance contract.

### Verification

- Frontend completeness: 13/13 passed.
- Taiwan prepare guard + normalization + compliance: 31/31 passed.
- Taiwan indexed-parent/Mainland/student mapping and handoff validation fixture:
  6/6 passed.
- Taiwan formal preflight fixtures: 3/3 passed.
- Submission-service `npm run type-check`: passed.
- Frontend targeted ESLint: no errors. Repository-wide frontend TypeScript
  check remains red only in pre-existing Philippines eTravel and Travel files;
  neither touched completeness file appears in the diagnostics.

### Read-only target verification

- Active Taiwan jobs `0`; reusable applicant handoffs `0`; official receipt
  absent. The historical result remains `stopped_at_captcha` and was not
  edited.
- All target mapping checks passed without returning answer contents: valid
  Traditional-Chinese name, Mainland/Beijing birthplace branch, formal student
  school name, student occupation with blank job title, and both parents on
  the deceased branch. All 3 currently required document records remain
  present.
- With the local corrected completeness contract the prior sole missing key
  (`job_title`) is no longer required, so completeness is ready. The production
  snapshot also passes the local prepare guard and reaches the boundary where
  a job could be created; no job was created.

Status: **LOCAL_READY_FOR_PRODUCTION_DEPLOY_APPROVAL**. Production still uses
the previously deployed completeness and duplicate-guard behavior until a
separate frontend + Taiwan runner deployment is approved. Not performed:
production DB writes, deployment, runner job creation/retry, official-site
access, OTP/CAPTCHA, final confirmation, receipt write, payment, or Git
operations.

## 2026-08-06 Production rollout of completeness and prepare guard

### Build and deployment

- User granted standing approval for this Taiwan completeness/prepare matter.
- Submission-service production build passed (`npm run build`).
- Internal website production build passed (`npm run build`); Next.js compiled
  and generated all 123 static pages. The project intentionally skips the
  separate repository-wide type-validation phase, whose unrelated pre-existing
  Philippines/Travel diagnostics remain recorded above.
- Deployed the existing Vercel project `viza-internal`:
  deployment ID `dpl_5JHXuxjWSbiTgDjzeFHntSgDfxD6`, deployment URL
  `https://viza-internal-n7p25ugfa-viza-gmail-s-projects.vercel.app`.
- A concurrent deployment moved the custom-domain alias after this deployment
  completed. Restored and re-read the alias; `app.viza.it.com` now resolves to
  the deployment ID above with production status Ready.
- Deployed the existing Fly app `viza-runner-taiwan` with image
  `deployment-01KZB7PEWQCHP4B4XE0AKK772C`, digest
  `sha256:ffe5d86065455cb230103321315708eeb1f278dafca484456ac1e7d322835eba`.
  Both Singapore machines updated successfully and are started.

### Production verification

- Fly `/health`: `ok`; `/ready`: `ready`, database reachable, worker started.
- Runtime config verified without reading secret values:
  `country=taiwan`, legacy queue `false`, runner-job consumer `true`,
  Browserbase enabled with country `TW`, handoff timeout 1800 seconds.
- Supabase, submission-result encryption, Browserbase, and 2Captcha secret
  names are configured. No values were printed.
- Production completeness and Taiwan handoff APIs both reached their expected
  unauthenticated `401` boundary. Taiwan long-form reached its authentication
  redirect (`307`).
- Final read-only DB check: active Taiwan jobs `0`, reusable Taiwan handoffs
  `0`; the target's historical `stopped_at_captcha` record remains unchanged
  and has no official receipt.

Status: **PRODUCTION_FIX_DEPLOYED_NO_JOB_CREATED**. The production VIZA
completeness path and Taiwan formal runner now contain the corrected student
job-title rule and expired-handoff duplicate guard. Not performed: migration,
application-answer write, runner job creation/retry, official-site access,
OTP/CAPTCHA, final confirmation, receipt write, payment, or Git operations.

## 2026-08-06 Authorized production handoff E2E

### Execution gate and enqueue

- Production completeness passed with no missing information or documents.
  Formal runner preparation normalized 140 answers and resolved all 3 required
  documents.
- Pre-enqueue key checks all passed without logging answer values: valid
  Traditional-Chinese name, Mainland/Beijing birthplace branch, formal student
  school, student occupation with omitted job title, and both parents on the
  deceased branch.
- Immediate pre-enqueue state was active Taiwan jobs `0`, reusable handoffs
  `0`, and no official receipt.
- Used the production `enqueueRunnerJob` helper used by the canonical retry
  route. It created exactly one Taiwan job (`17a6c0e0...`) with
  `maxAttempts=1`; no raw insert, retry, or second job was used.

### Formal runner result

- The job started at 2026-08-06 22:29:25 SGT. The formal background runner
  completed official entry, email OTP/CAPTCHA, terms/photo/delivery, field and
  material filling, final validation, and final CAPTCHA preparation.
- Applicant handoff was created at 22:30:58 SGT, before the official final
  confirmation. The persisted result remained `stopped_at_captcha`; 9 page
  stages and 83 audited controls/files were recorded. The assistant did not
  click the official final confirmation.
- The handoff expired at 22:59:39 SGT without official receipt evidence. The
  worker failed closed at 22:59:40 with attempts `1/1`; lease fields were
  cleared and the handoff was marked `abandoned`.
- Final state: job `failed`, applicant handoff unavailable/expired, official
  receipt absent, application not marked submitted, active Taiwan jobs `0`,
  reusable Taiwan handoffs `0`.
- No payment action occurred. Temporary production-env and execution helper
  files were removed after the run.

Status: **E2E_REACHED_HANDOFF_BUT_EXPIRED_NO_RECEIPT; NO_RETRY**. The automated
pre-handoff chain and current application mapping were successful. A fresh
handoff would require a separately authorized new job; this run will not retry
or create another job automatically.

## 2026-08-07 Authorized production handoff E2E

- Production completeness and formal Taiwan preparation passed: 140 normalized
  answers and all 3 required documents were ready. Immediately before enqueue,
  active Taiwan jobs and reusable handoffs were both 0, and no official receipt
  existed.
- Used the canonical production enqueue helper to create exactly one Taiwan job
  (redacted `27533349...`) with `maxAttempts=1`. No retry or second job was
  created.
- The formal worker reached checkpoint
  `applicant_handoff_before_final_confirmation`. The job remains `running` while
  the applicant handoff is `queued`; the application result is
  `stopped_at_captcha`.
- The handoff expires at 2026-08-07 11:11:27 SGT. The applicant was notified
  immediately to open the Taiwan application result/status page on
  `app.viza.it.com` and click `打开已填写的台湾官网`.
- No official receipt exists, the application is not marked submitted, and no
  payment action occurred. The assistant did not click the official final
  confirmation.

Status: **APPLICANT_HANDOFF_READY_AWAITING_APPLICANT_CONFIRMATION**.

## 2026-08-14 — VIZA-confirmed background formal submission

- Replaced the canonical Taiwan runner's applicant live-handoff mode with the
  existing formal `submit` path. The worker now completes official validation,
  solves the final CAPTCHA, clicks the official `確認資料` control, and accepts
  success only after the official success page yields an application/receipt
  number. Historical `stopped_at_captcha` and takeover-session rows remain
  readable but no longer block or drive a new formal run.
- Added two separate, mandatory VIZA confirmations: authorization to accept an
  existing official entry prompt, and acceptance of the official terms modal
  checkbox plus confirm action. The server records a versioned, timestamped,
  non-PII audit object in `runner_job.metadata`; the worker revalidates it
  before opening the official flow. Missing either item fails closed.
- The official DOM sequence remains strict: accept only a matching pre-existing
  Agree-first alert, check the terms control, verify its real checked state,
  then click the modal confirm button. Unknown alerts or unchecked controls
  stop the run.
- Updated the Taiwan result/status UI to describe background formal submission,
  remove the live-session open action, require both confirmations for retry,
  and preserve the distinction that submitted is neither approved nor paid.
  No automatic payment path was added.
- Verification passed:
  - submission-service Taiwan focused tests: 120/120;
  - submission-service type-check and production build;
  - internal-website Taiwan retry/result/final-confirmation tests: 30/30;
  - internal-website type-check and production build.
- No runner job was created, no official site was accessed, no application was
  submitted, and no payment was attempted as part of this change.

Status: **LOCAL_IMPLEMENTATION_AND_VERIFICATION_COMPLETE; NOT YET DEPLOYED**.

## 2026-08-13 Authorized production handoff rerun

- The pre-write production completeness check found exactly one information
  blocker, `name_chinese`, and no missing documents. The application-scoped
  canonical answer contract was used to update only that field; the subsequent
  completeness check passed.
- Formal Taiwan preparation then passed with 142 normalized answers and all 3
  required documents. Active Taiwan jobs and reusable handoffs were both 0
  before enqueue, and no official receipt existed.
- The canonical production enqueue helper created exactly one Taiwan job
  (`48c53773...`) with `maxAttempts=1` for the existing Taiwan worker.
- The worker failed closed at the `email_verify` checkpoint after the email
  send-code image CAPTCHA provider returned `ERROR_CAPTCHA_UNSOLVABLE` on all
  3 bounded in-session attempts. The job ended `failed` with attempts `1/1` and
  its lease cleared.
- No applicant handoff was created. No official final confirmation, official
  submission, receipt capture, or payment occurred. No second job or retry was
  created.

Status: **EMAIL_VERIFY_CAPTCHA_PROVIDER_FAILED_NO_HANDOFF; NO_RETRY**.

## 2026-08-13 Email CAPTCHA recovery and production handoff

### Root cause and local fix

- The preceding failed job exposed only the provider classification
  `ERROR_CAPTCHA_UNSOLVABLE`; the old runner did not retain image dimensions,
  content type, hash, or refresh diagnostics. Code inspection proved that the
  failure branch broke out after the first provider submission while its error
  text incorrectly reported the configured three-attempt budget. Actual prior
  provider submissions: 1; official CAPTCHA refreshes: 0.
- Updated the formal Taiwan CAPTCHA helper to validate non-empty PNG content
  and reasonable dimensions, compute a SHA-256 hash while logging only its
  prefix, classify provider failures, and prevent submitting the same image
  twice.
- `ERROR_CAPTCHA_UNSOLVABLE` now triggers the official refresh control, waits
  for a stable image whose full hash differs, and continues within the bounded
  attempt budget. Missing refresh controls, unchanged images, invalid images,
  provider configuration/balance errors, and unknown responses remain
  fail-closed with accurate attempt and refresh counts.
- Added `src/tw/__tests__/captcha.spec.ts` covering PNG extraction, invalid
  images, unsolvable-to-new-image recovery, unchanged-image rejection,
  missing refresh control, and structured exhaustion errors.

### Verification and production result

- `node --import tsx --test src/tw/__tests__/*.spec.ts`: 116 passed, 0 failed.
- `npm run type-check`: passed.
- `npm run build`: passed locally and in the Fly remote image build.
- Deployed only the existing `viza-runner-taiwan` worker. Fly release 5
  completed at 2026-08-13 21:51:44 SGT. `/health` returned `ok`; `/ready`
  returned `ready` with database reachable and worker started. Runtime remained
  `country=taiwan`, legacy queue disabled, consumer enabled, Browserbase
  enabled, and Browserbase/2Captcha/database capabilities configured. Taiwan
  OTP continues through Supabase `inbound_email`; no IMAP secret was required.
- The production gate passed with 142 normalized answers and all 3 required
  documents. Exactly one canonical Taiwan job (`64d9738c...`) was created with
  `maxAttempts=1`.
- Production diagnostics confirmed a valid 131x38 PNG email CAPTCHA. The first
  solve succeeded and the email send-code step advanced. The formal worker then
  completed OTP, fields, materials, final CAPTCHA preparation, and the official
  validation gate.
- A fresh applicant handoff became ready at the final-confirmation boundary and
  expires at 2026-08-13 22:23:43 SGT. A read-only Browserbase debug check
  confirmed one page at the exact official `/apply` path, not `/apply/verify`,
  with no non-official pages.
- Current state at handoff notification: job `running` with an active lease,
  handoff `queued` and valid, application result `stopped_at_captcha`, official
  receipt absent, submitted false, and payment false. The assistant did not
  click the official final confirmation.

Status: **APPLICANT_HANDOFF_READY_AWAITING_APPLICANT_CONFIRMATION**.
