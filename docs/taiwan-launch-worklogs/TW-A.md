# TW-A Worklog — Runner 合规与会话审计

- 状态：第一波 TW-A 已完成，等待主协调者汇合
- 负责人：TW-A
- 更新时间：2026-08-01

## 计划

1. 完整阅读 `docs/taiwan-launch-coordination.md`，只执行 TW-A 第一波任务。
2. 读取 `viza-be/submission-service/src/tw/AGENTS.md` 与 TW runner 代码，核对 CAPTCHA、final submit、session 生命周期边界。
3. 移除/隔离台湾 CAPTCHA 自动求解路径，不实现未批准的远程接管服务。
4. 增加 focused 合规测试，验证台湾 runner 不再暴露/调用 CAPTCHA solver，且当前实现仍会关闭本地 session。
5. 记录会话关闭点、交接设计、验证结果、发现、阻断与接口变化。

## 基线确认

- 开始时 `git status --short` 已有非 TW-A 改动/未跟踪文件，包括：
  - `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - `viza-be/submission-service/package.json`
  - `viza-be/submission-service/src/queue/halt-runners.ts`
  - 多个 `viza-fe/internal-website/**` 文件
  - `docs/taiwan-launch-coordination.md`、`docs/taiwan-launch-worklogs/`、`docs/tw-entry-permit-session-handoff-2026-07-31.md`
  - `viza-be/agent-backend/drizzle/0123_tw_entry_permit_document_requirements_zh_and_eligibility_split.sql`
- `viza-be/submission-service/src/queue/halt-runners.ts` 在基线中已有资格证明文件 key 拆分改动；TW-A 只在该文件中移除台湾结果 payload 的 `captchaAutoFilled` 写入。
- 未执行 commit、stash、checkout、switch、reset、rebase、merge、批量 git add、migration、部署或真实官方提交。

## 变更文件

- `viza-be/submission-service/src/tw/apply.ts`
  - 移除 `solveTwCaptcha` import 与调用。
  - `stopped_at_captcha` 结果不再包含 `captchaAutoFilled`。
  - `pagesFilled` 固定记录 `captcha_boundary`，不再产生 `captcha_auto_filled`。
  - 注释改为明确：只停在 CAPTCHA，不读取、不求解、不预填，不点击 `確認資料`。
- `viza-be/submission-service/src/tw/captcha.ts`
  - 删除台湾 2captcha 求解实现和 shared captcha client import。
  - 保留为只读边界说明/selector 常量 `TW_CAPTCHA_BOUNDARY`，用于说明 CAPTCHA 停点，不提供 solver。
- `viza-be/submission-service/src/tw/index.ts`
  - 不再导出 `solveTwCaptcha` / `TwCaptchaSolveOutcome`。
- `viza-be/submission-service/src/queue/halt-runners.ts`
  - 台湾 `TwSubmissionResult` payload 不再写入 `captchaAutoFilled`。
- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - 新增台湾合规测试：禁止 solver 符号、2captcha import、`captchaAutoFilled`、`captcha_auto_filled` 回归；确认仍记录 `captcha_boundary` 且当前本地 session 会关闭。
- `viza-be/submission-service/src/tw/AGENTS.md`
  - 增加合规测试说明，巩固台湾 no-CAPTCHA-solving 边界。
- `docs/taiwan-launch-worklogs/TW-A.md`
  - 本工作日志。

## 验证命令与结果

- `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/compliance.spec.ts`
  - 通过：2 tests / 1 suite / 0 fail。
- `cd viza-be/submission-service && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/normalize.spec.ts`
  - 失败：7 个既有台湾 normalize 用例因 `[is_taiwanese_spouse] missing/unrecognized yes-no value ""` 失败。未在 TW-A 修复；这是 schema/字段合同问题，归 TW-B/TW-03。
- 曾误运行 `npm test -- --test-name-pattern='Taiwan|normalizeTwAnswers'`，因为 shell 管道解析实际触发整包测试；失败项包含缺少 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 的非台湾测试及既有断言失败。该命令不作为 TW-A focused 验收依据。
- `rg` 检查 TW-A runtime 范围：
  - `viza-be/submission-service/src/tw/**` 与 `src/queue/halt-runners.ts`（排除 tests）中不再出现 `solveTwCaptcha`、`TwCaptchaSolveOutcome`、`solveImageCaptcha`、`../captcha/two-captcha`、`captchaAutoFilled`、`captcha_auto_filled`。

## 发现与证据

- CAPTCHA 自动求解路径已关闭：
  - 原 `apply.ts` 会在 CAPTCHA boundary 后调用 `solveTwCaptcha(page)`，并把成功状态写入 `captcha_auto_filled` / `captchaAutoFilled`。
  - 现在 runner 只验证 `isAtTwCaptchaBoundary(page)`，然后记录 `captcha_boundary` 并返回 `stopped_at_captcha`。
- 当前 session 被关闭的位置：
  - `viza-be/submission-service/src/tw/apply.ts` 的 `finally` 调用 `session.close()`。
  - `viza-be/submission-service/src/tw/session.ts` 的 `makeCloser()` 先关闭 Playwright context，再关闭 browser。
  - 因官方无持久账号/恢复链接，session 一旦关闭，已填写页面和 CAPTCHA 停点不可通过“另开官网”恢复。
- 当前实现可否安全保留/恢复：
  - 不能恢复已关闭 session；没有官方账号或 resume token 可重建同一份申请。
  - 可“保留”的前提是 runner 不在 CAPTCHA 停点关闭 browser/context，而是把同一活跃 browser session 交给受控人工/用户接续；这需要会话租约、worker affinity、短 TTL、访问控制、审计和强制清理。TW-A 未实现该服务。
- 最小可行交接实现设计：
  - 推荐第一版采用 `人工协助会话`，因为当前 runner 已是受控服务器浏览器且不需要公开远程接管给申请人。
  - 到达 CAPTCHA boundary 后，runner 返回/登记一个 `tw_manual_handoff_required` 状态，保持同一 browser context/page 存活，绑定 `applicationId`、`runId`、`expiresAt`、当前 URL、页面标题、boundary screenshot/trace metadata（不得记录 OTP、CAPTCHA 文本、敏感证件内容）。
  - worker 必须暂停 queue 完成态写入或写入明确的 `needs_user_action` checkpoint，同时保持单 application/session 锁，避免重复 runner 开第二个官方会话。
  - 操作员通过受控浏览器控制台/CDP/VNC/Browser API 进入同一 page，人工处理 CAPTCHA；系统仍不得自动点击 `確認資料`，除非后续产品/合规明确授权人工流程。
  - TTL 到期或人工取消时强制 `context.close()` / `browser.close()`，记录 `expired_at_captcha_handoff`，允许显式 retry 重新跑完整流程。
  - 若选择 `用户可接续远程会话`，需要额外的短时签名链接、申请人身份校验、只绑定单 session 的访问令牌、截图/输入隐私策略、并发/过期清理；不建议作为最小第一版。
  - 若选择 `资料包模式`，runner 应完全不打开官网填表，前端文案需改为资料包/官方入口，不再写 `stopped_at_captcha` 的已填官网暗示。

## 阻断/需要决策

- TW-G0 仍未关闭：当前代码仍在 `finally` 关闭 session；本次只完成合规边界移除，未实现任何获批交接模型。
- 主协调者需要选择交接模型：人工协助会话、用户可接续远程会话，或资料包模式。
- `TwSubmissionResult` 的 shared type 和前端镜像中仍存在可选 `captchaAutoFilled?: boolean`：
  - `viza-be/submission-service/src/submission-result.ts`
  - `viza-fe/internal-website/lib/submission-result.ts`
  - 这两个文件不在 TW-A 第一波允许范围内；TW-04/TW-07 应清理类型/UI 残留。
- 台湾 normalize focused test 失败显示 `is_taiwanese_spouse` 合同缺口；应由 TW-B/TW-03 判断 seed/default/必填规则，而不是 TW-A 在 runner 中猜默认值。
- `householdRevoked` 仍是已知必填字段缺口；TW-A 只保留 runner 现有 TODO，交给 TW-B/TW-03。

## 给其他工作包的接口变化

- `fillTwEntryPermitApplication()` 的 `stopped_at_captcha` 分支不再返回 `captchaAutoFilled`。
- 台湾 persisted payload 不再包含 `captchaAutoFilled`。
- `src/tw/index.ts` 不再导出 `solveTwCaptcha` / `TwCaptchaSolveOutcome`。
- `pagesFilled` 不再出现 `captcha_auto_filled`，只会在停点记录 `captcha_boundary`。
- 后续前端/共享类型应把任何台湾 `captchaAutoFilled` 展示或字段视为废弃。

---

## 阶段二更新 — 授权登录后可验证填表与上传，停在 CAPTCHA 前

- 状态：阶段二 TW-A runner 侧补丁完成；等待真实授权测试账号/安全测试申请数据做 live smoke。
- 更新时间：2026-08-01

### 本阶段计划

1. 重新读取 `docs/taiwan-launch-coordination.md` 与所有 `docs/taiwan-launch-worklogs/*.md`。
2. 只在 TW-A 独占范围内实现授权登录/OTP 可替换接口、严格字段校验、上传校验、CAPTCHA 前 metadata、重复运行保护。
3. 不访问真实生产申请数据；不写入真实账号、密码、OTP、Cookie；不处理 CAPTCHA；不点击最终提交。
4. 跑台湾 focused tests 与 submission-service type-check。

### 本阶段变更文件

- `viza-be/submission-service/src/tw/auth.ts`
  - 新增 `TwOfficialLoginProvider` 可替换授权官网登录接口。
  - 新增 `TwEmailOtpProvider` 可替换表单邮箱 OTP 接口。
  - 阶段二当时默认 official login provider 返回 `skipped`；第三阶段已替换为 fail-closed，见下方“第三阶段更新”。
- `viza-be/submission-service/src/tw/fillers.ts`
  - 新增 strict 填写/选择/勾选/日期/上传 helper。
  - 每个 helper 填完立即读取官网控件实际状态并比对 normalized VIZA/官方映射值；不匹配立即抛 `TwFieldVerificationError` 或 `TwFileUploadError`。
  - 文件上传后通过官方页面 file input 的 `files[0].name` 验证文件已实际挂载在页面控件上。
- `viza-be/submission-service/src/tw/apply.ts`
  - 在进入申请前调用 `officialLoginProvider.completeLogin()`。
  - 表单邮箱 OTP 改为 `emailOtpProvider.waitForEmailOtp()`。
  - 所有 TW 表单字段和上传改为 strict helper。
  - 成功停在 CAPTCHA 时返回 `runMetadata`，包括不含字段值的校验摘要、页面指纹和 masked screenshot 引用。
- `viza-be/submission-service/src/tw/run-metadata.ts`
  - 新增 CAPTCHA 前 metadata builder。
  - 只记录 field/control 名称、类型、匹配/跳过状态、计数、页面路径/标题/控件数量/是否存在 CAPTCHA 与最终提交按钮。
- `viza-be/submission-service/src/tw/diagnostics.ts`
  - 新增 `tryCaptureTwMaskedScreenshot()`；截图 mask 整个 `body`，避免泄露邮箱、申请字段值、文件名等页面文本。
- `viza-be/submission-service/src/tw/errors.ts`
  - 新增 `TwFieldVerificationError`、`TwFileUploadError`、`TwDuplicateRunError`。
- `viza-be/submission-service/src/tw/normalize.ts`
  - 将 TW-B 新增的 `household_revoked` 纳入显式必填 normalizer 合同。
- `viza-be/submission-service/src/tw/__tests__/normalize.spec.ts`
  - 更新 fixture，覆盖 `household_revoked` 与 `is_taiwanese_spouse`。
- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - 扩展合规测试：无 CAPTCHA solver、auth/OTP hook 顺序、sanitized metadata、重复运行保护。
- `viza-be/submission-service/src/tw/index.ts`
  - 导出新的 TW auth、strict fill、metadata 和错误类型。
- `viza-be/submission-service/src/tw/AGENTS.md`
  - 更新台湾 runner 边界：可使用授权官方登录 hook，但不得创建/存储/记录真实账号、密码、OTP、Cookie 或 storage state；字段/文件必须填后校验。
- `viza-be/submission-service/src/queue/halt-runners.ts` 台湾段
  - 运行前检查 application 是否已有 TW `stopped_at_captcha` 结果；若有则阻止重复运行。
  - 将 `photo` 作为 required document。
  - 写入 TW result 时附加本地扩展字段 `runMetadata`，未修改共享 `TwSubmissionResult` 类型文件。

### 本阶段验证命令与结果

- `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/normalize.spec.ts src/tw/__tests__/compliance.spec.ts`
  - 通过：15 tests / 2 suites / 0 fail。
- `cd viza-be/submission-service && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- 禁止/敏感路径检索：
  - `src/tw/**` 未出现 `solveTwCaptcha`、`solveImageCaptcha`、`two-captcha`、`captchaAutoFilled`、`captcha_auto_filled`、`TWOCAPTCHA`、`document.cookie`、`cookies()`、真实密码/OTP 字面量或点击 `確認資料` 的代码路径。
  - 检索命中的 `password` 只在 `halt-runners.ts` 非台湾段（UK/France/Australia）既有代码中。

### 失败场景与行为

- 授权官网登录 provider 未配置或选择跳过：
  - 阶段二当时默认 provider 可返回 `authorized_login_skipped`；第三阶段已替换为 fail-closed，未配置时不会继续运行。
- 表单邮箱 OTP 超时、未提取到或官网未显示已认证：
  - 抛 `TwEmailVerificationError`，不继续填后续字段。
- 必填字段缺失或 enum 无法 normalize：
  - `normalizeTwAnswers()` 抛 `TwNormalizationError`，`runTwHalt` 映射为 `NeedsHumanError`。
- 官网控件不存在、选项不存在、填入后实际值不等于 normalized/官方映射值：
  - strict helper 抛 `TwFieldVerificationError`，立即停止，不进入 CAPTCHA 后步骤。
- 必需文件缺失：
  - `runTwHalt` 先以 `NeedsHumanError` 阻止运行。
- 上传控件不存在或 `files[0].name` 与本地文件 basename 不一致：
  - 抛 `TwFileUploadError`，立即停止。
- 已有 TW `stopped_at_captcha` result 的同一 application 被重复运行：
  - `assertNoCompletedTwRun()` 抛 `TwDuplicateRunError`，`runTwHalt` 映射为 `NeedsHumanError`，不会重新打开官网会话。

### 遗留风险与阻断

- 未做真实官网 live smoke：本阶段未访问真实生产申请数据，也没有真实授权测试账号/安全测试申请资料。
- `TwOfficialLoginProvider` 是可替换接口，尚未绑定具体官方登录 DOM selector；真实账号登录/登录 OTP 的 provider 需要由授权运行方或后续 TW-A 子任务接入，且必须走 secret manager/受控回调。
- 当前成功后仍在 `finally` 关闭本地 browser session；本阶段目标是 CAPTCHA 前稳定填表与 metadata，不是远程接续会话服务。TW-G0 同会话交接仍需后续决策/实现。
- masked screenshot 当前 mask 整个 `body`，避免敏感泄露；可用于证明截图发生和页面上下文，但不能作为可读表单截图。可读证据需在安全测试数据上另行录制。
- `runMetadata` 作为台湾 payload 的本地扩展字段写入，未同步共享后端/前端 `TwSubmissionResult` 类型；TW-04/TW-07 需要决定正式 result schema。
- 未执行 DB migration、未执行部署、未点击 CAPTCHA 或最终 `確認資料`。

### 本阶段接口变化

- `TwApplyOptions` 新增：
  - `officialLoginProvider?: TwOfficialLoginProvider`
  - `emailOtpProvider?: TwEmailOtpProvider`
  - `diagnosticsOutputDir?: string`
- `TwFillResult.status === "stopped_at_captcha"` 新增：
  - `runMetadata: TwRunMetadata`
- `normalizeTwAnswers()` 现在要求 `household_revoked` 为 `yes/no`。
- 台湾 result payload 额外写入 `runMetadata`，但共享类型文件未改。

---

## 第三阶段更新 — 授权账号登录与 OTP Runner 接入

- 状态：TW-A 代码与 focused tests 已完成；真实官方 smoke 仍需授权操作员执行。
- 更新时间：2026-08-01

### 本阶段计划

1. 重新读取台湾上线协调总览和全部 TW worklog；协调总览与其他 worklog 只读。
2. 将官方登录 provider 从默认 `skipped` 改为 production fail-closed。
3. 把授权官网登录 provider 显式接入台湾 queue；登录与登录 OTP 只通过部署密钥库/受控回调注入。
4. 保留逐字段回读、上传后页面校验、重复运行保护和 CAPTCHA 前停止。
5. 增加 focused tests，并记录脱敏操作员 runbook、失败场景、验证结果和真实 smoke 待办。

### 本阶段变更文件

- `viza-be/submission-service/src/tw/auth.ts`
  - 删除默认 `twNoopOfficialLoginProvider`/`skipped` 语义。
  - 新增 `twFailClosedOfficialLoginProvider`；未配置受控 provider 时抛 `TwOfficialLoginConfigurationError`，不会继续进入官网填表。
  - 新增 official login runtime provider registry：`setTwOfficialLoginProviderForRuntime()`、`createTwOfficialLoginProvider()`、`createTwOfficialLoginProviderFromEnvironment()`。
  - 新增 official login OTP runtime provider registry：`setTwOfficialLoginOtpProviderForRuntime()`、`createTwOfficialLoginOtpProvider()`、`createTwOfficialLoginOtpProviderFromEnvironment()`。
  - 新增 `twFailClosedOfficialLoginOtpProvider` 与 `TwOfficialLoginOtpProvider`/`TwOfficialLoginOtpRequest`；授权登录 provider 只能通过受控回调取得登录 OTP，代码不读取、不保存、不记录任何真实登录材料。
- `viza-be/submission-service/src/tw/apply.ts`
  - 默认 official login provider 改为 fail-closed。
  - 将 `officialLoginOtpProvider` 传入 `officialLoginProvider.completeLogin()`，登录 OTP 获取发生在受控 provider 内，不进入 runner 日志或 metadata。
  - 成功路径只记录 `authorized_login`，`runMetadata.auth.officialLogin` 只接受 `authenticated`。
  - 未配置登录 provider 的错误向上抛出，避免被包装为可无限重试的普通填表失败。
- `viza-be/submission-service/src/tw/errors.ts`
  - 新增 `OFFICIAL_LOGIN_NOT_CONFIGURED`、`OFFICIAL_LOGIN_FAILED` 错误码和对应错误类。
- `viza-be/submission-service/src/tw/run-metadata.ts`
  - 移除 official login `skipped` metadata 状态。
- `viza-be/submission-service/src/tw/index.ts`
  - 导出新的 official login factory、runtime registry、fail-closed provider、登录 OTP provider 类型和 official login 错误类。
- `viza-be/submission-service/src/queue/halt-runners.ts` 台湾段
  - `runTwHalt()` 显式传入 `officialLoginProvider: createTwOfficialLoginProviderFromEnvironment()`。
  - `runTwHalt()` 显式传入 `officialLoginOtpProvider: createTwOfficialLoginOtpProviderFromEnvironment()`。
  - 未配置 provider 时映射为 `NeedsHumanError`，不会跳过登录继续运行。
- `viza-be/submission-service/src/tw/__tests__/auth.spec.ts`
  - 新增 focused tests：未配置 provider 必须失败；mock provider 才能认证；queue 使用 runtime provider；错误/result 不暴露敏感值。
- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - 更新静态合规测试：要求登录 OTP 接口存在、fail-closed provider 存在、queue 显式注入 provider、TW auth 源码不再出现 noop/skipped 登录语义。

### 本阶段验证命令与结果

- `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/auth.spec.ts src/tw/__tests__/normalize.spec.ts src/tw/__tests__/compliance.spec.ts`
  - 通过：19 tests / 3 suites / 0 fail。
- `cd viza-be/submission-service && npm run type-check`
  - 通过：`tsc --noEmit` 成功。
- 敏感/禁止路径检索：
  - 台湾 official login 已无 `twNoopOfficialLoginProvider`、`authorized_login_skipped` 或登录 result `status: "skipped"`。
  - 台湾 queue 已显式注入 official login provider 与 official login OTP provider。
  - 台湾 runtime 路径未出现 CAPTCHA solver、`captchaAutoFilled`、Cookie/storage-state 读取或点击 `確認資料` 的代码路径。
  - `src/tw/fillers.ts` 中的 `status: "skipped"` 仅表示可选字段审计项跳过，不是登录跳过。

### 失败场景与行为

- 未注册受控 official login provider：
  - 抛 `TwOfficialLoginConfigurationError`；queue 映射为 `NeedsHumanError`，安全停止在官方登录前，不进入表单填写。
- 受控 provider 登录失败或登录 OTP 失败：
  - provider 应抛脱敏错误；runner 不应继续到 `clickEnterApplication()`、邮箱 OTP、填表或上传。
- 表单邮箱 OTP 超时或官网未显示认证：
  - `TwEmailVerificationError`，不继续后续字段。
- 必填字段/枚举 normalizer 不匹配：
  - `TwNormalizationError` 映射为 `NeedsHumanError`，不打开错误申请。
- 官网字段或上传回读不匹配：
  - `TwFieldVerificationError`/`TwFileUploadError`，立即失败，不进入 CAPTCHA 后步骤。
- 同一 application 已有 TW `stopped_at_captcha` 结果：
  - `TwDuplicateRunError` 映射为 `NeedsHumanError`，防止重复运行同一申请。

### 脱敏操作员 Runbook

#### 需要配置的变量类别

- 官方登录 provider adapter：受控运行环境启动时注册 `TwOfficialLoginProvider`。
- 官方账号凭据引用：只保存部署密钥库引用或受控登录 broker 引用；不得把实际登录材料放入环境、日志或 Git。
- 登录 OTP 回调类别：短时有效的人工/受控回调通道，用于 `TwOfficialLoginOtpProvider`；只返回一次性 code 给 provider 内存流程，不落盘。
- 表单邮箱 OTP 类别：申请表 `/apply/verify` 使用受控 inbox alias 和现有邮件 OTP provider。
- 安全 smoke 申请类别：只使用授权测试申请和测试资料；不得访问真实生产申请数据。
- 运行隔离类别：台湾专用 worker/job scope、run id、短时 artifact 目录、kill switch/停止开关。
- 诊断输出类别：仅允许 masked screenshot 引用、字段校验摘要和页面指纹；不得保存原始页面截图或页面文本。

#### 安全 smoke 启动

1. 授权操作员在受控环境注册 official login provider，并确认 provider 从密钥库/回调读取登录材料。
2. 选择安全测试 application，确认 Documents 已上传 `photo`、`mainland_travel_document` 和对应 `eligibility_supporting_document_1..4` 中的一项。
3. 启动只处理台湾任务的 scoped worker/job。
4. 观察阶段顺序：`authorized_login` → `entry` → `terms_modal` → `delivery_location` → `email_verification` → field/file fill stages → `captcha_boundary`。
5. 到达 CAPTCHA 前确认返回 `stopped_at_captcha`；不得处理 CAPTCHA，不得点击 `確認資料`。

#### 预期状态

- `submission_result_status` 为 `needs_user_action`。
- TW result payload 为 `country: "TW"`、`status: "stopped_at_captcha"`。
- `runMetadata.auth.officialLogin` 为 `authenticated`，`method` 为脱敏 provider 方法名。
- `runMetadata.fieldVerification` 只有字段名、控件名、类型、matched/skipped 计数和文件校验摘要，不含字段值。
- `runMetadata.pageFingerprint.hasCaptchaInput` 或 `hasCaptchaImage` 可证明已到 CAPTCHA 边界；`hasFinalSubmitButton` 只作为页面指纹，不代表点击。
- masked screenshot 只保存引用和文件大小，不保存可读申请资料。

#### 停止与清理

- smoke 完成后停止台湾 scoped worker/job，关闭浏览器上下文。
- 清理短时 OTP 回调令牌和临时诊断目录；只保留脱敏 metadata。
- 确认没有最终官方提交、没有 CAPTCHA 处理、没有官方付款。
- 若 provider 注册错误或 OTP 超时，修复受控配置后重新排队；不要绕过 provider 或手工写入会话材料。

### 真实 smoke 仍需授权操作员执行

- AI 未访问真实官网生产申请数据，未使用真实官方账号，未输入真实 OTP，未上传真实官方资料。
- 授权操作员需要在受控环境执行一次登录至 CAPTCHA 前 smoke，并留存脱敏证据：
  - provider 已注册且登录发生在填表前。
  - 表单邮箱 OTP 完成后才开始填字段。
  - 每个必填字段和文件均有 matched 校验摘要。
  - 最终状态停在 `stopped_at_captcha`。
  - 无 CAPTCHA 处理、无 `確認資料` 点击、无最终提交。

### 本阶段遗留风险

- official login provider 是可替换接口和 runtime 注入点；具体官方登录 DOM 操作由受控部署 adapter 实现，当前仓库未存放真实登录实现或真实材料。
- 受控 provider 必须自行保证敏感材料不写入浏览器 trace、日志、异常 context 或 screenshot。
- 当前成功后仍会关闭本地 browser session；本阶段只保证安全停点和 metadata，不解决同会话人工接续服务。
- `runMetadata` 仍是 TW result payload 的本地扩展字段；共享后端/前端正式 schema 需 TW-07 统一。

---

## 第三阶段补丁 — 申请表邮箱 OTP Parser 修复

- 状态：TW-A parser 与 focused tests 已完成；等待授权操作员后续提供官网登录 OTP 样本。
- 更新时间：2026-08-01

### 本阶段边界

- 已重新读取台湾上线协调总览和全部 TW worklog。
- 本次只修改 TW-A 独占范围：`viza-be/submission-service/src/tw/inbox.ts`、台湾 inbox/runner tests、本 worklog。
- 本次修复的是申请表 `/apply/verify` 邮箱验证邮件，不是授权官网登录 OTP，也不是 CAPTCHA。
- 未处理 CAPTCHA，未点击 `確認資料`，未实现或修改授权官网登录 provider，未访问真实生产申请数据。

### 本阶段变更文件

- `viza-be/submission-service/src/tw/inbox.ts`
  - 删除旧的“4–8 位纯数字”假设和宽泛数字 fallback。
  - 邮件匹配改为三重条件：
    - 发件人域名必须是 `immigration.gov.tw` 或其官方子域。
    - 主题必须是台湾“境外人士线上申办系统/境外人士線上申辦系統”的邮箱验证/驗證类主题。
    - 正文必须出现明确的“验证码/驗證碼/认证码/verification code”标签。
  - 验证码只从明确标签后提取约 15 位的混合字母数字 token；纯数字编号不再被当成 code。
  - 邮件回看窗口从 10 分钟调整为 30 分钟，与人工证据中的有效期一致。
  - `extractTwVerificationCode()` 和 `isTwVerificationEmail()` 导出给 focused tests 直接覆盖。
- `viza-be/submission-service/src/tw/__tests__/inbox.spec.ts`
  - 新增脱敏 fixture 测试；只使用假的邮箱、假的 message id 和假的字母数字 token。
  - 覆盖正确邮件、官方子域、错误发件人、错误主题、缺少明确正文标签、主题标签不能替代正文标签、纯数字无关编号。

### 本阶段验证命令与结果

- `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/inbox.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/normalize.spec.ts src/tw/__tests__/compliance.spec.ts`
  - 通过：26 tests / 4 suites / 0 fail。
- `cd viza-be/submission-service && npm run type-check`
  - 通过：`tsc --noEmit` 成功。

### 失败场景与行为

- 官方域名但主题不是邮箱验证：
  - 不匹配，不会提取正文中的普通编号。
- 主题像台湾邮箱验证但发件人不是官方域名：
  - 不匹配。
- 正文没有明确“验证码/驗證碼/认证码/verification code”标签：
  - 不匹配；不会从正文任意位置扫描 token。
- 标签后只有纯数字编号：
  - 不提取，避免把案件编号、流水号或其他政府邮件编号误当作申请表邮箱 OTP。
- 匹配邮件但无法提取 token：
  - `waitForTwVerificationCode()` 抛脱敏错误，只包含 fake/实际 message id，不包含 code 值。

### 遗留风险与阻断

- 本次人工证据只覆盖申请表邮箱验证邮件；它不是授权官网登录 OTP 样本。
- `TW-G6` 仍需要授权操作员提供脱敏的官网登录 OTP 样本或 provider 行为证据，才能实现真实受控登录 adapter。
- 申请表邮箱 OTP 仍只在内存中交给 Playwright 填入页面；不得写入日志、metadata、截图、worklog 或 Git。

### 大小写保真补丁

- 更新时间：2026-08-01
- `viza-be/submission-service/src/tw/inbox.ts`
  - 删除 `extractTwVerificationCode()` 对 token 的强制全大写转换。
  - 申请表邮箱 OTP 大小写敏感性尚未由官网确认，因此 parser 必须保真传递邮件中的原始值。
  - 保留官方发件人、台湾验证主题、正文明确验证码标签、12–20 位字母数字长度限制和“必须同时含字母与数字”约束。
  - 仍不使用宽泛纯数字 fallback。
- `viza-be/submission-service/src/tw/__tests__/inbox.spec.ts`
  - 新增脱敏 mixed-case fixture：`Ab3cD4eFg5HiJ6k`。
  - 断言提取结果与原始字符串完全一致，不做大小写归一化。
- 验证命令与结果：
  - `cd viza-be/submission-service && node --import tsx --test src/tw/__tests__/inbox.spec.ts src/tw/__tests__/auth.spec.ts src/tw/__tests__/normalize.spec.ts src/tw/__tests__/compliance.spec.ts`
    - 通过：27 tests / 4 suites / 0 fail。
  - `cd viza-be/submission-service && npm run type-check`
    - 通过：`tsc --noEmit` 成功。

---

## 草稿准备只读检查 — VIZA 台湾测试申请

- 状态：阻断，未准备成完整可测试草稿。
- 更新时间：2026-08-01

### 边界确认

- 本次不改代码、不改数据库 schema、不改提交服务、不改 CAPTCHA、不改邮箱服务、不改前端或其他国家内容。
- 只做最小化只读检查；没有读取、复制或记录身份证号、护照号、邮箱、OTP、密码、材料内容或答案值。
- 未访问台湾官网，未发送台湾官网邮件验证码，未触发 CAPTCHA，未创建官方申请，未点击官网提交或付款。

### 检查结果

- 找到 1 笔 `country = taiwan`、`visa_type = TW_ENTRY_PERMIT` 的 VIZA 草稿候选：
  - Application ID：`6f64272e...6308`
  - VIZA 状态：`draft`
  - automation：`not_started`
  - documents：`not_started`
  - submission result：无
- 该 application row 没有明确测试/授权 metadata；当前资料不能被确认为“用户明确提供或系统内已标记为测试的数据”。
- 只读字段键名检查显示共有 98 个 answer key，但当前 TW runner 必填字段键仍缺少：
  - `household_revoked`
  - `name_chinese`
  - `name_english`
  - `overseas_residency_id_number`
  - `birth_place_is_mainland`
  - `local_mobile_phone`
  - `current_occupation`
  - `is_taiwanese_spouse`
  - `overseas_address`
  - `tw_contact_city`
  - `tw_contact_road`
  - `tw_contact_building_number`
  - `accepted_terms`
- `application_documents` 对该 application 为 0 条；因此材料不完整。
  - 至少缺少：`photo`、`mainland_travel_document`、一项 `eligibility_supporting_document_1..4`。
  - 条件材料 `hk_macau_id_scan`、`other_nationality_passport_scan`、`mainland_id_card_scan` 是否需要，不能在不读取答案值且未确认测试授权的情况下判断。

### 结论

- 表单是否完整：否。
- 是否保存成功：未进行写入；现有记录仍为 VIZA `draft`。
- 缺少字段/材料：见上方清单。
- 未触发官网提交。

### 需要用户提供

- 一笔明确标记为授权测试的 `taiwan / TW_ENTRY_PERMIT` application，或授权我创建测试草稿所需的完整假名测试资料。
- 对应的脱敏测试材料文件，至少包括 `photo`、`mainland_travel_document` 和与 `eligibility_category` 匹配的一项资格证明材料。

---

## 最终端到端测试尝试 — 未触发官网流程

- 状态：阻断，未开始台湾官网端到端提交流程。
- 更新时间：2026-08-01

### 只读复核结果

- Application ID：`6f64272e...6308`
- VIZA 状态：`draft`
- automation：`not_started`
- documents：`not_started`
- submission result：无
- 答案键数量：98
- 材料记录数量：0

### 阻断点

- 第 1 步“确认 VIZA 表单和材料完整”未通过。
- 仍缺少当前 TW runner 必填字段键：
  - `household_revoked`
  - `name_chinese`
  - `name_english`
  - `overseas_residency_id_number`
  - `birth_place_is_mainland`
  - `local_mobile_phone`
  - `current_occupation`
  - `is_taiwanese_spouse`
  - `overseas_address`
  - `tw_contact_city`
  - `tw_contact_road`
  - `tw_contact_building_number`
  - `accepted_terms`
- 没有任何 `application_documents` 记录，因此无法验证 `photo`、`mainland_travel_document` 或资格证明材料。
- 当前记录仍没有明确测试/授权 metadata；不能确认它是可用于真实官网测试的授权测试资料。

### 未执行事项

- 未触发台湾提交流程。
- 未生成或绑定新的 VIZA 受控邮箱。
- 未发送或解析台湾官网邮件 OTP。
- 未打开台湾官网自动填写表单。
- 未上传材料到台湾官网。
- 未处理 CAPTCHA。
- 未点击最终提交。
- 未付款。
- 未做自动审批进度查询。

### 提交结果

- 是否提交成功：否，未到提交步骤。
- 官方编号末四位：无。
- 截图位置：无；未进入官网流程，未生成截图。

---

## submission-service readiness

- 服务：未运行
- 环境：本地
- 台湾 handler：未加载
- 队列：通过
- 数据库：通过
- 邮箱：通过
- CAPTCHA：失败
- 阻断与下一位负责人：本地 `viza-be/submission-service` 没有运行中的服务进程；需由本地执行者在 `viza-be/submission-service` 启动服务，或由 TW-G/部署负责人在生产部署启动后复查运行态。当前本地 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED` 未设置为 `true`，台湾真实提交开关可读取且为关闭；CAPTCHA 只确认到本地有相关密钥配置，未在运行中服务内完成连通验证。

---

## submission-service readiness 复核

- 服务：运行中
- 环境：本地
- 台湾 handler：已加载
- 队列：通过
- 数据库：通过
- 邮箱：通过
- CAPTCHA：通过
- 阻断与下一位负责人：唯一阻断在 VIZA 测试草稿本身，不在 submission-service。当前目标环境只读复核仍显示 `6f64272e...6308` 为 `draft`，未看到明确测试标记，且仍缺 `household_revoked`、`overseas_residency_id_number`、`birth_place_is_mainland`、`local_mobile_phone`、`current_occupation`、`is_taiwanese_spouse`、`overseas_address`、`tw_contact_city`、`tw_contact_road`、`tw_contact_building_number`、`accepted_terms`；`application_documents` 仍为 0 条，缺 `photo`、`mainland_travel_document`、`eligibility_supporting_document_1`、`mainland_id_card_scan`。下一位负责人：用户/测试资料负责人需在当前目标环境补齐并明确标记授权测试 application，或提供正确 application ID。台湾真实提交开关可读取且当前关闭。

---

## 生产 VIZA 测试草稿补齐请求复核

- 状态：阻断，未填表，未上传材料，未创建新 application。
- 更新时间：2026-08-01

### 只读复核结果

- Application ID：`6f64272e...6308`
- VIZA 状态：`draft`
- automation：`not_started`
- documents：`not_started`
- submission result：无
- `submission_queue`：0
- `application_documents`：0
- `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true`：否

### 阻断项

- 当前请求要求“补齐所有台湾必填字段/材料”，但本任务没有提供可写入的授权测试字段值或测试材料文件位置。
- 由于边界要求不得编造申请人身份、护照、行程、地址、材料或任何真实个人资料，TW-A 未自行填写或上传。
- 当前生产库只读复核仍缺必填字段键：
  - `household_revoked`
  - `overseas_residency_id_number`
  - `birth_place_is_mainland`
  - `local_mobile_phone`
  - `current_occupation`
  - `is_taiwanese_spouse`
  - `overseas_address`
  - `tw_contact_city`
  - `tw_contact_road`
  - `tw_contact_building_number`
  - `accepted_terms`
- 当前生产库仍缺材料：
  - `photo`
  - `mainland_travel_document`
  - `eligibility_supporting_document_1`
  - `mainland_id_card_scan`

### 未执行事项

- 未打开台湾官网。
- 未触发台湾官网验证码邮件。
- 未进入 CAPTCHA。
- 未点击官方最终提交。
- 未付款。
- 未修改代码、数据库 schema、提交服务、前端或其他国家逻辑。

### 下一位负责人

- 测试资料负责人/用户：提供完整授权测试字段值与测试材料文件位置，或在生产 VIZA 中补齐并明确告知正确 application ID。
- TW-G/部署负责人：如要正式提交测试，需确认 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true` 在目标运行环境中启用。

---

## 生产 VIZA 测试申请页面复核 — 仍未达到可提交状态

- 状态：阻断，未填表，未上传材料，未创建新 application，未触发台湾官网流程。
- 更新时间：2026-08-01

### 本次边界

- 按用户指定打开 VIZA 生产申请页：
  - `country=taiwan`
  - `visaType=TW_ENTRY_PERMIT`
  - `applicationId=6f64272e-1af6-4a48-8525-fcabc5276308`
- 只使用页面和只读后台状态复核；没有编造或写入任何申请人身份、证件、行程、地址或材料。
- 未进入台湾官网，未发送官网邮件验证码，未触发 CAPTCHA，未点击官方最终提交，未付款。
- 未修改代码、数据库 schema、提交服务、前端或其他国家逻辑。

### 前端页面复核

- VIZA 页面可打开到 `VIZA Portal`，但当前 DOM 只显示顶部导航和空主区域。
- 未看到台湾长表单可编辑字段。
- 未看到确认页或 VIZA 提交按钮。
- 因页面没有渲染出可填写表单，未进行任何字段输入或文件上传。

### 只读后台复核

- Application ID：`6f64272e-1af6-4a48-8525-fcabc5276308`
- VIZA application 状态：`draft`
- automation：`not_started`
- documents：`not_started`
- submission result：无
- answer key 数量：104
- `application_documents` 数量：0
- `submission_queue` 数量：0
- 本地 submission-service：运行中，健康检查通过。
- 本地台湾真实提交开关：`TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED=true` 未确认；当前本地 service env 读取结果为关闭。

### 未通过的必填字段

当前只读复核仍缺以下台湾 runner 必填字段键：

- `household_revoked`
- `overseas_residency_id_number`
- `birth_place_is_mainland`
- `local_mobile_phone`
- `current_occupation`
- `is_taiwanese_spouse`
- `overseas_address`
- `tw_contact_city`
- `tw_contact_road`
- `tw_contact_building_number`
- `accepted_terms`

当前条件字段也缺：

- `mainland_id_number`
- `tw_contact_mobile`

### 未通过的材料

`application_documents = 0`，因此至少缺少：

- `photo`
- `mainland_travel_document`
- `eligibility_supporting_document_1`
- `mainland_id_card_scan`

### 结论

- 是否所有必填字段通过前端校验：否；页面未渲染出表单，后台只读复核也显示必填字段未完整。
- `application_documents` 数量：0。
- 是否看到确认页/提交按钮：否。
- 是否确认台湾 live flag 已开启：否；当前本地 service env 读取为关闭，未能确认生产 VIZA server 的该 flag 为 true。
- 当前唯一阻断项：这条 application 仍缺上述具体字段与材料，且页面未显示可填写表单；需要用户/测试资料负责人在 VIZA 生产环境补齐这些授权测试资料或提供可用的测试材料文件位置后再复核。

---

## 官网真实题目 vs VIZA 台湾长表单题目对照审计

- 状态：审计完成；未提交官网申请，未触发 CAPTCHA，未修改 submission-service。
- 更新时间：2026-08-01

### 本次边界

- 官网页面：已进入 `https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply` 的真实“新增”申请表。
- 初始官网入口 `.../apply` 曾出现邮箱验证页；随后接管 Chrome 中已有的 `.../apply` 标签，成功看到申请表。
- VIZA 页面：`https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` 本次只渲染 `VIZA Portal` 导航，主表单未显示；因此“我们当前显示题目”按当前 long-form 源码合同审计。
- 未点击官网最终提交，未发送官网验证码，未处理 CAPTCHA，未上传材料，未创建新 application。
- 没有在本文记录官网页面中出现的已认证邮箱、任何输入值、OTP、证件号或材料内容。

### 结论摘要

- A. 是否能进入官网表单：能。真实官网表单标题为“旅居海外大陸地區人民申請來臺觀光入境許可申請 - 新增”，包含“遞送地點”和“申請表”两个 tab。
- 用户点名的 4 个疑似地址字段中：
  - `tw_contact_city` 当前 long-form 中文“县市”与官网一致。
  - `tw_contact_building_number` 当前“门牌/楼层/室号（住饭店请填饭店名称）”含义与官网一致，可微调为“门牌号/楼/室（住饭店请填饭店名称）”。
  - `tw_contact_mobile_not_applicable` 当前“无在台联络手机号码”与官网一致。
  - `tw_contact_road` 当前“路街（路/街）”不是严重错译，但官网实际占位为“请輸入街、路段”，建议改为“街、路段”或“街/路段”。
- 必须修的主要问题不是这 4 个字段，而是台湾 long-form 仍有通用题目覆盖台湾专属含义、缺 TW 覆盖、以及 seed 必填/条件合同与官网不完全一致。

### 差异清单

| 官网原题目/证据 | 我们当前显示题目/合同 | field_name | 问题类型 | 建议修复中文/合同 |
|---|---|---|---|---|
| `目前戶口登記狀態`，选项为“未註銷戶口登記/已註銷戶口登記，但尚未取得香港、澳門護照”“已註銷戶口登記” | `bilingual-schema-contract.ts` 的 TW map 未覆盖 `household_revoked`；seed 英文为 `Current mainland household registration status` | `household_revoked` | 缺字段中文覆盖 / 可能回退机器生成 | 增加 `household_revoked: "目前户口登记状态"`；选项保留现有简体化官方含义。 |
| `護照號碼/香港簽證身分證明書號碼/澳門旅行證/大陸旅行證` | long-form 因共享 key 可能显示通用“护照号码”；旧 wizard 文案也写成“护照/港澳来往内地通行证/大陆居民往来台湾通行证号码”，与官网不完全一致 | `passport_number` | 含义偏差 / 台湾专属证件范围被简化 | TW 专属覆盖为“护照号码/香港签证身份书号码/澳门旅行证/大陆旅行证号码”。 |
| `護照效期/旅行證效期(西元)`，并提示入境时旅行证件需尚余 6 个月以上 | long-form 通用“护照到期日期” | `passport_expiry_date` | 含义偏差 | TW 专属覆盖为“护照效期/旅行证效期（西元）”；保留 6 个月效期提示。 |
| `僑居身分證號碼`，说明“永久居留证号码、居留证号码或签证号码”，香港身份证只填英文字母及 6 位数字 | “境外居留证号码（如永久居留证/工作许可证号码）” | `overseas_residency_id_number` | 含义偏差 | 改为“侨居身份证号码（如永久居留证号码、居留证号码或签证号码）”；移除“工作许可证号码”的暗示。 |
| `出生地(同所持旅遊證件)`，选项“中国大陆/其他” | “出生地” | `birth_place_is_mainland` | 文案缺少限定 | 改为“出生地（同所持旅游证件）”。 |
| `居住地手機號碼(需填寫國碼)` | “现居地手机号码（含国码）” | `local_mobile_phone` | 文案优化 | 改为“居住地手机号码（需填写国码）”。 |
| `現職` | long-form 通用“当前职业”；旧 wizard 为“目前职业” | `current_occupation` | 文案优化 / 官方术语不一致 | 改为“现职”。 |
| `經歷`，可见提示仅明确“现职栏位倘选择「退休」，请填写退休前服务单位及职称” | `occupation_experience` 合同写“职业为自由业/其他业/无/退休时必填” | `occupation_experience` | 条件逻辑不同（需进一步验证） | 按当前可见官网证据，至少把文案改为“经历”；条件必填需 TW-C/TW-03 复核选择不同职业后的官网行为，不能仅按旧假设扩大到自由业/其他/无。 |
| `*公司名稱及單位全銜或學校名稱` | seed `company_name` required=false；旧 wizard required=true；long-form 题目为“公司/机构/学校全名” | `company_name` | 必填合同不同 / 文案偏差 | seed/long-form 应 required=true；中文改为“公司名称及单位全衔或学校名称”。 |
| `*職稱` | seed `job_title` required=false；long-form 通用“职位名称”；旧 wizard required=true 且题目“职称” | `job_title` | 必填合同不同 / 翻译偏差 | seed/long-form 应 required=true；TW 专属覆盖为“职称”。 |
| `*是否為臺灣人民配偶`，提示“不能以此入出境許可證來臺辦理結婚登記” | “是否为台湾籍人士的配偶？” | `is_taiwanese_spouse` | 官方术语偏差 | 改为“是否为台湾人民配偶”；保留结婚登记提示。 |
| `港、澳或海外地址` | “港澳或境外住址” | `overseas_address` | 文案优化 | 改为“港、澳或海外地址”。 |
| `在臺聯絡地址` 下拉占位 `請選擇縣市` | “县市” | `tw_contact_city` | 无问题 | 保留“县市”。 |
| `請選擇鄉鎮市區` | “乡镇市区” | `tw_contact_district` | 无问题 | 可保留。 |
| `請輸入村/里`，官网说明“村/里/邻为非必填” | “村里（村/里）” | `tw_contact_village` | 文案优化 | 可改为“村/里（非必填）”。 |
| `請輸入鄰`，官网说明只填数字 | “邻（仅填数字）” | `tw_contact_neighborhood` | 无问题 | 保留。 |
| `請輸入街、路段` | “路街（路/街）” | `tw_contact_road` | 文案偏差（轻度） | 改为“街、路段”。 |
| `請輸入巷` | “巷（仅填数字）” | `tw_contact_lane` | 无问题 | 保留。 |
| `請輸入弄` | “弄（仅填数字）” | `tw_contact_alley` | 无问题 | 保留。 |
| `請輸入門牌號樓室`，另有“入住旅馆请于门牌号楼室栏位输入旅馆名称” | “门牌/楼层/室号（住饭店请填饭店名称）” | `tw_contact_building_number` | 基本正确 / 文案优化 | 可改为“门牌号/楼/室（住饭店请填饭店名称）”。 |
| `在臺市內電話` | “在台联络电话（市话）” | `tw_local_phone` | 文案优化 | 改为“在台市内电话”。 |
| `*在臺聯絡手機號碼` + checkbox `無在臺聯絡手機號碼` | `tw_contact_mobile` “在台联络手机号码”；`tw_contact_mobile_not_applicable` “无在台联络手机号码” | `tw_contact_mobile`, `tw_contact_mobile_not_applicable` | 无问题 | 保留；确认未勾选时 `tw_contact_mobile` 必填。 |
| `*所具其他國籍為` | “持有的其他国籍” | `other_nationality_country` | 文案优化 | 改为“所具其他国籍为”。 |
| `*他國護(證)照號碼` | long-form 通用“其他护照号码” | `other_passport_number` | 含义偏差 | TW 专属覆盖为“他国护（证）照号码”。 |
| `*他國護(證)照有效期限` | long-form 通用“其他护照到期日期” | `other_passport_expiry_date` | 含义偏差 | TW 专属覆盖为“他国护（证）照有效期限”。 |
| `申請人曾任大陸地區黨務、行政、軍事或具政治性機關(構)、團體之職務或為其成員者，曾任職於` | “曾在大陆党务、行政、军事或其他政治性机关（构）担任职务或为成员”；详情“曾任职务/单位” | `past_mainland_political_military_role`, `past_role_detail` | 含义偏差 | 改为“申请人曾任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者”；详情题目“曾任职于”。 |
| `申請人現任大陸地區黨務、行政、軍事或具政治性機關(構)、團體之職務或為其成員者，現任職於` | “现在大陆党务、行政、军事或其他政治性机关（构）担任职务或为成员”；详情“现任职务/单位” | `current_mainland_political_military_role`, `current_role_detail` | 含义偏差 | 改为“申请人现任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者”；详情题目“现任职于”。 |
| `申請人未曾擔任大陸地區黨務、行政、軍事或具政治性機關(構)、團體之職務或為其成員。` | “从未在大陆党务、行政、军事或其他政治性机关（构）担任职务或为成员” | `never_held_mainland_political_military_role` | 含义偏差 | 加上“申请人”“大陆地区”“具政治性机关（构）、团体”。 |
| `我已閱讀並接受下列條款與條件`，后续有多段确认/责任提示 | “本人已阅读并同意上述条款” | `accepted_terms` | 文案优化 | 改为“我已阅读并接受下列条款与条件”。 |
| 亲属状况区标题显示 `*父`、`*母`；各字段为“存歿/姓名/生日/电话/现职/服务单位/职称/现居地址”，有“同申请人海外地址”按钮 | seed 注释称 5 个亲属 block 均 optional；VIZA 题目为“父亲 — 生存/已故/离婚状态”等，并把“同申请人海外地址”建模成 yes/no 字段 | 亲属 `kin_*` 字段 | 条件逻辑不同 / 文案偏差（需进一步验证） | TW-C/TW-03 需验证父/母 block 是否至少必填；题目建议改为更贴近官网“父 — 存殁”“母 — 存殁”等；“同申请人海外地址”在官网是快捷按钮，不是申请问题，VIZA 若保留应明确是“是否套用申请人海外地址”。 |

### 必须修 vs 文案优化

必须修：

- `household_revoked` 缺 TW 中文覆盖。
- `passport_number`、`passport_expiry_date`、`other_passport_number`、`other_passport_expiry_date` 不能继续用通用“护照”题目覆盖台湾旅行证/护证照含义。
- `company_name`、`job_title` 在 seed/long-form 必填合同需与官网 `*` 一致。
- `overseas_residency_id_number` 应改为官网“侨居身份证号码”语义，避免“工作许可证号码”误导。
- 政治/党政军声明三项及详情字段需补“大陆地区”“具政治性机关（构）、团体”“曾/现任职于”。
- 亲属父/母 `*` 与 seed optional 结论冲突，需要 TW-C/TW-03 做选择/提交前校验级别验证。

文案优化：

- `tw_contact_road` 建议从“路街（路/街）”改为“街、路段”。
- `tw_contact_building_number` 可微调为“门牌号/楼/室（住饭店请填饭店名称）”。
- `current_occupation` 改为“现职”。
- `birth_place_is_mainland` 加“同所持旅游证件”。
- `local_mobile_phone` 改为“居住地手机号码（需填写国码）”。
- `is_taiwanese_spouse` 改为“是否为台湾人民配偶”。
- `overseas_address`、`tw_local_phone`、`accepted_terms` 可贴近官网原文。

### 建议交给 TW-C/TW-03 修复的文件

- `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
  - 增加/修正 TW 专属中文覆盖：`household_revoked`、`passport_number`、`passport_expiry_date`、`overseas_residency_id_number`、`birth_place_is_mainland`、`local_mobile_phone`、`current_occupation`、`job_title`、`is_taiwanese_spouse`、`overseas_address`、`tw_contact_road`、`tw_contact_building_number`、`tw_local_phone`、`other_nationality_country`、`other_passport_number`、`other_passport_expiry_date`、政治声明字段、`accepted_terms`、亲属字段。
- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
  - 修正 `company_name`、`job_title` required 为 true。
  - 复核 `occupation_experience` 条件是否应仅退休强制，或其他职业是否由官网 JS 动态要求。
  - 复核父/母亲属 block 是否至少部分必填。
- `viza-fe/internal-website/components/client/wizards/tw/config.ts`
  - 虽不是本次 long-form 主路径，但若仍保留台湾 wizard，应同步字段题目，避免之后切换路径时回归。
- 台湾前端/seed focused tests
  - 增加“官网题目合同”测试，锁定上述中文题目和 required/conditional 合同。

### 验证

- 本阶段只做浏览器只读审计与源码只读对照；未运行代码测试，因为未改产品代码。
- 已更新 `docs/taiwan-launch-coordination.md` 新增 `TW-G10` 阻断和状态日志。

### 必填/选填补充审计

- 更新时间：2026-08-01
- 方法：只读观察官网真实表单中的星号、可见提示、禁用状态与条件控件；对照 `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` 当前 `required` / `conditional_logic`。
- 注意：官网 DOM 不使用标准 HTML `required` 属性，星号多为视觉/文本标记；本表以页面可见星号和说明为准。未点击最终提交触发校验，因此亲属区和部分动态职业条件仍标为“需二次验证”。

| 官网原题目 | 官网必填/选填 | VIZA field_name | VIZA 当前 required | 是否一致 | 分类/备注 |
|---|---|---|---|---|---|
| 洲別 | 必填（递送地点） | `continent` | required | 一致 | 无。 |
| 駐外館處據點 | 必填（递送地点） | `embassy_office` | required | 一致 | 无。 |
| 照片上傳（請勿以手機拍攝及上傳） | 必填材料/上传 | `photo`（Documents requirement，不是 seed field） | required document | 一致 | 由 Documents 负责。 |
| 第1次自國外或香港澳門申請來臺觀光 | 必填 | `first_time_applying` | required | 一致 | 无。 |
| 申請證別 | 必填 | `permit_type` | required | 一致 | 无。 |
| 申請證數 | 必填 | `permit_count` | required | 一致 | 无。 |
| 是否具其他國籍護照 | 必填 | `has_other_nationality_passport` | required | 一致 | 选“是”触发其他国籍护照字段与材料。 |
| 申請資格 | 必填 | `eligibility_category` | required | 一致 | 触发对应 `eligibility_supporting_document_1..4`。 |
| 目前戶口登記狀態 | 必填 | `household_revoked` | required | 一致 | 必填一致；仍缺中文题目覆盖，必须修文案。 |
| 中文姓名 | 必填 | `name_chinese` | required | 一致 | 无。 |
| 英文姓名 | 必填 | `name_english` | required | 一致 | 无。 |
| 出生日期(西元) | 必填 | `date_of_birth` | required | 一致 | 无。 |
| 護照號碼/香港簽證身分證明書號碼/澳門旅行證/大陸旅行證 | 必填 | `passport_number` | required | 一致 | 必填一致；中文题目含义必须修。 |
| 護照效期/旅行證效期(西元) | 必填 | `passport_expiry_date` | required | 一致 | 必填一致；中文题目含义必须修。 |
| 性別 | 必填 | `gender` | required | 一致 | 无。 |
| 僑居身分證號碼 | 必填 | `overseas_residency_id_number` | required | 一致 | 必填一致；中文题目含义必须修。 |
| 大陸身分證號碼 | 条件必填：未勾选“无大陆身份证号码”时需要 | `mainland_id_number` | conditional required | 一致 | 触发条件一致。 |
| 無大陸身分證號碼 | 选填开关 | `mainland_id_number_not_applicable` | optional | 一致 | 无。 |
| 出生地(同所持旅遊證件) | 必填 | `birth_place_is_mainland` | required | 一致 | 文案需补限定。 |
| 出生地为其他后的国家/地区下拉 | 条件必填：出生地选“其他”后需要 | `birth_place_other_country` | conditional required | 一致 | 触发条件一致。 |
| 居住地手機號碼(需填寫國碼) | 必填 | `local_mobile_phone` | required | 一致 | 文案优化。 |
| 現職 | 必填 | `current_occupation` | required | 一致 | 文案优化为“现职”。 |
| 經歷 | 官网当前可见为选填；可见提示仅明确退休需填退休前服务单位及职称 | `occupation_experience` | conditional required for `current_occupation in [15,16,17,62]` | 可能不一致 | 官网选填但 VIZA 条件必填，可能卡用户；需 TW-C/TW-03 用不同职业触发官网 JS 验证。 |
| 公司名稱及單位全銜或學校名稱 | 必填 | `company_name` | optional | 不一致 | 高优先级：官网必填但 VIZA 选填，必须修。 |
| 職稱 | 必填 | `job_title` | optional | 不一致 | 高优先级：官网必填但 VIZA 选填，必须修。 |
| 是否為臺灣人民配偶 | 必填 | `is_taiwanese_spouse` | required | 一致 | 文案需改“台湾人民”。 |
| 父母是否同行 | 选填 | `traveling_with_parents` | optional | 一致 | 无。 |
| e-mail | 必填但由官网邮箱验证会话提供 | managed inbox / email OTP flow | 不在 seed 中收集 | 一致 | 不应让用户手填长期账号邮箱。 |
| 港、澳或海外地址 | 必填 | `overseas_address` | required | 一致 | 文案优化。 |
| 在臺聯絡地址 — 縣市 | 必填 | `tw_contact_city` | required | 一致 | 用户点名字段：当前 required 合同正确，文案“县市”正确。 |
| 在臺聯絡地址 — 鄉鎮市區 | 官网无星号，当前显示为选填/从县市联动 | `tw_contact_district` | optional | 一致 | 需注意官网是下拉联动，VIZA seed 当前是 text，属于控件类型/选项来源差异，可后续优化。 |
| 在臺聯絡地址 — 村/里 | 选填（官网说明村/里/邻为非必填） | `tw_contact_village` | optional | 一致 | 文案可加“非必填”。 |
| 在臺聯絡地址 — 鄰 | 选填（官网说明村/里/邻为非必填，只填数字） | `tw_contact_neighborhood` | optional | 一致 | 无。 |
| 在臺聯絡地址 — 街、路段 | 必填 | `tw_contact_road` | required | 一致 | required 一致；文案从“路街（路/街）”改“街、路段”。 |
| 在臺聯絡地址 — 巷 | 选填 | `tw_contact_lane` | optional | 一致 | 无。 |
| 在臺聯絡地址 — 弄 | 选填 | `tw_contact_alley` | optional | 一致 | 无。 |
| 在臺聯絡地址 — 門牌號樓室 | 必填；住旅馆时填旅馆名称 | `tw_contact_building_number` | required | 一致 | required 一致；文案可微调。 |
| 在臺市內電話 | 选填 | `tw_local_phone` | optional | 一致 | 文案优化。 |
| 在臺聯絡手機號碼 | 条件必填：未勾选“无在台联络手机号码”时必填 | `tw_contact_mobile` | conditional required | 一致 | 用户点名字段：required 合同正确。 |
| 無在臺聯絡手機號碼 | 选填开关 | `tw_contact_mobile_not_applicable` | optional | 一致 | 用户点名字段：文案和合同正确。 |
| 所具其他國籍為 | 条件必填：是否具其他国籍护照 = 是 | `other_nationality_country` | conditional required | 一致 | 文案优化。 |
| 他國護(證)照號碼 | 条件必填：是否具其他国籍护照 = 是 | `other_passport_number` | conditional required | 一致 | 必填一致；中文题目含义必须修。 |
| 他國護(證)照有效期限 | 条件必填：是否具其他国籍护照 = 是 | `other_passport_expiry_date` | conditional required | 一致 | 必填一致；中文题目含义必须修。 |
| 親屬狀況 — `*父` | 官网父区标题带星号；字段级必填需提交前校验确认 | `kin_father_*` | optional | 待确认 | 可能“官网必填但 VIZA 选填”；需 TW-C/TW-03 二次验证。 |
| 親屬狀況 — `*母` | 官网母区标题带星号；字段级必填需提交前校验确认 | `kin_mother_*` | optional | 待确认 | 可能“官网必填但 VIZA 选填”；需 TW-C/TW-03 二次验证。 |
| 親屬狀況 — 配偶 | 未见星号 | `kin_spouse_*` | optional | 一致 | 无。 |
| 親屬狀況 — 子女 | 未见星号 | `kin_child1_*`, `kin_child2_*` | optional | 一致 | 无。 |
| 曾任大陆地区党务/行政/军事/具政治性机关(构)、团体职务或成员 | 选填 checkbox；勾选后详情必填 | `past_mainland_political_military_role`, `past_role_detail` | checkbox optional; detail conditional required | 一致 | required 合同一致；文案必须修。 |
| 现任大陆地区党务/行政/军事/具政治性机关(构)、团体职务或成员 | 选填 checkbox；勾选后详情必填 | `current_mainland_political_military_role`, `current_role_detail` | checkbox optional; detail conditional required | 一致 | required 合同一致；文案必须修。 |
| 未曾担任上述职务或成员 | 选填 checkbox；与前两项应互斥/至少一类声明 | `never_held_mainland_political_military_role` | optional | 待确认 | 官网可能通过 JS 要求三项中至少一项；需二次验证。 |
| 我已閱讀並接受下列條款與條件 | 必填 | `accepted_terms` | required true | 一致 | 文案优化。 |
| CAPTCHA 驗證碼 | 必填但属于官网 CAPTCHA，不进入 VIZA 长表单 | `captchaToken` | 不建模 | 一致 | 不处理 CAPTCHA。 |

### required/optional 问题分类

官网必填，但我们是选填（高优先级，必须修）：

- `company_name`
- `job_title`
- 可能包括 `kin_father_*` / `kin_mother_*`，但需提交前校验或字段级星号复核确认。

官网选填，但我们是必填（高优先级，必须修，否则用户会被卡）：

- `occupation_experience` 目前存在风险：官网当前可见为“经历”且没有星号，可见提示只明确退休时填写退休前服务单位及职称；VIZA 对自由业/其他业/无/退休都设为条件必填。需 TW-C/TW-03 验证官网 JS 是否在这些职业下动态强制。

条件必填：

- `mainland_id_number`：未勾选“无大陆身份证号码”时必填。
- `birth_place_other_country`：出生地选择“其他”时必填。
- `tw_contact_mobile`：未勾选“无在台联络手机号码”时必填。
- `other_nationality_country`、`other_passport_number`、`other_passport_expiry_date`：选择“是否具其他国籍护照 = 是”时必填。
- `past_role_detail`：勾选曾任大陆地区党务/行政/军事/具政治性机关（构）、团体职务或成员时必填。
- `current_role_detail`：勾选现任大陆地区党务/行政/军事/具政治性机关（构）、团体职务或成员时必填。

纯文案问题（交给 TW-C 修）：

- `tw_contact_road`、`tw_contact_building_number`、`current_occupation`、`birth_place_is_mainland`、`local_mobile_phone`、`is_taiwanese_spouse`、`overseas_address`、`tw_local_phone`、`accepted_terms`。
- 必须修文案但 required 已一致的台湾专属证件题目：`passport_number`、`passport_expiry_date`、`other_passport_number`、`other_passport_expiry_date`、`overseas_residency_id_number`、政治声明字段。

## TW-C 修复后复核（2026-08-01）

### 范围与边界

- 本次只做复核；未改产品代码、submission-service、数据库、部署配置或其他国家逻辑。
- 未提交台湾官网申请、未处理 CAPTCHA、未点击官网最终提交。
- 已按要求先读总览、TW-C worklog 和本 TW-A worklog。

### VIZA 页面视觉复核

- 访问 VIZA 台湾 long-form：
  - `https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - `https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&applicationId=6f64272e-1af6-4a48-8525-fcabc5276308`
- 两次生产页面均只渲染 portal 导航（首页 / 申请 / 状态 / 智能助手 / 设置 / 帮助），未渲染长表单主体，页面 `inputCount=0`。
- 结论：本轮无法在生产页面视觉确认 TW-C 的新文案；当前可确认的是代码合同已修，生产页面未能视觉复核。可能原因是线上未部署最新代码、当前会话/路由未加载表单主体，或需要另一个受控环境复核。

### 坏翻译复核

- 生产页面因表单主体未渲染，未看到也无法视觉排除以下坏文案：
  - “联系人城市”
  - “联系人号码”
  - checkbox 只叫“联系人”
  - `Tw Contact Road`
- 源码合同复核结果：
  - `viza-fe/internal-website/lib/bilingual-schema-contract.ts` 的台湾专属字段覆盖已包含：
    - `tw_contact_city` → `县市`
    - `tw_contact_road` → `街、路段`
    - `tw_contact_building_number` → `门牌号/楼/室（住饭店请填饭店名称）`
    - `tw_contact_mobile_not_applicable` → `无在台联络手机号码`
  - `household_revoked` 已为 `目前户口登记状态`。
  - `passport_number` / `passport_expiry_date` 已保留台湾旅行证件/护照/香港签证身份证明书/澳门旅行证/大陆旅行证含义。
  - `overseas_residency_id_number` 已为侨居身份证号码语义。
  - 党政军/政治机关相关字段已包含“大陆地区”“党务、行政、军事或具政治性机关（构）、团体”“曾/现任”等官网语义。
- 结论：代码层面的坏翻译已由 TW-C 修复；生产视觉仍未完成确认。

### required 合同复核

- `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` 已显示：
  - `company_name` 为 `required: true`。
  - `job_title` 为 `required: true`。
- 台湾地址组合同复核：
  - `tw_contact_city` required，与官网“县市”必填一致。
  - `tw_contact_district` optional，与官网可见无星号/联动选择一致。
  - `tw_contact_village` optional，与官网“村/里/邻非必填”说明一致。
  - `tw_contact_neighborhood` optional，与官网“村/里/邻非必填”说明一致。
  - `tw_contact_road` required，与官网“街、路段”必填一致。
  - `tw_contact_lane` optional，与官网无星号一致。
  - `tw_contact_alley` optional，与官网无星号一致。
  - `tw_contact_building_number` required，与官网“门牌号楼室”必填一致。
  - `tw_local_phone` optional，与官网无星号一致。
  - `tw_contact_mobile_not_applicable` optional 开关，与官网一致。
  - `tw_contact_mobile` 在未选择“无在台联络手机号码”时条件必填，与官网一致。

### 剩余疑点结论

- `occupation_experience`
  - 官网只读 DOM/可见文案复核：`經歷` 当前未见星号，未见标准 `required` / `aria-required`；可见提示仅明确“现职栏位倘选择「退休」，请填写退休前服务单位及职称”。
  - VIZA 当前仍保留 `current_occupation in [15,16,17,62]` 条件显示/条件必填假设。
  - 结论：官网可见证据只能支持“退休时需填经历”的提示，尚不能确认自由业/其他业/无也必填。当前 VIZA 规则可能比官网更严，需 TW-C/TW-03 用安全职业切换或提交前校验确认后决定是否收窄。

- 父/母亲属区
  - 官网只读 DOM 复核：父亲 `kinships[0].deadMark`、母亲 `kinships[1].deadMark` 控件带 `aria-required="true"`，外层有 `input-group asterisk`。
  - 父/母其他字段（姓名、生日、电话、职业、单位、职称、地址）本次未见同等级字段 required 标记。
  - 结论：官网更像是字段级要求父/母“存歿”状态必填，而不是父/母整块所有字段必填。VIZA 当前 `kin_father_status` / `kin_mother_status` 仍为 optional，存在 required 合同差异，应交回 TW-C/TW-03 修复或用提交前校验最终确认；其他父/母字段暂不应盲目改必填。

### 是否仍需交回 TW-C

- 必须交回 TW-C/TW-03：
  - `kin_father_status`、`kin_mother_status`：官网 DOM 显示字段级 required，VIZA 当前 optional，建议修为 required 或补提交前校验证据。
  - `occupation_experience`：仍需验证是否只在退休时条件必填；当前 VIZA 对自由业/其他业/无/退休都条件必填，可能过严。
- 非 TW-C 代码问题：
  - VIZA 生产页面未渲染长表单主体，导致本轮无法视觉确认新文案；需部署/环境/路由负责人提供可渲染页面后再做最终视觉复核。

### 验证记录

- 已做浏览器只读复核：VIZA long-form 无 applicationId 与带授权测试 applicationId 两个 URL。
- 已做源码只读复核：台湾 bilingual schema 覆盖、台湾 seed required/conditional 合同、TW-C 新增测试记录。
- 已做台湾官网只读 DOM 复核：未提交、未触发 CAPTCHA、未点击最终提交。

## TW-C 父母存殁 + 经历条件修复复核（2026-08-01）

### 范围与边界

- 本次只做复核；未改产品代码、submission-service、数据库、部署配置或其他国家逻辑。
- 未进入台湾官网提交流程、未处理 CAPTCHA、未点击最终提交。
- 已按要求先读总览、TW-C worklog 和本 TW-A worklog。

### 源码/测试合同复核

- 通过：`kin_father_status` / `kin_mother_status` 已经由 seed 的 `kinshipFields()` helper 标为 required。
  - `statusRequired = group === "father" || group === "mother" ? true : requiredGroup`
  - `kin_${group}_status` 使用 `required: statusRequired`
- 通过：父/母其他亲属字段仍保持 optional。
  - 父/母姓名、生日、电话、职业、单位、职称、现住址是否同申请人海外地址、现住址均仍为 `required: false`。
- 通过：`occupation_experience` 已收窄为仅退休触发。
  - seed：`conditional_logic: { showIf: "current_occupation === 62" }`
  - 旧台湾 wizard config：仅 `form.current_occupation === "62"` 时加入 `occupation_experience`。
  - 前端 focused test 已断言 `current_occupation: "15"`（自由业）时 review section 不含“经历”；`current_occupation: "62"`（退休）时包含“经历”。
- 通过：台湾坏翻译未在有效台湾字段合同中回归。
  - 台湾专属 label 覆盖仍为 `tw_contact_city` → `县市`、`tw_contact_road` → `街、路段`、`tw_contact_building_number` → `门牌号/楼/室（住饭店请填饭店名称）`、`tw_contact_mobile_not_applicable` → `无在台联络手机号码`。
  - “联系人城市 / 联系人号码 / Tw Contact Road”等坏文案仅作为 regression test 输入或历史 worklog 证据出现，未作为台湾有效展示文案出现。

### 视觉复核

- Production 复核：
  - URL：`https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - 结果：仍只渲染 portal 导航（首页 / 申请 / 状态 / 智能助手 / 设置 / 帮助），未渲染长表单主体，`inputCount=0`。
  - 结论：生产仍不可视觉复核。
- 本地/当前 worktree 复核：
  - 本机已有前端服务监听 `localhost:3000`。
  - URL：`http://localhost:3000/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - 结果：同样只渲染 portal 导航，未渲染长表单主体，`inputCount=0`。
  - 结论：当前本地环境也不可视觉复核；没有看到父母存殁、经历、台湾地址等表单字段。

### 验证命令与结果

- `cd viza-be/agent-backend && npm test -- --run src/tests/tw-entry-permit-schema.test.ts`
  - 通过：`1` 个测试文件，`8` 个测试全部 passed。
- `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts`
  - 通过：`2` 个测试文件，`16` 个测试全部 passed。

### 结论

- 合同复核通过：TW-C 最新字段合同修复满足本轮要求。
- 视觉复核未完成：production 与本地当前页面都未渲染 long-form 表单主体。
- 暂无需要交回 TW-C 的字段合同问题。
- 下一步应转给部署/路由/环境负责人解决 long-form 页面不渲染；待页面可渲染后再做最终视觉复核（父母存殁必填、父母其他字段 optional、退休时经历出现并必填、非退休时经历不出现或不必填、坏翻译无回归）。

## 部署/重启后 long-form 视觉复核（2026-08-01）

### 范围与边界

- 本次只做 VIZA long-form 视觉/只读复核。
- 未进入台湾官网、未提交、未处理 CAPTCHA、未上传材料、未创建队列、未改产品代码或部署配置。
- 已先读总览、TW-A、TW-C、TW-G worklog；TW-G 记录显示 long-form 已在源码层兼容 `amp;visaType` / `&amp;visaType` 查询参数。

### Production 复核

- URL：
  - `https://app.viza.it.com/client/application/long-form?country=taiwan&amp;visaType=TW_ENTRY_PERMIT`
  - 同时复核 canonical：`https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
- 结果：
  - 页面标题：`VIZA Portal`
  - 页面文本仍只有 portal 导航：`首页 / 申请 / 状态 / 智能助手 / 设置 / 帮助`
  - `input/select/textarea = 0`
  - 未渲染台湾 long-form 表单主体。
- 结论：production 仍不可视觉复核；无法确认字段文案或 required 标记。

### Local 复核

- URL：
  - `http://localhost:3000/client/application/long-form?country=taiwan&amp;visaType=TW_ENTRY_PERMIT`
  - 同时复核 canonical：`http://localhost:3000/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
- 结果：
  - 页面标题：`VIZA Portal`
  - 页面文本仍只有 portal 导航：`首页 / 申请 / 状态 / 智能助手 / 设置 / 帮助`
  - `input/select/textarea = 0`
  - 未渲染台湾 long-form 表单主体。
- 结论：本地当前服务也不可视觉复核。

### 字段文案/required 复核结果

- 页面未渲染表单主体，因此以下项目本轮无法做视觉确认：
  - `tw_contact_city` → `县市`
  - `tw_contact_road` → `街、路段`
  - `tw_contact_building_number` → `门牌号/楼/室（住饭店请填饭店名称）`
  - `tw_contact_mobile_not_applicable` → `无在台联络手机号码`
  - `kin_father_status` / `kin_mother_status` 必填
  - 父母其他 kin 字段 optional
  - `occupation_experience` 仅退休 `current_occupation === 62` 时显示/必填
  - `company_name`、`job_title` 必填
- 坏翻译本轮也只能确认“页面文本中未出现”，不能作为通过证据，因为表单主体本身未渲染：
  - “联系人城市”
  - “联系人号码”
  - `Tw Contact Road`
  - checkbox 只叫“联系人”

### 结论与下一步

- 视觉复核未通过：阻断不是字段合同，而是 production 与 local long-form 均未渲染台湾表单主体。
- 剩余阻断：部署/路由/环境层仍未让 `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` 加载台湾 DB-driven 表单。
- 不能进入“填测试申请 + 提交入队前检查”下一步；应先由 TW-G/部署/路由/环境负责人继续处理 long-form 不渲染。

## 测试申请前置清单（2026-08-01）

### 范围与边界

- 本次不再做 long-form 视觉复核；只为页面恢复后立刻测试准备前置清单。
- 只读核对 application：`6f64272e-1af6-4a48-8525-fcabc5276308`。
- 未填表、未上传、未创建队列、未进入台湾官网、未提交、未处理 CAPTCHA、未改代码、未执行 git 操作。
- 未读取或输出证件号、姓名、邮箱、地址、文件名、storage path、OTP、密码或材料内容。

### 只读状态

- application：`6f64272e...6308`
- 国家/类型：`taiwan` / `TW_ENTRY_PERMIT`
- VIZA 状态：`draft`
- automation：`not_started` / `intake`
- payment：`not_started`
- consent：`not_started`
- documents：`not_started`
- staff review：`not_started`
- submission result：无
- answers：已有 `117` 条答案记录，但仍有提交前缺项。
- application_documents：`0`
- submission_queue：`0`

### 提交前缺字段

只列 key、中文含义和需要用户/系统提供的数据类型；不得在 worklog 中写真实值。

| field key | 中文含义 | 需要的数据类型 | 触发条件 |
|---|---|---|---|
| `accepted_terms` | 接受条款 | 勾选确认 | 基础必填 |
| `company_name` | 公司名称及单位全衔或学校名称 | 授权测试单位/学校名称 | 基础必填 |
| `household_revoked` | 目前户口登记状态 | 枚举选择 | 基础必填 |
| `job_title` | 职称 | 授权测试职称 | 基础必填 |
| `kin_father_status` | 父亲存殁状态 | 枚举选择 | 基础必填 |
| `kin_mother_status` | 母亲存殁状态 | 枚举选择 | 基础必填 |
| `mainland_id_number` | 大陆身份证号码 | 授权测试证件号码 | 未勾选“无大陆身份证号码” |
| `tw_contact_building_number` | 在台联络地址：门牌号/楼/室或饭店名称 | 授权测试地址片段 | 基础必填 |
| `tw_contact_city` | 在台联络地址：县市 | 枚举选择 | 基础必填 |
| `tw_contact_mobile` | 在台联络手机号码 | 授权测试联系电话 | 未勾选“无在台联络手机号码” |
| `tw_contact_road` | 在台联络地址：街、路段 | 授权测试地址片段 | 基础必填 |

本次只读条件摘要：

- 不触发 `birth_place_other_country`。
- 不触发 `occupation_experience`，因为当前不是退休条件。
- 不触发其他国籍字段。
- 不触发 `hk_macau_id_scan`。
- 仍触发 `mainland_id_number` 与 `tw_contact_mobile`。

### 提交前缺材料

当前 `application_documents = 0`，因此以下材料都未挂载/上传：

| requirement key | 中文含义 | 需要的数据类型 | 触发条件 |
|---|---|---|---|
| `photo` | 照片 | 授权测试照片文件 | always |
| `mainland_travel_document` | 大陆地区/港澳非永久居民旅行证件 | 授权测试旅行证件扫描件 | always |
| `eligibility_supporting_document_1` | 申请资格证明文件（匹配当前资格类别） | 对应资格类别的授权测试证明文件 | 当前资格类别已填写 |
| `mainland_id_card_scan` | 大陆身份证正反面 | 授权测试身份证扫描件 | 未勾选“无大陆身份证号码” |

### 用户需要准备什么

- 授权测试资料值：
  - 户口登记状态。
  - 公司/单位/学校名称。
  - 职称。
  - 父亲存殁状态。
  - 母亲存殁状态。
  - 大陆身份证号码，或改为勾选“无大陆身份证号码”并确认相应材料条件变化。
  - 在台联络地址：县市、街/路段、门牌号/楼/室或饭店名称。
  - 在台联络手机号码，或改为勾选“无在台联络手机号码”并确认相应条件变化。
  - 条款接受确认。
- 授权测试材料文件：
  - 照片。
  - 大陆地区/港澳非永久居民旅行证件。
  - 当前资格类别对应的资格证明文件。
  - 大陆身份证正反面，除非用户明确选择“无大陆身份证号码”并保存该条件。

### 页面恢复后最短测试路径

1. 打开 VIZA long-form：
   - `https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&applicationId=6f64272e-1af6-4a48-8525-fcabc5276308`
2. 确认页面不再只显示 portal 导航，且 `input/select/textarea > 0`。
3. 补齐上方缺字段；只使用用户明确提供或系统已标记为测试的数据。
4. 进入 Documents/材料步骤，上传或挂载上方缺材料。
5. 保存草稿并回到确认页；前端校验应无缺字段/缺材料提示。
6. 入队前检查：
   - application 仍为 `taiwan` / `TW_ENTRY_PERMIT`。
   - application 仍是授权测试申请。
   - `application_documents` 至少包含本清单触发的 required document keys。
   - `submission_queue = 0` 或无 active 台湾 live job，避免重复入队。
   - `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED` 仅由部署/运行环境负责人确认；本 worklog 不记录真实配置值。
7. 只有上述检查全部通过后，才可由授权操作员进入下一阶段的受控提交入队测试。

### 必须停下来问用户/授权操作员的动作

- 需要任何真实或准真实个人资料时：必须由用户明确提供或确认其为授权测试资料。
- 上传/挂载文件前：必须确认文件是授权测试材料，且不在聊天或 worklog 中暴露内容。
- 触发或读取邮箱 OTP 前：必须确认使用受控 application alias/inbox，OTP 不写入日志或 worklog。
- 遇到 CAPTCHA 前：必须停止并取得本次处理 CAPTCHA 的明确授权。
- 到达台湾官网最终提交/确认资料按钮前：必须停止，说明 application ID、目标官网和将提交的数据类型，并取得明确“提交这笔测试申请”的确认。

### 当前结论

- 这笔 application 尚未达到可提交/可入队状态。
- 缺字段：`11` 项。
- 缺材料：`4` 项。
- 当前仍 blocked by long-form：页面未恢复前无法补齐字段/材料，也不能进入“填测试申请 + 提交入队前检查”。

## 并行收口后 long-form 视觉复核（2026-08-01）

### 范围与边界

- 本次只做 VIZA long-form 视觉/只读复核。
- 未改代码、未进入台湾官网、未提交、未上传材料、未创建队列、未处理 CAPTCHA。
- 已读最新 coordination、TW-A、TW-B、TW-C、TW-E、TW-F、TW-G worklog。

### URL 复核结果

| 环境/URL | 是否登录阻断 | `input/select/textarea` | 结论 |
|---|---:|---:|---|
| production canonical `https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` | 否，未跳 `/client/login` | `0` | 仍只显示 portal 导航，production 未渲染表单主体，疑似未部署最新前端或仍有线上环境阻断。 |
| production 多层转义 `https://app.viza.it.com/client/application/long-form?country=taiwan&amp;amp;amp;visaType=TW_ENTRY_PERMIT` | 否，未跳 `/client/login` | `0` | 同上。 |
| production 带 applicationId `https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&applicationId=6f64272e-1af6-4a48-8525-fcabc5276308` | 否，未跳 `/client/login` | `0` | 同上。 |
| local canonical `http://localhost:3000/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT` | 否 | `3` | 已渲染台湾表单主体第一步。可见 `Delivery Location`、护照资料页上传控件、`所在洲别*`、`受理使领馆/代表处*`。 |
| local 多层转义 `http://localhost:3000/client/application/long-form?country=taiwan&amp;amp;amp;visaType=TW_ENTRY_PERMIT` | 否 | `3` | 已渲染台湾表单主体第一步，说明多层 `amp;` 兼容在 local 生效。 |

### 本地视觉观察

- local 已不再只显示 portal 导航；台湾 long-form 主体出现。
- 可见页面标题/流程：`中国台湾台湾入境许可证`、`Delivery Location`、`Photo & Basic Status`、`Applicant Identity`、`Taiwan Contact Address`、`Kinship Information` 等步骤。
- 可见第一步字段：
  - `所在洲别*`
  - `受理使领馆/代表处*`
- 坏翻译在当前可见本地页面未出现：
  - “联系人城市”
  - “联系人号码”
  - `Tw Contact Road`
  - checkbox 单独显示“联系人”

### 字段文案/required 抽查状态

- 已完成：local 确认台湾表单主体渲染，且第一步必填星号可见。
- 未完成：后续字段的页面视觉抽查仍未完成。原因是本轮停在只读边界，当前可见页面只展示第一步；直接切换 DB form 步骤可能触发当前步骤草稿保存。Review 深链接可打开，但没有展开缺失字段的完整标签，无法视觉确认后续标签与星号。
- 源码/测试合同仍作为补充证据：
  - `tw_contact_city` → `县市`
  - `tw_contact_road` → `街、路段`
  - `tw_contact_building_number` → `门牌号/楼/室（住饭店请填饭店名称）`
  - `tw_contact_mobile_not_applicable` → `无在台联络手机号码`
  - `kin_father_status` / `kin_mother_status` required，父母其他 kin 字段 optional
  - `company_name`、`job_title` required
  - `occupation_experience` 仅 `current_occupation === 62`（退休）触发

### 当前结论

- production：仍未渲染台湾表单主体；不是未登录跳转，倾向 production 未部署最新前端或仍有线上环境阻断。
- local：已渲染台湾表单主体第一步；local route params / about-me gate / DB 数据链路至少已恢复到能显示台湾表单。
- 不能在 production 进入“补齐测试申请字段/材料”下一步；生产页面仍需部署/环境负责人处理后再复核。
- 可在 local 做开发级下一步验证，但不能替代生产测试申请补齐。

## 用户称“我提交了”后的 VIZA 侧只读状态确认（2026-08-01）

### 范围与边界

- 本次只读检查 VIZA 侧 production/remote 数据和 VIZA 状态页外壳。
- 未进入台湾官网、未点击提交/重试/入队、未处理 OTP/CAPTCHA、未上传材料、未改代码或数据库。
- 未输出证件号、邮箱、文件名、storage path、queue payload、Cookie、密钥或任何材料内容。

### Application 状态

- application：`6f64272e...6308`
- 国家/类型：`taiwan` / `TW_ENTRY_PERMIT`
- VIZA `applications.status`：`processing`
- `automation_status` / `automation_stage`：`not_started` / `intake`
- `documents_status`：`not_started`
- `submission_result_status`：`waiting`
- `submitted_at` / `submission_result_updated_at`：已写入同一时间点。
- `submission_result`：无结构化 payload。
- 官方回执证据：无 `confirmation_number`，无 TW `officialReceipt`，无 official receipt / official submitted 证据。

### Materials / Documents

- `application_documents` 数量：`3`
- 已有 document keys：
  - `photo`
  - `mainland_travel_document`
  - `eligibility_supporting_document_1`
- production `document_requirements` 仍为 `10` 条。
- 当前资格类别对应的一项资格证明已存在；未输出资格类别值。
- 当前保存答案触发 `mainland_id_card_scan` 条件材料，但该 document key 仍缺失。
- `hk_macau_id_scan` 与 `other_nationality_passport_scan` 本次只读条件判断未触发。

### Required Field 快速检查

- 本次只读 presence check 显示此前重点字段大多已有值，包括姓名、侨居证号、出生地是否大陆、当地手机、现职、公司/单位/学校、职称、台湾配偶、海外地址、在台地址、在台手机、父母存殁、条款、资格类别等。
- 仍未看到 `household_revoked` 有保存值；这属于提交前阻断字段，不能进入真实官网提交。
- 未读取或输出任何字段实际值。

### Submission Queue

- `submission_queue` 数量：`1`
- queue row：
  - `status`：`tw_dry_run_pending`
  - `provider`：`taiwan_overseas_cn_entry_permit_dry_run`
  - `mode`：`dry_run`
  - `current_stage`：`null`
  - `official_status`：`null`
  - `created_at`：`2026-08-01T12:17:26.759+00:00`
- 结论：用户这次“提交”在 VIZA 侧只产生了 dry-run pending job；没有产生台湾 live-assisted 官网提交 job。

### VIZA 状态页只读确认

- 只读打开 `https://app.viza.it.com/client/status?applicationId=6f64272e...6308`。
- 页面未跳 `/client/login`，但仍只显示 portal 导航外壳，未渲染可读的申请状态主体；因此无法从页面视觉确认 draft/review/queued/processing/submitted/failed 阶段。
- 页面侧结论以数据库状态为准：VIZA application 已到 `processing` / `waiting`，queue 为 `tw_dry_run_pending`。

### 结论与下一步

- A. 用户这次“提交”在 VIZA 侧到了 `processing` / `waiting`，但 automation 仍是 `not_started` / `intake`。
- B. 已产生 queue job，但它是 `dry_run`，不是台湾 live-assisted 官网提交 job。
- C. 没有官方回执、官方申请编号或 official submitted 证据；不能声称已提交到台湾官网。
- D. 下一步先补齐 `household_revoked` 和缺失的 `mainland_id_card_scan` 授权测试材料，再由前端/发布负责人确认 live flag 与 production 表单主体可见；之后若要触发真实官网流程，遇到 OTP、CAPTCHA 或最终提交前必须停下来取得用户明确授权。

## 台湾官网自动填写任务队列只读确认（2026-08-01）

### 范围与边界

- 背景：用户截图显示 VIZA 状态卡为“台湾官网自动填写任务已排队 / 等待开始”。
- 本次只读复核 application 与最新 `submission_queue` row。
- 未进入台湾官网、未触发提交/重试/入队、未处理 OTP/CAPTCHA、未改代码或数据库、未执行 git 操作。
- 未读取或输出 queue payload、raw error、申请人资料、证件号、邮箱、文件名、Cookie 或密钥。

### Latest queue job

- application：`6f64272e...6308`
- queue count：`1`
- 最新 job：`46e1d3f3...6827`
- `status`：`tw_dry_run_pending`
- `provider`：`taiwan_overseas_cn_entry_permit_dry_run`
- `mode`：`dry_run`
- `stage/currentStage`：`null`
- `attempt_count`：当前 schema 无 `attempt_count` 列；对应可读列为 `attempts = 0`
- `created_at` / `updated_at`：`2026-08-01T12:17:26.759+00:00` / `2026-08-01T12:17:26.759+00:00`
- active：是；pending 且未见完成/失败/取消状态。
- worker 消费迹象：未见 `heartbeat_at`，未见 lock；判断尚未被 worker claim/消费。

### Application 状态

- `applications.status`：`processing`
- `automation_status` / `automation_stage`：`not_started` / `intake`
- `submission_result_status`：`waiting`
- `submitted_at`：已写入 VIZA 侧时间。
- `submission_result` / TW result：无结构化 payload。
- official receipt / 官方编号：无。

### Error 状态

- `submission_queue.error_code`：存在列，当前无值。
- `submission_queue.error_message`：存在列，当前无值；本次未输出 raw error。
- `submission_queue.error_category`：当前 schema 无此列。
- 结论：没有可读的错误码或错误分类；不是失败态。

### 判断

- 当前状态：等待 worker。
- 不是 worker 已开始：没有 heartbeat/lock，attempts 仍为 0。
- 不是缺 env/service 的明确失败：没有 error_code/error_message，也未进入 failed/dead-letter。
- 不是已提交：没有官方回执、官方编号或 TW result payload。
- 这仍是 `dry_run` 队列，不是 `live_assisted` 官网真实提交队列；因此不会进入台湾官网真实提交。

### 下一步

- 下一步应交给 TW-F/service 或发布/运行环境负责人确认：是否有 worker 消费 `tw_dry_run_pending`，以及若目标是真实官网 smoke，为什么前端创建的是 dry-run 而不是 live-assisted。
- 用户当前不需要输入 OTP/CAPTCHA/最终提交确认，因为 worker 尚未开始且此 job 不是 live 官网提交。

## 台湾提交入口改为 runner_job 预检与代码修复（2026-08-01）

### 范围与边界

- 目标：修复台湾 `TW_ENTRY_PERMIT` 的 VIZA 提交/重试入口，使 `live_assisted` 不再只进入 `submission_queue` dry-run，而是创建 `runner_job(country=taiwan)` 供 `tw/runner` / `runTwHalt` 消费。
- 未进入台湾官网、未处理 OTP/CAPTCHA、未点击官方最终提交、未付款、未执行 migration、未部署、未写入真实账号/密码/OTP/Cookie/storage state。
- 未把任何真实 adapter 名称、模块引用、密钥、申请人字段值、文件名或 queue payload 写入 worklog。

### 代码改动

- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
  - 台湾 `live_assisted` 分支改为调用 `enqueueRunnerJob(applicationId, "taiwan", ...)`。
  - API 仍返回台湾前端需要的脱敏队列摘要：`queueStatus=tw_live_assisted_pending`、`provider=taiwan_overseas_cn_entry_permit_live`、`mode=live_assisted`，并新增 `queueBackend=runner_job`。
  - 台湾 runner_job 入队后 application 状态写为 `processing` / `waiting`，不再在尚未进入官网时把 application 标为官方已提交。
  - 非台湾国家仍走现有 `submission_queue` / `enqueue_submission_retry` 路径。
- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts`
  - 更新 focused 测试：台湾 live 必须调用 `enqueueRunnerJob(..., "taiwan")`，不得调用 `enqueue_submission_retry` RPC。
  - 覆盖重复点击复用既有 queued/running runner_job。
  - 保留 fail-closed：`TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED` 缺失、空值、`false`、`1` 均拒绝。

### 验证结果

- `viza-fe/internal-website`: `npm test -- --run 'app/api/applications/[id]/retry-submission/__tests__/retry-submission-tw.test.ts' lib/__tests__/submission-queue.test.ts`
  - 通过：`2` 个测试文件，`24/24` tests passed。
- `viza-fe/internal-website`: `npm run type-check`
  - 未通过，但报错均为既有本范围外问题：
    - `lib/travel/__tests__/travel-llm-connectivity.spec.ts` tuple index 报错。
    - `scripts/capture-travel-city-coverage-screenshots.ts` 缺少 `playwright` 类型。
- `viza-be/submission-service`: `node --import tsx --test src/tw/__tests__/auth.spec.ts src/tw/__tests__/compliance.spec.ts src/queue/__tests__/terminal-status.spec.ts`
  - 通过：`23/23` tests passed。
- `viza-be/submission-service`: `npm run type-check`
  - 通过。

### Adapter / service 配置复核

- 本地 `viza-be/submission-service/.env` 中未配置以下三类变量；未输出真实值：
  - `TW_OFFICIAL_LOGIN_ADAPTER`
  - `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS`
  - `TW_OFFICIAL_LOGIN_ADAPTER_MODULE`
- 用 submission-service 自带 TS resolver 只读调用 `bootstrapTwOfficialLoginProvidersFromEnvironment()`：
  - 结果：`fail_closed`
  - reason：`missing_adapter`
- 仓库内未发现非测试的台湾官方登录 adapter 模块。当前只能验证 bootstrap 机制和 mock adapter tests，不能把真实运行环境切到 `Taiwan official login bootstrap configured`。
- 要达成用户要求的 configured 日志，发布/运行环境负责人必须通过受控密钥库/部署变量提供已批准 adapter 名称、approved list 和 adapter module；不得把真实账号、密码、OTP 或 module secret 写入 Git/worklog。

### applicationId 预检

- application：`6f64272e...6308`
- production/remote 当前 `runner_job`：`0` 条。
- 只读资料预检仍发现这笔 application 不适合立刻创建真实 runner_job：
  - `household_revoked` 未保存。
  - 当前条件触发 `mainland_id_card_scan`，但 `application_documents` 中缺该 key。
  - 已有材料仍为 `photo`、`mainland_travel_document`、当前资格类别对应的 `eligibility_supporting_document_1`。
- 因为 `runTwHalt()` 会在打开官网前对 normalization 和 required documents fail-fast，本次没有为该 application 创建 production runner_job，避免把确定失败的任务推进生产队列。

### 当前结论

- 代码层：台湾 live-assisted 提交入口已改为 runner_job，并有 focused tests 防止回退到 `submission_queue` dry-run。
- 按钮链路复核：台湾 long-form 提交按钮在需要服务端入队时会调用 `/api/applications/{id}/retry-submission`；结果卡/重试按钮也调用同一路由。因此本次 API 修复同时覆盖提交与重试入口。
- 真实 smoke：尚未完成。阻断项是：
  - 测试 application 仍缺 `household_revoked` 与 `mainland_id_card_scan`。
  - 本地/当前可见环境没有受控 `TW_OFFICIAL_LOGIN_*` adapter 配置，bootstrap 仍为 `missing_adapter`。
  - 未确认 production 已部署本次前端 API 修复。
- 下一步：
  - 用户/测试资料负责人补齐上述缺字段与缺材料。
  - TW-F/service 或发布负责人配置受控 official-login adapter，并用启动日志确认 `Taiwan official login bootstrap configured`。
  - 部署本次 API 修复后，用正式 VIZA 提交/重试按钮创建 runner_job；再由 `RUNNER_JOB_COUNTRY=taiwan` 的 submission-service 消费。
  - 若进入 OTP/CAPTCHA/最终提交边界，必须按授权停点处理，未获明确确认不得点击最终提交或付款。

## TW-C 字段合同修复后的视觉/差异复核（2026-08-01）

### 范围与边界

- 按要求读取总览、TW-C worklog 与 TW-A worklog。
- 本次只做 VIZA 台湾 long-form 视觉/合同复核。
- 未进入台湾官网、未创建/修改 application、未上传材料、未创建队列、未处理 OTP/CAPTCHA、未付款、未点击最终提交、未执行 git 操作。
- 未读取或输出任何申请人字段值、证件号、邮箱、文件名、Cookie、密钥或材料内容。

### 页面视觉结果

- local URL：`http://localhost:3000/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - 浏览器未跳 `/client/login`。
  - 只显示 portal 导航外壳：`首页 / 申请 / 状态 / 智能助手 / 设置 / 帮助`。
  - DOM 计数：`input=0`、`select=0`、`textarea=0`、`button=16`。
  - 未看到台湾表单主体，无法视觉复核地址、电话、其他国籍、父母存殁、职业或 required badge。
  - 截图引用：`/Users/mmmytooo/Github/VIZA-monorepo-git/tmp/tw-a-visual-audit/2026-08-01-local-long-form-shell.png`。
- production URL：`https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT`
  - 浏览器未跳 `/client/login`。
  - 同样只显示 portal 导航外壳。
  - DOM 计数：`input=0`、`select=0`、`textarea=0`、`button=16`。
  - 截图引用：`/Users/mmmytooo/Github/VIZA-monorepo-git/tmp/tw-a-visual-audit/2026-08-01-production-long-form-shell.png`。
- 页面 console error/warning：本次未捕获到可用错误输出。
- 结论：视觉复核未完成；阻断仍是 long-form 主体未渲染，而不是已观察到某个台湾字段文案错误。

### 源码/测试合同复核

- Focused tests：
  - `cd viza-fe/internal-website && npm test -- --run components/__tests__/taiwan-frontend-experience-audit.test.tsx lib/__tests__/bilingual-schema-contract.test.ts`
  - 通过：`2` 个测试文件，`25/25` tests passed。
- 通过的合同证据覆盖：
  - 台湾坏翻译覆盖：`联系人城市`、`联系人号码`、checkbox 只叫 `联系人`、`Tw Contact Road` 不应从 curated label path 出现。
  - `tw_contact_city`：显示为 `县市`，并被规范为台湾县市 select。
  - `tw_contact_district`：显示为 `乡镇市区`，并依赖 `tw_contact_city` 联动；高雄市选项包含 `新興區`、`前金區`、`苓雅區`、`鹽埕區`。
  - 电话组：默认 `tw_contact_mobile` 必填、`tw_local_phone` 选填；勾选 `tw_contact_mobile_not_applicable` 后，手机字段隐藏，`tw_local_phone` 变必填。
  - 其他国籍护（证）照：`has_other_nationality_passport=no` 时隐藏；`yes` 时 `other_nationality_country`、`other_passport_number`、`other_passport_expiry_date` 均 required。
  - 父/母亲属：`kin_father_status`、`kin_mother_status` required；父/母其他亲属字段仍 optional。
  - `mainland_id_number` 显示时 required，勾选无大陆身份证号码后隐藏豁免。
  - `company_name`、`job_title` 即使旧 DB rows 标为 optional，也由 TW-only 前端 normalization 兜底为 required。

### 结论与归属

- 字段合同层：通过；当前没有发现需要交回 TW-C 的字段合同问题。
- 视觉层：未通过/未完成；local 与 production 均仍是 portal 空壳，`input/select/textarea=0`。
- 下一步归属：交给 production long-form / local dev 渲染环境负责人（TW-G/部署/路由/layout owner）继续查为什么页面主体未挂载；TW-C 只有在页面主体恢复后发现具体字段文案或 required badge 不符时再接回。
- 不能进入“生产 long-form/提交队列/runner_job 集成问题”的完整验收：因为本次没有视觉看到表单主体。可进入的只是非视觉合同证据层，runner_job 集成仍另受 application 缺字段/缺材料与 official login adapter 配置阻断。

## 0124 后 production long-form 字段视觉验收（2026-08-03）

### 范围与边界

- 背景：用户确认 `0124` production 台湾字段元数据同步已执行成功，`upsert=28`，`TW_ENTRY_PERMIT` 总行数从 `91` 变 `92`，`all_checks_passed=true`。
- 本次在 production VIZA long-form 使用授权测试草稿 `6f64272e...6308` 做页面内视觉复核。
- 未进入台湾官网、未创建新 application、未上传材料、未创建/重试队列、未处理 OTP/CAPTCHA、未付款、未点击最终提交、未执行 git 操作。
- 未在 worklog 输出任何申请人答案、证件号、邮箱、文件名、Cookie、OTP、密钥或材料内容。
- 复核中仅做 VIZA 表单内临时条件切换；结束前已恢复：其他国籍护照为 no、职业为非退休原状态、县市为原状态、无在台联络手机号码为未勾选、大陆身份证号码字段为显示必填状态；页面无 `保存中...`。

### Production 页面主体

- URL：`https://app.viza.it.com/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&applicationId=6f64272e-1af6-4a48-8525-fcabc5276308`
- 初始打开该已提交/等待中的草稿时位于确认/status step，需展开 `1 审核申请` 后进入具体子步骤；这不是 portal 空壳。
- `Delivery Location` 字段页已渲染：
  - 页面标题：`中国台湾台湾入境许可证`
  - 可见字段：`所在洲别*`、`受理使领馆/代表处*`
  - DOM 计数：`input=2`、`select=1`、`textarea=0`
- 结论：production long-form 主体已可渲染，之前 `input/select/textarea=0` 的 portal shell 阻断已关闭；但确认/status step 本身仍可能显示 `0` 个表单控件，复核时必须进入字段子步骤。

### 字段视觉验收结果

- `household_revoked`
  - `Photo & Basic Status` 中已显示 `目前户口登记状态*`。
  - 控件类型为 radio 组。
  - 未选择时显示 `必填项`；验收通过。
- 其他国籍护照条件组
  - 默认 no 时 `Other Nationality` 子步骤隐藏，`所具其他国籍为`、`他国护（证）照号码`、`他国护（证）照有效期限` 不显示。
  - 临时切为 yes 后步骤数从 `10` 变 `11`，出现 `Other Nationality` 子步骤。
  - `Other Nationality` 子步骤内三项均显示 `*` 且继续按钮 disabled：
    - `所具其他国籍为*`
    - `他国护（证）照号码*`
    - `他国护（证）照有效期限*`
  - 结束前已恢复 no；验收通过。
- `Applicant Identity`
  - `大陆身份证号码*` 显示为 required。
  - 临时勾选 `无大陆身份证号码` 后，`大陆身份证号码*` 消失；取消勾选后恢复显示 `大陆身份证号码*`。
  - `公司名称及单位全衔或学校名称*` 显示为 required。
  - `职称*` 显示为 required。
  - `现职*` 当前为非退休时 `经历` 不显示。
  - 临时选择 `退休` 后出现 `经历*` 且继续按钮 disabled；恢复非退休后 `经历*` 消失。
  - 验收通过。
- 台湾地址联动
  - `Taiwan Contact Address` 中显示：
    - `县市*`
    - `乡镇市区` + `选填`
    - `街、路段*`
    - `门牌号/楼/室（住饭店请填饭店名称）*`
    - `村/里（非必填）`、`邻（仅填数字）`、`巷（仅填数字）`、`弄（仅填数字）` 均为选填。
  - 临时将县市切为 `高雄市` 后，区乡镇市下拉重置为 `请选择...`。
  - 打开区乡镇市下拉可见 `鹽埕區`、`新興區`、`前金區`、`苓雅區`，且未混入台北 `中正區`。
  - 结束前已恢复原县市；验收通过。
- 电话反向必填
  - 默认状态：`在台联络电话` 显示 `选填`，`在台联络手机号码*` 显示 required。
  - 临时勾选 `无在台联络手机号码` 后，`在台联络电话*` 显示 required，普通 `在台联络手机号码*` 字段隐藏；取消勾选后恢复默认状态。
  - 验收通过。
- 父母亲属
  - `Kinship Information` 中 `父 — 存殁*`、`母 — 存殁*` 显示 required。
  - 父/母其他字段均显示选填，包括姓名、生日、电话、现职、服务单位、职称、现住址是否与申请人海外地址相同、现住址。
  - 验收通过。

### 差异/失败项

- 未发现需要交回 TW-C 的字段文案、控件类型、required 标记或条件逻辑差异。
- 本次没有验证台湾官网真实提交、官方 OTP、CAPTCHA、付款、官方回执或 runner_job 消费。

### 当前结论

- production 字段视觉验收通过，可进入 application 完整性和 runner_job smoke 准备。
- 下一步仍需独立处理：
  - application 完整性：此前阻断的缺字段/缺材料需重新只读确认，尤其 `household_revoked` 保存值与条件材料。
  - runner_job smoke：确认台湾提交/重试按钮在 production 已走 `runner_job(country=taiwan)`，并由 `RUNNER_JOB_COUNTRY=taiwan` 的 submission-service 消费。
  - service/runtime：确认受控官方邮箱/OTP、CAPTCHA 服务和任何必要 adapter 均在安全环境配置；不得把密钥、OTP、Cookie 或申请人答案写入日志/worklog。

## 官网 `householdRevoked` 真实显示条件复核（2026-08-03）

### 范围与边界

- 背景：用户在台湾官网真实申请流程中没有看到 `目前戶口登記狀態`，且不应要求用户猜答案。
- 本次使用当前已登录的台湾官网申请页做只读 DOM / 脚本审计。
- 未修改台湾官网任何真实申请答案，未点击提交，未处理 OTP/CAPTCHA，未付款，未输出申请人资料。
- 记录内容仅限字段可见性、DOM name、required 状态、官方选项与非敏感显示条件。

### 官网 DOM 证据

- 官网页面：`https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply`
- DOM 中存在 `name="householdRevoked"`：`2` 个 radio input。
- 官方 DOM name：`householdRevoked`。
- 官方选项：
  - `value="N"`：`未註銷戶口登記/已註銷戶口登記，但尚未取得香港、澳門護照`
  - `value="Y"`：`已註銷戶口登記`
- required 状态：
  - 第一项 radio 带 `aria-required="true"`。
  - 第二项 radio 未单独带 required 属性；同组应作为 radio group required 处理。
- 当前可见性：
  - 两个 radio 本身未 disabled。
  - 外层容器 `#household-revoked-div` 当前为 `display:none`。
  - 当前页面可见文字不包含 `目前戶口登記狀態`。
  - 当前路径下该字段实际不可见、不可填写。

### 当前官网路径

- 当前递送地 `overseaOfficeId`：`53` / `駐新加坡台北代表處`。
- 当前申请资格 `traveller.applyQualification`：`4` / `1.赴國外或香港、澳門留學生`。
- 当前 `traveller.othPassportFlag`：`N`。
- 当前申请证别为单次证；`firstApplyFlag` 本次未作为触发条件证据。
- 结论：当前新加坡递送地 + 留学生资格路径下，官网不需要 `householdRevoked`，不能因为 VIZA 缺 `household_revoked` 阻止当前测试申请进入后续完整性检查。

### 官网显示条件

- 官网公开脚本证据：
  - `js/page/overseas-foreign-china/apply/add.js`
    - `$("input[name='householdRevoked']").rules("add", { required: true });`
    - `$("#household-revoked-div").hide();`
    - 当 `qualification === "5" && (officeId === "50" || officeId === "51")` 时 `$("#household-revoked-div").show();`
  - `js/page/overseas-foreign-china/utils.js`
    - 注释：`旅居國外或香港、澳門取得當地永久居留權需顯示戶口登記狀態`
    - 申请资格 change handler 中同样只在 `$(this).val() === "5" && (officeId === "50" || officeId === "51")` 时 show，否则 hide。
- 官方非敏感条件映射：
  - `traveller.applyQualification === "5"`：第 2 类 `旅居國外或香港、澳門取得當地永久居留權`。
  - `overseaOfficeId in ["50", "51"]`：
    - `50`：`台北經濟文化辦事處／香港辦事處`
    - `51`：`台北經濟文化辦事處／澳門辦事處`
- 未发现它由以下项触发：
  - `applyCaseExtendTemp.firstApplyFlag`
  - `traveller.applyVisa`
  - `traveller.othPassportFlag`

### 对 VIZA 合同的结论

- VIZA 当前把 `household_revoked` 设成无条件 required 是错误的。
- 正确合同应为条件显示 / 条件必填：
  - 若使用 VIZA 字段值：`eligibility_category === "2" && embassy_office in ["50", "51"]`
  - 若使用官网映射值：`traveller.applyQualification === "5" && overseaOfficeId in ["50", "51"]`
- 当前测试申请路径为新加坡递送地 + 留学生资格，不应要求 `household_revoked`。
- TW-C 应修改的精确合同：
  - `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
    - `household_revoked.required` 从无条件 `true` 改为条件 required。
    - 添加 `conditional_logic.showIf` / `validation_rules.required_when`，条件为 `eligibility_category === 2 && embassy_office in ["50", "51"]`（注意 VIZA 资格值 `2` 会映射到官网 `5`）。
  - `viza-fe/internal-website/components/client/wizards/tw/config.ts`
    - `household_revoked` 从 `basicFields` 无条件显示改为条件显示。
  - `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
    - 移除 `household_revoked` 的 TW-only 无条件 required override；改为同一条件 required。
  - 前端/seed focused tests：
    - 当前新加坡 `embassy_office=53` + 留学生 `eligibility_category=1` 时不显示、不校验 `household_revoked`。
    - 香港/澳门 `embassy_office in ["50","51"]` + 永久居留权 `eligibility_category=2` 时显示并必填。
- Runner / normalization 后续也需同步同一条件：
  - `viza-be/submission-service/src/tw/normalize.ts` 不应无条件 require `household_revoked`。
  - `viza-be/submission-service/src/tw/apply.ts` 只应在官网字段可见条件满足时填写 `householdRevoked`。

### 阻断调整

- 在 TW-C 修复前，TW-A 后续做当前测试申请完整性检查时，不允许把缺 `household_revoked` 作为阻断项。
- 当前仍可能存在其他完整性阻断，例如条件材料 `mainland_id_card_scan`，需另行只读复核；但 `household_revoked` 对当前官网路径不是阻断。

## 官网 `在臺聯絡地址` 子字段 required 规则复核（2026-08-03）

### 范围与边界

- 背景：用户官网截图显示红星只在整个 `在臺聯絡地址` 标题前，且说明 `村/里/鄰為非必填`；用户质疑 `街、路段` 不应被 VIZA 设为必填。
- 本次只做安全审计：未修改官网真实申请答案，未点击官网最终提交，未处理 OTP/CAPTCHA，未付款，未上传材料，未写数据库，未改代码，未做 git 操作。
- 证据来源：
  - 当前已登录台湾官网申请页仍存在：`https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply`。
  - 当前页前次 DOM 证据已读取到地址字段的 `name`、可见性、`aria-required`、class/error 状态。
  - 本轮补充核对官网公开脚本：
    - `https://coa.immigration.gov.tw/coa-frontend/js/page/common/address-form-rwd.js`
    - `https://coa.immigration.gov.tw/coa-frontend/js/page/overseas-foreign-china/traveller-form.js`

### 官网公开脚本证据

- `address-form-rwd.js` 的 `initAddressValidation(prefix, suffix, required)`：
  - 地址整体 required 时，仅对 `select[name='${prefix}city${suffix}']` 加 `required: true`。
  - 地址整体 required 时，仅对 `input[name='${prefix}number${suffix}']` 加 `required: true`。
  - `select[name='${prefix}township${suffix}']` 的 required 为条件规则：已选择县市时 `cityValue !== ""` 才必填。
  - `input[name='${prefix}road${suffix}']` 只加 `maxlength: 10` 与 `addressCharChk: true`，没有 `required`。
  - `village`、`neighborhood`、`lane`、`alley` 也只加长度/字符校验，没有 `required`。
- `traveller-form.js` 的电话规则：
  - `traveller.twMobile` 默认 `required: true`。
  - 勾选 `traveller.noTwMobileFlag` 后，`traveller.twMobile` 被清空并 disabled，`traveller.twTelNo` 动态加 `required: true`；取消勾选后移除市话 required。

### 当前页 DOM 证据

| VIZA field | 官网 DOM name | 官网控件 | 当前 DOM required 证据 | 官网结论 |
|---|---|---|---|---|
| `tw_contact_city` | `traveller.city` | select | `aria-required="true"`；脚本地址 required 时加 `required: true` | 必填 |
| `tw_contact_district` | `traveller.township` | select | 前次 DOM 为 `aria-required="true"`；脚本在县市已选择时 required depends `cityValue !== ""` | 条件必填：选择县市后必填 |
| `tw_contact_village` | `traveller.village` | input | 无 `aria-required`；官方说明 `村/里/鄰為非必填`；脚本无 required | 选填 |
| `tw_contact_neighborhood` | `traveller.neighborhood` | input | 无 `aria-required`；官方说明 `村/里/鄰為非必填`；脚本无 required | 选填 |
| `tw_contact_road` | `traveller.road` | input | 前次 DOM 无 `aria-required`、class 为 valid；脚本只校验长度/字符，没有 required | 选填，不是独立必填 |
| `tw_contact_lane` | `traveller.lane` | input | 无 `aria-required`；脚本无 required | 选填 |
| `tw_contact_alley` | `traveller.alley` | input | 无 `aria-required`；脚本无 required | 选填 |
| `tw_contact_building_number` | `traveller.number` | input | 前次 DOM 为 `aria-required="true"` 且在空值时有 required error；脚本地址 required 时加 `required: true` | 必填 |
| `tw_local_phone` | `traveller.twTelNo` | input | 默认无 required；勾选无手机时脚本动态加 required | 条件必填：仅无在台联络手机时必填 |
| `tw_contact_mobile_not_applicable` | `traveller.noTwMobileFlag` | checkbox | 本身非必填；控制手机/市话反向 required | 选填控制项 |
| `tw_contact_mobile` | `traveller.twMobile` | input | 默认 `required: true`；勾选无手机后 disabled 且不 required | 默认必填；无手机时隐藏/禁用且不校验 |

### 对用户疑问的结论

- `街、路段` 在官网不是独立必填字段。
- 官网采用“地址整体必填 + 子字段组合校验”的方式；实际 required 子字段为：
  - `縣市` 必填。
  - `區/鄉/鎮/市` 在已选县市后必填。
  - `門牌號樓室` 必填。
  - `街、路段` 不是必填，只在填写时受长度/字符规则限制。
- 因此 VIZA 当前 `tw_contact_road.required=true` 是错误的，会不必要地阻止用户进入后续流程。
- VIZA 当前 `tw_contact_building_number.required=true` 与官网一致。
- 额外发现：VIZA seed/runner 目前把 `tw_contact_district` 当 optional，但官网脚本显示它在已选 `tw_contact_city` 后条件必填；这也是合同差异。

### TW-C 精确修改范围

- Seed / production metadata：
  - `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`
    - 将 `tw_contact_road.required` 从 `true` 改为 `false`。
    - 将 `tw_contact_district` 从普通 optional 改为条件必填：`required_when tw_contact_city is present` 或等价 `conditional required`。
    - 保持 `tw_contact_city.required=true`、`tw_contact_building_number.required=true`。
    - 在 `validation_rules` 中记录官网 DOM：`traveller.city`、`traveller.township`、`traveller.road`、`traveller.number` 与脚本证据。
- 前端 wizard / required badge：
  - `viza-fe/internal-website/components/client/wizards/tw/config.ts`
    - 移除 `tw_contact_road` 的 required 标记。
    - 让 `tw_contact_district` 在已选择 `tw_contact_city` 后显示 required/必填校验。
    - 保持 `tw_contact_building_number` required。
- 前端 schema / completeness：
  - `viza-fe/internal-website/lib/bilingual-schema-contract.ts`
    - 移除任何把 `tw_contact_road` 强制必填的 TW override。
    - 添加或修正 `tw_contact_district` 的条件 required 合同。
  - 表单完整性检查中不得把空 `tw_contact_road` 作为 blocker；县市存在时应检查区乡镇市；继续检查门牌号楼室。
- Runner normalize / apply：
  - `viza-be/submission-service/src/tw/normalize.ts`
    - `tw_contact_road` 不应再 `requireStr(...)`；有值则传递，无值允许为空。
    - `tw_contact_district` 应在 `tw_contact_city` 存在时 required。
  - `viza-be/submission-service/src/tw/apply.ts`
    - `tw_contact_road` 使用 optional fill；空值不失败。
    - `tw_contact_district` 在已选县市后必须选择并回读校验。
    - `tw_contact_building_number` 继续 required strict fill。
- Tests：
  - Seed/schema tests：锁定 `tw_contact_road` optional、`tw_contact_district` conditional required、`tw_contact_building_number` required。
  - Frontend tests：required badge / 下一步 disabled / completeness 不因空 `街、路段` 阻断；县市已选但区乡镇市空时阻断；门牌号楼室空时阻断。
  - Runner normalize/apply tests：空 `tw_contact_road` 不失败；县市有值但 district 空失败；building number 空失败；填写 road 时仍按官网字符/长度约束传递并回读。

### 阻断调整

- 在 TW-C 修复前，当前台湾测试申请不应因为缺 `tw_contact_road` 被阻止继续完整性检查。
- 若已选择 `tw_contact_city`，则应要求用户提供/选择对应的 `tw_contact_district`；这不是个人资料猜测，必须由授权测试资料给出。
- `tw_contact_building_number` 仍是当前测试申请的真实必填项，不得放宽。

## 用户亲自核对的 VIZA 台湾长表单 UI 调整记录（2026-08-03）

### 当前范围

- 用户正在根据台湾官网截图/HTML，逐 section 核对 VIZA 台湾 `TW_ENTRY_PERMIT` 长表单。
- 本阶段是本地前端 UI/文案/分组调整；不进入台湾官网，不处理 OTP/CAPTCHA，不付款，不提交官网申请。
- 用户明确要求：后续每个 section 先根据官网截图/HTML识别对应问题，再确认后放入对应 section。

### 已确认 section 结构

- `递送地点`
- `旅居海外大陆地区人民申请来台观光`
  - 小步显示名：`申请资格与证别`
- `应检附文件`
- `申请人资料`
- `亲属状况（亲属资料）`
- `申报事项`

### `申请资格与证别` 已确认问题

- `照片上传（请勿以手机拍摄及上传）`
  - VIZA 对应材料 key：`photo`
  - 用户确认：照片上传放在此 section，而不是后续 `应检附文件`。
- `第1次自国外或香港澳门申请来台观光`
  - VIZA 对应字段：`first_time_applying`
- `申请证别`
  - VIZA 对应字段：`permit_type`
  - 需显示官网蓝色说明框。
- `申请证数`
  - VIZA 对应字段：`permit_count`
  - 需显示官网蓝色说明框。
- `是否具其他国籍护照`
  - VIZA 对应字段：`has_other_nationality_passport`
- `申请资格`
  - VIZA 对应字段：`eligibility_category`
- 用户确认删除/隐藏：
  - `目前户口登记状态` / `household_revoked` 不在当前 VIZA 表单中显示。

### `应检附文件` 待实施计划

- 用户澄清：之前要求去掉的 `optional` 是因为旧的 optional 区块无关；现在用户提供的官网附件表格里的非星号附件仍是相关条件材料，应保留。
- `应检附文件` 应根据 `申请资格 / eligibility_category` 的回答分布，并按用户将提供的四类官网截图/HTML逐项抄写。
- 用户指定四类顺序：
  1. `赴国外或香港、澳门留学生`
  2. `旅居国外或香港、澳门取得当地永久居留权`
  3. `旅居国外或香港、澳门1年以上且领有工作证明`
  4. `旅居国外或香港、澳门取得当地依亲居留权且有财力证明`

### 从当前官网 HTML / 用户截图提取的材料清单修正

- 用户纠正：不得从旧 VIZA 条件逻辑自动加入材料。`hk_macau_id_scan` 这类旧条件材料若未在当前官网截图/HTML 的对应资格附件表中出现，就不应加入该资格的 `应检附文件`。
- 后续规则：用户给截图即可替代 HTML；只要截图中文字和红星清楚，就按截图逐行抄写。
- 截图中红星 `*` 视为该资格下必传；无红星但出现在同一附件表中的行，视为该资格相关的条件/情形适用材料，不放进旧的泛化 `可选补充材料` 区块。
- 纠正：上一轮将用户后续截图误归为资格 1；该组不是资格 1 的最终清单，后续必须按用户逐张截图重新归类，不沿用误判。

#### 资格 1：`赴国外或香港、澳门留学生`

- 用户提供截图时间：2026-08-03 14:12。
- 官网截图显示的材料行：
  - `* 大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件`
  - `* 有效学生签证（或再入国签证）及学校核发之3个月内在学证明`
  - `旅居香港或澳门之申请人，须附香港或澳门居民身份证（正、反面）及有效香港或澳门签证（11岁以下免附）`
  - `未成年且无法定代理人或监护人陪同来台者，应检附法定代理人同意书及亲属关系证明（如：出生证明、亲属关系公证书或同户之常住人口登记卡）或监护人同意书及监护证明文件。`
  - `其他相关证明文件（若无要求则免附，申请人如旅居日本，请上传3个月内住民票）`
  - `具有他国国籍护（证）照文件`
  - `* 大陆身份证（正、反面）`
- 资格 1 截图当前可见范围没有出现：
  - `永久居留权证明`
  - `hk_macau_id_scan`
- 因此资格 1 不应自动加入 `hk_macau_id_scan`；若需要港澳居民身份证/签证材料，应按官网这一行建立对应的资格 1 条件材料，而不是复用旧的 `hk_macau_id_scan` 名义。
- 已实施到本地长表单：
  - `应检附文件` 按 `eligibility_category === "1"` 显示资格 1 材料清单。
  - 必需材料：大陆/港澳旅行证件、有效学生签证/再入国签证及 3 个月内在学证明、大陆身份证正反面。
  - 情形适用材料：旅居香港/澳门申请人的居民身份证及有效签证、未成年且无法定代理人/监护人陪同材料、其他相关证明文件、其他国籍护（证）照文件。
  - `hk_macau_id_scan` 不作为资格 1 默认材料加入；截图中的港澳申请人材料以新的资格 1 情形适用行承载，避免旧 key 误导为所有申请人必传。
  - `photo` 继续保留在 `申请资格与证别` section，不在 `应检附文件` 重复显示。

#### 待重新归类的截图材料行

- 用户确认以下截图属于资格 2：`旅居国外或香港、澳门取得当地永久居留权`。
- 官网截图显示的材料行：
  - `* 大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件`
  - `* 永久居留权证明`
  - `未成年且无法定代理人或监护人陪同来台者，应检附法定代理人同意书及亲属关系证明（如：出生证明、亲属关系公证书或同户之常住人口登记卡）或监护人同意书及监护证明文件。`
  - `其他相关证明文件（若无要求则免附，申请人如旅居日本，请上传3个月内住民票）`
  - `具有他国国籍护（证）照文件`
  - `* 大陆身份证（正、反面）`
- 已实施到本地长表单：
  - `eligibility_category === "2"` 时，必需材料显示大陆/港澳旅行证件、永久居留权证明、大陆身份证正反面。
  - 情形适用材料显示未成年且无法定代理人/监护人陪同材料、其他相关证明文件、其他国籍护（证）照文件。
  - 资格 2 不显示资格 1 的“旅居香港或澳门之申请人，须附香港或澳门居民身份证及有效签证”材料行。
  - 修正：若材料中心初始数据尚未包含 `eligibility_supporting_document_2`，本地长表单仍以前端兜底 requirement 显示 `永久居留权证明`，避免资格 2 页面漏项。

### 下一步准备添加的规则

- `应检附文件` section 不显示旧的泛化 `可选补充材料` 标题。
- 但会显示官网附件表中的相关条件材料，并按截图/HTML实际出现的行标注/出现：
  - 不再预设加入 `hk_macau_id_scan`；只有用户提供的对应资格截图/HTML 中出现该行时才加入。
  - 未成年无监护人陪同材料：需要后续确认 VIZA 是否已有年龄/陪同字段可触发；没有则先作为条件说明或新增字段候选。
  - 日本住民票/其他相关证明：按居住地或用户选择条件显示；没有触发字段则先作为条件说明或新增字段候选。
  - 其他国籍护照文件：`has_other_nationality_passport === yes` 时显示。
- 继续等待用户提供资格 3/4 的截图/HTML 后，再逐类抄写官方材料题目。

## Submission normalize/runner 职业字段合同修复（2026-08-04）

### 范围

- 本次只处理台湾 submission-service normalize/apply 合同，不改 seed、前端、数据库、部署配置或 runner job。
- 未进入台湾官网，未登录，未处理 OTP/CAPTCHA，未创建/重试 runner_job，未提交或付款。

### canonical code 核实

- `current_occupation === "14"`：学生。
- `current_occupation === "61"`：待业。
- `current_occupation === "62"`：退休。
- code 来源：台湾字段配置/seed 的 canonical option value；本次不按中文 label 猜测。

### 改动

- `viza-be/submission-service/src/tw/normalize.ts`
  - 学生 `14`：保留并要求 `company_name`，省略 `job_title`；即使旧草稿残留 `job_title`，也不输出给 runner。
  - 退休 `62` / 待业 `61`：省略 `company_name` 和 `job_title`；即使旧草稿残留两项，也不输出给 runner。
  - 其他现职：维持提交要求，`company_name` 与 `job_title` 均需存在并输出；缺任一项会抛 `TwNormalizationError`，由 runner readiness 停止。
- `viza-be/submission-service/src/tw/apply.ts`
  - 官网填表前增加同一职业 code 保险：学生不填 `job_title`；退休/待业不填 `company_name`、`job_title`，避免绕过 normalizer 时提交隐藏旧值。
- `viza-be/submission-service/src/tw/__tests__/normalize.spec.ts`
  - 新增 focused tests：学生只省略 `job_title`；退休/待业省略两项；普通职业仍要求并保留两项。

### 验证

- `node --import tsx --test src/tw/__tests__/normalize.spec.ts`
  - 15 tests passed。
- `npm run type-check`
  - passed。
- `node --import tsx --test src/tw/__tests__/*.spec.ts`
  - 44 tests passed。

### 未执行项 / 边界

- 未验证生产部署；不得声称 production 已更新。
- 未执行真实官网 smoke、OTP、CAPTCHA、最终提交、付款或队列操作。
- 未改 `viza-be/submission-service/src/queue/halt-runners.ts`；runner readiness 通过 `normalizeTwAnswers()` 接收本次修正后的字段合同。

## 邮箱验证发送前 CAPTCHA + 台湾专用邮箱修复（2026-08-04）

### 范围

- 本次只处理本地 `submission-service` 台湾 runner、台湾 focused tests 与本 worklog。
- 未访问台湾官网，未登录，未创建或重试 `runner_job`，未改 DB/env，未部署，未提交或付款。
- 未改前端 completeness / long-form 文件。

### 事实核对

- 既有协调记录与用户/官网证据均显示：台湾申请表邮箱验证入口在点击 `寄送驗證碼` 前存在图形 CAPTCHA。
- 既有最终提交 CAPTCHA 逻辑位于 `src/tw/captcha.ts`，会点击官方 `確認資料`；本次不能复用该最终提交函数。
- 现有真实 CAPTCHA 形态使用 `/coa-frontend/captcha` 图片、`input#captchaToken` / placeholder `請輸入驗證碼`、刷新 `換下一組`；本次发送前 CAPTCHA 使用同一图形 CAPTCHA 低层 selector，但只点击 `寄送驗證碼`。

### 改动

- `viza-be/submission-service/src/tw/captcha.ts`
  - 新增独立 `solveTwEmailCaptchaAndSendCodeWithRetry()` / `solveTwEmailCaptchaAndSendCodeOnce()`。
  - 使用 shared `solveImageCaptcha()` 与 `reportBadCaptcha()`；不打印、不持久化 CAPTCHA 明文。
  - 顺序：发现发送前 CAPTCHA → 截图给 shared CAPTCHA client → 填 `captchaToken` → 只点击 `寄送驗證碼`。
  - 若验证码错误且 CAPTCHA 仍可见，有限重试并上报 bad captcha；无 CAPTCHA 时兼容直接点击寄送。
  - 未调用 `solveTwCaptchaAndSubmitWithRetry()`，不查找/点击 `確認資料`。
- `viza-be/submission-service/src/tw/apply.ts`
  - `verifyTwEmail()` 改为：填 email → 记录 `sentAfter` → 发送前 CAPTCHA solve+send → 等待该时间之后的 OTP → 填 OTP → 点击 `驗證`。
  - 最终 CAPTCHA / `確認資料` 逻辑保持原位置不变。
- `viza-be/submission-service/src/tw/auth.ts`
  - 台湾申请邮箱改为专用配置：`TW_ENTRY_PERMIT_EMAIL` + `TW_ENTRY_PERMIT_IMAP_PASSWORD`。
  - `TW_ENTRY_PERMIT_IMAP_HOST` / `TW_ENTRY_PERMIT_IMAP_PORT` 可配置；缺失时安全回退通用 `IMAP_HOST` / `IMAP_PORT`。
  - 不复用通用 `IMAP_EMAIL` / `IMAP_PASSWORD` 作为台湾邮箱凭据；缺专用 email 或专用 password 时 fail closed。
  - OTP provider 直接用现有 IMAP 基础设施读取该专用邮箱，不再按 haggstorm alias 查询 `inbound_email`。
  - 只匹配寄送动作之后、官方 `immigration.gov.tw` 发件域、台湾系统验证主题、正文明确验证码标签；保留 mixed-case OTP 原值。
- `viza-be/submission-service/src/queue/halt-runners.ts`
  - 台湾 runner 不再生成 `tw-*@haggstorm.com` / application alias。
  - 改为读取 `resolveTwEntryPermitEmail()`；配置缺失时转换为 `NeedsHumanError` 安全停止。
- `viza-be/submission-service/src/tw/__tests__/auth.spec.ts`
  - 覆盖专用台湾 email env、专用 IMAP password fail-closed、post-send IMAP OTP 匹配、脱敏。
- `viza-be/submission-service/src/tw/__tests__/compliance.spec.ts`
  - 覆盖 email CAPTCHA 顺序、发送前 CAPTCHA 与最终提交 CAPTCHA 分离、重试/脱敏/无 CAPTCHA 兼容的静态边界。

### 验证

- `node --import tsx --test src/tw/__tests__/*.spec.ts`
  - 47 tests passed。
- `npm run type-check`
  - passed。

### 边界 / 未执行

- 未写入真实 `TW_ENTRY_PERMIT_EMAIL` 或任何邮箱密码；源码/测试/worklog 均未包含用户指定真实 Gmail 或密码。
- 未访问官网验证 selector live 状态；仍需授权操作员在受控环境执行真实 smoke。
- 未部署，不能声称 production 已更新。

## 邮箱方向校正：恢复 generated alias + inbound_email（2026-08-04）

### 最新事实

- 用户再次校正：台湾官网应填写自动生成邮箱，不应填写后台接收/管理 Gmail。
- 只读 DB 证据显示 `viza.it.com` 已有近期 `inbound_email`，包含生成式 `appl-*` 别名且 MX 正常；说明新域 alias → `inbound_email` 链路已工作。
- `nanan...` 类后台管理邮箱不应写入官网，也不应由 Taiwan runner 直连 IMAP。

### 本次校正

- 撤销上一段“台湾专用 Gmail / TW_ENTRY_PERMIT_IMAP_PASSWORD / 直连 IMAP”方向。
- `viza-be/submission-service/src/tw/auth.ts`
  - 恢复按 `input.email` generated alias 查询 `inbound_email`。
  - 保留 `sentAfter`，只读取点击 `寄送驗證碼` 之后到达的邮件。
  - 继续使用台湾 parser：官方 `immigration.gov.tw` 发件域、台湾系统验证主题、正文明确验证码标签、mixed-case 原样。
- `viza-be/submission-service/src/queue/halt-runners.ts`
  - 恢复 `twApplicationInboxAlias(applicationId)`，但 alias domain 改为 env-driven：
    - `TW_ENTRY_PERMIT_ALIAS_DOMAIN`
    - `VIZA_MANAGED_INBOX_DOMAIN`
    - fallback：`viza.it.com`
  - 移除 `haggstorm.com` fallback。
- `viza-be/submission-service/src/tw/captcha.ts`
  - 邮箱发送前 CAPTCHA 修复保留：解图形 CAPTCHA 后只点击 `寄送驗證碼`，不复用/不触发最终 `確認資料` CAPTCHA 函数。

### 验证

- `node --import tsx --test src/tw/__tests__/*.spec.ts`
  - 45 tests passed。
- `npm run type-check`
  - passed。
- 源码扫查：
  - 台湾 runner/source 已无 `TW_ENTRY_PERMIT_EMAIL`、`TW_ENTRY_PERMIT_IMAP*`、`resolveTwEntryPermitEmail`、`waitForTwVerificationCodeFromImap`。
  - 台湾 runner/source 已无 `haggstorm.com` fallback；`twApplicationInboxAlias()` fallback 为 `viza.it.com`。
  - 台湾 OTP provider 使用 `inbound_email`，并按 `sentAfter` 过滤寄送动作之后的邮件。

### 边界

- 未改 production env、DB、部署。
- 未进入台湾官网，未创建/retry runner_job，未执行 live 流程，未最终提交。

## birth_place_mainland_region options 修复准备（2026-08-13）

### 只读核验

- production `TW_ENTRY_PERMIT / birth_place_mainland_region` 当前为 `required select`，`conditional_logic` / `validation_rules` 存在，但 `options = NULL`。
- seed `BIRTH_PLACE_MAINLAND_OPTIONS` 为 49 项 canonical option，包含 `北京`；每项结构为 `value/text/label_zh/official_label` 同值。
- 官方 DOM 合同仍为 `traveller.birthPlace1`，该字段是 `birth_place_is_mainland === mainland` 分支。

### 本地改动

- 新增 `viza-be/agent-backend/drizzle/0131_tw_birth_place_mainland_region_options.sql`
  - 仅更新 `public.visa_form_fields` 中 `visa_type='TW_ENTRY_PERMIT' AND field_name='birth_place_mainland_region'` 的 `options`。
  - 不改答案、材料、队列、runner job、document requirements 或其他字段。
- 更新 `viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts`
  - 回归锁定 0131 只触碰该字段 options。
  - 从 seed 解析 49 项 canonical set，并断言 migration JSON 与 seed parity。
  - 断言包含 `北京`、value 去重、官方 DOM/source 合同不变。

### 前端 fail-closed 接口请求

- 建议交给前端负责人：动态表单遇到 required/select 且 `options` 为 `NULL` 或空数组时，应显示“字段配置缺失，请联系支持/稍后重试”的配置错误状态，而不是渲染空白下拉并卡住用户。
- 本次未修改 shared frontend、结果卡/API 或 B 当前占用文件。

### 验证

- `npm run test -- src/tests/tw-entry-permit-schema.test.ts`
  - passed，17 tests passed。
  - 首次沙箱内运行因 Vitest 需要写临时 bundled config 文件被 `EPERM` 阻止；同命令经本地测试写入权限重跑通过。
- `npm run type-check`
  - passed。
- `git diff --check -- viza-be/agent-backend/drizzle/0131_tw_birth_place_mainland_region_options.sql viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts docs/taiwan-launch-worklogs/TW-A.md`
  - passed。

### 边界

- 未执行 migration，未写 production DB，未 seed，未部署。
- production 执行 `0131` 必须由主协调另行向用户取得批准。

## production 0131 migration 执行结果（2026-08-13）

### 执行前复核

- `npm run test -- src/tests/tw-entry-permit-schema.test.ts`
  - passed，17 tests passed。
- `git diff --check -- viza-be/agent-backend/drizzle/0131_tw_birth_place_mainland_region_options.sql viza-be/agent-backend/src/tests/tw-entry-permit-schema.test.ts docs/taiwan-launch-worklogs/TW-A.md`
  - passed。

### production 执行

- 已在 production Supabase project 执行 migration：
  - `0131_tw_birth_place_mainland_region_options`
  - recorded version: `20260813002516`
- 只执行此 migration；未 seed、未部署、未创建/retry runner_job、未访问官网。

### 只读核验

- `TW_ENTRY_PERMIT / birth_place_mainland_region`
  - `field_type = select`
  - `required = true`
  - `options` 为 JSON array。
  - `options_count = 49`
  - 包含 `北京`。
  - 每个 option 均含 `value/text/label_zh/official_label`。
- metadata：
  - `conditional_logic.showIf = birth_place_is_mainland === mainland`
  - `validation_rules.required_when = birth_place_is_mainland === mainland`
  - `validation_rules.official_dom_name = traveller.birthPlace1`
  - `validation_rules.branch_for = birth_place_is_mainland === mainland`
  - `validation_rules.source = BIRTH_PLACE_MAINLAND_OPTIONS`
  - 上述关键 metadata 均保持正确。
- 影响范围：
  - 全表 exact 0131 options JSON 仅出现在 `TW_ENTRY_PERMIT/birth_place_mainland_region`。
  - 未发现其他 package/field 获得该 options 集合。

### 边界

- 未读取或输出申请人资料。
- 未修改其他 production 数据。
