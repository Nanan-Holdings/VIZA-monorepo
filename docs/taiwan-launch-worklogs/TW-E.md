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

