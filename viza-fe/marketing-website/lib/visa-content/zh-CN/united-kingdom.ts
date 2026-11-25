import type { DestinationContent } from "../types";

/** 英国签证（新加坡办理）简体中文版。事实核对日期、来源与未能确认的事项见 ../united-kingdom.ts。 */
export const unitedKingdom: DestinationContent = {
  slug: "united-kingdom",

  heroTitle: "新加坡办理英国签证",
  lede: "在新加坡办理英国签证，看的是您持哪本护照。新加坡和马来西亚护照不需要签证，办 ETA 电子旅行授权即可入境，每次最长停留 6 个月。如果您住在新加坡，持中国、印度、印尼、菲律宾或越南护照，就需要办标准访客签证。本页讲清楚新加坡的英国签证申请流程：在线表格、录指纹预约、费用、按准证类型准备的材料，以及常见的拒签原因。",
  heroImage: "/assets/heroes/united-kingdom.jpg",
  meta: [
    { k: "新加坡护照", v: "办 ETA，最长 6 个月" },
    { k: "签证费", v: "6 个月签证 135 英镑" },
    { k: "办理方式", v: "在线申请，再录指纹" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "材料核对" },
    { icon: "bolt", label: "签证与 ETA" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "新加坡、马来西亚护照不需要（办 ETA）。中国、印度、印尼、菲律宾、越南护照需要",
      govFee: "6 个月标准访客签证 135 英镑。ETA 约 20 英镑",
      processing: "一般在您申请、录指纹并递交材料后 3 周内出结果",
      maxStay: "每次最长 6 个月",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "护照决定适用的规则。新加坡 PR 和准证持有人，按各自所持护照的规则办理。英国有一份可以办 ETA 的国籍名单，名单以外的护照都要申请签证。",
      rows: [
        { passport: "新加坡", status: "不需要签证，要办 ETA", note: "出发前在英国 ETA 应用程序里申请 ETA。获批后每次可访问最长 6 个月。" },
        { passport: "中国（PRC）", status: "需要签证", note: "中国护照不能办 ETA。住在新加坡的中国护照持有人，申请标准访客签证。" },
        { passport: "马来西亚", status: "不需要签证，要办 ETA", note: "马来西亚在 ETA 名单上，住在新加坡的马来西亚人办 ETA，不用办签证。" },
        { passport: "印度", status: "需要签证", note: "在线申请标准访客签证，并到签证申请中心录指纹。" },
        { passport: "印度尼西亚", status: "需要签证", note: "印尼不在 ETA 名单上，申请标准访客签证。" },
        { passport: "菲律宾", status: "需要签证", note: "菲律宾不在 ETA 名单上，申请标准访客签证。" },
        { passport: "越南", status: "需要签证", note: "越南不在 ETA 名单上，申请标准访客签证。" },
        { passport: "其他护照", status: "请查看英国政府网站", note: "英国政府网站有查询工具，告诉您需要签证还是 ETA。您的国籍不能办 ETA，就需要签证。" },
      ],
    },

    visaTypes: {
      intro: "英国有几种访客签证。住在新加坡、为度假或探亲出行的人，大多办标准访客签证。",
      items: [
        { title: "标准访客签证，6 个月", body: "用于旅游、探亲和短期商务会议，最长 6 个月，费用 135 英镑。这是申请人问得最多的一种。" },
        { title: "长期标准访客签证，2、5 或 10 年", body: "适合常去英国的人。费用是 2 年 506 英镑、5 年 903 英镑、10 年 1,128 英镑。每次停留仍然最长 6 个月，申请时要附上旅行记录。" },
        { title: "就医与学术访客", body: "为私人就医办理的标准访客签证最长 11 个月，学术访客最长 12 个月，各为 234 英镑，另需医生、医院或大学出具的材料。" },
        { title: "过境及其他途径", body: "访客过境签证费用是 74.50 英镑，用于途经英国。结婚、读书和工作要办其他签证，标准访客不能在英国从事有薪工作，也不能结婚。" },
      ],
    },

    residents: {
      intro: "录指纹的预约在网上申请时一并预订，签证申请中心可以在其他国家。住在新加坡的人订预约时选新加坡的中心。您的准证说明您住在这里。",
      rows: [
        { pass: "工作准证（EP）", body: "带上 EP 卡、写明职位、薪水和已批准假期的在职证明，以及近期银行流水。这是在新加坡工作的中国和印度护照持有人最常走的路。" },
        { pass: "S 准证", body: "带上 S 准证卡、在职证明和银行流水。清单与工作准证相同。" },
        { pass: "家属准证（DP）", body: "带上家属准证和主准证持有人的准证复印件，加上结婚或出生证明。如果由主准证持有人付费，再附上其银行流水和一封信。" },
        { pass: "永久居民（PR）", body: "带上 PR 卡或再入境许可，以及您在新加坡工作或经营的证明。您以本国护照申请，新加坡护照的 ETA 规则不适用于您。" },
        { pass: "新加坡公民", body: "无需签证。办 ETA，带上申请时用的同一本护照，并在有电子护照闸机的地方通关。" },
        { pass: "学生准证", body: "带上学生准证和注明学期日期的学校证明信。父母可以出具支持信，并附银行流水。" },
      ],
    },

    fees: {
      intro: "签证费由英国政府制定，您付给英国签证与移民局。VIZA 的协助免费。每位家人都要各自申请、缴费和预约。",
      rows: [
        { item: "标准访客签证，6 个月", amount: "135 英镑", note: "英国政府网站上的收费，申请时在线支付。" },
        { item: "长期签证，2 年", amount: "506 英镑", note: "每次停留仍然最长 6 个月。" },
        { item: "长期签证，5 年", amount: "903 英镑", note: "每次停留仍然最长 6 个月。" },
        { item: "长期签证，10 年", amount: "1,128 英镑", note: "每次停留仍然最长 6 个月。" },
        { item: "就医或学术访客", amount: "234 英镑", note: "就医最长 11 个月，学术访客最长 12 个月。" },
        { item: "电子旅行授权（ETA）", amount: "约 20 英镑", note: "适用于新加坡和马来西亚护照。确切费用以 ETA 应用程序显示为准。" },
        { item: "签证中心服务费", amount: "由中心制定", note: "预约时，中心会列出自己的服务费和可选服务。" },
      ],
      processing: "英国签证与移民局表示，一般在您申请、证明身份并递交材料后 3 周内给出决定。最早可在出行前 3 个月申请。部分情况可以加费办理更快的决定，请看预约页面。ETA 通常很快，起飞前要先收到批准邮件。",
    },

    apply: {
      intro: "先决定走哪条路。新加坡和马来西亚护照用 ETA 应用程序，其他护照用在线签证表格，再加一次录指纹预约。",
      guided: {
        title: "自助指引",
        body: "VIZA 的 AI 带您完成英国签证表格，并按您的准证类型列出材料清单。表格、预约和到场都由您自己完成。",
      },
      fullService: {
        title: "全程服务",
        body: "VIZA 顾问帮您准备答案，核对银行流水、在职证明和表格是否一致，并为预约当天准备好材料。",
      },
      steps: [
        { title: "确认办理途径", body: "我们先确认您的护照需要签证还是 ETA，以及可以申请的日期。" },
        { title: "填写在线表格", body: "在英国签证与移民局网站填写表格，包括出行日期、住宿、行程费用、住址记录和收入。" },
        { title: "录指纹", body: "预订新加坡的签证申请中心。您要录指纹、拍照、出示护照并递交材料。" },
        { title: "等候结果", body: "英国签证与移民局作出决定后，护照寄回。在结果出来前，请不要订不可退款的机票。" },
      ],
    },

    checklist: {
      intro: "英国要求一份核心清单，并核对材料与表格是否吻合。递交前，请对照英国政府网站最新的证明材料指南。",
      groups: [
        {
          applicant: "所有申请人",
          items: [
            "护照有效期覆盖整个停留期",
            "出行日期、住宿和行程费用估算",
            "住址和住址记录",
            "能说明资金来源的银行流水",
            "近 10 年的旅行记录（如有）",
            "非英文、非威尔士文的文件需附经认证的翻译",
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
          ],
        },
      ],
    },

    travel: {
      intro: "签证或 ETA 让您可以出行。能否入境，由边境部队的官员在柜台决定。",
      items: [
        { title: "没有入境卡", body: "英国没有纸质或电子入境卡。航空公司会在登机前核对您的签证或 ETA。" },
        { title: "边检提问", body: "请准备好说明住宿、旅费来源和回程机票。签证或 ETA 不保证一定能入境。" },
        { title: "新加坡护照的 ETA", body: "在英国 ETA 应用程序里，用护照和一张自拍申请。ETA 允许每次停留最长 6 个月。" },
        { title: "访客不能做的事", body: "访客不能工作、领取福利、结婚，也不能靠反复来访在英国长期生活。获准的有薪活动是例外，需要另外准备材料。" },
        { title: "逾期滞留", body: "请在获准的期限内离境。逾期可能被禁止再入境。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照英国政府网站核对。费用和规定会变动，付款前请查看页尾“来源”里的链接。",
    },

    related: {
      destinations: ["france", "schengen", "united-states", "canada"],
      guides: [
        { label: "新加坡护照免签国家", href: "/guides/visa-free-countries-singapore-passport" },
        { label: "新加坡的中国护照持有人办签证", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "新加坡的菲律宾和印度居民办签证", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "电子旅行授权和签证的区别", href: "/guides/eta-vs-visa" },
        { label: "签证被拒：原因和重新申请", href: "/guides/visa-refused-reapply" },
        { label: "各国签证照片要求", href: "/guides/visa-photo-requirements" },
        { label: "英国政府网站：访客证明材料指南", href: "https://www.gov.uk/government/publications/visitor-visa-guide-to-supporting-documents/guide-to-supporting-documents-visiting-the-uk" },
        { label: "VIZA 签证资讯", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "常见拒签原因",
  rejectionSub: "英国签证与移民局按“真实访客”规则审查每一份访客申请。下面是顾问最先检查的几点。",
  rejectionReasons: [
    { title: "看不出您会离开英国", body: "在新加坡居住时间短、没有在职证明，或计划模糊，都让人更难相信您访问后会回家。" },
    { title: "资金来源不明", body: "银行流水看不出钱从哪里来，或在申请前突然存入大笔款项，会引起疑问。" },
    { title: "材料与表格不一致", body: "表格上的收入、工作和行程费用，要与您的信件和流水吻合。不一致是常见的拒签原因。" },
    { title: "移民记录", body: "以往被拒签、逾期滞留，或频繁长时间访问英国，都需要清楚说明。" },
    { title: "虚假或不可靠的材料", body: "无法信任的文件会导致拒签，还可能被长期禁止申请。" },
    { title: "访客不能做的计划", body: "如有证据显示您打算工作、结婚，或在没有对应签证的情况下私人就医，这是拒签的理由。" },
  ],

  faqSub: "没有找到答案？请问下面的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "我需要签证吗", q: "新加坡公民去英国需要签证吗？", a: "不需要。新加坡护照持有人用 ETA 访问英国，最长 6 个月。ETA 费用约 20 英镑，出发前在英国 ETA 应用程序里申请。" },
    { category: "我需要签证吗", q: "住在新加坡的中国护照持有人需要英国签证吗？", a: "需要。中国不在 ETA 名单上，所以您要在线申请标准访客签证，并到签证申请中心录指纹。" },
    { category: "我需要签证吗", q: "住在新加坡的马来西亚人需要英国签证吗？", a: "不需要。马来西亚在 ETA 名单上，出行前办 ETA 即可。" },
    { category: "我需要签证吗", q: "印度、印尼、菲律宾和越南护照需要英国签证吗？", a: "需要。这几本护照都不能办 ETA，各自申请标准访客签证。" },
    { category: "在新加坡办理", q: "怎样在新加坡申请英国签证？", a: "填写在线的英国签证表格，缴费，再在签证申请中心预约并选新加坡。您要录指纹、拍照并递交材料。" },
    { category: "在新加坡办理", q: "需要预约录指纹吗？", a: "办签证需要。您在中心录指纹、拍照并出示护照。办 ETA 不需要预约。" },
    { category: "在新加坡办理", q: "什么时候可以申请？", a: "最早在出行前 3 个月。英国签证与移民局一般在您申请、录指纹并递交材料后 3 周内给出决定。" },
    { category: "在新加坡办理", q: "全家可以一起申请吗？", a: "每位家人都要各自申请、缴费和预约，预约时间可以订得相近。" },
    { category: "费用与时间", q: "在新加坡办英国签证要多少钱？", a: "6 个月标准访客签证 135 英镑。长期签证 2 年 506 英镑、5 年 903 英镑、10 年 1,128 英镑。" },
    { category: "费用与时间", q: "可以办更长期的英国签证吗？", a: "可以。常去的访客可以申请 2、5 或 10 年的签证。每次停留仍然最长 6 个月，申请时要附上旅行记录。" },
    { category: "拒签", q: "英国签证被拒怎么办？", a: "英国签证与移民局会寄来说明理由的通知。再次申请前，请先请顾问看一遍，因为新的申请应该回应每一点。" },
    { category: "出行前", q: "持标准访客签证可以在英国工作吗？", a: "不可以。访客不能工作、领取福利或结婚。获准的有薪活动是例外，需要另外准备材料。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，您直接向英国政府缴付费用。" },
  ],

  sources: [
    { label: "英国政府网站，标准访客签证", url: "https://www.gov.uk/standard-visitor", display: "gov.uk" },
    { label: "英国政府网站，申请标准访客签证", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa", display: "gov.uk" },
    { label: "英国政府网站，证明材料指南", url: "https://www.gov.uk/government/publications/visitor-visa-guide-to-supporting-documents/guide-to-supporting-documents-visiting-the-uk", display: "gov.uk" },
    { label: "英国政府网站，查看何时可办 ETA", url: "https://www.gov.uk/guidance/check-when-you-can-get-an-electronic-travel-authorisation-eta", display: "gov.uk" },
    { label: "英国政府网站，申请访问英国的 ETA", url: "https://www.gov.uk/eta/apply", display: "gov.uk" },
    { label: "英国签证费用计算器", url: "https://visa-fees.homeoffice.gov.uk/y/singapore/sgd/visit/all", display: "visa-fees.homeoffice.gov.uk" },
    { label: "英国签证与移民局在线申请", url: "https://visas-immigration.service.gov.uk/apply-visa-type/visit", display: "visas-immigration.service.gov.uk" },
  ],

  price: {
    etaLabel: "出结果时间",
    etaValue: "一般 3 周内",
    title: "标准访客签证 · 最长 6 个月",
    sub: "VIZA 的协助免费：表格准备和材料审阅。签证费支付给英国签证与移民局。",
    foot: "VIZA 的服务免费。英国签证费直接支付给英国签证与移民局。",
  },

  aiPlaceholder: "询问新加坡办理英国签证的任何问题：ETA、费用、材料、录指纹…",
};

export default unitedKingdom;
