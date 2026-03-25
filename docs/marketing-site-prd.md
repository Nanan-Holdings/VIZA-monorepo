# VIZA — External Website PRD

**Version:** 2.0
**Status:** Draft
**Platform:** Framer (standalone, separate from monorepo)
**Primary Language:** zh-CN (Phase 1; English Phase 2)
**Site Type:** Full marketing + conversion website for a live visa agency

---

## 1. Business Overview

VIZA is an AI-powered visa agency offering end-to-end visa application services for non-immigration visas (tourist, business, work, student, long-term stays, digital nomad). VIZA does not handle permanent residency or immigration.

**Dual market:**
- B2C: Individual applicants who want professional help with their own visa
- B2B: Employers managing visa applications for employees or business travelers

**Service model:**
- Clients sign up, pay, and are onboarded into the VIZA internal platform to begin their application
- Human visa consultants + AI technology work together to guide and process applications
- Two service tiers available within each visa type:
  - **顾问辅助 (Guided):** VIZA prepares and advises; client submits themselves
  - **全程托管 (Full-service):** VIZA prepares and submits on the client's behalf

**Pricing model:**
- B2C: Per-application pricing (varies by visa type and destination)
- B2B: Monthly subscription (volume-based, for companies with recurring needs)

**Headquarters:** 227 Pasir Panjang Rd, Singapore 117341

**Primary contact channels:** WeChat, Email, Phone

**Target market Phase 1:** Chinese nationals (individuals and companies)

**Competitors:**
- Traditional visa agencies (offline, slow, expensive)
- SaaS immigration tools: Boundless, Deel Immigration (focus on US immigration; VIZA focuses on non-immigration visas globally)
- Travel platforms with visa add-ons: Booking.com, Agoda (no human expertise, no submission service)

**Core differentiators:**
- Technology-driven efficiency at lower cost than traditional agencies
- Higher approval rates through AI document review + human expert oversight
- Chinese-market first — less competition, native language support
- Full-submission service: we handle it so clients don't have to navigate government portals
- Both B2C and B2B in one platform

---

## 2. Brand

**Name:** VIZA

**Primary Color:** `#03346E` (Navy)

**Color Scale:**
- 50: `#EEF3FA`
- 100: `#D4E0F0`
- 200: `#AABFDF`
- 300: `#7A9DCE`
- 400: `#3D6DAD`
- 500: `#03346E` (primary)
- 600: `#022B5C`
- 700: `#01214A`
- 800: `#011737`
- 900: `#000D21`

**Typography:**
- Headings: Switzer (variable) — Framer equivalent if unavailable; fallback to Inter
- Body: Inter
- Chinese copy: PingFang SC / Noto Sans SC (system stack)

**Tone (Chinese):**
- 专业、高效、值得信赖
- Speaks to both the individual stressed about paperwork and the HR manager dealing with compliance
- Not cold or bureaucratic — clear, direct, human
- Does not talk down to the user; explains complexity without jargon

---

## 3. Information Architecture

```
/ ........................... 首页 (Home)
/about ...................... 关于我们 (About)
/solutions .................. 签证服务 (Solutions overview)
  /solutions/tourist ........ 旅游签证
  /solutions/business ....... 商务签证
  /solutions/work-permit .... 工作签证
  /solutions/student ........ 学生签证
  /solutions/long-term-stay . 长期居留签证
  /solutions/digital-nomad .. 数字游民签证
/pricing .................... 价格方案
/blog ....................... 博客
  /blog/[slug] .............. 文章页 (Article template)
/contact .................... 联系我们
```

---

## 4. Global Navigation

**Left:** VIZA wordmark logo (navy on white; white on dark backgrounds)

**Center links:**
- 签证服务 (mega-dropdown showing all 6 visa types)
- 价格方案
- 博客
- 关于我们

**Right:**
- 联系我们 (ghost/text button)
- 立即开始 (filled button, navy)

**Dropdown for 签证服务:**
Two-column grid showing all 6 visa type links with a short descriptor line each:
- 旅游签证 — 短期出行，快速办理
- 商务签证 — 商务出访、参展、谈判
- 工作签证 — 海外就业、跨国派遣
- 学生签证 — 海外留学全程辅助
- 长期居留签证 — 长期工作或生活许可
- 数字游民签证 — 远程办公，自由出行

**Mobile:** Hamburger menu with same links, accordion for 签证服务 dropdown, CTA at bottom.

---

## 5. Global Footer

**Row 1 (4 columns):**

Col 1 — Brand
- VIZA logo
- Tagline: 专业签证服务，AI 驱动，人工把关
- Social/contact icons: WeChat | Email | Phone

Col 2 — 签证服务
- 旅游签证
- 商务签证
- 工作签证
- 学生签证
- 长期居留签证
- 数字游民签证

Col 3 — 公司
- 关于我们
- 价格方案
- 博客
- 联系我们

Col 4 — 联系我们
- WeChat QR code (small, scannable)
- 邮箱: [email]
- 电话: [phone]
- 地址: 227 Pasir Panjang Rd, Singapore 117341

**Row 2 (bottom bar):**
© 2025 VIZA. 保留所有权利。 | 隐私政策 | 服务条款

---

## 6. Page 1 — 首页 (Home)

**Purpose:** Establish credibility, communicate the full scope of VIZA's service across visa types and client types (B2C + B2B), and drive conversion to sign up or contact.

---

### Section 1: Hero

**Layout:** Full-width, dark navy background. Headline left, product mockup right.

**Headline (H1):**
> 签证申请，全程交给 VIZA

**Subheadline:**
> 无论旅游、商务、工作还是留学，VIZA 专业签证顾问 + AI 智能系统，为您处理每一个环节。

**CTA (primary):** 立即开始申请

**CTA (secondary):** 了解我们的服务

**Visual:** Split mockup showing the VIZA platform (AI chat + document checklist) on one side, and a secondary visual of a human consultant reviewing documents — reinforcing both AI efficiency and human expertise.

---

### Section 2: Trust / Stats Bar

**Layout:** Horizontal strip with 4 stats. White or light background.

Placeholder stat slots (Edward to fill with real numbers):
- X+ 个国家签证覆盖
- X% 申请通过率
- X+ 位专业签证顾问
- X+ 位客户信任

If real numbers not available yet, use a single trust statement: 新加坡注册签证机构，专业顾问团队，AI 智能驱动

---

### Section 3: Visa Services Overview

**Layout:** Section header + 6 cards in a 3x2 grid. Each card links to the relevant /solutions/[type] page.

**Section headline:** 我们覆盖的签证类型

**Cards (6):**
1. **旅游签证** — 短期旅行，轻松出行，快速审批
2. **商务签证** — 商务访问、参展、合作洽谈
3. **工作签证** — 海外就业、企业派遣、工作许可
4. **学生签证** — 海外留学申请全程辅助
5. **长期居留签证** — 长期工作或生活所需居留许可
6. **数字游民签证** — 远程办公者的跨境自由签证方案

Each card: icon + title + one-line description + 了解更多 link.

---

### Section 4: How It Works

**Layout:** 4-step horizontal flow or alternating step blocks.

**Section headline:** 申请流程，简单四步

**Step 1 — 注册并选择签证类型**
创建 VIZA 账号，选择您需要申请的国家和签证类型。我们覆盖全球主要目的地。

**Step 2 — 与签证顾问确认方案**
AI 系统结合顾问专业判断，为您提供针对性的申请方案和所需材料清单。

**Step 3 — 上传文件，AI 智能审核**
按照引导上传所需文件，AI 系统实时检查文件完整性和格式，顾问进行人工复核。

**Step 4 — 提交并等待结果**
选择全程托管方案，VIZA 代您完成提交；或选择顾问辅助方案，自行提交。结果直接通知您。

---

### Section 5: Why VIZA

**Layout:** 3x2 feature grid with icon + title + short description.

**Section headline:** 为什么选择 VIZA？

1. **AI 驱动，效率更高** — 智能文件审核、自动填表、实时进度追踪，大幅缩短申请时间
2. **专业顾问团队** — 经验丰富的签证顾问全程把关，针对复杂情况提供专属策略
3. **覆盖全球目的地** — 无论去哪个国家，我们都能提供签证申请支持
4. **高通过率** — AI 提前审核 + 人工复核，有效降低被拒风险
5. **中文全程服务** — 全程中文沟通，无语言障碍，服务体验更顺畅
6. **企业与个人均适用** — 一次性申请或企业订阅制，灵活满足不同需求

---

### Section 6: B2C vs B2B Split

**Layout:** Two-column card, one side B2C, one side B2B. Each with headline, 3 bullet points, and a CTA.

**Left — 个人申请者**
- 单次按申请付费，无需订阅
- 旅游、留学、工作签证均可办理
- AI 引导 + 顾问支持，省心省力
- CTA: 查看个人方案

**Right — 企业客户**
- 月度订阅，批量管理员工签证需求
- 商务签证、工作许可、跨国派遣一站式管理
- 专属客户经理，优先响应
- CTA: 了解企业方案

---

### Section 7: Testimonials

**Layout:** 3 quote cards in a row.

Placeholder slots — Edward to populate with real client testimonials. Do not fabricate.

---

### Section 8: Blog Preview

**Layout:** 3 latest blog article cards. Title, category tag, date.

**Section headline:** 签证资讯与攻略

Link below: 查看更多文章 →

---

### Section 9: Bottom CTA Banner

**Layout:** Full-width navy band.

**Headline:** 准备好了吗？让 VIZA 帮您搞定签证

**Subtext:** 个人申请或企业签证管理，我们都有对应方案

**CTAs:** 立即开始申请 / 联系我们

---

## 7. Page 2 — 关于我们 (About)

**Purpose:** Build credibility and trust. Humanize VIZA. Explain the mission and why this company exists.

---

### Section 1: Hero

**Headline:** 我们让签证申请变得简单

**Subheadline:** VIZA 成立于新加坡，由一支签证专业人士和技术团队组成，致力于用 AI 技术重塑传统签证行业。

---

### Section 2: Mission Statement

**Layout:** Large centered text block, possibly with background image or abstract graphic.

**Headline:** 我们的使命

**Body:**
签证申请本不应该是一件让人头疼的事。繁琐的材料要求、难懂的政府网站、高额的中介费用——这些是传统签证行业长期存在的问题。VIZA 的使命是用技术和专业知识，让每一个人都能高效、低成本地完成签证申请。

---

### Section 3: Our Approach

**Layout:** 3 cards or icon list.

**Headline:** 我们的方式

1. **技术 + 人工双重保障** — AI 处理效率问题，顾问处理复杂判断，两者结合才是最好的申请方案
2. **以客户结果为导向** — 我们的目标不是完成表格，而是帮您拿到签证
3. **透明定价，无隐藏费用** — 按申请收费（B2C）或企业订阅（B2B），价格清晰，无意外收费

---

### Section 4: Team

**Layout:** Grid of team member cards with photo, name, title, brief bio (1-2 lines).

Placeholder slots — Edward to populate with real team info.

**Section headline:** 我们的团队

---

### Section 5: Company Info

**Layout:** Simple info block or map + details.

**Headline:** 公司信息

- 注册地：新加坡
- 办公地址：227 Pasir Panjang Rd, Singapore 117341
- 联系方式：WeChat | Email | Phone
- Map embed (Google Maps or static image)

---

### Section 6: CTA

**Headline:** 想了解更多？

**CTAs:** 联系我们 / 查看价格方案

---

## 8. Page 3 — 签证服务总览 (Solutions Overview)

**Purpose:** Landing page for the /solutions parent route. Gives a clear visual overview of all 6 visa categories and helps users self-select the right one.

---

### Section 1: Hero

**Headline:** 我们提供哪些签证服务？

**Subheadline:** 从旅游到工作，从短期到长期，VIZA 覆盖各类非移民签证申请。选择您需要的签证类型，了解详情。

---

### Section 2: Visa Type Cards (6)

**Layout:** 3x2 grid of large cards. Each card links to its /solutions/[type] page.

Each card contains:
- Icon or illustration
- Visa type name (large)
- Who it's for (1 line)
- Typical use cases (2-3 bullet points)
- Destination examples (flag icons or country names)
- 了解详情 → link

---

### Section 3: Not Sure Which Visa You Need?

**Layout:** Highlighted callout box or banner.

**Headline:** 不确定需要哪种签证？

**Body:** 联系我们的签证顾问，根据您的行程和目的，为您推荐最合适的签证类型和申请策略。

**CTA:** 免费咨询

---

## 9. Pages 4–9 — Solution Sub-pages (Template)

Each of the 6 visa type pages follows the same template structure. Content differs per visa type.

**Route pattern:** /solutions/[visa-type]

**Template sections:**

### Section 1: Hero
- Visa type name as H1
- One-line description of who this visa is for
- CTA: 立即申请 / 了解价格

### Section 2: 适用人群 (Who It's For)
- 3-4 bullet points describing the target applicant
- Examples: 计划赴泰旅游的中国公民 / 需要赴日参加展会的商务人士 / etc.

### Section 3: 我们帮您处理什么 (What VIZA Handles)
- Checklist of everything VIZA manages: document review, form filling, submission, status tracking
- Contrast with "if you did this yourself" to highlight the value

### Section 4: 一般所需材料 (Typical Required Documents)
- General list (specific requirements vary by destination)
- Note: exact requirements confirmed during consultation

### Section 5: 参考处理时间 (Typical Processing Time)
- General timeframe ranges (varies by country)
- Note: VIZA processes applications as fast as the destination government allows

### Section 6: 价格 (Pricing for This Visa Type)
- Show relevant tier pricing (per-application B2C)
- Link to full /pricing page for B2B / enterprise
- Government fees noted separately in a small footnote (not a disclaimer box — just a clean line: "政府官方签证费另计，具体金额因国家而异")

### Section 7: FAQ (4-6 questions specific to this visa type)
- Accordion expandable

### Section 8: CTA
- 立即开始申请 / 联系顾问

---

**The 6 visa type pages:**

#### /solutions/tourist — 旅游签证
For individuals planning leisure travel. Short stays. Wide country coverage. Emphasize speed and simplicity.

#### /solutions/business — 商务签证
For business travelers attending meetings, conferences, trade shows. Emphasize professional handling, supporting documents for business purpose.

#### /solutions/work-permit — 工作签证
For individuals taking up employment abroad or companies sending employees overseas. More complex — emphasize human expert involvement.

#### /solutions/student — 学生签证
For individuals enrolled or planning to enroll in overseas educational institutions. Emphasize checklist completeness and timing.

#### /solutions/long-term-stay — 长期居留签证
For individuals needing extended stay permits for work or personal reasons that fall short of permanent residency. Emphasize VIZA's expertise in navigating country-specific requirements.

#### /solutions/digital-nomad — 数字游民签证
For remote workers seeking legal long-term residence in another country while working for a foreign employer. Emphasize newer visa category, VIZA's up-to-date knowledge.

---

## 10. Page 10 — 价格方案 (Pricing)

**Purpose:** Drive plan selection for B2C per-application clients and B2B subscription clients. Clear, honest, no surprises.

---

### Section 1: Hero

**Headline:** 透明定价，按需选择

**Subheadline:** 个人申请按次付费，企业客户可订阅月度方案。所有方案均含 AI 智能审核 + 专业顾问支持。

---

### Section 2: B2C vs B2B Toggle

**Layout:** Toggle switch at top: 个人申请 | 企业方案

Defaults to 个人申请.

---

### Section 3a: B2C Pricing (个人申请 — 按次付费)

**Layout:** Two-column tier comparison (side by side), then a per-visa-type pricing breakdown table below.

#### Service Tier Cards (2 cards):

**顾问辅助 (Guided)**
- VIZA 顾问 + AI 全程指导
- 文件审核与材料清单
- 签证策略建议
- 由您自行完成最终提交
- 适合：有一定英语能力、希望节省费用的申请者
- Price: 从 ¥XXX 起（因签证类型而异）
- CTA: 选择此方案

**全程托管 (Full-service)** ★ 推荐
- 以上所有功能
- VIZA 代您完成申请提交
- 全程进度追踪与通知
- 优先顾问支持
- 适合：希望省心省力、无需自己操作的申请者
- Price: 从 ¥XXX 起（因签证类型而异）
- CTA: 选择此方案

#### Per-Visa-Type Pricing Table:

| 签证类型 | 顾问辅助价格 | 全程托管价格 |
|---------|------------|------------|
| 旅游签证 | ¥XXX | ¥XXX |
| 商务签证 | ¥XXX | ¥XXX |
| 工作签证 | ¥XXX | ¥XXX |
| 学生签证 | ¥XXX | ¥XXX |
| 长期居留签证 | ¥XXX | ¥XXX |
| 数字游民签证 | ¥XXX | ¥XXX |

Note below table: 政府官方签证费另计，具体金额因目的地国家而异，在申请开始前会明确告知。

---

### Section 3b: B2B Pricing (企业方案 — 月度订阅)

**Layout:** 3 subscription tier cards.

**基础企业版**
- 每月最多 X 个申请名额
- 所有签证类型
- AI 审核 + 顾问支持
- 邮件 + 微信客服
- Price: ¥XXX/月
- CTA: 选择此方案

**成长企业版** ★ 最受欢迎
- 每月最多 X 个申请名额
- 所有功能 + 优先处理
- 专属客户经理
- 申请状态实时推送
- 企业报告与数据汇总
- Price: ¥XXX/月
- CTA: 选择此方案

**大型企业版**
- 申请名额不限
- 以上所有功能
- 定制化服务 SLA
- 专属法律顾问支持
- Price: 联系销售获取报价
- CTA: 联系我们

---

### Section 4: What's Included (All Plans)

**Layout:** Checklist or feature grid.

All plans include:
- AI 文件完整性检查
- 专业签证顾问审核
- 全球目的地覆盖
- 中文全程支持
- 申请进度实时追踪
- 安全加密文件存储

---

### Section 5: Pricing FAQ

**Q:** 政府签证费包含在价格里吗？
**A:** 不含。政府官方签证费由目的地国家政府收取，金额因国家和签证类型而异。我们会在申请开始前明确告知具体金额。

**Q:** 如果签证申请被拒，是否退款？
**A:** 我们的 AI 审核 + 顾问团队会尽力降低被拒风险，但最终审批权在目的地国家政府。若因 VIZA 操作失误导致申请问题，将全额退款。

**Q:** 企业方案的申请名额是否可以叠加使用？
**A:** 不可。每月名额不累计至下月，建议根据实际月均需求选择方案。

**Q:** 个人申请完成后多久可以再次申请不同签证？
**A:** 随时可以。个人按次付费，每次申请独立计费。

**Q:** 支持哪些支付方式？
**A:** 支持信用卡/借记卡、支付宝、微信支付。企业方案支持对公转账。

---

### Section 6: CTA

**Headline:** 不确定选哪个方案？

**Body:** 联系我们的顾问，根据您的需求推荐最合适的方案。

**CTAs:** 立即开始申请 / 联系顾问

---

## 11. Page 11 — 博客 (Blog)

**Purpose:** SEO-driven content marketing. Establish VIZA as an authoritative source on visa information. Drive organic Chinese-speaking traffic. CMS-driven in Framer.

---

### Section 1: Hero

**Headline:** 签证资讯与攻略

**Subheadline:** 最新签证政策、申请攻略、目的地指南，由 VIZA 签证顾问团队撰写。

**Search bar:** 搜索文章...

---

### Section 2: Featured Article

**Layout:** Large hero card for the latest/pinned article. Title, category tag, date, excerpt, 阅读全文 link.

---

### Section 3: Category Filter

**Tabs/pills:**
- 全部
- 旅游签证
- 商务签证
- 工作签证
- 学生签证
- 长期居留
- 数字游民
- 签证政策动态
- 目的地指南

---

### Section 4: Article Grid

**Layout:** 3-column card grid (responsive 2-col mobile). Each card:
- Thumbnail image
- Category tag (colored pill)
- Article title
- Date + estimated read time
- 阅读全文 →

Load more / pagination below.

---

### Blog Article Template (/blog/[slug])

**Layout:** Standard long-form article layout.

Sections:
- Breadcrumb: 首页 > 博客 > [Category] > [Title]
- Article hero: title, author name + avatar, date, read time, category tag
- Article body (CMS rich text — Framer CMS)
- Author bio card at bottom
- Related articles (3 cards)
- CTA box mid-article and at end: 需要专业签证帮助？立即联系 VIZA 顾问

---

### Suggested Blog Post Titles (for AI content generation — titles only):

**旅游签证:**
- 2025 年东南亚热门目的地旅游签证完全攻略
- 申根区旅游签证申请指南：材料、流程与常见被拒原因
- 日本旅游签证最新政策解读：中国公民如何申请

**商务签证:**
- 商务签证 vs 旅游签证：出差该用哪一种？
- 美国商务签证（B-1）申请完整指南
- 参加海外展会如何申请商务签证

**工作签证:**
- 新加坡工作签证（EP/SP/WP）详解：如何选择与申请
- 企业海外派遣员工：工作签证申请常见误区
- 2025 年哪些国家的工作签证最容易申请？

**学生签证:**
- 英国学生签证（Student Visa）申请全流程
- 澳大利亚学生签证（Subclass 500）材料清单与时间规划
- 学生签证被拒的 5 大常见原因及如何避免

**长期居留 & 数字游民:**
- 数字游民签证盘点：2025 年哪些国家有最友好的政策？
- 泰国长期居留签证（LTR）：适合哪些人申请？
- 马来西亚 MM2H 计划最新政策解读

**签证政策动态:**
- 2025 年签证政策重大变化汇总：这些国家收紧了要求
- 免签协议扩大：中国护照新增哪些免签目的地？

---

## 12. Page 12 — 联系我们 (Contact)

**Purpose:** Make it easy for potential clients to reach VIZA. Both B2C inquiries and B2B sales.

---

### Section 1: Hero

**Headline:** 联系我们

**Subheadline:** 有任何关于签证申请或企业方案的问题，我们的团队随时为您解答。

---

### Section 2: Contact Methods

**Layout:** 3 cards side by side.

**Card 1 — 微信**
- WeChat QR code (scannable)
- 微信号: [WeChat ID]
- 工作日 9:00–18:00（新加坡时间）
- 最快响应

**Card 2 — 邮件**
- 邮箱: [email address]
- 工作日 24 小时内回复

**Card 3 — 电话**
- 电话: [phone number]
- 工作日 9:00–18:00（新加坡时间）

---

### Section 3: Contact Form

**Layout:** Clean form on left, office info on right.

**Form fields:**
- 姓名 (required)
- 邮箱 (required)
- 电话/微信号 (optional)
- 咨询类型 (dropdown): 个人签证申请 / 企业方案咨询 / 其他
- 目标国家/地区 (text input, optional)
- 签证类型 (dropdown): 旅游 / 商务 / 工作 / 学生 / 长期居留 / 数字游民 / 不确定
- 您的问题 (textarea, required)
- Submit button: 发送消息

**Right side — Office Info:**
- 办公地址: 227 Pasir Panjang Rd, Singapore 117341
- Map embed (Google Maps static or interactive)
- 办公时间: 周一至周五 9:00–18:00（新加坡时间）

---

### Section 4: FAQ Preview

3 common pre-sales questions with answers, link to /faq for full list.

---

## 13. SEO / Meta Tags

| Page | Title (zh-CN) | Meta Description (zh-CN) |
|------|--------------|--------------------------|
| Home | VIZA \| AI 签证代办服务 \| 旅游、商务、工作签证一站式申请 | 专业签证机构，AI 智能审核 + 人工顾问把关。覆盖旅游、商务、工作、学生等各类签证，全程中文服务，新加坡注册。 |
| About | 关于 VIZA \| 新加坡专业签证机构 | 了解 VIZA 的团队、使命与服务理念。新加坡注册签证机构，专业顾问 + AI 技术，致力于让签证申请更简单高效。 |
| Solutions | 签证服务 \| 覆盖全球主要目的地 \| VIZA | VIZA 提供旅游、商务、工作、学生、长期居留及数字游民六大类签证申请服务，覆盖全球主要目的地。 |
| Tourist | 旅游签证代办 \| VIZA 专业签证服务 | 旅游签证申请全程辅助，AI 文件审核 + 顾问支持，快速办理，覆盖全球主要旅游目的地。 |
| Business | 商务签证代办 \| VIZA 专业签证服务 | 商务出访签证申请，专业处理商务邀请函、行程安排等材料，高效办理，降低被拒风险。 |
| Work Permit | 工作签证代办 \| VIZA 专业签证服务 | 海外工作签证申请，企业派遣及个人就业均可办理，顾问全程把关，复杂情况专属方案。 |
| Student | 学生签证代办 \| VIZA 专业签证服务 | 海外留学签证申请，材料清单完整、时间规划准确，顾问辅助提高申请成功率。 |
| Long-term | 长期居留签证代办 \| VIZA 专业签证服务 | 长期居留签证申请辅助，针对各目的地国长期居留政策，提供专业申请策略。 |
| Digital Nomad | 数字游民签证代办 \| VIZA 专业签证服务 | 数字游民签证申请，覆盖全球主流数字游民签证计划，远程工作者的合规出行首选。 |
| Pricing | 价格方案 \| 个人与企业签证服务 \| VIZA | 查看 VIZA 签证服务价格。个人按次付费，企业月度订阅。透明定价，无隐藏费用。 |
| Blog | 签证资讯与攻略 \| VIZA 博客 | VIZA 签证顾问团队撰写的签证申请攻略、政策解读、目的地指南。帮您了解最新签证信息。 |
| Contact | 联系我们 \| VIZA 签证服务 | 联系 VIZA 签证顾问。微信、邮件、电话均可。新加坡办公室，工作日快速响应。 |

---

## 14. Framer Implementation Notes

- Use a clean SaaS or professional services Framer template as the base; replace all content
- Primary color: Navy `#03346E`
- Framer CMS for Blog: article title, slug, date, author, category, thumbnail, body (rich text), excerpt
- Framer CMS for Team (About page): name, title, photo, bio
- Framer CMS for Testimonials: quote, name, company, photo
- Pricing numbers (¥XXX) are all placeholder — Edward to fill before launch
- Government fees: mentioned only as a one-line footnote under pricing tables, never as a warning box or disclaimer
- Mobile responsive throughout — primary audience is on mobile (WeChat ecosystem)
- WeChat QR code in footer and Contact page must be scannable at rendered size
- B2C/B2B toggle on pricing page requires Framer interaction (show/hide variant)
- Blog category filter tabs require Framer CMS filtering

---

## 15. Out of Scope (Phase 1)

- English version of site (Phase 2)
- Languages other than zh-CN
- Immigration / permanent residency visa types
- Payment processing on the marketing site (handled in the internal platform after signup)
- Live chat widget (WeChat handles this)
- Country-specific sub-pages (covered within each visa type page generically)
- Job listings / careers page
- Press / media page
