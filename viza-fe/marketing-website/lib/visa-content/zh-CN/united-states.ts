import type { DestinationContent } from "../types";

/** 美国签证（新加坡办理）简体中文版。事实核对日期、来源与未能确认的事项见 ../united-states.ts。 */
export const unitedStates: DestinationContent = {
  slug: "united-states",

  heroTitle: "新加坡办理美国签证",
  lede: "在新加坡办理美国签证，看的是您持哪本护照。新加坡护照走免签证计划，办理 ESTA 即可入境，每次最长 90 天。如果您住在新加坡，持中国、马来西亚、印度、印尼、菲律宾或越南护照，就需要办 B1/B2 访客签证，要填写 DS-160 表格、缴签证费，并到美国驻新加坡大使馆面谈。本页讲清楚新加坡的美国签证申请流程、美国签证预约怎么约、各类准证所需材料和费用。",
  heroImage: "/assets/heroes/united-states.jpg",
  meta: [
    { k: "新加坡护照", v: "办 ESTA，最长 90 天" },
    { k: "签证费（B1/B2）", v: "185 美元" },
    { k: "面谈", v: "到使馆当面进行" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "DS-160 核对" },
    { icon: "calendar", label: "预约指引" },
  ],

  page: {
    framing: "singapore",

    glance: {
      needVisa: "新加坡护照短期出行不需要（办 ESTA）。中国、马来西亚、印度、印尼、菲律宾、越南护照需要",
      govFee: "B1/B2 签证申请费 185 美元。ESTA 约 40 美元。缴费前请再确认签证诚信费的情况",
      processing: "由使馆安排。面谈等候时间每周都会变，部分个案面谈后还要补充审查",
      maxStay: "入境时由边检官员决定，通常最长 6 个月。ESTA 每次最长 90 天",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "护照决定走哪条路，居住地决定在哪里申请。美国国务院建议申请人在居住国申请，所以住在新加坡的人一般在美国驻新加坡大使馆预约。",
      rows: [
        { passport: "新加坡", status: "办 ESTA，最长 90 天", note: "新加坡属于免签证计划成员。在线申请 ESTA，费用约 40 美元，最长两年有效。停留超过 90 天需要办 B1/B2 签证。" },
        { passport: "中国（PRC）", status: "需要签证", note: "中国护照持有人办 B1/B2 签证。如果签发的是 10 年有效签证，出行前还要登记 EVUS。" },
        { passport: "马来西亚", status: "需要签证", note: "马来西亚不在免签证计划内。住在新加坡的马来西亚人要办 B1/B2 签证。" },
        { passport: "印度", status: "需要签证", note: "办 B1/B2 签证。请带上工作证明和新加坡准证，官员会问您住在哪里、做什么工作。" },
        { passport: "印度尼西亚", status: "需要签证", note: "办 B1/B2 签证，DS-160 和面谈的步骤与其他护照相同。" },
        { passport: "菲律宾", status: "需要签证", note: "办 B1/B2 签证。面谈前请准备好工作、存款和家庭关系的证明。" },
        { passport: "越南", status: "需要签证", note: "办 B1/B2 签证，步骤与其他需要签证的护照相同。" },
        { passport: "其他护照", status: "请对照免签证计划名单", note: "美国国务院公布免签证计划的国家名单。您的护照不在名单上，就需要办 B1/B2 签证。" },
      ],
    },

    visaTypes: {
      intro: "美国按事由发签证。住在新加坡、为度假、探亲或短期商务出行的人，大多办 B 类签证。",
      items: [
        { title: "B1/B2 访客签证", body: "一本签证同时涵盖 B1（商务会议、会展、合同洽谈）和 B2（旅游、探亲、就医）。不允许在美国从事有薪工作。入境次数和有效期由签证官决定，每次停留多久由入境的边检官员决定。" },
        { title: "ESTA，适用于新加坡护照", body: "它不是签证，而是免签证护照使用的在线旅行授权，用于旅游或商务，每次最长 90 天。需要有回程或续程机票，护照要符合电子护照的要求。" },
        { title: "过境（C-1）", body: "用于途经美国前往第三国。免签证护照持有人可以用 ESTA 过境。" },
        { title: "学习、工作和其他签证", body: "在美国读书、工作或居住需要办其他签证，通常要先由学校或雇主递交申请。这些与 B 类签证是两回事，本页不涉及。" },
      ],
    },

    residents: {
      intro: "使馆想确认您住在新加坡，并且有理由回来。您的准证就是证明。在新加坡住得越久、工作越稳定，材料越容易让官员看明白。",
      rows: [
        { pass: "工作准证（EP）", body: "带上 EP 卡、近期在职证明（写明职位、薪水和已批准的假期）和近期工资单。持中国、印度或菲律宾护照的 EP 持有人最常走这条路。" },
        { pass: "S 准证", body: "带上 S 准证卡、在职证明和工资单。官员看的和 EP 一样：您的工作、收入，以及回来的打算。" },
        { pass: "家属准证（DP）", body: "带上家属准证和主准证持有人的准证复印件，加上能证明关系的结婚或出生证明，以及您本人或主准证持有人的银行流水和支持信。" },
        { pass: "永久居民（PR）", body: "带上 PR 卡或再入境许可，以及您在新加坡工作或经营的证明。您以本国护照申请，新加坡护照的 ESTA 规则不适用于您。" },
        { pass: "新加坡公民", body: "90 天以内的行程无需签证。办 ESTA，带电子护照，保存好 ESTA 批准号码。只有停留更久或不能办 ESTA 时，才需要 B1/B2 签证。" },
        { pass: "学生准证", body: "带上学生准证和注明学期日期的学校证明信。父母可以出具支持信，并附银行流水。" },
      ],
    },

    fees: {
      intro: "下面所有费用都由美国政府制定，也付给美国政府。VIZA 的协助免费。B1/B2 签证费在预约面谈时缴付，签证被拒也不退还。",
      rows: [
        { item: "B1/B2 签证申请费", amount: "185 美元", note: "每人一份，儿童也要缴。来源是美国国务院的收费页面。" },
        { item: "签证诚信费", amount: "法律规定 250 美元", note: "2025 年 7 月通过。各使领馆何时开始收取的说法不一，缴费前请查看国务院和使馆页面，并把它计入预算。" },
        { item: "ESTA", amount: "约 40 美元", note: "适用于新加坡护照。确切金额以 ESTA 网站为准，因为美国海关会调整。最长两年有效。" },
        { item: "中国护照 10 年签证的 EVUS", amount: "约 30 美元", note: "持 10 年签证，每次出行前都要登记。确切金额以 EVUS 网站为准。" },
        { item: "延长停留（I-539 表）", amount: "由 USCIS 制定", note: "人在美国时，在停留期结束前向 USCIS 递交。请查看 USCIS 的收费页面。" },
      ],
      processing: "面谈等候时间每周都不同，美国国务院在签证等候时间页面公布新加坡的数字。面谈后，部分个案会转入行政审查，要多花时间。请先看清时间再订机票。ESTA 通常几分钟内出结果，建议至少在起飞前 72 小时申请。",
    },

    apply: {
      intro: "B1/B2 的步骤人人一样：填 DS-160、缴费、预约、面谈。先决定需要多少协助，再按顺序完成。",
      guided: {
        title: "自助指引",
        body: "VIZA 的 AI 带您逐题完成 DS-160，并按您的准证类型列出材料清单。预约和面谈由您自己完成，每个答案都由您掌控。",
      },
      fullService: {
        title: "全程服务",
        body: "VIZA 顾问与您一起准备 DS-160 的答案，核对支持材料，并梳理面谈可能涉及的话题，让材料和回答前后一致。",
      },
      steps: [
        { title: "选 ESTA 还是签证", body: "新加坡护照行程在 90 天以内，办 ESTA。其他护照从 B1/B2 签证开始。" },
        { title: "填写 DS-160", body: "在美国国务院网站填写在线 DS-160，包括旅行史和社交媒体账号。请保存确认页。" },
        { title: "缴费并预约", body: "缴付签证费，并通过使馆的预约系统订面谈时间，入口在美国驻新加坡大使馆的签证页面。" },
        { title: "参加面谈", body: "带上护照、DS-160 确认页、预约确认信和支持材料。指纹在使馆采集。获批后，护照会连同签证一起寄回。" },
      ],
    },

    checklist: {
      intro: "使馆只要求一小部分核心材料，其余在面谈中判断。下面的支持材料，是顾问按不同申请人类型核对的内容。",
      groups: [
        {
          applicant: "所有申请人",
          items: [
            "护照有效期覆盖整个停留期",
            "带条形码的 DS-160 确认页",
            "6 个月内拍摄的数码照片，白色背景，不戴眼镜",
            "签证费收据和预约确认信",
            "以往的美国签证和旅行记录（如有）",
          ],
        },
        {
          applicant: "工作准证与 S 准证",
          items: [
            "准证卡，正反面复印件",
            "写明职位、薪水和已批准假期的在职证明",
            "近期工资单和本人银行流水",
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
            "本人银行流水和税务记录",
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
      intro: "签证只是让您可以申请入境。在美国机场，由边检官员决定您能否入境、停留多久。",
      items: [
        { title: "没有入境卡", body: "美国没有纸质或电子入境卡。空运和海运入境时，美国海关会生成电子 I-94 记录，您可以在海关的 I-94 网站查询。" },
        { title: "边检提问", body: "海关会拍照、采集指纹，并可能要求出示回程机票、资金和住宿。签证或 ESTA 不保证一定能入境。" },
        { title: "停留时间", body: "官员会在 I-94 上记录您获准停留的期限。ESTA 每次最长 90 天，不能延长。B1/B2 可以在 I-94 到期前向 USCIS 申请延长。" },
        { title: "中国护照的 EVUS", body: "持 10 年 B1/B2 签证的中国护照持有人，出行前要先登记 EVUS，航空公司在值机时会检查。" },
        { title: "逾期滞留", body: "请在 I-94 的日期前离境。逾期会使签证作废，可能被禁止再入境，也会失去办 ESTA 的资格。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照美国国务院、美国海关和美国驻新加坡大使馆核对。费用和规定会变动，付款前请查看页尾“来源”里的链接。",
    },

    related: {
      destinations: ["canada", "united-kingdom", "japan", "australia"],
      guides: [
        { label: "新加坡的中国护照持有人办签证", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "新加坡美国签证面谈", href: "/guides/us-visa-interview-singapore" },
        { label: "签证被拒：原因和重新申请", href: "/guides/visa-refused-reapply" },
        { label: "各国签证照片要求", href: "/guides/visa-photo-requirements" },
        { label: "美国国务院：签证等候时间", href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" },
        { label: "VIZA 签证资讯", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "常见拒签原因",
  rejectionSub: "美国会说明拒签的法律依据，B 类签证大多属于下面几种。顾问会在面谈前和您一起逐项检查。",
  rejectionReasons: [
    { title: "与居住地的联系不够清楚（214(b) 条）", body: "最常见的原因。官员必须相信您会回新加坡，所以稳定的工作、家人、住所和存款都有帮助。情况改变后可以再次申请，签证费要重新缴付。" },
    { title: "材料缺失或需要补充审查（221(g) 条）", body: "官员要求补交文件，或把个案转去补充审查。面谈时请带齐材料，收到要求要尽快回复。" },
    { title: "回答不准确或前后不一致", body: "DS-160 与护照、材料或面谈回答不一致，会引起疑问。虚假陈述可能导致永久禁入。" },
    { title: "以往在美国的移民问题", body: "曾经逾期滞留或被遣返，需要诚实说明。逾期 180 天以上，会有按时间计算的再入境禁令。" },
    { title: "资金与行程不相称", body: "银行流水对这趟行程来说偏少，或在申请前突然存入大笔款项，会让人怀疑谁来付费、为什么。" },
  ],

  faqSub: "没有找到答案？请问下面的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "我需要签证吗", q: "新加坡公民去美国需要签证吗？", a: "旅游或商务在 90 天以内不需要。新加坡护照持有人在线申请 ESTA，费用约 40 美元，最长两年有效。停留超过 90 天，或不符合 ESTA 条件的人，需要办 B1/B2 签证。" },
    { category: "我需要签证吗", q: "住在新加坡的中国护照持有人需要美国签证吗？", a: "需要。您要申请 B1/B2 签证并参加面谈。如果签发的是 10 年有效签证，出行前还要登记 EVUS。" },
    { category: "我需要签证吗", q: "住在新加坡的马来西亚人需要美国签证吗？", a: "需要。马来西亚不在免签证计划内，所以马来西亚护照持有人即使住在新加坡，也要办 B1/B2 签证。" },
    { category: "我需要签证吗", q: "新加坡永久居民需要美国签证吗？", a: "看您持什么护照，而不是 PR 身份。持中国、马来西亚、印度、印尼、菲律宾或越南护照的 PR，需要办 B1/B2 签证。" },
    { category: "在新加坡办理", q: "怎样在新加坡申请美国签证？", a: "填写 DS-160，缴签证费，通过使馆的预约系统订面谈，然后带材料参加面谈。每本需要签证的护照步骤都一样。" },
    { category: "在新加坡办理", q: "新加坡的美国签证预约怎么约？", a: "缴费后，通过美国驻新加坡大使馆签证页面上的链接预约。可约时间经常变化，订机票前请先看当前的等候时间。" },
    { category: "在新加坡办理", q: "一定要面谈吗？", a: "几乎都要。自 2025 年 10 月 1 日起，美国国务院收紧了免面谈的范围。主要的免面谈情形，是在 B 类签证到期前 12 个月内续签，且原签证为全有效期、签发时您已年满 18 岁。" },
    { category: "在新加坡办理", q: "不是新加坡公民，可以在新加坡申请吗？", a: "住在新加坡的人一般在这里申请。美国国务院建议在居住国申请，所以请备好准证和工作证明，供官员查看。" },
    { category: "费用与时间", q: "在新加坡办美国签证要多少钱？", a: "B1/B2 申请费每人 185 美元。法律规定还有 250 美元的签证诚信费，缴费前请查看国务院和使馆页面，确认何时适用。" },
    { category: "费用与时间", q: "美国签证要办多久？", a: "面谈日期由使馆安排，美国国务院会公布新加坡当前的等候时间。部分个案面谈后还要补充审查，出行前请多留些时间。" },
    { category: "拒签", q: "美国签证被拒怎么办？", a: "官员会说明法律依据，最常见的是 214(b) 条。费用不退还，情况改变后可以再次申请。可以先请顾问检查可能的薄弱环节。" },
    { category: "出行前", q: "持 B1/B2 签证可以在美国工作吗？", a: "不可以。B1 涵盖商务会议和会展，B2 涵盖旅游和探亲。有薪工作需要办其他签证。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，您直接向美国政府缴付费用。" },
  ],

  sources: [
    { label: "美国国务院，访客签证", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html", display: "travel.state.gov" },
    { label: "美国国务院，签证服务收费", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html", display: "travel.state.gov" },
    { label: "美国国务院，签证等候时间", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html", display: "travel.state.gov" },
    { label: "美国国务院，免面谈更新（2025 年 9 月 18 日）", url: "https://travel.state.gov/content/travel/en/News/visas-news/interview-waiver-update-sept-18-2025.html", display: "travel.state.gov" },
    { label: "美国国务院，免签证计划", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html", display: "travel.state.gov" },
    { label: "美国驻新加坡大使馆，签证", url: "https://sg.usembassy.gov/visas/", display: "sg.usembassy.gov" },
    { label: "DS-160 在线非移民签证申请", url: "https://ceac.state.gov/genniv/", display: "ceac.state.gov" },
    { label: "ESTA，美国海关与边境保护局", url: "https://esta.cbp.dhs.gov/", display: "esta.cbp.dhs.gov" },
    { label: "EVUS 登记", url: "https://www.evus.gov/", display: "evus.gov" },
    { label: "USCIS，延长停留（I-539 表）", url: "https://www.uscis.gov/i-539", display: "uscis.gov" },
  ],

  price: {
    etaLabel: "面谈等候",
    etaValue: "由使馆安排",
    title: "B1/B2 访客签证 · 使馆面谈",
    sub: "VIZA 的协助免费：DS-160 核对、材料审阅和面谈指引。签证费支付给美国政府。",
    foot: "VIZA 的服务免费。美国签证费直接支付给美国政府。",
  },

  aiPlaceholder: "询问新加坡办理美国签证的任何问题：ESTA、DS-160、面谈、费用…",
};

export default unitedStates;
