# VIZA — 已建模块清单（截至 2026-05-06）

VIZA SaaS 平台已建工作的模块化清单。**不含浏览器扩展**（扩展单独追踪）。

---

## 总览数字

- 总 commit：167（Edward 署名 159，95.2%）
- 开发周期：2026-03-25 → 2026-05-06（约 6 周）
- TypeScript 总行数：97,080（前端 55,766 + agent 后端 16,250 + submission service 25,064）
- SQL migrations：44 条（1,590 行）
- 各国 seed 脚本：27 个
- 已建 schema 国家：30 国
- 文档：65 篇 markdown
- shadcn/ui 组件：36 个
- PRD 故事：235 条（130 已交付 + 105 待办）

---

## 一、前端交互采集

### 1. 智能动态表单 (Smart Dynamic Form)
**描述**：把官方签证表单拆为步骤化向导（Stepper）。一引擎驱动 30 国 schema 渲染，含分支、条件门、多目的子流程、枚举选项。新增国家不写新 UI 代码。
**作为用户**：我希望分步骤填写信息，而不是面对一整页密密麻麻的表格感到焦虑。
**仓库证据**：`viza-fe/internal-website/components/client/wizards/`、`components/application-steps/`、`app/client/application/long-form/`、`app/client/simplified-form/`。

### 2. 长 / 简表单双入口 (Long-Form vs Simplified-Form)
**描述**：同一份规范答案集，两条填法路径。新手走简表单最小必填、老手走长表单一次填全，最终落同一 `application_answers` 表。
**作为用户**：我希望按熟练度选填法，不被迫走最长路径。
**仓库证据**：`app/client/application/long-form/`、`app/client/simplified-form/`、`app/client/simplified-form/review/`。

### 3. 双语对照核对页 (Bilingual Review Page)
**描述**：提交前左右分屏：客户原始填写 + 系统生成的英文/官方格式版本。客户最终核对拼音、日期格式、地址译名。
**作为用户**：我需要在最终提交前直观核对信息被准确翻译成官方格式。
**仓库证据**：`app/client/simplified-form/review/`、`viza-be/submission-service/src/translation-gate.ts`。

### 4. 引导式自我介绍 (About-Me Onboarding / Companion)
**描述**：把"填表"包装成"对话"。客户自然语言聊一段，系统抽出结构化字段写入答案集。
**作为用户**：我不想直接面对一堆字段，希望像聊天一样把基本信息交代清楚。
**仓库证据**：`components/client/about-me/`、`components/client/companion/`、`app/client/about-me-form/`、`app/client/about/`、`app/client/onboarding/`。

### 5. 电子签名工作流 (E-Sign Workflow)
**描述**：浏览器内对申请文件电子签名，含审计轨迹（IP、时间、文件哈希），与提交 orchestrator 已对接。
**作为用户**：我希望签字这一步在网页内完成，不用打印扫描回传。
**仓库证据**：`app/client/signing/[applicationId]/page.tsx`、`components/client/signing/`、`app/actions/`。

### 6. 护照扫描自动填表 (Passport Scan & OCR)
**描述**：客户上传护照首页，服务端 OCR 提取姓名、护照号、有效期、国籍、生日，自动写入答案集。
**作为用户**：我希望传张护照照片就能填好一半表格。
**仓库证据**：`app/api/passport-scan/extract/route.ts`。

---

## 二、设计系统

### 1. 品牌 token 设计系统 (Brand Token System)
**描述**：所有组件强制走 `brand-*` 设计 token，无原生 hex。设计/实现解耦：换主题不改业务代码。
**作为团队**：保证视觉一致 + 可主题化 + 后期能换皮。
**仓库证据**：`viza-fe/internal-website/frontend.md`（设计规范）、`tailwind.config.ts`、`components.json`、CLAUDE.md 内强制规范条款。

### 2. shadcn/ui 组件库定制 (Customized shadcn/ui Library)
**描述**：基于 shadcn/ui 定制 36 个底层组件（Button / Input / Select / Dialog / Toast 等），与 brand token 对齐。
**作为团队**：UI 拼装速度快，新页面基本组装现有 primitive。
**仓库证据**：`components/ui/` 36 个 `.tsx` 文件、`components.json` 配置。

### 3. 响应式 Web 门户 (Responsive Web Portal)
**描述**：Next.js 16 App Router + React 19。43 个 page 路由、68 个 app 目录。客户/管理员/员工三套界面在同一域名下。
**作为用户**：我希望从手机到桌面访问体验一致。
**仓库证据**：`viza-fe/internal-website/app/`、55,766 行 TS。

---

## 三、AI 辅助引擎

### 1. AI 伴随式辅导员 (AI Co-Pilot)
**描述**：填表页旁实时聊天 agent。按当前字段（如"宗教信仰"、"出入境口岸"、"近 10 年访问国家"）给示范答案、官方雷区、常见拒签理由。Socket.IO `/visa` 命名空间持久化每会话。
**作为用户**：对生僻问题不知所措时，希望 AI 直接告诉我标准答案。
**仓库证据**：`viza-be/agent-backend/src/agent/`、`src/socket/`、`app/client/chat/`、migration `0008_user_chat_sessions.sql`。

### 2. 用户隔离工具注册表 (UserScopedToolRegistry)
**描述**：每次 LLM 工具调用按申请人 ID 绑定，构造上无法跨租户读数据。所有 agent 工具走这套注册表。
**作为系统**：A 用户的 AI 不应读到 B 用户的护照号。
**仓库证据**：`viza-be/agent-backend/src/agent/`、CLAUDE.md 强制规范。

### 3. 多模型 LLM 集成 (Multi-Provider LLM)
**描述**：同时接 Anthropic Claude、Google Gemini、OpenAI、Google Cloud Translate。不同任务走最合适的模型（聊天用 Claude、批量翻译走 Translate API、备援走 OpenAI）。
**作为系统**：不被单一供应商绑死，按成本和能力路由。
**仓库证据**：`@anthropic-ai/sdk`、`@google/generative-ai`、`openai`、`@google-cloud/translate` — 见 `viza-be/agent-backend/package.json`。

### 4. LLM Eval 框架 (LangSmith + agentevals + openevals)
**描述**：agent 输出有自动评估管线，跟踪回答质量、响应延迟、token 成本。
**作为团队**：不靠手感判断 AI 是否变差，跑评估集对比。
**仓库证据**：`viza-be/agent-backend/package.json` 内 `langsmith`、`agentevals`、`openevals`。

### 5. 多脚本翻译规范化 (Translation Gate)
**描述**：把客户用中/韩/日/俄/阿文等填写的姓名、地址、雇主名按目标官方表单要求规范化（拼音、Hepburn、Latin transliteration）。
**作为系统**：客户不该被强迫先翻译再填，后端自动完成。
**仓库证据**：`viza-be/submission-service/src/translation-gate.ts`、`application_translations` 表（migration `0009`）。

---

## 四、底层核心服务

### 1. 30 国 Schema 引擎 (30-Country Schema Engine)
**描述**：动态表单的基石。`visa_form_fields` 表 + per-country seed 脚本。schema 含字段 ID、标签、必填、选项集、条件门、子流程分块。新增国只需写一份 seed。
**作为系统**：30 国靠数据驱动，不是 30 份硬编码 UI。
**仓库证据**：migration `0003_visa_form_fields.sql`（基石表）、`migration 0010-0042`（每国 package）、27 个 `seed-{cc}-{visa-type}-form-fields.ts`。
**已建国家**：US (DS-160 200+ 字段) / UK (11 目的子流程) / Schengen (FR/IT/CH/DE/ES 五国共用) / VN / AU / JP / ID / KR / EG / TH / MY / SG / HK / MO / NZ / RU / TR / AE / CA / MV / PH / KH / LA / LK / ZA / IN (110 字段、7 变体)。

### 2. 申请答案规范层 (Canonical Answer Set)
**描述**：所有客户填写最终落到 `application_answers`。submission service 是唯一读者。前端两种填法 + AI 抽取 + OCR 自动填都汇到这里。
**作为系统**：UI / AI / Runner 互不耦合，都信这一张表。
**仓库证据**：migrations `0007`、`0009`。

### 3. RAG 签证政策知识库 (RAG Knowledge Base on pgvector)
**描述**：用 pgvector + RAG 让 AI 答之前先检索官方文档片段。确保建议贴合目标国当前最新政策，不胡编。
**作为系统**：每个 AI 答案应可溯源到官方文件。
**仓库证据**：`viza-be/agent-backend/scripts/ingest-ds160-rag.ts`、`scripts/ingest-faqs.ts`、`knowledge-base/`、`research/`、Supabase pgvector 扩展。

### 4. 凭据加密边界 (Credential Cipher)
**描述**：portal 登录、2captcha key、申请人提交账户的明文只在受控边界内出现。
**作为系统**：DB 泄漏不应等于全租户凭据泄漏。
**仓库证据**：`viza-be/submission-service/src/secret-cipher.ts`。计划升级 Supabase Vault（PRD SECRETS-001）。

### 5. 工件持久化 (Artifact Storage)
**描述**：runner 每次跑的截图、HAR、PDF、客户上传文档全部持久化到 Supabase Storage，带签名 URL 给员工台调阅。
**作为系统**：失败可回放、客户可审计、客服可调证。
**仓库证据**：`viza-be/submission-service/src/artifact-storage.ts`、migration `0016_submission_artifacts_bucket.sql`。

### 6. RLS 隔离层 (Row-Level Security)
**描述**：所有 PII 表（applications / application_answers / profiles / chat_sessions）开 RLS，每条查询自动按 `auth.uid()` 过滤。`createAdminClient()` 是受控提权点，前端不可导入。
**作为系统**：DB 直连访问也保证客户间隔离。
**仓库证据**：migration `0002_enable_rls.sql`、`viza-fe/internal-website/lib/supabase/admin.ts`。

### 7. PDF 生成与拼装 (PDF Composition)
**描述**：纸质签发流程（JP / KR / SG / HK / MO 等）需要把答案拼装成可填可打印 PDF。`pdf-lib` 集成。
**作为系统**：纸质国家也有提交产物，员工台可下载寄送。
**仓库证据**：`pdf-lib` 依赖、submission-service PDF 拼装代码。

---

## 五、提交自动化（最后一公里）

### 1. 全自动提交引擎 (Auto-Submit Engine)
**描述**：Playwright + stealth 驱动签证官方网站。从答案集出发，自动登录、填表、过校验、解 CAPTCHA、收 OTP，停在客户授权检查点（签字 / 付款 / 提交确认）。
**作为用户**：核对完数据后，希望系统替我应付难用的官方系统和验证码。
**仓库证据**：`viza-be/submission-service/`（25,064 行 TS）、`src/stealth-browser.ts`。15 国模块：`ceac/`（US Phase 4）、`france-visas/`（Schengen Phase 4）、`au-visitor/`（AU Phase 3）、`vietnam/`（VN Phase 3）、`uk/`（Phase 2）、`egypt/`、`italy-vfs-cn/`、`kh/`、`la/`、`lk/`、`za/`、`in/`（Phase 1 recon）。
**DS-160 专项**：`ceac/` 含 24 个文件，三件套审计（`ds160-completeness-verify.ts`、`ds160-coverage-audit.ts`、`ds160-derive-answers.ts`）保证与官方表单 100% 对齐。

### 2. CAPTCHA 解决器 (CAPTCHA Solver)
**描述**：2captcha 集成 + 重试 + 预算记账。reCAPTCHA、image CAPTCHA 通用。
**作为用户**：政府网站那些扭曲文字图我看不清，希望系统替我搞定。
**仓库证据**：`viza-be/submission-service/src/captcha/`、`ceac/start-page-captcha.ts`。

### 3. 邮箱 OTP 轮询 (Email OTP Poller)
**描述**：portal 发 OTP / 验证邮件后，runner 自动从指定邮箱抓 6 位码或确认链接回填。当前 IMAP 实现，下一版迁 Cloudflare Email Workers + per-applicant 别名（PRD INBOX-* 轨）。
**作为系统**：客户不应被要求"赶紧打开邮箱手抄"，自动化应包含邮件环节。
**仓库证据**：`viza-be/submission-service/src/email/`、commit `d510b54`。

### 4. Portal Recon Walker (Portal Reconnaissance)
**描述**：通用走器先抓 portal 页面图、selector、跳转规则、错误模式，再写完整 runner。最近一周用 recon 一次性搭起 KH/LA/LK/ZA/IN 五国骨架。
**作为系统**：每加一国不该是从零写 Playwright，应有可复用探路工具。
**仓库证据**：`viza-be/submission-service/src/recon/`；commits `cbd4baa`、`527ba45`、`cfceab2`。

### 5. 提交结果与状态追踪 (Submission Result Store)
**描述**：每次 runner 跑结果（成功 / 停在某检查点 / 失败原因）落 `submission_results`。员工台可查每申请当前在哪一步、上次截图、引用号。
**作为用户**：我希望在一个页面就能看到我的签证审核进度。
**仓库证据**：migration `0015_submission_results.sql`、`src/submission-result.ts`、`result-writer.ts`。

### 6. 失败告警路由 (Alert Router)
**描述**：runner 失败、portal 改版、CAPTCHA 失败、anti-bot 触发等事件按严重度分级路由告警。
**作为系统**：上线后任何 runner 异常应有人响应。
**仓库证据**：`src/alert.ts`。

---

## 六、运营控制台

### 1. 管理员仪表盘 (Admin Dashboard)
**描述**：员工/管理员看每个申请人的状态、订单、套餐、Cal 预约、产品/服务清单。
**作为运营**：在一个页面看清所有客户和当前状态。
**仓库证据**：`app/admin/(dashboard)/{patients,products,users,orders,cal-bookings}/`。

### 2. 客户聊天通道 (Client Chat Channel)
**描述**：客户在门户内直接与 AI agent + 员工聊天。Socket.IO `/visa` 命名空间，会话持久化，员工可介入。
**作为用户**：有问题直接在网站里问，不用发邮件等回复。
**仓库证据**：`app/client/chat/`、`app/api/chat/`、`app/api/chat/save-block/`、agent-backend `src/socket/`。

### 3. 客户文档库 (Client Document Library)
**描述**：护照、照片、银行流水、邀请函等按申请聚合。员工可查、可标注。
**作为用户**：所有上传资料集中一处管理。
**仓库证据**：`app/client/documents/`、对应 server action。

### 4. 鉴权与会话 (Auth & Session Management)
**描述**：Supabase Auth（JWT + RLS）。含登录、注册、密码重置、邮箱验证、impersonate（员工代客户登录调试）等流。
**作为系统**：员工应能在客户授权下代登录排错，不靠共享密码。
**仓库证据**：`app/auth/{callback,client-callback,impersonate-callback,reset-password}/`、`app/login/`、`app/forgot-password/`、`app/api/client/session/`。

---

## 七、部署与基础设施

### 1. 前端：Vercel 部署 (Vercel — Frontend)
**描述**：Next.js 客户/管理员/员工门户跑在 Vercel。Edge Functions、ISR、preview deployments per branch。
**作为团队**：每条 PR 自动有 preview URL，前端验证不依赖本机环境。
**部署位置**：Vercel project 关联 `viza-fe/internal-website/`。

### 2. AI / Agent 后端：Railway 部署 (Railway — Agent Backend)
**描述**：Express + Socket.IO + Anthropic SDK + RAG 服务跑在 Railway。常驻 WebSocket 连接，per-region container。
**作为团队**：聊天会话需常驻服务，Vercel 不合适，Railway 是合适的承载。
**部署位置**：Railway service 关联 `viza-be/agent-backend/`。

### 3. 数据库 & 存储：Supabase (Supabase Stack)
**描述**：单一 Supabase 项目承载 Postgres（含 pgvector 扩展）、Auth（JWT）、Storage（工件桶）、Realtime（聊天广播）、RLS（隔离）。
**作为团队**：DB / Auth / Storage / Realtime 四件套同一栈，运维面收敛。
**仓库证据**：所有 migration 走 Supabase；`viza-fe/internal-website/lib/supabase/`、`viza-be/agent-backend/src/db/supabase-client.ts`。

### 4. DNS & 邮件：Cloudflare (Cloudflare DNS + Email)
**描述**：`haggstorm.com` DNS 由 Cloudflare 托管。计划接 Cloudflare Email Routing + Email Workers 做 per-applicant 虚拟邮箱（PRD INBOX-* 轨）。
**作为团队**：每个申请人有独立 `appl-{id}@haggstorm.com` 别名，OTP 入站可程序化处理。

### 5. CAPTCHA 服务：2captcha (2captcha Service)
**描述**：第三方 CAPTCHA 解付费服务。接入含重试、预算记账。
**仓库证据**：`viza-be/submission-service/src/captcha/`。

### 6. Drizzle 迁移流水线 (Drizzle Migration Pipeline)
**描述**：Schema 变更走 Drizzle 生成的 SQL migration，按序编号，幂等可重复跑。`db:generate` / `db:push` / `db:migrate` 脚本对接本地 + 生产。
**作为团队**：schema 漂移有版本化记录，回滚有依据。
**仓库证据**：`viza-be/agent-backend/drizzle/0001_…0042_*.sql`、`scripts/seed-*.ts`、`drizzle-kit` 配置。

### 7. 测试体系 (Test Infrastructure)
**描述**：Vitest 跑单元 + 集成 + 覆盖率。提交服务有 smoke 测试 + e2e 测试（`ceac/_e2e.ts`）。
**作为团队**：CI（待）跑前先本地 typecheck + test。
**仓库证据**：`viza-be/agent-backend/src/tests/{unit,integration}/`、`vitest` 依赖、`viza-be/submission-service/src/ceac/_e2e.ts`、`smoke.ts`。

---

## 八、工程方法论

### 1. PRD 自治环 (PRD-Driven Autonomous Loop)
**描述**：用 Ralph 风格 agent 控制环驱动建造。`prd.json` 是唯一权威工单（235 故事），`progress.txt` 是规范执行日志（1281 行），`/loop` 取最高优先级 `passes: false` 故事，实现 → typecheck → commit → 标 pass → 追加 progress。
**作为团队**：单作者高速建造靠纪律，不靠英雄主义。
**仓库证据**：根 `prd.json`、`progress.txt`、根 `CLAUDE.md` + `.claude/CLAUDE.md`。

### 2. 文档先行 (Docs-First)
**描述**：每国先写 `scope.md`（官方源 + 范围合同 + 分支目录）+ `gap-report.md`（gap + deferred + runner 准备度），再写代码。每个功能级 PRD 都有对应 `docs/prd-*.md`。
**作为团队**：写不出 scope 和 gap 就先别写代码。
**仓库证据**：`/docs` 下 65 篇 markdown — 30 × 2 国别文档 + 7 篇功能 PRD + 横切方法论 `docs/visa-schema-playbook.md`。

### 3. 模式抽取与复用 (Pattern Extraction)
**描述**：30 国建造期间抽出可复用模式 — Asia-tourist 8 段模板、9 段 Sponsor extension、UK + IN 共用的多目的子流程、瘦 7 段入境-only、`||` partner 门、健康申报块、多变体 `visa_type_requested`。
**作为团队**：模式越多，下一国越便宜。
**仓库证据**：`progress.txt` 内 2026-04-29 各国学习总结、30 个 `docs/{country}-visa-{scope,gap-report}.md`。

---

*生成于 2026-05-06，所有声明可经 `git log`、`find`、文件直读三件套验证。*
