# 菲律宾 eTravel（PH_ETRAVEL_ARRIVAL_CARD）自动提交 — 现场核查报告

**状态：核查完成，等你对第 4 节的分叉点做决定，之后再讨论要不要写代码 / 是否需要单独出方案。本报告本身不包含任何代码改动、DB 改动或跨包改动。**

## 0. 结论先说：现有实现处于什么阶段

跟台湾那条线不一样——**台湾核查前好歹是"填表逻辑写完了但很多选择器猜错"，菲律宾这条线核查前其实是"连填表逻辑本身都还没写"**。具体：

- `viza-be/submission-service/src/ph-etravel/runner.ts` 的 `runPhEtravelPortalSubmissionWithBrowser` 打开官网首页 → 截图 → 检测是否被墙 → （如果 `stopBeforeSubmit` 是 false）尝试用一对写死在 env 变量里的账号密码登录 → **然后不管走到哪一步，都无条件 `throw new PhEtravelPortalError(..., { code: "ph_etravel_selector_mapping_incomplete" })`**。
- 目录里**没有** `selectors.ts` / `page-bindings.ts` / `fillers.ts` / `apply.ts` 这类台湾/UK 都有的真实填表文件。`normalize.ts` 只做"把 VIZA 内部答案映射成一个 payload 接口"，从未被传给任何驱动 Playwright 填表的代码——因为那份代码不存在。
- 也就是说：**目前这条线 0% 完成"把答案实际填进官网表单"这件事**，只完成了"payload 归一化 + 校验 + 72 小时窗口检查 + 打开浏览器探测是否被墙"。

这个判断本身就是本次核查最重要的发现之一：如果之前有人以为"菲律宾这条线大体能跑，只是有几个选择器不准"，那是不对的——它现在到"能不能找到姓名输入框"这一步都还没到。

## 1. 台湾 7 个坑，逐条核对菲律宾现状

| # | 台湾踩的坑 | 菲律宾现状 |
|---|---|---|
| 1 | 标签文字猜错一半 | 无适用对象——没有任何"猜标签文字"的填表代码存在，无从谈错不错 |
| 2 | 日期控件是只读自定义组件，`.fill()` 静默失败 | 无适用对象——同上，没有日期填值代码 |
| 3 | 勾选框没有 `<label>` | 无适用对象——同上 |
| 4 | 下拉/单选 value 靠猜 | **有真实问题**，见第 3 节——`official-options.ts` 里硬编码的 `purpose_of_travel`（`HOLIDAY`/`BUSINESS`/...）、`port_of_entry`（12 个机场英文全名）等值，从官网自己的生产代码里能确认至少 `purpose_of_visit_code` 真实用的是 `POV001`/`POV007` 这类编码，不是英文单词——跟 VIZA 种子脚本假设的值对不上，模式上和台湾"申請資格 1/2/3/4 vs 真实 4/5/6/9"一模一样 |
| 5 | 必填字段清单靠印象猜 | **有真实问题**，见第 3 节——多处条件必填（`return_date`/`transit_*`/`flight_number_special`/`travel_company_code`/`vessel_name`/`photo_url` 等）在 VIZA 种子脚本里被简化成了"要么无条件必填、要么不存在这个字段"，跟官网真实的 Yup 校验规则对不上 |
| 6 | 用隐藏分类字段区分上传槽位，结果发现同类下全部一样 | 无适用对象——菲律宾这边连"文件上传"这个概念在种子脚本和 `document_requirements` 里都完全不存在，见第 2 节 |
| 7 | 文件/照片上传其实走 `application_documents`，不是 `visa_application_answers`，两套系统没桥接 | **比台湾当初还早一个阶段**——见第 2 节 |

## 2. 第 7 条坑对应的菲律宾现状：文件/照片上传完全没规划

- 官网真实存在 `photo_url` 字段（护照照片/自拍照上传），从生产 JS 里的校验规则看，是 `.when(["nationality_country_code"], ...)`——即根据国籍代码是否等于 `"PH"` 来决定是否必填（具体条件的完整语义还需要登录后现场再确认一次，见第 4 节的"未能验证清单"）。
- 但 VIZA 这边：`viza-be/agent-backend/scripts/ph-etravel/form-fields.ts` 里的 `PH_ETRAVEL_FORM_FIELDS` **完全没有任何文件类字段**；`grep` 全仓库 `document_requirements` 相关文件，**没有找到任何 `PH_ETRAVEL` 的 document_requirements 种子数据**。
- 换句话说：台湾当初的坑是"以为文件走 `visa_application_answers`，实际该走 `application_documents`，两条线没接上"；菲律宾这边**连"该走哪条线"这个问题都还没被问过**——这个功能点目前是空白，不是接错，是没接。真要做，直接复用你已经在台湾那边建好的 `viza-be/submission-service/src/documents/resolve-application-documents.ts`（按 `requirement_key` 查 `application_documents` 下载成本地文件），但前提是要先给 `document_requirements` 加菲律宾这几行数据——这属于 DB 改动，按你的规则需要先出方案给你确认，我这次没有动手写。

## 3. 用官网真实生产代码核对出的具体字段/校验差异（不是猜的，也不是抄第三方博客）

### 3.1 为什么是这个方法，而不是像台湾那样登录后现场读 DOM

台湾那条线核查时能直接登录进去，是因为台湾官网只需要"邮箱验证码校验"（不设密码），这不算注册账号。**菲律宾官网的登录墙不一样：`/authentication` → `/signin` 的真实流程是"输入邮箱 → 设置密码 → 创建账号"（有真实的 Password 输入框），这属于我不会代为操作的"创建账号 / 输入密码"动作，哪怕你本人授权也一样，所以这次没有登录进去实测已认证状态下的真实页面 DOM。**

改用的方法：eTravel 官网是 Next.js（Pages Router）应用，`/wizard/me`、`/wizard/declaration`、`/new-travel-declaration` 等已登录页面对应的 JS 代码块（`_next/static/chunks/*.js`）**在浏览器里是公开可下载的静态文件，不需要登录就能拿到**（登录墙是前端路由层面拦的，不是这些静态资源本身被保护）。我用 Claude in Chrome 在真实官网页面里跑 JS，抓取 `_buildManifest.js` 定位到这些页面对应的代码块文件，下载后在文本里搜真实的字段名、Yup 校验规则（`.required()`/`.when()`）和选项编码——这是官网自己生产环境里跑的代码,可信度高于任何第三方教程或博客，但比"登录后现场读渲染出来的 DOM"证据链短一环：它能确认真实字段名/校验逻辑,但不能确认这些字段渲染成什么控件类型（原生 `<select>` 还是自定义组件）、是否有 `<label>`、必填星号长什么样——这几点仍然待验证,见第 4 节。

### 3.2 确认的字段名不一致（VIZA 内部字段名 → 官网真实字段名）

- `date_of_birth` → 官网真实是 `birth_date`
- `passport_number` → 官网真实是 `passport_no`
- `transport_type` → 官网真实是 `transportation_type`
- `philippines_address` → 官网真实是 `destination_address`
- `purpose_of_travel`（VIZA 选项值是 `HOLIDAY`/`BUSINESS`/`VISIT_FAMILY`/... 这类英文单词）→ 官网真实字段是 `purpose_of_visit_code`，值是编码（确认见到 `POV001`、`POV007`），不是英文单词
- `country_of_birth` → 官网真实是 `country_of_birth_code`（是编码字段，不是国家名字符串）

这些不一致，本质上跟台湾"申請資格 value 猜错"是同一类问题——如果现在就照 VIZA 现有的 `normalize.ts`/`official-options.ts` 去写 `fillers.ts`，选中的下拉选项/传的值大概率是错的，会出现"看起来选中了，实际官网收到的值不对"的静默错误。

### 3.3 确认存在、但 VIZA 完全没建模的真实字段/条件逻辑

- `transit_country_code` / `transit_port` / `transit_date` —— 转机声明区块，`with_transit` 为真时必填。VIZA 种子脚本里完全没有转机相关字段。
- `flight_number_special`——当 `flight_number === "SPECIAL FLIGHT"` 时必填（至少5字符）；`travel_company_code`——`transportation_type === "AIR"` 时必填（航空公司代码，不是航班号）；`vessel_name`——`transportation_type === "SEA"` 时必填。VIZA 现在只有一个扁平的 `flight_number` + 可选的 `airline_or_vessel_name`，跟官网这套条件分支对不上。
- `return_date`（对应"返程/离境日期"）真实必填条件是 `purpose_of_visit_code` 属于特定几个编码 **且**（`ARRIVAL`+`FOREIGNER` 或 `DEPARTURE`+`FILIPINO`）等组合条件；VIZA 现在把 `departure_date` 标成无条件必填,跟官网的条件必填规则不一致。
- `seat_number`、`passenger_type`、`stay_location_type` —— 官网真实存在的字段，VIZA 种子脚本里完全没有。
- `family_members`（提交 payload 里的字段）—— 说明官网这套表单本身支持同一次提交带多个家庭成员,但这跟你在 migration 注释里"Out of scope: ... group/family submissions"明确排除的范围一致，这里只是确认这条排除是对的、不是漏做。

### 3.4 验证码机制（直接回答你问的"是否已经在自动解验证码"）

**没有，菲律宾这条线现在完全没有验证码相关代码**（`grep captcha` 在 `ph-etravel/` 目录下只匹配到 `AGENTS.md` 里"如果遇到 CAPTCHA 就报失败"这句话,以及 `runner.ts` 里把"页面文字含 captcha/turnstile"当成一种"被墙"信号,从未有过求解逻辑)。而且现在的代码在真正打开表单页面之前就已经无条件抛错停手了,连有没有机会碰到验证码都谈不上。

额外确认了一个跟"是否要接 2captcha"直接相关的事实:**官网真实用的是 Google reCAPTCHA Enterprise**(在 `registration-slips` 页面的代码块里找到 `recaptcha/enterprise.js` 的加载地址和站点 key,以及一个专门的 `CaptchaInput` 组件,最终提交 payload 里有 `captcha` 这个 token 字段)。这跟你提到的"部分国家用 2captcha/滑块几何计算"不是同一类验证码——reCAPTCHA Enterprise 通常需要专门支持 Enterprise token 的第三方解码服务，跟滑块验证码的几何计算完全是两回事，选型和成本都不一样。

### 3.5 一个没有写在任何文档里的悬空假设:共享账号模型

`runner.ts` 里的 `reachAuthenticatedPhEtravelSession` 会用 `process.env.PH_ETRAVEL_ACCOUNT_EMAIL` / `PH_ETRAVEL_ACCOUNT_PASSWORD` 这一对**全局共享**的账号密码去登录官网,不区分申请人。这两个环境变量在整个仓库里只在这一个文件被引用,没有出现在任何 `.env.example`、`AGENTS.md`、`CLAUDE.md` 或方案文档里——看起来是某次实现时留下的一个未经讨论、未经确认的架构假设,而不是一个明确决定。这个假设是否合理,取决于官网"一个账号能不能提交多个不同旅客的申报"(官网首页确实有"For me"/"For someone else"两种模式,理论上支持),但这属于第 4 节需要你决定的分叉点,我没有默认继续沿用,也没有默认推翻。

## 4. 我没能验证的部分(诚实清单,不打埋伏)

- 真实渲染出来的表单 DOM——`name`/`id` 属性、日期控件是原生 `<input type=date>` 还是自定义弹窗、勾选框有没有真实 `<label>`、必填红色星号长什么样——这几项台湾那轮是登录后现场读 DOM 拿到的,菲律宾这次因为登录墙需要"创建账号+设密码"(不是台湾那种邮箱验证码),按规则我不会代为操作,所以这几项还是空白。
- `civil_status`(婚姻状况)—— VIZA 种子脚本里有这个字段,我这次抓到的校验规则片段里没搜到对应的官方字段名,不确定是漏抓、字段名不同,还是官网这个版本的申报流程里其实没有这一项(参照 3.2 节抓到的其它字段都在同一段校验规则里,理论上应该一起出现)。
- `port_of_entry`/国籍/国家这些下拉的真实选项列表(编码全集)——这类大字典很可能是登录后从后端选项接口动态拉的,不在静态 JS 代码块里,VIZA 现在硬编码的 12 个机场/港口大概率既不完整、编码格式也对不上(`country_of_birth_code`已经确认是编码而不是国家名,`port_of_entry`大概率也是同类情况,但没有拿到真实编码表)。
- `photo_url` 必填条件的完整语义(`.when(["nationality_country_code"], ...)`只抓到了一段,`"PH"===i`那个分支具体在说"菲律宾籍必填"还是别的,需要再登录确认一次上下文)。
- 有没有"未成年监护人同意"之类台湾那边发现过的隐藏必填项——没查。

## 5. 需要你决定的分叉点(不会默认选,也不会默认不选)

1. **验证码策略**:现在这条线其实还没走到能碰到验证码的地步(第3.4节)。等真正的填表代码(`fillers.ts`/`apply.ts`)写出来后,要不要照抄台湾"填完全部字段,停在验证码框前,不自动解"的边界?还是考虑对接 reCAPTCHA Enterprise 兼容的第三方解码服务?这是两条完全不同的实现路径,费用和政策风险也不同。
2. **停止边界**:菲律宾 eTravel 本身免费、没有付款环节,"停在付款前"这个台湾式边界在这里不适用。真正该停在"验证码框前"(人工输入验证码+人工点最终提交),还是"验证码之后、点最终提交前"(如果决定接入解码服务)?
3. **账号模型**:第3.5节提到的"全局共享一个 eTravel 账号密码去提交所有申请人的申报"这个假设,是要继续沿用、改成每个申请人各自的账号、还是有其他官网支持的模式(比如"For someone else"免登录直接填的可能性,这个我没有登录验证过是否存在)?
4. 上面 3 点一旦定下来,真正要写的东西会涉及新建 `viza-be/submission-service/src/ph-etravel/{selectors,page-bindings,fillers,apply}.ts`(照抄台湾模式)、给 `document_requirements` 加菲律宾照片上传的种子数据(DB 改动)、以及可能同步改 `viza-fe` 那边的 wizard 字段(跨包改动)——按你的规则,这些我会先出一份具体方案给你确认,这份报告本身不包含任何这类改动。

## 5.5 登录后现场核对(你登录、我只读 DOM,没有输入你的账号密码)——第一页「Onboarding - Personal Information」

你登录后停在 `https://etravel.gov.ph/en/onboarding-wizard?wizard_page=0`,我在这一页用 `javascript_tool` 直接读了真实 DOM(`querySelectorAll('input,select,textarea')` 拿每个控件的 `name`/`id`/`type`),以下是这一页确认的真实结构,**部分修正了第 3 节纯读 JS 代码块时的推测**:

- **姓名不是一个字段,是拆开的**:真实 DOM 是 `first_name`(必填,原生 text input)/`middle_name`(可选)/`last_name`(页面文案写"optional"——姓氏本身是选填!)/隐藏字段 `extension_name`(对应"Suffix"下拉,用 react-select 实现)。**VIZA 现在 `normalize.ts`/`form-fields.ts` 只有一个 `full_name` 字段**,真要接这条线,要么改成收集分开的名/中间名/姓/后缀,要么在 `apply.ts` 里做姓名拆分——拆分有风险(护照姓名格式五花八门),需要你决定怎么处理,不建议我自己猜规则拆。
- **Sex 不是原生下拉,是隐藏字段 + react-select 组合**:真实字段名是 `gender`(不是 VIZA 现在用的 `sex`),可见的是一个 `react-select-2-input` 搜索框,实际值写入旁边的 `<input type=hidden name="gender">`。Playwright 不能用 `selectOption`,要走"点开→点选项文字"这条路,跟 UK 那套自定义下拉的处理方式类似。
- **国籍/出生国家/护照签发国/职业,都是同一种自定义 combobox(HeadlessUI),不是原生 `<select>`**:真实字段名 `nationality_country_code`/`country_of_birth_code`/`passport_issued_country_code`/`occupation_code`——都是"code"后缀,确认是编码字典,不是自由文本(**`occupation_code` 这一条是新发现:VIZA 现在把 occupation 当成自由文本字段,官网真实是一个编码下拉**)。这几个 combobox 的 DOM id 是 `headlessui-combobox-input-:r1:` 这种自动生成、随渲染次数变化的 id,**不能拿 id 做选择器**,要靠前面的 label 文字或容器结构定位。
- **手机号输入框没有 `name` 属性**:真实 DOM 是一个 `type=tel`、不带 `name` 的 input,前面挂一个国旗+区号下拉(默认 `+63`),VIZA 现在假设的 `mobile_country_code`/`mobile_number` 两个独立字段,在真实 DOM 里目前看到的是"一个不带 name 的 tel 输入 + 一个国旗下拉",具体区号怎么真实提交(是拼在一起,还是国旗下拉自己有别的 name)还需要再点开那个国旗下拉确认一次。
- **`passport_number`/`birth_date`/`passport_issued_date` 是原生 text input**,不是自定义组件——这几个可以放心当"简单字段"处理;但日期是不是只读弹窗(仿 TW 的 datepicker 坑),这次没点开日历图标测,还不确定。
- **照片上传没有原生 `<input type=file>` 挂在 DOM 上**——"Take a photo or upload a file"这个按钮点击后大概率是动态生成 input 或弹出摄像头组件,这次没有点开测,具体交互方式还不知道。
- **这一页从头到尾没有看到任何红色星号之类的"必填标记"**——跟台湾"必填字段用红星号核实"这条不一样,菲律宾这边不能靠肉眼扫必填标记,只能靠登录后试提交(留空点 Next 看报什么错)或者继续抠 Yup 校验规则来确定哪些字段真必填。
- 这一页**没有出现 `civil_status`**(婚姻状况)——跟第 3 节"没搜到对应校验规则"的怀疑一致,基本可以确认第一页个人信息里没有这一项,不代表后面的页面没有,还需要翻页确认。

## 6. 你的决策记录(2026-07-28)

1. **验证码策略:接入 reCAPTCHA Enterprise 解码服务**(不走台湾"停在验证码框前"的保守路线)。
2. **停止边界:验证码之后、最终提交前**——即程序拿到验证码 token 后自动继续,停在点击"确认资料/最终提交"按钮之前,由你人工确认后再点提交。
3. **账号模型:每个申请人独立账号**(仿台湾/UK 模式,不沿用 `runner.ts` 里悬空的全局共享账号假设)。

## 7. 基于以上决策的后续方案框架(仅框架,不是可执行代码;涉及 DB/跨包改动,按规则需要你先确认这份方案再动手)

在你确认下面这份框架之前,我不会新建表、不会写 `fillers.ts`/`apply.ts` 等实际填表代码。

### 7.1 需要新建的文件(仿台湾 `src/tw/*` 命名,放在 `viza-be/submission-service/src/ph-etravel/`)

- `selectors.ts` / `page-bindings.ts` / `fillers.ts` / `apply.ts`——真正驱动 Playwright 填表,字段名要按第 3.2/3.3 节确认过的真实字段名(`birth_date`/`passport_no`/`transportation_type`/`destination_address`/`purpose_of_visit_code`/`country_of_birth_code`/`transit_*`/`flight_number_special`/`travel_company_code`/`vessel_name`/`seat_number`/`passenger_type`/`stay_location_type`)去写,**不能照抄现有 `normalize.ts`/`official-options.ts` 里那套旧字段名**——这意味着 `normalize.ts` 和 `official-options.ts` 本身也需要跟着改。
- `register.ts`(账号创建,仿 `uk/register.ts`,因为账号模型选了"每个申请人独立账号",而 eTravel 是"邮箱+密码"真实注册,不是台湾那种纯邮箱验证码)。
- `captcha.ts`(对接 reCAPTCHA Enterprise 解码服务,需要另外确认具体用哪家服务商——`src/captcha/two-captcha.ts` 目前是否支持 Enterprise token 求解需要先查一下,不一定能直接复用)。
- `runner.ts`——现有的会被大幅重写(目前是"打开页面就报错"的占位实现)。

### 7.2 数据库改动(需要单独出 migration 方案给你确认,这次没有建表)

- 新建 `ph_etravel_accounts` 表(结构参考 `uk_accounts`:`applicant_id`/`email`/`password_encrypted`/`storage_state_json`/`last_authenticated_at`),因为选了"每个申请人独立账号"。
- 新增 `document_requirements` 种子数据,给 `PH_ETRAVEL_ARRIVAL_CARD` 补上照片/护照照片上传项(对应官网的 `photo_url` 字段),运行时复用你已有的 `resolve-application-documents.ts`。
- `agent-backend/scripts/ph-etravel/form-fields.ts` 需要新增字段(转机声明、`seat_number`、`passenger_type`、`stay_location_type` 等)并修正现有字段的 `field_name`/选项值,对应一份新的 seed migration。

### 7.3 可能涉及的跨包改动

- `viza-fe/internal-website` 的 eTravel wizard 如果字段键名对不上新的 `normalize.ts` 期望,需要同步改前端表单字段名——具体要不要动、动多少,取决于前端现在的字段名是否已经跟第 3.2 节的"VIZA 内部字段名"一致(我这次没有去读前端 wizard 代码,只查了后端和 DB 部分,这块还需要单独确认一次)。

### 7.4 我建议的下一步

在你正式拍板"就照这个框架做"之前,我建议再做一次**授权范围内的现场核查**:如果你愿意提供一个已经创建好、你自己持有密码的测试用 eTravel 账号(你自己登录,我在旁边用 Claude in Chrome 读已认证状态下的真实 DOM——不需要我输入密码),就能一次性补齐第 4 节里"未能验证"的所有项(真实 DOM 控件类型、`<label>`、必填星号、下拉真实选项编码全集、`civil_status` 是否存在)。这样后面写 `fillers.ts` 就不用再靠这次的 JS 代码块推断,能达到台湾那轮同等的现场核查严谨度。

## 附:项目规则核对

- 已读根目录 `CLAUDE.md`、`.claude/CLAUDE.md`、`viza-be/agent-backend/CLAUDE.md`。"数据库改动 / 跨多个包的改动必须先出方案确认"这条规则在 `.claude/CLAUDE.md` 里有明确写("Always enter plan mode for (no exceptions): Database schema changes or migrations... Changes that span more than one package"),本次报告和核查过程没有触发这条(没有改代码、没有改 DB)。
- 需要提醒一下:`.claude/CLAUDE.md` 里的项目描述(提到 `report-generator`、`admin-website`、`viza-mobile`、Shopify、化验单位换算这些)跟这个仓库实际的签证自动提交业务对不上,像是从别的项目模板照抄留下的,内容本身没有可疑指令,但你可能需要找时间清理一下,避免以后误导。
- `.claude/lessons.md` 目前是空的(0 条已记录的教训)。
