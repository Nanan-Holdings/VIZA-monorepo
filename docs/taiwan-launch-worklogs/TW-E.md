# TW-E Worklog — 前端台湾 live queue 入队

- 状态：已完成前端提交/重试入口的台湾 queue job 创建修复；未部署、未提交 Git、未访问台湾官网或任何生产密钥/申请人资料。
- 负责人：TW-E
- 开始前已阅读：`docs/taiwan-launch-coordination.md`、`docs/taiwan-launch-worklogs/TW-D.md`
- 文件范围：仅修改 retry API、submission queue helper、台湾/提交队列 focused tests，以及本 worklog。

## 改了什么

1. `viza-fe/internal-website/lib/submission-queue.ts`
   - 新增 `isTaiwanEntryPermitApplication()`，识别 `taiwan` / `TW` + `TW_ENTRY_PERMIT`。
   - 新增台湾明确 queue statuses：
     - `tw_dry_run_pending`
     - `tw_dry_run_processing`
     - `tw_dry_run_failed`
     - `tw_live_assisted_pending`
     - `tw_live_assisted_processing`
     - `tw_live_assisted_failed`
     - `tw_blocked`
   - 台湾 dry-run 不再落到通用 `pending`。
   - 台湾 live 不再落到通用 provider `null`，而是：
     - dry-run provider：`taiwan_overseas_cn_entry_permit_dry_run`
     - live provider：`taiwan_overseas_cn_entry_permit_live`
   - `submitModeForPrimaryApplicationAction()` 对台湾返回 `live_assisted`。
   - legacy queue fallback allowlist 加入 `tw_live_assisted_pending`，避免缺少 live columns 时台湾 live retry 被前端 helper 排除。

2. `viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
   - `supportsLiveAssisted` 白名单加入台湾 `TW_ENTRY_PERMIT`。
   - 台湾 live 开关改为 fail-closed：
     - 只有服务器变量 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED === "true"` 才允许 live enqueue。
     - 缺失、空值、`false`、`1` 或任何其他值都会拒绝 live enqueue。
     - 不再读取 `NEXT_PUBLIC_TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED` 作为放行条件。
   - 台湾 live enqueue 时传入明确 `currentStage`：
     - `queued_for_tw_entry_permit_live`

3. 测试
   - `viza-fe/internal-website/lib/__tests__/submission-queue.test.ts`
     - 覆盖台湾识别、dry-run/live status、provider、主提交 mode、server enqueue、legacy live fallback。
   - `viza-fe/internal-website/app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts`
     - 覆盖正式 retry API 可为台湾创建 live queue job。
     - 覆盖错误输入：visa type 与 application 不匹配。
     - 覆盖默认缺失服务器变量时拒绝入队。
     - 覆盖只有服务器变量明确等于 `true` 才放行，空值、`false` 和 `1` 都拒绝。
     - 覆盖已完成官方提交时不重复创建 job。
     - 覆盖重复点击时复用已有 queue job。

## 测试命令和结果

- `npm test -- --run lib/__tests__/submission-queue.test.ts 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts'`
  - 通过：2 个测试文件，23/23 tests passed。

- `npm test -- --run 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts'`
  - 通过：1 个测试文件，6/6 tests passed（最新复跑：覆盖默认缺失、空值、`false`、`1` 拒绝，以及服务器变量明确 `true` 放行）。

- `npm run type-check`
  - 未通过，但剩余报错均在本工作包范围外：
    - `app/client/application/_components/result-cards/TwResultCard.tsx(40,7)` 缺少 `submitted` 状态 copy。
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple 推断问题。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺少 `playwright` 类型。
  - 本次新增台湾 retry API 测试的类型错误已修复。

## 前端提交时预期生成的 queue job 证据

从 VIZA 正式提交/重试入口，对 `country = "taiwan"`、`visa_type = "TW_ENTRY_PERMIT"`、`mode = "live_assisted"` 发起请求，并且服务器环境变量 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED` 明确等于 `true` 后，前端 API 预期调用：

- RPC：`enqueue_submission_retry`
- `p_application_id`：当前 application id
- `p_status`：`tw_live_assisted_pending`
- `p_mode`：`live_assisted`
- `p_provider`：`taiwan_overseas_cn_entry_permit_live`
- `p_current_stage`：`queued_for_tw_entry_permit_live`

API 成功响应预期包含：

- `jobId`：非空 queue id
- `queueStatus`：`tw_live_assisted_pending`
- `mode`：`live_assisted`
- `provider`：`taiwan_overseas_cn_entry_permit_live`
- `scheduled`：`false`

重复点击时，如果 RPC 返回 `reused_existing = true`，API 返回同一个非空 `jobId` 并带 `alreadyQueued: true`，不会创建第二条 live job。

## 仍依赖的后端工作包

仍依赖 TW-A / TW-02 台湾 runner 后端工作包和最终集成包确认 worker 侧消费合同：submission-service 需要识别并消费 `provider = "taiwan_overseas_cn_entry_permit_live"` / `status = "tw_live_assisted_pending"` 的 queue row，并把后续阶段写回同一 queue job。当前 TW-E 只负责前端正式入口创建可追踪 job id，不修改 `viza-be/submission-service/**`。

## 2026-08-01 parallel review - TW-G0 frontend queue

- Review scope: only retry-submission API, submission-queue helper, Taiwan submission/retry API tests, and this worklog. No changes to submission-service, runner, schema, CAPTCHA, login, tracking, deployment, or other countries.
- Conclusion: even though the long-form body still does not render, the submit/retry entrypoint itself is independently testable. Calling the official retry API with country = taiwan, visaType = TW_ENTRY_PERMIT, mode = live_assisted, and server env TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED exactly equal to true can create a Taiwan live queue job.
- Queue evidence contract: queueStatus = tw_live_assisted_pending, mode = live_assisted, provider = taiwan_overseas_cn_entry_permit_live, currentStage = queued_for_tw_entry_permit_live. These are not null, do not use generic pending, and do not downgrade to dry-run.
- Safety flag: Taiwan live enqueue is fail-closed. Missing, empty, false, 1, or any non-true server value is rejected. NEXT_PUBLIC flags are not read as an allow condition.
- Test coverage: default rejection, server true allow path, wrong visaType rejection with no enqueue, already submitted application with no duplicate job, and repeated click reuse of an existing queue job.

### Files changed in this review

- docs/taiwan-launch-worklogs/TW-E.md: appended this review section.
- No product or test file changes were needed in this review; existing route.ts, submission-queue.ts, retry-submission-tw.test.ts, and submission-queue.test.ts already satisfy this assignment.

### Focused test command and result

- npm test -- --run lib/__tests__/submission-queue.test.ts app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts
  - Passed: 2 test files, 24/24 tests passed.

### TW-G0 frontend queue status

- Frontend queue portion can be treated as closed: the frontend API/helper layer can create a traceable Taiwan live queue job id and focused regression tests pin provider, mode, status, stage, default rejection, and duplicate submission behavior.
- This does not close Taiwan launch overall: real button clicking still depends on TW-G/deployment/routing resolving the long-form body render failure, and actual worker consumption/official submission still depends on TW-A/TW-02/TW-G backend and integration validation.

## 2026-08-25 正式工作区集成：全程留在 VIZA、后台自动提交

本节取代上方旧的 `submission_queue` RPC 入队证据。台湾正式提交现已切换为 canonical `runner_job`，且本次没有创建或重试任何真实 job。

### 集成与冲突检查

- 补丁来源：`/Users/mmmytooo/.codex/.chatgpt-projects/g-p-6a6d6a817d00819191640198c28c83bf/tw-viza-background-submission.patch`
- `git apply --check --whitespace=error-all`：通过，无 whitespace error 或上下文冲突。
- 应用前逐项对比补丁文件与未提交改动：Mock Interview、DS-160 guide、登录和 application-center 的并行改动均不与补丁同文件重叠。
- 补丁直接应用成功；无需三方合并或人工冲突处理，也没有覆盖其他 AI 改动。
- `git diff --check`：通过。

### 实际应用文件

- `viza-fe/internal-website/lib/submission-queue.ts`
- `viza-fe/internal-website/app/client/application/long-form/page.tsx`
- `viza-fe/internal-website/app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts`
- `viza-fe/internal-website/app/client/application/_components/result-cards/TwResultCard.tsx`
- `viza-fe/internal-website/app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx`
- `viza-fe/internal-website/app/client/application/_components/result-cards/SubmissionStatusStep.tsx`
- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts`
- `viza-fe/internal-website/app/api/applications/[id]/taiwan-handoff/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/taiwan-handoff/route.test.ts`
- `viza-fe/internal-website/app/api/applications/customer-submission-result.ts`
- `viza-fe/internal-website/app/api/applications/customer-submission-result.test.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route-handler.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route.test.ts`
- `viza-be/submission-service/src/queue/halt-runners.ts`
- `viza-be/submission-service/src/tw/index.ts`
- `viza-be/submission-service/src/tw/submission-authorization.ts`（新增）
- `viza-be/submission-service/src/tw/__tests__/submission-authorization.spec.ts`（新增）
- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
- `docs/taiwan-launch-worklogs/TW-E.md`（本记录）

### 验收行为

- 用户只在 VIZA 最终核对页完成五项确认：两项官网条款、资料真实性声明、电子代提交授权、官方费用责任确认。
- 前端在缺字段、缺文件、资料冲突或 requirements 尚未加载时禁用台湾提交；API 再次执行 completeness 检查，未完成时返回 `application_incomplete`，不会调用 `enqueueRunnerJob`。
- 台湾 live 开关继续 fail-closed：只有服务端 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED === "true"` 才允许正式入队，不读取 `NEXT_PUBLIC_*` 放行。
- 正式提交调用 canonical `enqueueRunnerJob(applicationId, "taiwan", ...)`，测试返回可追踪 `jobId = runner_tw_live_001`；响应包含 `queueBackend = runner_job`、`queueStatus = tw_live_assisted_pending`、`mode = live_assisted`、`provider = taiwan_overseas_cn_entry_permit_live`。
- runner metadata 包含版本化 `taiwanOfficialTermsConsent` 与 `taiwanSubmissionAuthorization`；submission-service 在正式提交前同时校验两组审计记录。
- 双击/重复提交受两层保护：已有 active `runner_job` 返回 409；canonical enqueue 返回 `created = false` 时复用原 `jobId` 并返回 `alreadyQueued = true`。
- 客户状态固定为 `needs_confirmation`、`queued`、`running`、`needs_operational_review`、`submitted_with_receipt`、`failed` 六类。只有 `officialReceipt.source = official_success_page_with_application_number` 且有非空 `caseNumber` 才显示已提交；无 receipt 的 submitted 进入运营复核。
- 台湾公开 handoff API 对已认证申请人返回 410，对未认证请求返回 401；客户 API 递归移除 `portalUrl`、handoff、Live View、VNC/CDP、official/resume URL 字段，同时保留脱敏 receipt 证据。
- 台湾结果卡只提供返回 VIZA 最终核对页的 CTA；没有台湾官网跳转、Live View 或 handoff CTA。

### 验证命令与结果

- 前端 focused tests：
  - 命令：`npm test -- --run 'lib/__tests__/submission-queue.test.ts' 'app/client/application/long-form/__tests__/taiwan-entry-permit-layout.test.ts' 'app/client/application/_components/result-cards/__tests__/TwResultCard.test.tsx' 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts' 'app/api/applications/[id]/taiwan-handoff/route.test.ts' 'app/api/applications/customer-submission-result.test.ts' 'app/api/applications/[id]/submission-status/route.test.ts'`
  - 结果：通过，7 files，100/100 tests。
- submission-service focused tests：
  - 命令：`node --import tsx --test 'src/tw/__tests__/submission-authorization.spec.ts' 'src/tw/__tests__/official-terms-consent.spec.ts' 'src/tw/__tests__/compliance.spec.ts' 'src/tw/__tests__/receipt.spec.ts'`
  - 结果：通过，19/19 tests。
- 前端 typecheck：在 `viza-fe/internal-website` 运行 `npm run type-check`，通过。
- submission-service typecheck：在 `viza-be/submission-service` 运行 `npm run type-check`，通过。
- 前端 focused lint：对 14 个补丁涉及的前端 TS/TSX 文件运行本地 ESLint，0 errors。`SubmissionStatusStep.tsx` 有 2 个既有 warning，补丁只删除该文件中的台湾 retry props，未触及 warning 行；测试文件按仓库 lint ignore 配置跳过。
- submission-service 没有 lint script 或 ESLint/Biome 配置；以 focused tests 和 `tsc --noEmit` 验证。

### READY_FOR_COMMIT 与生产审批

- 台湾补丁本身：`READY_FOR_COMMIT`。正式工作区仍同时包含其他并行未提交改动，后续必须只选择性暂存本节列出的台湾文件；本工作包未 commit、push 或 deploy。
- 仍需发布负责人批准并执行 internal-website 与 submission-service 同批部署。
- 仍需生产配置负责人明确设置服务端 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`；缺失或其他值均保持拒绝。
- 部署后仍需经业务/合规与运营批准的受控 smoke：使用已授权测试申请创建单一真实 `runner_job`，确认 worker 消费、状态回写及官方 receipt 后再扩大流量。本工作包未访问台湾官网、未提交真实申请、未读取密钥或申请人资料。
- 本补丁不需要数据库 migration，也未更改 production DB 或 env。
