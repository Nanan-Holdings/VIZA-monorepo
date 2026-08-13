# TW-D Worklog — 发布与 QA 审计

- 状态：已完成静态上线就绪审计；**未通过真实提交验收**。
- 负责人：TW-D
- 基线确认：2026-08-01；本次只读检查未提交的台湾相关代码与共享文档。未访问官网、生产数据、密钥或申请人资料，未创建队列、未部署、未提交。
- 变更文件：仅本 worklog。

## 已复核的链路（代码静态结论）

1. 前端状态页可把 `taiwan` / `TW_ENTRY_PERMIT` 识别为台湾专属状态卡；Documents 对四个资格类别的资料项有定向测试。
2. `src/queue/dispatch.ts` 已把 `taiwan` 路由到 `tw/runner.runOne`，该入口再调用 `runTwHalt`。
3. `runTwHalt` 会读取申请资料、创建 VIZA inbox alias、解析上传材料并调用 `fillTwEntryPermitApplication`。
4. 当前 `apply.ts` 的成功路径是：官方登录 hook → 条款 → 递送地点 → 申请表邮箱 OTP → 严格逐字段/文件回读校验 → CAPTCHA → 点击官方「确认资料」。浏览器会在 `finally` 关闭。
5. CAPTCHA 代码使用共享客户端；提交结果中对解题文字写入 `[redacted]`，不写明文答案。

## 定向验证（本地、无官网访问）

- `viza-be/submission-service`: `npm run type-check` — 通过。
- `viza-be/submission-service`: `node --import tsx --test src/tw/__tests__/*.spec.ts src/country-submissions/__tests__/registry.spec.ts` — 49/49 通过。
- `viza-fe/internal-website`: 台湾结果卡、Documents、前端体验三组 Vitest — 14/14 通过。

这些是 fixture/静态质量证据，**不是**真实登录、CAPTCHA、官方提交或查询状态的验收证据。

## 发布阻断项（按优先级）

### P0 — 用户按钮目前无法启动台湾 live worker

`viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts` 的 `supportsLiveAssisted` 白名单不含台湾；台湾 `live_assisted` 请求会被拒绝为不支持。与此同时 `lib/submission-queue.ts` 没有台湾 provider 或台湾专属 live queue status，默认 provider 为 `null`、status 为通用 `pending`。结果卡却已显示台湾可提交/重试状态，前后端契约不一致。

**关闭证据：** 一次授权测试申请从 VIZA 的明确“提交”按钮获得非空 queue job id；job 的 provider、mode、stage 与 worker 消费记录一致。需补充自动化测试覆盖这条 API 路径。

### P0 — 生产登录 provider 没有实际 bootstrap

`src/tw/auth.ts` 的 `createTwOfficialLoginProviderFromEnvironment()` 名称容易误导：它只读取进程内 registry。全仓库的 `setTwOfficialLoginProviderForRuntime()` / OTP 对应注册调用仅存在于测试；没有生产启动代码注册真实、受控的 provider。因此当前部署会 fail-closed，不会登录。

**关闭证据：** 已部署 worker 在不泄露凭据/OTP 的条件下，于启动时注册受控 adapter；一笔安全测试可到达后续页面。若官方实际流程没有独立账号登录，则应先由产品/runner负责人更正该强制 hook，而不是使用空 provider 跳过。

### P0 — legacy worker 默认仍会降级为 dry run

台湾走 `submission_queue` legacy consumer；`src/index.ts` 只有 `VIZA_ALLOW_LEGACY_REAL_SUBMIT === "1"` 才会进入 legacy real-submit 分支，否则会调用 dry-run fallback。`deploy/fly/fly.legacy.toml` 未声明这个开关；本审计不能判断生产环境是否另行配置。

**关闭证据：** 授权发布负责人在不暴露值的前提下确认该开关的受控生产配置，并通过单笔安全测试证明台湾 row 由真实 runner 消费，而非 dry-run。

### P0 — “submitted” 不要求官方回执/案号

当前 runner 点击「确认资料」后只要 CAPTCHA 页面消失就返回 `submitted`；`tryReadTwCaseNumber()` 为可选项。没有要求官方案号、确认页指纹、回执文件或持久化成功证据，误判为成功的风险未关闭。

**关闭证据：** 成功条件强制包含至少一项可核验的官方回执（案号/官方确认页证据），并将其与 application/queue 状态原子持久化；缺失时进入可恢复失败而非 `submitted`。

### P1 — 台湾 tracking 尚不存在

台湾只有提交结果卡与可选 `caseNumber` 显示；未找到台湾官方状态查询 runner、查询输入/选择器、计划任务、结果解析或通知实现。现有 `official_application_tracking` migration 约束 `country_code = 'VN'`，只服务越南。因此“提交后可 tracking”目前不是已实现能力。

**关闭证据：** 台湾专属查询合同（官方查询所需字段、频率、失败策略）、持久化模型、worker/scheduler、状态 UI 与至少一笔受控查询证据。

### P1 — 部署能力不能从代码证明

Fly legacy secret 同步脚本可以注入 `TWOCAPTCHA_API_KEY` 与 IMAP 配置，但仓库没有可审计的台湾登录 provider/OTP adapter 配置。代码也没有台湾独立 country worker；它依赖 `viza-submission-legacy`。本工作包未读取部署平台，因此不能将“已安装/已配置”当成验收完成。

**关闭证据：** 发布负责人提供脱敏部署版本、健康检查、必要能力已配置的确认，以及上述端到端受控测试的时间戳和结果。

### P1 — 真实页面选择器与材料分支尚无 live 证据

严格字段/文件验证代码和单测已存在，但目前测试不打开 NIA 页面。`apply.ts` 本身仍保留未完整建模的未成年人监护材料说明。四种资格类别、条件文件、OTP 超时/重发、CAPTCHA 重试及提交后回执均需在授权测试中逐项验证。

## 安全的下一步（不做真实申请）

1. 先由 TW-A/TW-G 修正并测试 P0 的前端 enqueue、生产 auth bootstrap、legacy live gate 与回执成功条件；不要以手工插入 `submission_queue` 绕过产品入口。
2. 再由发布负责人部署一个可回滚版本，并确认所有配置仅存在于受控密钥系统；不要把密钥、OTP、Cookie、申请人数据或 CAPTCHA 图片写进仓库/worklog。
3. P0 全关后，才由已授权操作员用真实、经同意且资料正确的安全测试申请，从 VIZA 的正式提交按钮跑一次完整流程。保存脱敏的 queue job id、阶段时间线、官方回执“存在性”和后续查询结果；不在文档记录敏感值。
4. 在 tracking 实现前，产品文案只能称“已提交/待人工查询”（且仅在有官方回执时），不得承诺自动追踪。

- 给其他工作包的接口变化：无。本审计未修改产品代码、部署或数据库。
- 更新时间：2026-08-01
