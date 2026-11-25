import type { DestinationContent } from "../types";

/** 澳洲签证（新加坡办理）简体中文版。事实核对日期、来源与未能确认的事项见 ../australia.ts。 */
export const australia: DestinationContent = {
  slug: "australia",

  heroTitle: "新加坡办理澳洲签证",
  lede: "在新加坡办理澳洲签证，看的是您持哪本护照，而且没有哪本护照可以不经任何批准就前往澳洲。新加坡和马来西亚护照在澳洲 ETA 应用程序里申请 ETA。如果您住在新加坡，持中国、印度、印尼、菲律宾或越南护照，就要申请访客签证（subclass 600），也就是澳洲旅游签证。本页讲清楚澳洲签证申请：ETA、2026 年 7 月 1 日起的费用、按准证类型准备的材料，以及常见的拒签原因。",
  heroImage: "/assets/heroes/australia.jpg",
  meta: [
    { k: "新加坡护照", v: "办 ETA，仅限应用程序" },
    { k: "旅游签证费", v: "澳洲境外申请 250 澳元" },
    { k: "办理方式", v: "ImmiAccount 或 ETA 应用程序" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "材料核对" },
    { icon: "bolt", label: "ETA 与签证" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "每本护照都需要批准。新加坡、马来西亚护照办 ETA。中国、印度、印尼、菲律宾、越南护照申请访客签证",
      govFee: "旅游类别在澳洲境外申请 250 澳元。ETA 没有签证费，应用程序服务费约 20 澳元",
      processing: "ETA 常在几分钟到几小时内出结果。访客签证由澳洲内政部安排，请提前 1 至 2 个月申请",
      maxStay: "ETA 每次最长 3 个月。访客签证按批准结果为 3、6 或 12 个月",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "护照决定走哪条路。新加坡 PR 和准证持有人，按各自所持护照的规则办理。澳洲内政部公布可办 ETA 的护照名单，名单以外的护照都申请访客签证。",
      rows: [
        { passport: "新加坡", status: "办 ETA，仅限应用程序", note: "在澳洲 ETA 应用程序里用护照和照片申请。每次访问最长 3 个月，12 个月内有效。停留超过 3 个月要办访客签证。" },
        { passport: "中国（PRC）", status: "需要访客签证", note: "中国护照不能办 ETA。住在新加坡的中国护照持有人，在 ImmiAccount 申请访客签证（subclass 600）。" },
        { passport: "马来西亚", status: "办 ETA，仅限应用程序", note: "马来西亚在 ETA 名单上，住在新加坡的马来西亚人在 ETA 应用程序里申请。" },
        { passport: "印度", status: "需要访客签证", note: "在线申请访客签证。请带上工作证明、准证和存款证明。" },
        { passport: "印度尼西亚", status: "需要访客签证", note: "在 ImmiAccount 在线申请访客签证。" },
        { passport: "菲律宾", status: "需要访客签证", note: "在线申请访客签证。银行流水请多留些时间准备。" },
        { passport: "越南", status: "需要访客签证", note: "在 ImmiAccount 在线申请访客签证。" },
        { passport: "其他护照", status: "请查看澳洲内政部", note: "部分欧洲护照用 eVisitor 签证，部分亚洲和北美护照用 ETA。澳洲内政部有针对您护照的查询工具。" },
      ],
    },

    visaTypes: {
      intro: "澳洲有几种访问方式。住在新加坡、为度假或探亲出行的人，大多用 ETA 或访客签证。",
      items: [
        { title: "ETA（subclass 601）", body: "适用于符合条件的护照。您在澳洲 ETA 应用程序里申请，没有签证费，应用程序另收约 20 澳元的服务费。12 个月内可多次访问，每次最长 3 个月。" },
        { title: "访客签证（subclass 600），旅游类别", body: "也就是澳洲旅游签证，涵盖度假和探亲。澳洲内政部批准 3、6 或 12 个月的停留，并决定单次还是多次入境。旅游最常见的是 3 个月。" },
        { title: "常客类别", body: "为经常去澳洲的人设计的较长签证。费用 1,845 澳元，最长可批 10 年，每次停留最长 3 个月。" },
        { title: "工作、学习及其他签证", body: "在澳洲工作、读书或居住需要办其他签证。访客签证不允许工作，学习也有限制。" },
      ],
    },

    residents: {
      intro: "您在线申请，办访客签证时在 ImmiAccount 上传材料。您的准证说明您住在新加坡，有助于官员看到您的联系和回来的打算。",
      rows: [
        { pass: "工作准证（EP）", body: "带上 EP 卡、写明职位、薪水和已批准假期的在职证明，以及 3 至 6 个月的银行流水。这是在新加坡工作的中国和印度护照持有人最常走的路。" },
        { pass: "S 准证", body: "带上 S 准证卡、在职证明和银行流水。清单与工作准证相同。" },
        { pass: "家属准证（DP）", body: "带上家属准证和主准证持有人的准证复印件，加上结婚或出生证明，以及主准证持有人的银行流水和支持信。" },
        { pass: "永久居民（PR）", body: "带上 PR 卡或再入境许可，以及您在新加坡工作或经营的证明。您以本国护照申请，新加坡护照的 ETA 规则不适用于您。" },
        { pass: "新加坡公民", body: "起飞前在应用程序里申请 ETA。批准与护照绑定，有电子护照闸机的地方可以使用。" },
        { pass: "学生准证", body: "带上学生准证和注明学期日期的学校证明信。父母可以出具支持信，并附银行流水。" },
      ],
    },

    fees: {
      intro: "签证费由澳洲内政部制定，也付给内政部。VIZA 的协助免费。费用以递交当天的标准为准，所以之后调价不影响您已经递交的申请。",
      rows: [
        { item: "访客签证，旅游类别，澳洲境外申请", amount: "250 澳元", note: "自 2026 年 7 月 1 日起，之前是 200 澳元。" },
        { item: "访客签证，旅游类别，澳洲境内申请", amount: "630 澳元", note: "自 2026 年 7 月 1 日起，之前是 500 澳元。" },
        { item: "常客类别", amount: "1,845 澳元", note: "自 2026 年 7 月 1 日起，之前是 1,480 澳元。" },
        { item: "ETA（subclass 601）", amount: "没有签证费", note: "ETA 应用程序另收约 20 澳元的服务费，不可退款。" },
      ],
      processing: "澳洲内政部公布访客签证的处理时间，并每月更新，所以递交前请先查看页面。请在出行前 1 至 2 个月申请，拿到批准后再订机票。ETA 常在几分钟到几小时内出结果，也可能更久。",
    },

    apply: {
      intro: "先决定走哪条路。新加坡和马来西亚护照用 ETA 应用程序，其他护照在 ImmiAccount 填写在线的访客签证表格。",
      guided: {
        title: "自助指引",
        body: "VIZA 的 AI 带您完成表格，并按您的准证类型列出材料清单。您自己在 ImmiAccount 或 ETA 应用程序里递交，每个答案都由您掌控。",
      },
      fullService: {
        title: "全程服务",
        body: "VIZA 顾问帮您准备答案，核对银行流水、在职证明和行程是否一致，并为递交准备好档案。",
      },
      steps: [
        { title: "确认办理途径", body: "我们先确认您的护照可以办 ETA 还是要办访客签证，以及您打算停留多久。" },
        { title: "准备档案", body: "备好护照、照片、银行流水、在职证明，以及一份简单的行程计划。" },
        { title: "在线递交", body: "在 ImmiAccount 递交访客签证，或在澳洲 ETA 应用程序里申请 ETA，费用由您自己支付。" },
        { title: "等候批准", body: "澳洲内政部通过电邮通知结果。签证与护照电子绑定，护照上不会贴标签。拿到批准前，请不要订不可退款的机票。" },
      ],
    },

    checklist: {
      intro: "澳洲内政部要求一份核心清单，并可能要求更多。下面是通用的核心清单，递交前请对照最新的表格。",
      groups: [
        {
          applicant: "所有申请人",
          items: [
            "护照有效期覆盖整个停留期，最好再多 6 个月",
            "近期彩色照片",
            "近 3 至 6 个月的银行流水",
            "注明已批准假期的在职证明，或公司注册文件",
            "简单的行程和您与新加坡的联系",
          ],
        },
        {
          applicant: "工作准证与 S 准证",
          items: [
            "准证卡，正反面复印件",
            "写明职位、薪水和已批准假期的在职证明",
            "工资单和本人银行流水",
          ],
        },
        {
          applicant: "家属准证",
          items: [
            "家属准证卡和主准证持有人的准证复印件",
            "能证明关系的结婚或出生证明",
            "主准证持有人的银行流水和支持信",
          ],
        },
        {
          applicant: "永久居民",
          items: [
            "PR 卡或再入境许可",
            "在新加坡工作或经营的证明",
            "本人银行流水",
          ],
        },
        {
          applicant: "学生",
          items: [
            "学生准证和注明学期日期的学校证明信",
            "父母的支持信和他们的银行流水",
            "未与父母双方同行的儿童，需出生证明和同意书",
          ],
        },
        {
          applicant: "中国护照持有人",
          items: [
            "身份证，正反面",
            "户口簿页（如被要求）",
            "澳洲内政部清单中针对中国申请人列出的申请表",
          ],
        },
      ],
    },

    travel: {
      intro: "ETA 或签证让您可以出行。能否入境，由边境部队的官员在机场决定。",
      items: [
        { title: "签证与护照电子绑定", body: "入境时不会盖章。登机前请先持有 ETA 或访客签证，并使用申请时的同一本护照。" },
        { title: "入境旅客卡", body: "每位抵达的旅客都要填写入境旅客卡，其中有生物安全方面的问题，请仔细阅读。" },
        { title: "生物安全", body: "请申报食品、植物和动物制品。虚假申报的罚款很重，官员会检查行李。" },
        { title: "SmartGate", body: "新加坡和中国的电子护照可以在主要机场使用 SmartGate。" },
        { title: "延长停留或逾期滞留", body: "访客签证不能延长，要在到期前重新递交申请。逾期 28 天或以上，可能被禁止再入境 3 年。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照澳洲内政部和澳洲驻新加坡高级专员公署核对。费用和规定会变动，付款前请查看页尾“来源”里的链接。",
    },

    related: {
      destinations: ["indonesia", "malaysia", "vietnam", "thailand"],
      guides: [
        { label: "新加坡的中国护照持有人办签证", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "新加坡的菲律宾和印度居民办签证", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "电子旅行授权和签证的区别", href: "/guides/eta-vs-visa" },
        { label: "签证被拒：原因和重新申请", href: "/guides/visa-refused-reapply" },
        { label: "各国签证照片要求", href: "/guides/visa-photo-requirements" },
        { label: "澳洲内政部：签证处理时间", href: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times" },
        { label: "VIZA 签证资讯", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "常见拒签原因",
  rejectionSub: "澳洲内政部按每份档案单独作出决定。下面是顾问最先检查的几点。",
  rejectionReasons: [
    { title: "看不出您会回家", body: "官员需要相信您是真实的访客。联系薄弱，例如准证期限短、没有在职证明或目的含糊，是最常见的问题。" },
    { title: "资金来源不明", body: "银行流水看不出稳定的储蓄或收入，或在申请前突然存入大笔款项，会引起谁来付费的疑问。" },
    { title: "材料不完整或不清楚", body: "缺在职证明、扫描件看不清，或缺身份文件，都会造成延误和拒签。" },
    { title: "信息有误", body: "虚假或有误导的陈述可能导致拒签，并被禁止再次申请。每个问题都请如实回答。" },
    { title: "以往的签证问题", body: "以往逾期滞留或违反签证条件，需要清楚说明。" },
    { title: "健康或品行方面的顾虑", body: "健康要求以及品行方面的原因，例如犯罪记录，都可能导致拒签。" },
  ],

  faqSub: "没有找到答案？请问下面的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "我需要签证吗", q: "新加坡公民去澳洲需要签证吗？", a: "新加坡护照持有人需要 ETA，在澳洲 ETA 应用程序里申请。12 个月内每次访问最长 3 个月。停留更久要办访客签证。" },
    { category: "我需要签证吗", q: "澳洲签证的 ETA 是什么？", a: "ETA（subclass 601）是符合条件的护照使用的、仅限应用程序申请的旅行授权。没有签证费，应用程序另收约 20 澳元的服务费，与护照绑定。" },
    { category: "我需要签证吗", q: "住在新加坡的中国护照持有人需要澳洲旅游签证吗？", a: "需要。中国护照不能办 ETA，所以您要在 ImmiAccount 在线申请访客签证（subclass 600）。" },
    { category: "我需要签证吗", q: "住在新加坡的印度、印尼、菲律宾和越南护照需要签证吗？", a: "需要。各自在线申请访客签证，并附上工作、存款和与新加坡联系的证明。" },
    { category: "在新加坡办理", q: "怎样在新加坡办理澳洲签证申请？", a: "先确认护照的途径。新加坡和马来西亚护照用 ETA 应用程序，其他护照在 ImmiAccount 递交访客签证并上传材料。" },
    { category: "在新加坡办理", q: "要去哪里申请，需要跑一趟吗？", a: "全程在线。您在新加坡通过 ImmiAccount 或 ETA 应用程序递交。如果需要体检或生物识别，澳洲内政部会通知您。" },
    { category: "在新加坡办理", q: "持旅游签证可以停留多久？", a: "澳洲内政部每次批准 3、6 或 12 个月，并决定单次还是多次入境。旅游最常见的是 3 个月。" },
    { category: "费用与时间", q: "澳洲旅游签证要多少钱？", a: "自 2026 年 7 月 1 日起，旅游类别在澳洲境外申请是 250 澳元，常客类别是 1,845 澳元。ETA 没有签证费，应用程序服务费约 20 澳元。" },
    { category: "费用与时间", q: "澳洲签证要办多久？", a: "ETA 常在几分钟到几小时内出结果。访客签证的处理时间由澳洲内政部公布，每月都会变，所以请在出行前 1 至 2 个月申请。" },
    { category: "费用与时间", q: "澳洲访客签证可以延长吗？", a: "不可以。您要在现有签证到期前重新递交申请。在澳洲境内申请是 630 澳元，部分签证附有“不得再延长停留”的条件。" },
    { category: "拒签", q: "澳洲签证被拒怎么办？", a: "澳洲内政部不退费，并会说明原因。最常见的原因是官员不确定您是真实的访客。再次申请前，请先请顾问看一遍。" },
    { category: "出行前", q: "去澳洲需要入境卡吗？", a: "需要。每位抵达的旅客都要填写入境旅客卡，其中有生物安全问题。部分航线正在试行电子版本。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，您直接向澳洲内政部缴付费用。" },
  ],

  sources: [
    { label: "澳洲内政部，访客签证（subclass 600）", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600", display: "immi.homeaffairs.gov.au" },
    { label: "澳洲内政部，电子旅行授权（subclass 601）", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601", display: "immi.homeaffairs.gov.au" },
    { label: "澳洲内政部，当前签证收费", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/fees-and-charges/current-visa-pricing", display: "immi.homeaffairs.gov.au" },
    { label: "澳洲内政部，全球签证处理时间", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times", display: "immi.homeaffairs.gov.au" },
    { label: "ImmiAccount", url: "https://online.immi.gov.au/lusc/login", display: "online.immi.gov.au" },
    { label: "澳洲边境部队，入境旅客卡", url: "https://www.abf.gov.au/entering-and-leaving-australia/crossing-the-border/at-the-border/incoming-passenger-card-(ipc)", display: "abf.gov.au" },
    { label: "澳洲驻新加坡高级专员公署，签证与移民", url: "https://singapore.highcommission.gov.au/sing/Visas_and_Migration.html", display: "singapore.highcommission.gov.au" },
  ],

  price: {
    etaLabel: "处理时间",
    etaValue: "由澳洲内政部安排",
    title: "访客签证或 ETA",
    sub: "VIZA 的协助免费：表格准备和材料审阅。签证费支付给澳洲内政部。",
    foot: "VIZA 的服务免费。澳洲签证费直接支付给澳洲内政部。",
  },

  aiPlaceholder: "询问新加坡办理澳洲签证的任何问题：ETA、费用、材料…",
};

export default australia;
