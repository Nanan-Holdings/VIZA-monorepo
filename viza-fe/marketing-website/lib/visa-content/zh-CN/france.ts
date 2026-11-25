import type { DestinationContent } from "../types";

/** 法国签证（新加坡办理）简体中文版。事实核对日期、来源与未能确认的事项见 ../france.ts。 */
export const france: DestinationContent = {
  slug: "france",

  heroTitle: "新加坡办理法国签证",
  lede: "在新加坡办理法国签证，看的是您持哪本护照。新加坡和马来西亚护照免签入境法国，任意 180 天内最长停留 90 天。如果您住在新加坡，持中国、印度、印尼、菲律宾或越南护照，就需要办法国申根签证，要在 France-Visas 网站申请，再到新加坡的签证中心递交。法国签证同样适用于其他申根国家，所以如果法国不是唯一的目的地，请一并阅读申根签证总览页。",
  heroImage: "/assets/heroes/france.jpg",
  meta: [
    { k: "新加坡护照", v: "免签，180 天内 90 天" },
    { k: "签证费", v: "成人 90 欧元" },
    { k: "递交地点", v: "新加坡 VFS Global" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "材料核对" },
    { icon: "plane", label: "申根签证" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "新加坡、马来西亚护照不需要。中国、印度、印尼、菲律宾、越南护照需要",
      govFee: "成人 90 欧元，6 至 11 岁儿童 45 欧元，6 岁以下免费。另加签证中心费用",
      processing: "15 天，部分个案最长 45 天。最早可在出行前 6 个月申请",
      maxStay: "任意 180 天内最长 90 天，所有申根国家合计",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "护照决定适用的规则。新加坡 PR 和准证持有人，按各自所持护照的规则办理。欧盟公布免签国籍的名单，下表列出在新加坡最常见的几种护照。",
      rows: [
        { passport: "新加坡", status: "免签，180 天内 90 天", note: "旅游或短期商务无需签证。欧盟的 ETIAS 旅行授权尚未启用，欧盟也还没有宣布启用日期。" },
        { passport: "中国（PRC）", status: "需要签证", note: "住在新加坡的中国护照持有人，在新加坡递交法国签证申请。" },
        { passport: "马来西亚", status: "免签，180 天内 90 天", note: "马来西亚同样在免签名单上。" },
        { passport: "印度", status: "需要签证", note: "如果法国是主要目的地，就申请法国签证。请出示新加坡准证作为居住证明。" },
        { passport: "印度尼西亚", status: "需要签证", note: "流程和材料与其他需要签证的护照相同。" },
        { passport: "菲律宾", status: "需要签证", note: "流程相同。住在新加坡的人在新加坡递交。" },
        { passport: "越南", status: "需要签证", note: "流程相同。请对照 France-Visas 上适用于您情况的清单。" },
        { passport: "其他护照", status: "请对照欧盟名单", note: "欧盟公布免签名单。您的护照不在名单上，就需要签证。" },
      ],
    },

    visaTypes: {
      intro: "法国发短期签证用于访问，长期签证用于居住。住在新加坡、为度假出行的人，大多办短期签证。",
      items: [
        { title: "短期签证（C 类）", body: "用于旅游、探亲和短期商务，任意 180 天内最长 90 天，在所有申根国家有效。成人费用 90 欧元。" },
        { title: "单次或多次入境", body: "首次申请的人一般按行程拿到对应的次数和日期。记录良好的常客，可以申请有效期更长的多次入境签证。" },
        { title: "机场过境", body: "用于途经法国机场的国际区域而不入境法国。部分护照需要，部分不需要。" },
        { title: "长期签证", body: "留学、工作和停留超过 90 天，要办法国国家签证，流程另算。学生在递交前先完成 Campus France 这一步。" },
      ],
    },

    residents: {
      intro: "France-Visas 表示，住在新加坡的人要在新加坡预约递交申请。您用所持护照申请，准证说明您住在这里。",
      rows: [
        { pass: "工作准证（EP）", body: "带上 EP 卡、写明职位、薪水和已批准假期的在职证明，以及 3 个月的银行流水。准证有效期要在您回程后至少再有 3 个月。" },
        { pass: "S 准证", body: "带上 S 准证卡、在职证明和 3 个月的银行流水。清单与工作准证相同。" },
        { pass: "家属准证（DP）", body: "带上家属准证和主准证持有人的准证复印件，加上结婚或出生证明。如果由主准证持有人付费，再附上其银行流水和支持信。" },
        { pass: "永久居民（PR）", body: "带上 PR 卡或再入境许可，以及您在新加坡工作或经营的证明。您以本国护照申请，新加坡护照的免签规则不适用于您。" },
        { pass: "新加坡公民", body: "无需签证。带上有效期覆盖停留期的护照，并预期在边境登记欧盟出入境系统。" },
        { pass: "学生准证", body: "带上学生准证和注明假期日期的学校证明信。父母可以出具支持信，并附银行流水。" },
      ],
    },

    fees: {
      intro: "签证费由欧盟制定，申请时缴付。签证中心另收自己的费用。VIZA 的协助免费。",
      rows: [
        { item: "成人签证费", amount: "90 欧元", note: "由欧盟法律规定，签证被拒不退还。" },
        { item: "6 至 11 岁儿童", amount: "45 欧元", note: "6 岁以下儿童免费。" },
        { item: "新加坡中心的申请费", amount: "34 欧元", note: "France-Visas 新加坡页面按每份申请列出，以新加坡元支付，不可退款。" },
        { item: "签证中心的可选服务", amount: "由 VFS Global 制定", note: "VFS Global 在其法国页面列出自己的附加服务。" },
        { item: "旅行保险", amount: "付给保险公司", note: "最低 30,000 欧元保额，覆盖整个停留期和所有申根国家。" },
      ],
      processing: "决定一般需要 15 天，部分个案最长 45 天。最早在出行前 6 个月申请，一般最晚在出行前 15 天。指纹在递交时采集。旺季请提前 6 至 8 周，并尽早预约。",
    },

    apply: {
      intro: "先确认法国是不是正确的国家。向停留天数最多的国家申请，如果各国天数相同，就向第一个入境的国家申请。如果要去多个国家，请看申根签证总览页。",
      guided: {
        title: "自助指引",
        body: "VIZA 的 AI 带您完成 France-Visas 表格，并按您的准证类型列出材料清单。预约和递交由您自己到签证中心完成。",
      },
      fullService: {
        title: "全程服务",
        body: "VIZA 顾问帮您准备表格、行程、保险和银行流水，让您带着与法国清单相符的档案到签证中心。",
      },
      steps: [
        { title: "确认国家", body: "法国必须是您的主要目的地或第一个入境国。如果要去几个国家，请先看申根总览页。" },
        { title: "填写 France-Visas", body: "在 France-Visas 网站填写在线表格并打印摘要。备好护照、照片、保险和订单。" },
        { title: "预约并递交", body: "在新加坡的签证中心预约并亲自前往，采集指纹并递交档案。" },
        { title: "等候并领取", body: "法国使馆作出决定，您领取护照。在决定出来前，请不要订不可退款的机票。" },
      ],
    },

    checklist: {
      intro: "欧盟规定一份核心清单，法国再加上自己的要求。下面是通用的核心清单，递交前请对照 France-Visas 上的清单。",
      groups: [
        {
          applicant: "所有申请人",
          items: [
            "在线填写并签名的 France-Visas 表格",
            "护照在您离开后至少还有 3 个月有效期，并有 2 页空白页",
            "符合申根标准的近期照片",
            "整个停留期的机票预订和住宿",
            "覆盖所有申根国家、保额至少 30,000 欧元的旅行保险",
            "近 3 个月的银行流水",
          ],
        },
        {
          applicant: "工作准证与 S 准证",
          items: [
            "准证卡，正反面复印件，在您回程后至少还有 3 个月有效期",
            "在职证明和假期批准",
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
            "PR 卡和涵盖行程的再入境许可",
            "在新加坡工作或经营的证明",
            "本人银行流水",
          ],
        },
        {
          applicant: "学生",
          items: [
            "学生准证和注明假期日期的学校证明信",
            "父母的支持信和他们的银行流水",
          ],
        },
      ],
    },

    travel: {
      intro: "过去一年欧盟有几项系统变了。它们影响的是过关方式，而不是申请方式。",
      items: [
        { title: "出入境系统", body: "自 2026 年 4 月 10 日起，EES 已在欧盟外部边境全面运作。首次到访的旅客会被拍照，有时还会采集指纹，护照不再盖章。" },
        { title: "ETIAS", body: "ETIAS 是免签访客使用的旅行授权，目前尚未启用，欧盟会提前公布启用日期。" },
        { title: "没有入境卡", body: "法国没有纸质或电子入境卡。边检警察可能询问回程机票、资金、保险和住宿。" },
        { title: "保险", body: "覆盖整个停留期和所有申根国家、保额至少 30,000 欧元的保险，是签证的条件之一。" },
        { title: "180 天内 90 天的规则", body: "所有申根国家的天数合计计算。请把行程安排在签证上的日期之内。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照 France-Visas、欧盟签证法典和欧盟旅行网站核对。费用和规定会变动，付款前请查看页尾“来源”里的链接。",
    },

    related: {
      destinations: ["schengen", "italy", "united-kingdom", "turkiye"],
      guides: [
        { label: "新加坡申根签证材料清单", href: "/guides/schengen-visa-checklist-singapore" },
        { label: "VIZA 申根签证总览：所有申根国家共用的规则", href: "/visa/schengen" },
        { label: "欧盟出入境系统的运作方式", href: "https://travel-europe.europa.eu/ees/ltr/how-does-the-ees-work" },
        { label: "VIZA 签证资讯", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "常见拒签原因",
  rejectionSub: "欧盟签证法典列出了拒签的理由。下面是对旅游申请最重要的几项，顾问会在您递交前检查。",
  rejectionReasons: [
    { title: "行程目的不清楚", body: "使馆需要看到清楚的访问理由。无法解释每一天安排的行程，是常见的薄弱点。" },
    { title: "资金不足", body: "您必须证明有足够的资金覆盖整个停留期和回程。流水偏少或临近申请才存入的款项，会引起怀疑。" },
    { title: "没有有效的保险", body: "保额不到 30,000 欧元、保险开始日期太晚，或不覆盖所有申根国家，都会被拒。" },
    { title: "对您是否离开存疑", body: "与新加坡的联系薄弱，例如准证期限短或没有在职证明，会让人怀疑您会不会回来。" },
    { title: "订单或文件不可靠", body: "无法确认的订单，或使馆无法信任的文件，是拒签的理由，也可能影响以后的申请。" },
    { title: "以往的申根记录", body: "以往逾期滞留，或申根系统里有警示记录，需要说明。" },
  ],

  faqSub: "没有找到答案？请问下面的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "我需要签证吗", q: "新加坡公民去法国需要签证吗？", a: "不需要。新加坡护照免签入境法国，任意 180 天内最长停留 90 天。欧盟的 ETIAS 旅行授权尚未启用，欧盟也还没有宣布启用日期。" },
    { category: "我需要签证吗", q: "住在新加坡的中国护照持有人需要法国签证吗？", a: "需要。您要申请法国的申根签证，住在新加坡的人在新加坡递交申请。" },
    { category: "我需要签证吗", q: "住在新加坡的马来西亚人需要法国签证吗？", a: "不需要。马来西亚在欧盟免签名单上，任意 180 天内最长可停留 90 天。" },
    { category: "我需要签证吗", q: "住在新加坡的印度、印尼、菲律宾和越南护照需要法国签证吗？", a: "需要。如果法国是主要目的地，各自申请法国的申根签证。" },
    { category: "在新加坡办理", q: "怎样在新加坡申请法国签证？", a: "在 France-Visas 填写表格，在新加坡的签证中心预约并带材料亲自前往。指纹在中心采集。" },
    { category: "在新加坡办理", q: "新加坡的法国签证中心在哪里？", a: "France-Visas 列出新加坡的 VFS Global，仅限预约。中心已在 2026 年 6 月 2 日搬迁，所以出发前请到 France-Visas 页面确认最新地址。" },
    { category: "在新加坡办理", q: "法国签证可以去其他国家吗？", a: "可以。只要法国是主要目的地或第一个入境国，法国的短期签证在所有申根国家都有效。共用的规则请看申根签证总览页。" },
    { category: "在新加坡办理", q: "什么时候申请？", a: "最早在出行前 6 个月，一般最晚在出行前 15 天。旺季请提前 6 至 8 周。" },
    { category: "费用与时间", q: "在新加坡办法国签证要多少钱？", a: "签证费成人 90 欧元，6 至 11 岁儿童 45 欧元，6 岁以下免费。France-Visas 列出新加坡中心的申请费 34 欧元，以新加坡元支付。" },
    { category: "费用与时间", q: "法国签证要办多久？", a: "一般 15 天，部分个案最长 45 天。指纹在递交时采集。" },
    { category: "材料", q: "需要旅行保险吗？", a: "需要。最低保额 30,000 欧元，覆盖整个停留期和所有申根国家。" },
    { category: "拒签", q: "法国签证被拒怎么办？", a: "您会收到说明理由的通知，签证费不退还。再次申请前，请先请顾问看一遍。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，您直接缴付签证费和中心费用。" },
  ],

  sources: [
    { label: "France-Visas，短期签证", url: "https://www.france-visas.gouv.fr/en/visa-de-court-sejour", display: "france-visas.gouv.fr" },
    { label: "France-Visas，新加坡递交地点", url: "https://france-visas.gouv.fr/en/singapour", display: "france-visas.gouv.fr" },
    { label: "VFS Global，新加坡法国签证", url: "https://visa.vfsglobal.com/sgp/en/fra/", display: "visa.vfsglobal.com" },
    { label: "欧盟内政事务总司，申请申根签证", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/applying-schengen-visa_en", display: "home-affairs.ec.europa.eu" },
    { label: "欧盟签证法典，第 810/2009 号条例", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02009R0810-20200202", display: "eur-lex.europa.eu" },
    { label: "欧盟旅行网站，ETIAS", url: "https://travel-europe.europa.eu/en/etias", display: "travel-europe.europa.eu" },
    { label: "欧盟旅行网站，出入境系统", url: "https://travel-europe.europa.eu/ees/faq", display: "travel-europe.europa.eu" },
  ],

  price: {
    etaLabel: "出结果时间",
    etaValue: "15 天，最长 45 天",
    title: "法国申根短期签证 · 最长 90 天",
    sub: "VIZA 的协助免费：表格准备和材料审阅。签证费在申请时缴付。",
    foot: "VIZA 的服务免费。签证费和中心费用直接支付给签发机构和签证中心。",
  },

  aiPlaceholder: "询问新加坡办理法国签证的任何问题：费用、材料、VFS、申根…",
};

export default france;
