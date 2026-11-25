import type { DestinationContent } from "../types";

/** 申根签证（新加坡办理）简体中文版。事实核对日期、来源与未能确认的事项见 ../schengen.ts。仅咨询顾问，无结账。 */
export const schengen: DestinationContent = {
  slug: "schengen",

  heroTitle: "新加坡办理申根签证",
  lede: "办一张申根签证，可以在 29 个欧洲国家短期停留，任意 180 天内最长 90 天。新加坡护照不需要办。如果您住在新加坡，持中国、印度、印尼、菲律宾、泰国或越南护照，就要向其中一个国家的使馆申请，通过该国在新加坡的签证中心递交，而向哪个国家申请，取决于您在哪里停留最久。先看这一页，再到法国或意大利页面看具体清单。",
  heroImage: "/assets/heroes/schengen.jpg",
  meta: [
    { k: "新加坡护照", v: "免签，180 天内 90 天" },
    { k: "签证费", v: "成人 90 欧元" },
    { k: "保险", v: "至少 3 万欧元" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "材料核对" },
    { icon: "plane", label: "法国与意大利" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "新加坡和马来西亚护照不需要，多数其他护照需要",
      govFee: "成人 90 欧元，6 至 11 岁儿童 45 欧元，6 岁以下免费，另加签证中心费用",
      processing: "15 天，部分个案最长 45 天。出行前最早 6 个月可申请",
      maxStay: "任意 180 天内 90 天",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "规则看您的护照。新加坡 PR 和准证持有人，按各自所持护照的规则办。欧盟在第 2018/1806 号条例里公布免签国家名单，下表列出新加坡最常见的几种护照。",
      rows: [
        { passport: "新加坡", status: "免签，180 天内 90 天", note: "旅游和短期商务无需签证。欧盟的 ETIAS 旅行授权尚未运行，欧盟也还没有公布启用日期。" },
        { passport: "马来西亚", status: "免签，180 天内 90 天", note: "马来西亚同样在免签名单上。ETIAS 启用后，预计会适用于免签访客。" },
        { passport: "中国（PRC）", status: "需要签证", note: "合法居留在新加坡的中国护照持有人，可以在新加坡申请。" },
        { passport: "印度", status: "需要签证", note: "向您停留天数最多的国家申请，用新加坡准证作为居留证明。" },
        { passport: "印度尼西亚", status: "需要签证", note: "流程和材料与其他需要签证的护照相同。" },
        { passport: "菲律宾", status: "需要签证", note: "流程相同。住在新加坡的人，通过所选国家的签证中心办理。" },
        { passport: "越南", status: "需要签证", note: "流程相同，请对照目的地国家自己的清单。" },
        { passport: "其他护照", status: "请对照第 2018/1806 号条例", note: "泰国也在需要签证的名单上。您的护照不在免签名单上，就需要签证。" },
      ],
    },

    visaTypes: {
      intro: "短期停留签证是游客最常用的一种，其他事由另有类型。",
      items: [
        { title: "短期签证，单次入境", body: "入境一次，任意 180 天内最长 90 天，适合一次度假。" },
        { title: "短期签证，多次入境", body: "可以多次入境。首次申请的人通常拿到单次，常出行的人可以逐步申请更长的多次签证：过去 2 年内用过 3 次签证，可以申请 1 年，之后是 2 年，再之后 5 年，但都不超过护照有效期。" },
        { title: "机场过境", body: "用于经停申根国家机场的国际区域，不入境。有些护照需要，有些不需要。" },
        { title: "长期国家签证", body: "留学、工作和超过 90 天的停留，要办各国自己的国家签证，不是申根短期签证。" },
      ],
    },

    residents: {
      intro: "申根签证以居住地为准，所以使馆要看到您在新加坡合法居住的证明。各国要求不同：意大利使馆要求准证在行程结束后至少再有 90 天有效，PR 的再入境许可也一样。请看您申请的那个国家的要求。",
      rows: [
        { pass: "工作准证（EP）", body: "带上 EP 卡和在职证明。回程后准证至少还要有 3 个月有效，这是意大利的要求，对其他国家也是稳妥的目标。" },
        { pass: "S 准证", body: "与 EP 相同。带上准证卡、在职证明和 3 个月的银行流水。" },
        { pass: "家属准证（DP）", body: "带上家属准证和主准证持有人的准证复印件。如果由主准证持有人出钱，再附上支持信和对方的银行流水。" },
        { pass: "永久居民（PR）", body: "带上 PR 卡，以及行程结束后至少还有 90 天有效的再入境许可，这是意大利的要求。" },
        { pass: "新加坡公民", body: "无需签证。护照有效期要覆盖行程，欧盟启用 ETIAS 之后还要另外办理。" },
        { pass: "非居民", body: "有些使馆接受因正当理由短期合法停留在新加坡的人申请，并逐案决定。意大利使馆表示保留审查的权利。" },
      ],
    },

    fees: {
      intro: "签证费付给您申请的那个国家，签证中心另收服务费。VIZA 的协助免费。签证中心的收费请以各国自己的页面为准，因为每家中心自己定价。",
      rows: [
        { item: "成人签证费", amount: "90 欧元", note: "由欧盟法律规定。意大利使馆公布 2026 年第四季度为 132.80 新元。" },
        { item: "6 至 11 岁儿童", amount: "45 欧元", note: "意大利使馆公布 2026 年第四季度为 66.40 新元。" },
        { item: "6 岁以下儿童", amount: "免费", note: "不收签证费。" },
        { item: "签证中心服务费，法国", amount: "34 欧元", note: "每位申请人，在 VFS Global 以当地货币支付。" },
        { item: "签证中心服务费，其他国家", amount: "以中心公布为准", note: "每家中心自己公布费用，我们未能确认各国在新加坡的数字。" },
        { item: "旅行保险", amount: "付给保险公司", note: "整个停留期至少 3 万欧元的保额。" },
      ],
      processing: "审理一般需要 15 天，部分个案最长 45 天。最早出行前 6 个月可以申请，一般最晚出行前 15 个自然日。指纹在递交时录取。夏季旺季人多，建议提前 6 到 8 周办理。",
    },

    apply: {
      intro: "先选国家。规则很简单：向停留天数最多的国家申请。如果各国天数差不多，就向您第一个入境申根区的国家申请；只去一个国家的话，就向那个国家申请。",
      guided: {
        title: "自助指引",
        body: "VIZA 帮您选对国家，再带您填表并过清单。预约和递交由您自己到签证中心完成。",
      },
      fullService: {
        title: "全程代办",
        body: "VIZA 顾问替您准备表格、行程、保险和银行流水，让您带着符合该国清单的材料到签证中心。",
      },
      steps: [
        { title: "选国家", body: "按主要目的地规则选。要去法国或意大利，请到对应页面看它们的清单。" },
        { title: "准备材料", body: "备齐表格、护照、照片、准证、行程、保险和银行流水。" },
        { title: "预约并递交", body: "预约所选国家的签证中心，带上护照原件亲自前往，生物信息在中心录取。" },
        { title: "等待并取件", body: "等候结果，领取贴有签证的护照。获批之前，请不要订不能退的机票。" },
      ],
    },

    checklist: {
      intro: "欧盟规定了一份核心清单，各国再各自增加。下面是通用的核心材料，请务必对照目的地国家自己的清单。",
      groups: [
        {
          applicant: "所有人",
          items: [
            "填好并签名的签证申请表",
            "护照，至少 2 页空白页，离境后至少还有 3 个月有效，签发不超过 10 年",
            "符合申根标准的近期照片",
            "机票预订和每晚的住宿证明",
            "覆盖整个申根区的旅行保险，保额至少 3 万欧元",
            "最近 3 个月的银行流水",
          ],
        },
        {
          applicant: "工作准证与 S 准证",
          items: [
            "准证卡正反面复印件，回程后至少还有 3 个月有效",
            "在职证明和休假批准",
            "工资单和本人的银行流水",
          ],
        },
        {
          applicant: "家属准证",
          items: [
            "家属准证卡和主准证持有人的准证复印件",
            "证明关系的结婚证或出生证明",
            "主准证持有人的银行流水和支持信",
          ],
        },
        {
          applicant: "永久居民",
          items: [
            "PR 卡和行程结束后至少还有 90 天有效的再入境许可",
            "在新加坡就业或经营的证明",
            "本人的银行流水",
          ],
        },
        {
          applicant: "学生",
          items: [
            "学生准证和写明假期日期的学校证明信",
            "父母出具的支持信及其银行流水",
          ],
        },
      ],
    },

    travel: {
      intro: "欧盟最近一年改了几套系统，它们影响的是过边境的方式，不是申请的方式。",
      items: [
        { title: "出入境系统（EES）", body: "EES 自 2026 年 4 月 10 日起在所有外部边境全面运行。首次入境的访客会被拍面部照片，有时还会录指纹，护照不再盖章。再次入境的访客只做核验，也可以使用自助通道。" },
        { title: "ETIAS", body: "ETIAS 是面向免签访客的旅行授权，费用 20 欧元，有效期 3 年，18 岁以下和 70 岁以上免费。目前尚未运行，欧盟会提前数月公布启用日期。" },
        { title: "保险", body: "整个申根区、整个停留期的保额至少 3 万欧元，需涵盖遣返、紧急医疗和住院治疗。多次入境签证，保险要覆盖第一次行程。" },
        { title: "过边境时", body: "请准备好出示行程目的、资金、住宿和离开的方式。180 天内 90 天的计算，是整个申根区合在一起算。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照欧盟签证法典、欧盟内政和旅行网站、意大利驻新加坡大使馆和 VFS Global 的页面。规则会变，付款前请先看页面底部的来源链接。",
    },

    related: {
      destinations: ["france", "italy", "united-kingdom", "turkiye"],
      guides: [
        { label: "新加坡的中国护照持有人办签证", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "新加坡的菲律宾和印度居民办签证", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "新加坡申根签证材料清单", href: "/guides/schengen-visa-checklist-singapore" },
        { label: "签证被拒：原因和重新申请", href: "/guides/visa-refused-reapply" },
        { label: "各国签证照片要求", href: "/guides/visa-photo-requirements" },
        { label: "欧盟出入境系统的运作方式", href: "https://travel-europe.europa.eu/ees/ltr/how-does-the-ees-work" },
        { label: "VIZA 签证资讯", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "常见拒签原因",
  rejectionSub: "欧盟签证法典列明了拒签的理由。以下几项对游客申请最要紧，顾问会在您递交前先帮您检查。",
  rejectionReasons: [
    { title: "说不清出行目的", body: "使馆需要一个清楚的出行理由。行程对不上每一天的安排，是常见的薄弱点。" },
    { title: "资金不足", body: "您需要证明整个停留期和回程的费用。流水偏薄或临时存入大额款项，都会引起疑问。" },
    { title: "没有有效保险", body: "整个停留期至少 3 万欧元的保额是条件之一。保单开始日期偏晚或覆盖区域不对，会被拒绝。" },
    { title: "对您回程的疑虑", body: "与新加坡的联系薄弱，比如准证有效期短、没有在职证明，会让使馆怀疑您会不会回来。" },
    { title: "申请的国家不对", body: "申请的不是您的主要目的地国家，材料可能被退回。" },
    { title: "文件虚假或不可靠", body: "使馆无法信任的文件是拒签理由之一。请使用原件，并保持每一个日期一致。" },
  ],

  faqSub: "没找到答案？问下方的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "需要签证吗", q: "新加坡人去欧洲需要申根签证吗？", a: "不需要。新加坡护照在欧盟免签名单上，任意 180 天内可停留最长 90 天。ETIAS 计划面向免签访客，但尚未运行，欧盟也还没有公布日期。" },
    { category: "需要签证吗", q: "新加坡 PR 和准证持有人需要申根签证吗？", a: "要看护照。持中国、印度、印尼、菲律宾、泰国和越南护照的人需要，持马来西亚护照的人不需要。" },
    { category: "在新加坡办理", q: "向哪个国家申请？", a: "向停留天数最多的国家申请。如果各国天数差不多，就向您第一个入境申根区的国家申请；只去一个国家，就向那个国家申请。" },
    { category: "在新加坡办理", q: "在新加坡到哪里办申根签证？", a: "通过所选国家的签证中心办理。法国、德国、荷兰、瑞士、奥地利、葡萄牙和瑞典使用 VFS Global，意大利和西班牙使用 BLS，丹麦的 VFS 中心也受理挪威和芬兰。" },
    { category: "在新加坡办理", q: "只在新加坡短期居住也能申请吗？", a: "要看使馆。意大利使馆接受因正当理由合法停留在新加坡的人申请，并表示保留审查的权利。" },
    { category: "在新加坡办理", q: "什么时候申请比较好？", a: "最早出行前 6 个月，一般最晚出行前 15 个自然日。旺季建议提前 6 到 8 周。" },
    { category: "费用与时间", q: "从新加坡办申根签证要多少钱？", a: "签证费成人 90 欧元，6 至 11 岁儿童 45 欧元，6 岁以下免费。意大利使馆公布 2026 年第四季度成人为 132.80 新元。签证中心另收服务费。" },
    { category: "费用与时间", q: "申根签证要办多久？", a: "一般 15 天，部分个案最长 45 天。指纹在递交时录取。" },
    { category: "费用与时间", q: "签证中心的服务费是多少？", a: "每家中心自己定价。法国在 VFS Global 公布的是每人 34 欧元，以当地货币支付。请查看您那个国家的页面。" },
    { category: "材料", q: "需要买旅行保险吗？", a: "需要。整个申根区、整个停留期的保额至少 3 万欧元，涵盖遣返、紧急医疗和住院治疗。" },
    { category: "材料", q: "我的准证需要有效多久？", a: "意大利使馆要求行程结束后准证或 PR 再入境许可至少还有 90 天有效。请查看您申请的那个国家的规定。" },
    { category: "出行前", q: "出入境系统（EES）是什么？", a: "是记录出入境、取代护照盖章的边境系统，自 2026 年 4 月 10 日起全面运行。首次入境的访客会被拍照，有时还会录指纹。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，签证费和签证中心费用由您直接支付。" },
  ],

  sources: [
    { label: "欧盟内政总司，申请申根签证", url: "https://home-affairs.ec.europa.eu/policies/schengen/schengen-visas/applying-schengen-visa_en", display: "home-affairs.ec.europa.eu" },
    { label: "欧盟签证法典，第 810/2009 号条例", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02009R0810-20200202", display: "eur-lex.europa.eu" },
    { label: "欧盟第 2018/1806 号条例，免签国家", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", display: "eur-lex.europa.eu" },
    { label: "欧盟旅行网站，ETIAS", url: "https://travel-europe.europa.eu/en/etias", display: "travel-europe.europa.eu" },
    { label: "欧盟旅行网站，出入境系统", url: "https://travel-europe.europa.eu/ees/faq", display: "travel-europe.europa.eu" },
    { label: "意大利驻新加坡大使馆，签证费用", url: "https://ambsingapore.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visas-fees/", display: "ambsingapore.esteri.it" },
    { label: "VFS Global，法国签证，新加坡", url: "https://visa.vfsglobal.com/sgp/en/fra/", display: "visa.vfsglobal.com" },
    { label: "VFS Global，德国签证，新加坡", url: "https://visa.vfsglobal.com/sgp/en/deu/", display: "visa.vfsglobal.com" },
    { label: "BLS 西班牙签证，新加坡", url: "https://singapore.blsspainvisa.com/", display: "singapore.blsspainvisa.com" },
  ],

  price: {
    etaLabel: "审理时间",
    etaValue: "15 天，最长 45 天",
    title: "申根签证 · 新加坡居民",
    sub: "VIZA 的协助免费：选国家、表格准备和材料核对。签证费和中心费用付给相关机关和签证中心。",
    foot: "VIZA 的服务免费。申根的费用付给使馆和签证中心。",
  },

  aiPlaceholder: "问问新加坡办理申根签证：向哪个国家申请、费用、材料…",
};

export default schengen;
