# 台湾入境许可证（Taiwan Online Entry Permit）自动提交 — 实施方案

**状态：架构已定稿（第二版，见下方"架构修正"），等你确认这版改动后开始写代码。**

## 架构修正（重要，推翻了第一版"照抄 UK"的部分假设）

第一版方案假设台湾这条线要照抄 UK（`uk_accounts` 账号表 + `runner_job` 队列 + 44 页 resume）。实地看过真实官网、又去代码库里核查了"新加坡这条线到底是不是最新最推荐的模式"之后，发现代码库里其实有 **三套不同的接入模式**，需要重新选择：

1. **UK/France/US/AU 模式**（`runner_job` 表 + `src/queue/dispatch.ts` 的 `DISPATCH` 表 + `runner.ts` 导出 `runOne`，符合 `DispatchOutcome` 类型）——16 个"完整签证申请"国家在用，有持久账号（`uk_accounts`/`fv_accounts`）、可以跨天 resume。
2. **MDAC/TDAC/PH eTravel 模式**（`submission_queue` 表 + `src/index.ts` 里一个巨大的 `processDigitalArrivalCardLiveItem` switch，不走 `runOne` 契约）——这套是"数字入境卡"专用的，不需要账号，一次性单页表单，部分国家用 2captcha 自动过验证码。
3. **DS-160/France/Vietnam 的"live assisted"模式**（`*_live_manual_actions` 表 + heartbeat 字段）——更重的人机协同层，专门给风险更高、需要人工审核 diff 的场景用，这次用不上。

**台湾这条线最终决定：产品形态上属于第 1 类（这是一个会被移民署实际审核、核准后才付款的正式入出境许可申请，不是免费即时的入境卡通知），但实现上借用第 2 类的简洁性。** 具体：

- **不建 `tw_accounts` 表**——官网没有持久账号模式，就是"打开→填完→送出→拿案号"的单次连续 session（跟 MDAC 一样），不需要跨天恢复，所以不需要存加密密码/resume_url。真的需要持久化的只有：这次申请填到哪一步了、最后拿到的案号（暂存或收件号），这些放进现有的 `applications`/`submission_result` 通用字段即可，不需要新表。
- **接入方式走 `runner_job` + `queue/dispatch.ts` + `runner.ts` 导出 `runOne`**（第1类的契约），不去扩 `src/index.ts` 里那个 `ArrivalCardCode` union——因为把"台湾入境许可申请"硬塞进"数字入境卡"的分类里在语义上不对（入境卡是当场生效的免费通知，台湾这个是要审核+核准+另外付款的正式许可证申请），会让那个本来就很大的 `processDigitalArrivalCardLiveItem` 文件更难维护。这是"有没有更优雅做法"的取舍：优雅的做法是"产品分类归 UK 那一类的契约，实现细节借 MDAC 那一类的简单session"，而不是照抄某一类的全部。
- **状态命名**：`queue/types.ts` 里 `DispatchOutcome.outcome` 是写死的三选一 `"halted_before_pay" | "submitted_pending_pay" | "paper_ready"`，这是所有 `runOne` 实现共用的队列层通用状态，UK/France/AU halt 在这一层都统一映射成 `halted_before_pay`（即使他们各自真实卡住的原因不同）。台湾也照这个既有惯例，在队列层映射成 `halted_before_pay`；但在国家专属的 `TwSubmissionResult.status` 里用更准确的 `stopped_at_captcha`，跟 `UkSubmissionResult.status = "stopped_at_pay"` 是同一个设计模式（队列层统一记账，国家层保留真实语义）。
- **验证码——刻意跟 MDAC 不一样**：MDAC/TDAC 会自动解验证码（滑块几何计算/2captcha）才停在最终送出前。台湾这条线**不接 2captcha、不解验证码**，填完所有栏位后直接停在验证码输入框，状态就是 `stopped_at_captcha`——这是你已经明确选定的边界，不因为"抄近的模式"而妥协。
- DB 改动缩减为：一条 `visa_packages` 目录行迁移（照抄 `0098_sg_arrival_card_package.sql`/`0100_mdac_tdac_arrival_card_packages.sql`/`0103_ph_etravel_arrival_card_package.sql` 的写法，序号定为 `0104_tw_entry_permit_package.sql`），不需要账号表迁移。

以下第 1-3 节是第一版内容，**除了"tw_accounts 表"和"账号模型"相关描述已被上面这段取代之外，其余（字段清单、页面结构、停止边界、验证码位置）仍然有效**，不用重复确认。

## 0. 卡住的前提条件（必须先解决，否则不会动手写填表逻辑）

- 你说的附件 `tw_entry_permit_fillable.html` **没有实际传到这次会话**（uploads 目录是空的）。请重新上传。
- 如果拿不到可导出的 fillable HTML，请改为提供：官网从头到尾每一页的截图（按顺序），或每页 view-source 保存的 html；如果流程需要先登录才能看到完整页面，麻烦给一个可用于探路的测试账号/流程说明。
- 在拿到真实材料前，我不会去猜测选择器、页面顺序、是否有付款步骤这些——一律来自你提供的材料，猜错了会在官网上产生真实的错误提交风险。

## 1. 已确认可复用的目标架构（来自 `docs/uk-auto-submit-plan.md` 与 `src/uk/*`、`src/france-visas/*` 的实测代码）

### Backend `viza-be/submission-service/src/tw/`（新增目录，逐一对照 `src/uk/`）

| 文件 | 对应 UK 文件 | 作用 |
|------|------|------|
| `selectors.ts` / `pages.ts` / `gates.ts` / `errors.ts` | 同名 UK 文件 | 页面识别 + 维护/限流/超时等异常检测框架 |
| `session.ts` | `uk/session.ts` | 用共享 `ceac/stealth-browser` 打开 TW 官网起始页 |
| `register.ts`（+ `register-captcha.ts` 如需要） | `uk/register.ts` | **待确认是否需要**：见分叉点 2 |
| `normalize.ts` | `uk/normalize.ts` | `normalizeTwAnswers()`：把 wizard 存的字段名/值翻译成 TW 表单 filler 期望的键/值；翻译不了就抛 `TwNormalizationError` |
| `page-bindings.ts` | `uk/page-bindings.ts` | `TW_PAGE_FILLERS` + `TW_PAGE_ORDER`，拿到真实页面结构后逐页对照编写 |
| `fillers.ts` | `uk/fillers.ts` | Playwright 填表原语（`twFillText`/`twFillDateSplit`/`twPickRadio`/`twSelectCountry`/`twPickCheckboxes`），命名照抄 UK 的模式 |
| `resume.ts` | `uk/resume.ts` | `resumeTwApplication()`：主循环沿 `TW_PAGE_ORDER` 逐页 `ensureOnSlug → filler → 下一步`，停在真正付款步骤前；**若确认无付款步骤，改为停在「最终确认/提交」前**，状态名待定（见分叉点 3） |
| `runner.ts` | `uk/runner.ts` | `export { runTwHalt as runOne } from "../queue/halt-runners.js"` |
| `diagnostics.ts` | `uk/diagnostics.ts` | 失败截图，复用 `tryCaptureScreenshot` 模式 |
| `proxy-egress.ts` | `uk/proxy-egress.ts` | **待确认是否需要**（见分叉点 5） |
| `country-iso3.ts` | `uk/country-iso3.ts` | 若表单有国家下拉才需要 |
| `__tests__/normalize.spec.ts` | `uk/__tests__/normalize.spec.ts` | 喂 wizard 形态答案，断言输出键值符合 filler 期望 |

`src/queue/halt-runners.ts` 新增 `runTwHalt`，形态与 `runUkHalt` 完全一致：
`loadProfileAndApp → loadRawAnswers → buildAnswerMap → normalizeTwAnswers → (若需要账号) loadTwAccount → resumeTwApplication → 结果映射为 halted_before_pay/stopped_at_pay 或等效状态`

`src/queue/dispatch.ts`（`LAUNCH_COUNTRIES`/`COUNTRY_ALIASES`/`DISPATCH`）与前端 `lib/queue/countries.ts` **必须同步**加 `taiwan` 别名与 dispatch 项（`docs/infra/queue.md` 里明确要求两侧联动，否则入队会在其中一侧校验失败）。

`src/country-submissions/registry.ts` 登记新条目（`mapperFiles`/`schemaFiles`/`notes`），供 `scripts/audit-bilingual-schema-clarity.ts` 审计。

### 数据库（Drizzle migration，新建，命名沿用 `0018_uk_accounts.sql` 之后的下一个序号）

`tw_accounts` 表，结构照抄 `uk_accounts`：

- `id UUID PK`
- `applicant_id UUID FK→applicant_profiles(id) CASCADE`
- `email TEXT`, `password_encrypted TEXT`（经 `secret-cipher.ts` 加密）
- `resume_url TEXT` — **若 TW 系统没有「账号+resume link」模式，此字段可能不需要，或整张表大幅精简**（见分叉点 2）
- `storage_state_json JSONB`, `last_authenticated_at TIMESTAMPTZ`
- `created_at`/`updated_at`，`UNIQUE(applicant_id, email)`
- RLS 比照 `uk_accounts`（`applicant_profiles.auth_user_id = auth.uid()`）

字段答案本身**不需要新表** —— 复用现有通用表 `visa_application_answers`（`field_name`/`value_text`/`application_id`），只需新增一份 seed 脚本 `agent-backend/scripts/seed-tw-entry-permit-form-fields.ts`（照抄 `seed-uk-standard-visitor-form-fields.ts`），列出 TW 表单需要的 `field_name` 清单，`normalize.ts` 的输出键必须与之一致。

### Frontend `viza-fe/internal-website/`

- `lib/visa-destinations.ts` 加一条 `taiwan` 目的地（卡片入口），例如 `visaType: TW_ONLINE_ENTRY_PERMIT`
- `components/client/wizards/tw/config.ts` — 新建 wizard，参照 `wizards/uk/config.ts` 的分步结构（复用 `shell/shared-steps/*` 组件：`StepGenericFields`/`StepPurposeCards`/`StepTripDates`/`StepFundingBlock`/`StepYesNoChecklist` 等）；字段键名**从一开始就对齐 `normalizeTwAnswers` 期望的 seed 键**，避免 UK 那种「wizard 键名与 filler 期望对不上」返工（UK 现在正在补的坑，见 `docs/uk-auto-submit-plan.md` 差距1）
- 新建 `TwResultCard.tsx`（照抄 `UkResultCard.tsx`），展示进度（`pagesFilled/totalPages`）、application reference、若需要人工登录付款的 `portalUrl` 入口
- wizard registry（`LAUNCH_WIZARD_CONTRACT`）加 taiwan 项

## 2. 你提供的草稿文件 — 定性 + 已查证的背景信息

你贴过来的 HTML 文件头部自己写明：**「本页仅为个人离线填写用的草稿表...本页不会连网...样式为中性设计，非官方网站版面」**。也就是说这不是从官网 view-source / 导出的真实 DOM，是你自己整理的字段备忘录（字段标题、选项文字、必填/条件逻辑是可信的内容依据，但**不是**真实的 HTML 标签/id/class/选择器/分页结构）。所以：

- **可以直接拿来用**：字段清单、必填/条件显示逻辑（如"第7题选是才出现42-44题"）、申报类别（5选1资格）、材料清单、亲属信息5组结构、在台联络地址拆成8个栏位——这些是设计我们自己 wizard 表单、写 `normalize.ts` 归一化目标键位的可靠依据。
- **不能直接拿来用**：`page-bindings.ts`/`fillers.ts` 需要的真实 selector、真正的分页边界（这份草稿把全部题目摊平在一页，官网是否也是一页到底还是分成多个 step 页面，未知）、真实 DOM 结构。这部分我仍然需要**官网的 view-source 或截图**才会写。

我额外做了一次背景核查（网页搜索内政部移民署官网说明，未访问/未抓取实际申请表单页面），确认了几个关键事实，直接回答/修正了下面几个分叉点：

- 系统是真实存在的：内政部移民署「大陸地區人民旅居國外或香港澳門線上申請來臺從事觀光活動」，官方给出的入口是 `https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china`（境外人士線上申辦系統），与你草稿里的资格分类、材料要求完全对得上。
- **付款环节存在，但不在同一次提交流程里**：官方说明是"申请→移民署审核→核准后才在系统里用信用卡付款"（单次证/一年多次证等费用不同），付款发生在**核准之后的另一次登录/另一个环节**，不是像 UK 那样"填满 N 页表单后立刻撞到付款墙"。这意味着你原本要的"停在真正付款步骤前"这个边界，在台湾这条线上**不能照搬 UK 的位置**——申请提交本身是免费动作，真正要花钱的步骤要等审核通过后才出现，属于完全不同的一次会话。
- **没有找到"先注册账号收验证邮件"的模式**：官方描述是"以电脑登录方式登打送出"，读起来更像"一次性填完表单直接提交，用申请编号追踪进度"，不是 UK/France 那种「先建门户账号→等确认邮件→再登录填表」的模式。真实情况仍需截图/view-source 确认（比如是否有"设置查询密码"这类栏位）。
- 你的草稿第58题写的验证码是**提交前最后一步，且明确"官网现场填写"**——这个我们没法用程序绕过（除非上 2captcha 之类服务，涉及第5点的政策决定）。

## 2.5 实地核查结果（用你的浏览器走了一遍真实官网，只读不提交）

已在 `coa.immigration.gov.tw/coa-frontend/overseas-foreign-china` 上走完「我要申请」到验证码页为止（**没有点击「确认资料」/最终送出，没有产生真实提交**）。关键发现，直接替换/修正前面几节的推测：

**真实页面结构 = 单页长表单，不是 UK 那种 44 个独立 URL 的分页 wizard。**
- `我要申请` → 一个「移民署同意条款」弹窗（勾选 + 确定）→ 进入 `/apply` 页面，页面内是两个 tab：「递送地点」（洲别 + 驻外馆处两个下拉，选完点「下一步」）和「申请表」（后面全部 58 题都在这一个 tab 里，一路往下滚动填完，不换 URL）。
- 「申请表」tab 内部结构：照片上传 → 基本状态单选题组 → 申请资格 → 申请人资料（中英文姓名/出生日期/护照号码等文本框 + 性别/现职等原生 `<select>`）→ 出生地条件显示（选"其他"才出现国家下拉）→ 在台联络地址 8 个子栏位 → 其他国籍条件区块（选"是"才出现，含一个几百项的国家 `<select>`，选项值是数字代码如新加坡=27）→ 亲属状况 5 组（父/母/配偶/子女×2，每组结构相同：存歿下拉 + 姓名/生日/电话文本框 + 现职下拉 + 服务单位/职称文本框 + 现居地址 textarea + 一个"同申请人海外地址"按钮可以一键代入）→ 申报事项 3 个独立 checkbox（曾任/现任/未曾担任大陆党务军事机关，前两个勾选后各自出现一个文本框要填"曾任职于"/"现任职于"）→ "我已阅读并接受条款"checkbox → **验证码图片 + 输入框（图片来自 `/coa-frontend/captcha`，有"换下一组"刷新和"语音播放"两个链接）** → 底部两个按钮：「回上一页」(`type=button`) 和「确认资料」(`type=submit`)。
- 表单最开头需要 **email 验证**（`/apply/verify` 路由）：填 email → 点寄送验证码 → 收验证邮件 → 填验证码 → 点"验证"，验证通过后才能继续填表；**不是**注册账号+密码，验证过的 email 会直接显示"xxx@gmail.com 已认证"文字（不可再改），后续全靠这个 email 收案件审理通知。这个 email 验证机制可以直接复用 UK 现有的 `inbox/wait-for-message.ts` 基础设施写一个 `waitForTwVerificationEmail`，不需要 UK `register.ts`/`uk_accounts` 那一整套"建账号"逻辑。
- 官网自己承认的中断续填机制：如果填到一半关闭浏览器，系统会给一个 20 码「申请案号」（暂存），可以在「申请进度查询」用这个案号+一些查询条件找回暂存的数据继续填；正式送出后换成 12 码「收件号」用于查案件状态。**这意味着我们不需要 UK 式的 email+password+resume_url 账号模型**，`tw_accounts`（如果还需要这张表的话）大概率只要存：`applicant_id`、`verified_email`、`case_number`（暂存或收件号，跑到哪一步就存哪个）就够了，不需要 `password_encrypted`/`resume_url` 这些字段。
- 确认了「确认资料」按钮之前就是验证码——跟你选定的停止边界完全吻合：**程序填到验证码框前为止就停手**，不点「确认资料」，不做验证码识别。

**对 fillers.ts 设计的影响**：绝大部分字段是原生 HTML `<select>`（continent/embassy/性别/现职/存歿/其他国籍……）配合 Playwright 的 `selectOption` 即可，不需要 UK 那种自定义 accessible-autocomplete 组件（`ukSelectCountry` 那一套影子 DOM 处理在这里大概率用不上，除非国家下拉在真实渲染时其实是自定义组件——目前用 accessibility tree 读到的是标准 `combobox`/`option`，看起来是原生 select）。日期栏位（出生日期、护照效期、亲属生日）目前只读到文本框 + 一个日历图标，还没实测点击后是原生 `<input type=date>`还是自定义 datepicker 弹窗，这个需要再实测一次点击日历图标看跳出什么，才能定 `twFillDateSplit` 还是要写一个自定义 datepicker 交互。

## 3. 需要你确认/提供的关键分叉点（更新版）

1. **已解决** — 已用浏览器实地走过一遍（见 2.5 节），拿到了真实字段结构、selector 类型、页面流程。剩两个小缺口需要再确认一次：(a) 日期栏位点开日历图标后是原生 date input 还是自定义 datepicker；(b) 大陸身分證號碼/在台聯絡手機號碼这类带"无此项"checkbox 联动禁用输入框的栏位，实测填入禁用态时 Playwright 该怎么处理（先勾选 checkbox 还是先判断是否要填值）。这两点会在正式写 `fillers.ts` 前再单独点开确认，不会阻塞整体方案。
2. **停止边界 — 已确认**：程序自动填完所有栏位，**停在验证码+最终送出按钮之前**（`resumeTwApplication` 返回状态定名为 `stopped_at_captcha`，对应 UK 的 `stopped_at_pay` 在架构里的位置），由申请人自己输入验证码并点击送出。程序不会自动过验证码，也不会代为点击最终送出。审核结果与之后的付款（核准后另一次登录）完全在自动化范围之外，只需前端把"申请编号/追踪方式"回传给用户即可，不需要 UK 那种"停在付款页、回传 resume link 给用户去付款"的 UI，改成"填表已完成到验证码页，请自行打开链接输入验证码送出"的提示。
3. **账号/登录模型 — 已确认** — 不是账号+密码模式，是 email OTP 验证 + 20码暂存案号/12码收件号做进度追踪。`tw_accounts`（如果要建）只需存 `applicant_id`/`verified_email`/`case_number`，不需要 `password_encrypted`/`resume_url`。
4. **验证码** — 草稿明确验证码在最后一页且需人工输入，倾向于不做自动识别（也避免用第三方验证码服务对付政府网站带来的政策风险）；如果你想要程序自动过验证码，需要明确同意用 2captcha 之类服务，我不会默认启用。
5. **地区出口 IP** — 台湾官网是否对访问来源地区有限制，是否需要类似 UK 的 Bright Data 住宅代理（`proxy-egress.ts`）——仍待确认，通常台湾政府网站对東南亞/其他地区访问未设限，但需要实测确认。

## 3. 验证计划（仿 UK 计划文档）

- `normalize.ts` 单测：喂 wizard 形态答案，断言输出键值符合 filler 期望
- 用「不提交」QA 模式跑一遍，验证选择器命中但不真正提交（比照 `UK_REGISTER_COMMIT` 环境变量的思路）
- 测试数据上跑一次 `headless=false`，人工盯着截图确认走到了正确的停止边界
- 端到端：wizard 填写 → 入队 → `runner_job` 状态流转 → 前端展示结果卡
- `viza-be/submission-service && npm run type-check`；前端改动后 `viza-fe/internal-website && npm run type-check`

## 4. 不会做的事（硬性要求，重申）

- 不会用「人工在台湾官网上手动点/填」作为任何阶段的替代方案——所有填表必须是程序根据网站上存的答案自动完成
- 遇到真实页面结构不确定的地方，不会猜，会停下来问你要材料
- 最终目标停在真正的付款步骤（或其等价的「最终提交」步骤）之前，不自动完成最后一步

## 5. 第二轮现场核对（在真实半填状态的会话里直接查 DOM，不再是猜）

用还开着的浏览器 tab 直接对着真实页面跑 `javascript_tool` 查询，而不是继续读之前的猜测标签，纠正/补充了下面这些点：

### 5.1 日期栏位——不是原生 `<input type=date>`
每个日期输入框都是 `readOnly:true`，class 里带 `hasDatepicker`，是标准的 jQuery UI Datepicker（`#ui-datepicker-div`，年/月两个 `<select>`，日期用 `.ui-datepicker-calendar a` 链接），配一个 `img.ui-datepicker-trigger` 触发图标。之前 `twFillDate` 只是 `.fill()` 的别名，对 readonly 输入框会静默失败——**所有日期字段之前实际上一个都没真正填进去过**。已重写为真正驱动这个日历弹窗。

### 5.2 从"猜标签文字"整体换成"真实 DOM name 属性"
现场读到了几乎整份申请表每个字段真实的 `name` 属性（`traveller.chineseName`、`traveller.birthDate`、`kinships[0..4].*`、`careersInformations[0].*` 等），比标签文字匹配可靠得多。`src/tw/apply.ts`/`fillers.ts` 已整体从 label 匹配换成 name 匹配。附带发现修正：
- "無大陸身分證號碼"/"無在臺聯絡手機號碼" 这两个勾选框**根本没有 `<label>` 元素**（裸 checkbox + 旁边纯文字），原来的 `getByLabel` 写法永远找不到、静默跳过。
- 申請資格（eligibility_category）真实单选框的 value 是 `4/5/6/9`，不是种子脚本里假设的 `1/2/3/4`——已在 apply.ts 做值映射修正（种子脚本本身没动）。
- 出生地（birth_place_is_mainland）真实控件是 `<select>`（值 `1`=中國大陸/`5`=其他），不是单选组、也不是 `mainland`/`other` 字符串。
- 5 个亲属区块的真实结构是规整的 `kinships[0..4]` 索引数组（父=0/母=1/配偶=2/子女=3/子女=4，已用隐藏字段核实顺序），比"按标题文字找最近祖先节点"的启发式可靠得多，已整体替换。
- 同意条款勾选框真实文案是"同意上述條款，請打勾。"，跟原来标"verbatim"的文案完全对不上；email 验证输入框的可访问名称其实是英文 "e-mail"，不是"電子郵件"。均已改用 name 属性定位，不再依赖这些文案。
- 必填字段清单已用页面真实的红色 "*" 逐条核实（不是猜的），并修正了种子脚本里几处required标错的地方（company_name/job_title 改为非必填，is_taiwanese_spouse/tw_contact_mobile 改为必填，5 个亲属区块统一改为非必填——之前假设"只有父亲区块必填"是错的）。
- 发现一个真实存在但种子脚本/前端完全没覆盖的必填题「目前戶口登記狀態」（`name="householdRevoked"`）——后来确认它在当前测试路径下是**条件隐藏**的（`display:none`），触发条件没能试出来（试过申請資格/是否首次申请/是否持有他国护照都没能让它显示），暂不加入，等真正遇到需要它的情况再处理。

### 5.3 「應檢附文件」——真实存在、目前完全没做的必填证明文件区块
現場核對發現：申請資格四个选项各自要求不同的證明文件（一開始以為靠隱藏的 `reasonCode` 就能区分每一格文件是什么，實測發現同一資格類別下所有格子的 `reasonCode` 是一樣的，**不能靠它區分**——後來改成按每一格自己前面那行說明文字定位，這才是真的可靠）。四類資格的專屬證明：
- 留學生 → 有效學生簽證(或再入國簽證) + 學校核發3個月內在學證明
- 永久居留權 → 永久居留權證明
- 1年以上工作證明 → 出入境查驗章戳護照內頁 + 工作簽證 + 3個月內公司在職證明
- 依親居留權+財力證明 → 現住地依親居留權證明 + 新臺幣10萬元以上、一個月內開立且存滿一個月的存款證明

四類共通還需要：大陸/港澳旅行證件（一定要）；港澳居民要另附身分證+簽證；有他國國籍護照要附掃描件；沒勾"無大陸身分證號碼"要附大陸身分證正反面；其他（含日本住民票）為選填。已加進種子腳本（`mainland_travel_document`/`eligibility_supporting_document`/`hk_macau_id_scan`/`other_nationality_passport_scan`/`mainland_id_card_scan`/`other_supporting_document`），`apply.ts` 用文字匹配上傳到正確格子。

**未覆盖**：「未成年且無法定代理人或監護人陪同來臺者」這條，在留學生/永久居留這兩類測到過，工作證明/依親居留這兩類沒測到，四類是否都有、順序怎麼排沒有完全確認，VIZA 目前也沒有收集監護人同意文件——留作已知缺口，沒有硬塞進去。

### 5.4 文件上传的真实架构——发现一个从最早实现开始就存在的死路
本来想直接复用现有的"照片上传桥接"逻辑（`visa_application_answers.photo_upload` 文本字段），一查才发现这条桥根本没接通：DocumentCenterClient 真实上传时只写 `application_documents` 表（按 `document_type`/`requirement_key` 归档 `storage_path`），从来不会写回 `visa_application_answers`。也就是说包括最早就有的"照片"在内，这条自动化流程里从来没有一段代码真正把上传的文件解析成本地文件路径喂给 Playwright。

已修正为正确路径：`document_requirements` 表新增台湾这几类文件的定义（迁移 `0105_tw_entry_permit_document_requirements.sql`），运行时由新增的 `src/documents/resolve-application-documents.ts`（按 `requirement_key` 查 `application_documents` 拿 `storage_path`，从 Supabase Storage 下载成本地文件）在 `queue/halt-runners.ts` 的 `runTwHalt` 里解析，再通过 `TwApplyOptions.supportingDocuments`/`photoFilePath` 传给 `apply.ts`——不再经过 `normalize.ts`（文字类答案）这条线，`normalize.ts` 里对应位置留了清楚的注释说明为什么这几个字段不走 `requireStr` 校验。

### 5.5 仍然没做/没验证的（诚实清单）
- 「未成年监护人同意」文件的四类资格覆盖情况没测全，VIZA 也没收集监护人同意书本身。
- 台湾县市/乡镇下拉的选项代码这一轮没有重新核对，仍然沿用第一轮"已从真实 DOM 抓取"的说法。
- 邮箱验证码的真实格式（位数、发件域名）还没有收过一封真实验证邮件确认。
- 全流程端到端（Playwright 实际执行，不只是 DOM 核对 + 类型检查）还没跑过一次。
- IP 地域限制、案号提取正则——低优先级，仍未测。
