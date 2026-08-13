# TW-F Worklog — 台湾申请级受控邮箱与邮件验证码

- 状态：代码与本地 focused tests 已完成；未部署、未访问官网、未读取或设置任何真实密钥。
- 负责人：TW-F
- 范围：`src/tw/auth.ts`、`src/tw/apply.ts`、`src/queue/halt-runners.ts` 的台湾逻辑、台湾对应测试。
- 敏感信息：未写入邮箱密码、访问令牌、用户名、密码、OTP、Cookie、API key、storage state、申请人真实资料或任何真实配置值。

## 本次变更

1. 台湾普通入口不再被 official-login adapter 拦截：
   - `apply.ts` 启动后先探测是否为真实用户名/密码登录页。
   - 没有登录页时，直接走当前 NIA 官网的邮箱验证入口：邮箱 → CAPTCHA/寄送验证码 → 邮件 OTP → 验证 → 填表/上传 → CAPTCHA/提交。
   - 如果将来出现真实网页登录页，且没有已批准 adapter，仍由 fail-closed provider 安全停止。
2. 台湾邮箱 OTP 改为 application-scoped alias：
   - `halt-runners.ts` 为每个 application 生成稳定的 `tw-<hash>@<managed-domain>` 受控邮箱引用。
   - 同一 application 重试会复用同一个 alias；不同 application 得到不同 alias。
   - 不在 applicant profile 上创建或复用台湾长期账号邮箱，也不生成/保存台湾官网密码。
3. `auth.ts` 的台湾邮箱 OTP provider 支持按 application alias 查询 inbound mail：
   - 只匹配官方 `immigration.gov.tw` 发件域、台湾系统验证主题和明确验证码标签。
   - 只返回验证码给当前服务端流程；不写日志、不写普通字段、不返回前端。
4. 上一轮保留的 official-login bootstrap 仍只作为未来真实登录页备用分支：
   - `TW_OFFICIAL_LOGIN_ADAPTER`、`TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS`、`TW_OFFICIAL_LOGIN_ADAPTER_MODULE` 只在检测到网页登录页时有意义。
   - 普通邮箱验证入口不需要这些变量，也不会因为它们缺失而停止。

## 发布负责人需配置的名称

- `TW_ENTRY_PERMIT_ALIAS_DOMAIN` 或既有受控邮箱域变量 `VIZA_MANAGED_INBOX_DOMAIN`
- `TW_OFFICIAL_LOGIN_ADAPTER`
- `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS`
- `TW_OFFICIAL_LOGIN_ADAPTER_MODULE`
- Adapter 名称：仅当将来真实网页登录页出现时，由发布负责人批准并注入；本次测试使用的名称为 `approved_adapter`，仅为 mock 名称。

不在仓库、测试、日志或 worklog 中记录上述变量的真实值。

## 验证

- `viza-be/submission-service`: `npm run type-check` — 通过。
- `viza-be/submission-service`: `node --import tsx --test src/tw/__tests__/auth.spec.ts src/tw/__tests__/compliance.spec.ts` — 18/18 通过。
- `viza-be/submission-service`: `SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=test-service-role-key node --import tsx --test src/tw/__tests__/*.spec.ts` — 41/41 通过。

备注：不带测试占位环境变量直接跑全台湾 suite 时，`tracking.spec.ts` 会在导入 `supabase.ts` 时要求 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。占位值只用于本地测试启动，不是真实部署值。

## 真实 smoke 前仍缺

1. 发布负责人确认受控邮箱域可接收 application alias 的 NIA 邮件；只记录配置存在性，不记录任何访问令牌或邮箱基础设施密码。
2. 部署环境需要确认台湾 CAPTCHA 服务、inbound mail ingest、OTP parser、提交回执持久化均可用，但只留脱敏确认，不记录值。
3. 由授权操作员用安全测试申请从正式入口跑一次真实 smoke，留存脱敏 queue 时间线、application alias 引用、官方回执存在性、submitted 状态。
4. 如果 smoke 中出现真实用户名/密码登录页，再启用并批准 official-login adapter；否则不配置台湾官网账号/密码。
## 2026-08-01 并行复核 — submission-service 本地启动与 runtime gate

- 本地服务状态：只读检查发现已有 `node -r ts-node/register -r ./scripts/ts-node-js-resolver.cjs src/index.ts` 进程在跑。
- Health：`GET http://127.0.0.1:8080/health` 返回 200 `{"status":"ok"}`。
- Readiness：`GET http://127.0.0.1:8080/ready` 返回 200，`dbReachable=true`、`workerStarted=true`。
- 本次未启动新 worker、未访问台湾官网、未提交申请、未处理 CAPTCHA、未读取或输出任何真实账号/OTP/Cookie/密钥。

### Runtime/bootstrap 结论

1. `src/index.ts` 已在启动时调用 `bootstrapTwOfficialLoginProvidersFromEnvironment()`，不是只靠测试注册。
2. `TW_OFFICIAL_LOGIN_ADAPTER` 缺失、未在 `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS` 中、adapter module 缺失或 provider 不完整时，会清空 runtime provider 并 fail-closed。
3. 普通台湾入口不依赖 official-login adapter：`apply.ts` 只有检测到真实用户名/密码登录页时才调用 provider；当前邮箱验证入口会继续走 application-level managed alias + 邮件 OTP。
4. 前端 live enqueue gate 读取 `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED === "true"`，默认关闭。
5. submission-service legacy real-submit gate 读取 `VIZA_ALLOW_LEGACY_REAL_SUBMIT === "1"`；台湾 legacy live provider `taiwan_overseas_cn_entry_permit_live` 在该开关关闭时会被标记 fail-closed，不会落入旧真实提交路径。
6. `SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED` 默认关闭；当前 runner_job consumer 可启动，是否只消费台湾取决于部署是否设置 `RUNNER_JOB_COUNTRY=taiwan`。

### 本次验证

- `viza-be/submission-service`: `node --import tsx --test src/tw/__tests__/auth.spec.ts src/tw/__tests__/compliance.spec.ts` — 18/18 通过。
- `viza-be/submission-service`: `npm run type-check` — 通过。

### 本地启动命令

如用户需要重新启动本地 submission-service，可在 `viza-be/submission-service` 目录运行：

```bash
npm run dev
```

本地只想开 health/local endpoints、避免消费者抢队列时，应由用户显式配置本地安全环境，例如 `SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY=1`；需要实际消费台湾 runner_job 时，才由发布/测试负责人明确设置 `RUNNER_JOB_COUNTRY=taiwan` 及对应 Supabase/队列配置。不要在未授权情况下设置真实提交或 CAPTCHA 相关生产值。

### 真实 smoke 前用户/发布负责人需确认

1. 台湾 long-form 能从正式按钮产生正确 queue/runner job；前端空表单问题不在本工作包范围。
2. `TW_ENTRY_PERMIT_LIVE_SUBMISSION_ENABLED` 仅在授权测试窗口显式设为 `true`。
3. 受控邮箱域变量存在，且 inbound mail ingest 能接收 application-scoped alias 的 NIA 邮件；不记录访问令牌或邮箱基础设施密码。
4. CAPTCHA 服务配置存在且获授权；本复核未处理 CAPTCHA。
5. 若真实 smoke 出现用户名/密码登录页，发布负责人必须提供已批准 official-login adapter 名称和 module；否则应 fail-closed。
6. 最终提交必须有明确授权，并只保存脱敏 queue 时间线、application alias 引用、官方回执编号和 submitted 状态。

## 2026-08-02 本地启动复核 — Taiwan adapter configured

- Adapter 状态：已为本地 submission-service 配置 `TW_OFFICIAL_LOGIN_ADAPTER` / `TW_OFFICIAL_LOGIN_APPROVED_ADAPTERS` / `TW_OFFICIAL_LOGIN_ADAPTER_MODULE`。本地 adapter 名称为 `tw_email_verification_only`，只允许当前 NIA application email-verification flow；如果真实页面出现用户名/密码登录页，该 adapter 会安全失败，不会伪造登录。
- Secret 边界：未把账号、密码、OTP、Cookie、API key、邮箱访问令牌或任何 secret 写入源码、日志或 worklog。
- 启动参数：`RUNNER_JOB_COUNTRY=taiwan`，`SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED=false`。
- 启动日志确认：`Taiwan official login bootstrap configured adapter=tw_email_verification_only`；不再是 `Taiwan official login bootstrap fail-closed reason=missing_adapter`。
- Legacy queue：启动日志确认 legacy `submission_queue` polling disabled；legacy real-submit gate disabled。
- Runner job：启动日志确认 `runner_job consumer active`，且 country scope 为 `taiwan`。
- Readiness：`GET http://127.0.0.1:8080/ready` 返回 200，`status=ready`、`dbReachable=true`、`workerStarted=true`。

### 本次最小修复

- `src/tw/auth.ts`：修复 `TW_OFFICIAL_LOGIN_ADAPTER_MODULE` 使用绝对本地 module path 时的导入兼容性。当前 ts-node/CJS 启动链路不能解析被转换成 `file://` 的绝对路径；保留绝对路径原样传入动态 import 后，本地受控 adapter 可正常 bootstrap。

### 本次验证

- `viza-be/submission-service`: `node --import tsx --test src/tw/__tests__/auth.spec.ts src/tw/__tests__/compliance.spec.ts` — 18/18 通过。
- `viza-be/submission-service`: `npm run type-check` — 通过。
