import type { DestinationContent } from "../types";

/** 加拿大签证（新加坡办理）简体中文版。事实核对日期、来源与未能确认的事项见 ../canada.ts。 */
export const canada: DestinationContent = {
  slug: "canada",

  heroTitle: "新加坡办理加拿大签证",
  lede: "在新加坡办理加拿大签证，看的是您持哪本护照。新加坡护照免签，乘飞机入境只需办 eTA。如果您住在新加坡，持中国、马来西亚、印度、印尼或越南护照，就需要办加拿大旅游签证，也就是访客签证，要在线申请并录生物识别信息。本页讲清楚从新加坡申请加拿大签证的流程：谁需要签证、费用、按准证类型准备的材料，以及常见的拒签原因。",
  heroImage: "/assets/heroes/canada.jpg",
  meta: [
    { k: "新加坡护照", v: "乘飞机办 eTA，7 加元" },
    { k: "访客签证费", v: "100 加元，另加 85 加元生物识别费" },
    { k: "办理方式", v: "在线申请，再录生物识别" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "材料核对" },
    { icon: "bolt", label: "签证与 eTA" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "新加坡护照不需要（乘飞机办 eTA）。中国、马来西亚、印度、印尼、越南护照需要",
      govFee: "访客签证 100 加元，另加生物识别 85 加元。eTA 7 加元",
      processing: "由加拿大移民部公布，可在其处理时间查询工具中查看，视您的档案由哪里处理而定",
      maxStay: "通常每次最长 6 个月，由边检官员决定",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "护照决定适用的规则。新加坡 PR 和准证持有人，按各自所持护照的规则办理。加拿大移民部公布免签国家和需要签证国家的名单，下表列出在新加坡最常见的几种护照。",
      rows: [
        { passport: "新加坡", status: "免签，乘飞机办 eTA", note: "飞往加拿大前申请 eTA，费用 7 加元，大多数申请几分钟内获批。陆路或海路入境一般只需有效护照。" },
        { passport: "中国（PRC）", status: "需要访客签证", note: "住在新加坡的中国护照持有人，申请访客签证并录生物识别信息。" },
        { passport: "马来西亚", status: "需要访客签证", note: "马来西亚不在“可用 eTA 代替签证”的国家名单上，所以马来西亚人要办访客签证。" },
        { passport: "印度", status: "需要访客签证", note: "在线申请访客签证并录生物识别信息。加拿大移民部按国家公布处理时间。" },
        { passport: "印度尼西亚", status: "需要访客签证", note: "印尼不在需要签证国家的 eTA 名单上，请申请访客签证。" },
        { passport: "菲律宾", status: "需要签证，符合条件可办 eTA", note: "菲律宾护照持有人如果近 10 年内持有过加拿大访客签证，或持有有效的美国非移民签证，乘飞机时可以用 eTA 代替签证。" },
        { passport: "越南", status: "需要访客签证", note: "越南不在需要签证国家的 eTA 名单上，请申请访客签证。" },
        { passport: "其他护照", status: "请使用移民部查询工具", note: "加拿大移民部有入境要求查询工具，会告诉您的护照需要签证还是 eTA。" },
      ],
    },

    visaTypes: {
      intro: "加拿大按护照和事由发放访客文件。住在新加坡、为度假、探亲或短期商务出行的人，大多用前两种。",
      items: [
        { title: "访客签证（TRV）", body: "用于旅游、探亲和短期商务。签证最长可有效 10 年，或到护照或生物识别信息到期为止，以先到者为准，官员也可以定更短的日期。每次停留通常最长 6 个月。" },
        { title: "eTA", body: "电子旅行授权，适用于免签护照，以及部分需要签证的护照，在您乘飞机飞往或经过加拿大机场时使用。费用 7 加元，与护照绑定。" },
        { title: "超级签证", body: "适用于加拿大公民或永久居民的父母或祖父母。每次可停留最长 5 年，10 年内可多次入境。" },
        { title: "学习、工作及其他许可", body: "在加拿大读书、工作或居住需要办其他许可。商务访客的停留要少于 6 个月。有薪工作和读书是另外的申请。" },
      ],
    },

    residents: {
      intro: "您用所持护照在线申请，并在新加坡的签证申请中心录生物识别信息。您的准证说明您住在这里，有助于官员看到您的联系和回来的打算。",
      rows: [
        { pass: "工作准证（EP）", body: "带上 EP 卡、写明职位、薪水和已批准假期的在职证明，以及 6 个月的银行流水。这是在新加坡工作的中国、印度和马来西亚护照持有人最常走的路。" },
        { pass: "S 准证", body: "带上 S 准证卡、在职证明和 6 个月的银行流水。清单与工作准证相同。" },
        { pass: "家属准证（DP）", body: "带上家属准证和主准证持有人的准证复印件，加上结婚或出生证明，以及主准证持有人的银行流水和支持信。" },
        { pass: "永久居民（PR）", body: "带上 PR 卡或再入境许可，以及您在新加坡工作或经营的证明。您以本国护照申请，新加坡护照的 eTA 规则不适用于您。" },
        { pass: "新加坡公民", body: "无需签证。乘飞机前办好 eTA，并保留申请时用的护照。陆路或海路入境一般只需有效护照。" },
        { pass: "学生准证", body: "带上学生准证和注明学期日期的学校证明信。父母可以出具支持信，并附银行流水。" },
      ],
    },

    fees: {
      intro: "下面所有费用都由加拿大移民部制定，也付给移民部。VIZA 的协助免费。部分申请人可以免缴一部分费用，请查看移民部页面了解您的情况。",
      rows: [
        { item: "访客签证", amount: "100 加元", note: "每人收费。5 人或以上的家庭合计 500 加元。" },
        { item: "生物识别", amount: "85 加元", note: "每人收费，家庭最多 170 加元。首次申请的人在递交时缴付。" },
        { item: "eTA", amount: "7 加元", note: "填完表后立即在线支付，不可退款。" },
        { item: "访客记录（延长停留）", amount: "100 加元", note: "在停留期结束前在线申请。当前费用请看移民部页面。" },
        { item: "签证中心服务费", amount: "由中心制定", note: "预约时，新加坡的中心会列出自己的服务费。" },
      ],
      processing: "加拿大移民部在在线工具里公布处理时间，时间长短视您的档案由哪里处理而定。收到生物识别通知信后，请尽快预约，以免耽误。订机票前请留足时间。eTA 通常几分钟内获批，如果移民部要求补交文件，会在 72 小时内发邮件给您。",
    },

    apply: {
      intro: "先决定走哪条路。新加坡护照用 eTA，其他护照用加拿大移民部的在线入口，再加一次录生物识别的预约。",
      guided: {
        title: "自助指引",
        body: "VIZA 的 AI 带您完成移民部的表格，并按您的准证类型列出材料清单。您自己在移民部入口递交，并自己预约录生物识别。",
      },
      fullService: {
        title: "全程服务",
        body: "VIZA 顾问帮您准备表格，核对银行流水、信件和行程是否一致，并为上传准备好档案。",
      },
      steps: [
        { title: "确认办理途径", body: "我们先确认您的护照需要签证还是 eTA，以及您的生物识别信息是否仍然有效。" },
        { title: "准备档案", body: "备好护照扫描件、照片、表格、行程、银行流水和雇主信。您需要扫描仪或相机。" },
        { title: "在移民部入口递交", body: "在线缴付签证费和生物识别费。开始前请先读表格的填写指南。" },
        { title: "录生物识别并等候", body: "收到生物识别通知信后，在新加坡预约。移民部作出决定，获批后护照连同签证标签寄回。" },
      ],
    },

    checklist: {
      intro: "加拿大移民部会在入口里为您生成个人清单。下面是通用的核心清单，地方签证办公室可能要求更多。",
      groups: [
        {
          applicant: "所有申请人",
          items: [
            "护照有效期至少超过计划出行日期 6 个月",
            "符合移民部要求的数码照片",
            "行程，含机票、住宿或活动登记",
            "旅行记录",
            "近 6 个月的银行流水",
          ],
        },
        {
          applicant: "工作准证与 S 准证",
          items: [
            "准证卡，正反面复印件",
            "写明职位、薪水和已批准假期的雇主信",
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
            "未成年人独自出行时的出行授权信",
          ],
        },
      ],
    },

    travel: {
      intro: "签证或 eTA 让您可以出行。能否入境、停留多久，由机场的边检官员决定。",
      items: [
        { title: "eTA 只用于乘飞机", body: "eTA 适用于空运入境。开车、坐巴士、火车或乘船入境不需要 eTA，只需有效护照。需要签证的护照，任何入境方式都要有签证。" },
        { title: "边检提问", body: "官员可能询问回程机票、资金和住宿，并决定您可以停留多久。签证或 eTA 不保证一定能入境。" },
        { title: "停留时间", body: "通常每次最长 6 个月。您可以在线申请访客记录来延长，最好在停留期结束前很早就办。" },
        { title: "护照有效期", body: "签证或 eTA 会随护照到期而失效。护照有效期越长，签证可以越长。" },
        { title: "逾期滞留", body: "请在获准的期限内离境。失去身份会留下记录，之后再访问更困难。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照加拿大政府网站和移民部核对。费用和规定会变动，付款前请查看页尾“来源”里的链接。",
    },

    related: {
      destinations: ["united-states", "united-kingdom", "france", "japan"],
      guides: [
        { label: "新加坡的中国护照持有人办签证", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "电子旅行授权和签证的区别", href: "/guides/eta-vs-visa" },
        { label: "签证被拒：原因和重新申请", href: "/guides/visa-refused-reapply" },
        { label: "各国签证照片要求", href: "/guides/visa-photo-requirements" },
        { label: "加拿大移民部：各国入境要求", href: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html" },
        { label: "VIZA 签证资讯", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "常见拒签原因",
  rejectionSub: "加拿大移民部的官员按每份档案单独作出决定。下面是顾问最先检查的几点。",
  rejectionReasons: [
    { title: "看不出您会离开加拿大", body: "最常见的原因。与新加坡或本国的联系薄弱，例如准证期限短、没有在职证明，会让人更难相信您会回家。" },
    { title: "资金来源不明", body: "银行流水不足以覆盖这趟行程，或在申请前突然存入大笔款项，会引起谁来付费、为什么的疑问。" },
    { title: "访问目的含糊", body: "没有行程、日期前后不一致，或邀请信没有写明邀请人在加拿大的身份和地址，都让访问目的不清楚。" },
    { title: "申请不完整", body: "缺表格、有空白栏、文件没有翻译或没有录生物识别，都会造成延误和拒签。" },
    { title: "信息有误", body: "虚假陈述，或没有说明以往的拒签，可能导致被禁止申请。每个问题都请如实回答。" },
    { title: "其他原因", body: "犯罪记录、以往的移民问题，或医疗、安全方面的原因，也可能导致拒签。" },
  ],

  faqSub: "没有找到答案？请问下面的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "我需要签证吗", q: "新加坡公民去加拿大需要签证吗？", a: "不需要。新加坡护照持有人飞往加拿大只需办 eTA，费用 7 加元，通常几分钟内获批。陆路或海路入境一般只需有效护照。" },
    { category: "我需要签证吗", q: "住在新加坡的中国护照持有人需要加拿大签证吗？", a: "需要。您要在线申请访客签证并录生物识别信息。这就是中国护照持有人在新加坡办理的加拿大旅游签证。" },
    { category: "我需要签证吗", q: "住在新加坡的马来西亚人需要加拿大签证吗？", a: "需要。马来西亚不在“可用 eTA 代替签证”的国家名单上，所以马来西亚人要办访客签证。" },
    { category: "我需要签证吗", q: "菲律宾人可以用 eTA 去加拿大吗？", a: "有时可以。菲律宾护照持有人如果近 10 年内持有过加拿大访客签证，或持有有效的美国非移民签证，乘飞机时可以用 eTA。否则要办访客签证。" },
    { category: "在新加坡办理", q: "怎样从新加坡申请加拿大签证？", a: "在加拿大移民部入口在线申请，缴费，等收到生物识别通知信后在新加坡预约。申请时同时上传材料。" },
    { category: "在新加坡办理", q: "在新加坡哪里录生物识别信息？", a: "在新加坡的签证申请中心。移民部会寄来通知信，请尽快预约，以免耽误。" },
    { category: "在新加坡办理", q: "需要邀请信吗？", a: "只有探访亲友时才需要。移民部把邀请信列为建议材料，探亲还需要证明您与邀请人的关系。" },
    { category: "费用与时间", q: "加拿大访客签证要多少钱？", a: "签证每人 100 加元，生物识别每人 85 加元。5 人或以上的家庭，签证合计 500 加元，生物识别最多 170 加元。" },
    { category: "费用与时间", q: "加拿大签证要办多久？", a: "加拿大移民部在在线工具里公布处理时间，视您的档案由哪里处理而定。计划行程前请先查看，并在拿到结果后再订机票。" },
    { category: "费用与时间", q: "加拿大访客签证有效期多长？", a: "最长 10 年，或到护照或生物识别信息到期为止，以先到者为准。官员可以定更短的日期，每次停留通常最长 6 个月。" },
    { category: "拒签", q: "加拿大签证被拒怎么办？", a: "移民部会寄来说明原因的信。最常见的原因是官员不确定您会离开。再次申请前，请先请顾问看一遍。" },
    { category: "出行前", q: "去加拿大需要入境卡吗？", a: "不需要入境卡。在边检时，请准备好回程机票、资金和住宿的证明。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，您直接向加拿大移民部缴付费用。" },
  ],

  sources: [
    { label: "加拿大移民部，申请访客签证", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/apply-visitor-visa.html", display: "canada.ca" },
    { label: "加拿大移民部，各国入境要求", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html", display: "canada.ca" },
    { label: "加拿大移民部，eTA 申请方法", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html", display: "canada.ca" },
    { label: "加拿大移民部，部分需要签证国家公民的 eTA", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/eligibility/eta-x.html", display: "canada.ca" },
    { label: "加拿大移民部，查询处理时间", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html", display: "canada.ca" },
    { label: "加拿大移民部，生物识别", url: "https://www.canada.ca/biometrics", display: "canada.ca" },
    { label: "加拿大移民部，收费表", url: "https://ircc.canada.ca/english/information/fees/fees.asp", display: "ircc.canada.ca" },
    { label: "VFS Global，新加坡加拿大签证", url: "https://visa.vfsglobal.com/sgp/en/can/", display: "visa.vfsglobal.com" },
  ],

  price: {
    etaLabel: "处理时间",
    etaValue: "由加拿大移民部安排",
    title: "访客签证 · 最长 10 年",
    sub: "VIZA 的协助免费：表格准备和材料审阅。签证费和生物识别费支付给加拿大移民部。",
    foot: "VIZA 的服务免费。加拿大签证费直接支付给加拿大移民部。",
  },

  aiPlaceholder: "询问新加坡办理加拿大签证的任何问题：eTA、费用、生物识别、材料…",
};

export default canada;
