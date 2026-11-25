import type { DestinationContent } from "../types";

/** 印尼落地签（电子落地签 e-VOA）简体中文版。事实核对日期、来源与未能确认的事项见 ../indonesia.ts。 */
export const indonesia: DestinationContent = {
  slug: "indonesia",

  heroTitle: "印尼签证办理：印尼落地签（e-VOA）申请条件与流程",
  lede: "印尼落地签是可停留 30 天的签证，出发前可以在线申请，也就是电子落地签（e-VOA），并且可以延期一次，再停 30 天。按印尼移民总局目前的信息，费用是 50 万印尼盾，印尼已宣布要调高费用，但还没有生效日期。新加坡护照免签入境印尼，最长 30 天，所以想延期的话，e-VOA 更合适。中国和印度护照办落地签或 e-VOA。所有访客入境前还要免费填写 All Indonesia 入境申报。",
  heroImage: "/assets/heroes/indonesia.jpg",
  meta: [
    { k: "类型", v: "电子落地签（B1）" },
    { k: "停留", v: "30 天，可延期一次" },
    { k: "费用", v: "50 万印尼盾（已宣布调高）" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "材料核对" },
    { icon: "bolt", label: "在线申请" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "新加坡、马来西亚、菲律宾、越南护照旅游停留不超过 30 天不需要。中国和印度护照办落地签或 e-VOA",
      govFee: "按目前信息，落地签或 e-VOA 为 50 万印尼盾。印尼在 2026 年 8 月宣布 e-VOA 75 万、柜台办理 100 万印尼盾，尚无生效日期",
      processing: "以政府网站为准。请在出发前申请，并预留刷卡付款和收邮件的时间",
      maxStay: "30 天，可延期一次，再 30 天。免签入境为 30 天，不能延期",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "印尼看护照，不看您住在哪里。下表是各本护照通常的办理途径。最终以网站的签证查询页和移民总局的落地签国家名单为准。",
      rows: [
        { passport: "新加坡", status: "免签，最长 30 天", note: "不收费，也不能延期。新加坡护照也可以办 e-VOA，可延期一次 30 天。" },
        { passport: "中国（PRC）", status: "落地签或 e-VOA", note: "中国护照一直走落地签途径。申请前请先对照国家名单确认您的护照。" },
        { passport: "马来西亚", status: "免签，最长 30 天", note: "东盟护照旅游在免签名单上。" },
        { passport: "印度", status: "落地签或 e-VOA", note: "印度护照可以办 B1 落地签和 e-VOA。" },
        { passport: "印度尼西亚", status: "无需签证", note: "印尼公民用本国护照入境，同样要填 All Indonesia 申报。" },
        { passport: "菲律宾", status: "免签，最长 30 天", note: "东盟护照旅游在免签名单上。" },
        { passport: "越南", status: "免签，最长 30 天", note: "东盟护照旅游在免签名单上。" },
        { passport: "其他护照", status: "请对照国家名单", note: "约 90 个国家可以办落地签或 e-VOA。您的国家不在名单上，出发前要申请访问签证。" },
      ],
    },

    visaTypes: {
      intro: "印尼有几种短期停留的途径，大多数游客用前三种之一。",
      items: [
        { title: "免签入境", body: "东盟护照的旅游访问，最长 30 天。不收费，不能延期，也不能转成其他居留许可。" },
        { title: "电子落地签 e-VOA（B1）", body: "出发前在线申请的落地签。一份申请最多可以包含五个人，刷卡付费，停留 30 天，可延期一次 30 天。" },
        { title: "机场落地签（B1）", body: "同一种签证，在移民柜台购买。印尼计划让这条途径的费用比 e-VOA 更高，所以在线申请更划算。" },
        { title: "访问签证（C1）与长期停留", body: "要停留更久或办商务，请通过网站的签证查询页申请访问签证或其他类别。B1 不允许销售商品或服务，也不能领取印尼公司的报酬。" },
      ],
    },

    residents: {
      intro: "住在新加坡，不会改变印尼的要求，护照说了算。请让准证在整个行程期间保持有效，这样您才能回新加坡。",
      rows: [
        { pass: "工作准证（EP）", body: "按您护照那一行办。中国或印度护照持有人办落地签或 e-VOA，EP 只关系到回新加坡。" },
        { pass: "S 准证", body: "与 EP 相同。e-VOA 表格要的是护照和个人资料，不要准证。" },
        { pass: "家属准证（DP）", body: "每位家人用自己的护照申请，网站上一份申请最多可含五个人。家属准证请保持在回程日期之后仍然有效。" },
        { pass: "永久居民（PR）", body: "PR 持有的是另一个国家的护照，所以按那一行办。有一份指南提到，新加坡 PR 去巴淡、宾坦和卡里蒙短途旅行有特别豁免，使用前请先查清条件。" },
        { pass: "新加坡公民", body: "30 天内无需签证。可能要延期的话，用 e-VOA。请带上有 6 个月有效期的护照、回程机票和 All Indonesia 二维码。" },
        { pass: "学生准证", body: "按护照那一行办，并确认护照有 6 个月有效期。" },
      ],
    },

    fees: {
      intro: "免签入境不收费。落地签和 e-VOA 在网站上刷卡支付。VIZA 的协助免费。",
      rows: [
        { item: "e-VOA 或落地签（B1）", amount: "50 万印尼盾", note: "这是移民总局目前信息里的数字。付款当天请再查一下网站。" },
        { item: "已宣布的调价", amount: "e-VOA 75 万，柜台办理 100 万印尼盾", note: "2026 年 8 月 12 日宣布，被描述为提议，尚无生效日期。" },
        { item: "e-VOA 延期", amount: "以网站为准", note: "可延期一次 30 天，在网站上申请，并在次日的工作日到移民局拍照。" },
        { item: "免签入境", amount: "免费", note: "东盟护照，最长 30 天，不能延期。" },
        { item: "巴厘岛旅游税", amount: "15 万印尼盾（据报道）", note: "由巴厘省政府对外国游客另行征收。出发前请查巴厘省政府的页面。" },
      ],
      processing: "本指南读到的网站页面没有写明固定的办理时间，所以请在出发前申请，并保留邮件。使用 Mastercard、Visa 或 JCB 付款，护照需要有 6 个月有效期。e-VOA 就是落地签，抵达印尼移民柜台时，连同护照一起出示。",
    },

    apply: {
      intro: "按您需要多少协助来选。网站是政府的，费用交给政府，不交给 VIZA。",
      guided: {
        title: "自助指引",
        body: "VIZA 的 AI 带您填写 e-VOA 表格，检查护照和照片，由您自己在网站上递交并付款。",
      },
      fullService: {
        title: "全程代办",
        body: "VIZA 顾问替您和同行的人准备表格，检查文件并整理好申请，在付款前先拦下常见的护照和日期错误。",
      },
      steps: [
        { title: "在 VIZA 开始", body: "告诉我们护照、出行日期和同行的人。我们先确认您可以免签，还是想办 e-VOA。" },
        { title: "准备文件", body: "扫描护照资料页，再附一张近期照片。递交前我们先检查。" },
        { title: "申请并付款", body: "在印尼移民局电子签证网站递交并刷卡付费，费用交给政府。" },
        { title: "申报入境", body: "抵达前三天内，免费填写 All Indonesia 申报，把二维码和 e-VOA 放在一起。" },
      ],
    },

    checklist: {
      intro: "网站要的材料不多。下面是所有人通用的，后面按申请人类型补充几点。",
      groups: [
        {
          applicant: "所有人",
          items: [
            "护照至少有 6 个月有效期",
            "护照资料页扫描件和近期照片",
            "电子邮箱，以及用于付款的 Mastercard、Visa 或 JCB 卡",
            "回程或后续机票和第一个落脚地址，入境时备查",
            "抵达前三天内填好的 All Indonesia 二维码",
          ],
        },
        {
          applicant: "新加坡公民与居民",
          items: [
            "新加坡准证或身份证在回程时仍然有效",
            "申请时用您持有国家的护照，而不是准证",
          ],
        },
        {
          applicant: "家庭与团体",
          items: [
            "一份申请最多可含五个人，并填每个人的护照资料",
            "儿童各用自己的护照",
          ],
        },
        {
          applicant: "中国和印度护照持有人",
          items: [
            "确认您的护照在落地签国家名单上",
            "出发前先申请 e-VOA，避开柜台更高的费用",
          ],
        },
      ],
    },

    travel: {
      intro: "签证只是一部分。印尼要求每位访客填入境申报，也有几条规定容易让人踩坑。",
      items: [
        { title: "All Indonesia 入境申报", body: "所有旅客在抵达前三天内，到 allindonesia.imigrasi.go.id 提交入境卡。涵盖移民、海关和健康，免费，填好后得到二维码。它不是签证。", href: "/arrival-cards/indonesia-all-indonesia", linkLabel: "阅读 All Indonesia 指南" },
        { title: "e-VOA 延期", body: "e-VOA 可以在网站上延期一次 30 天，合计 60 天。免签入境不能延期，所以可能多留的话，请选 e-VOA。" },
        { title: "工作与商务", body: "B1 不允许销售商品或服务，也不能领取印尼公司的报酬。要工作，请到网站查对应的签证。" },
        { title: "巴厘岛旅游税", body: "外国游客去巴厘岛要另付旅游税，据报道是 15 万印尼盾。这不属于签证费用。" },
        { title: "保险", body: "旅行保险不是入境要求，但办一份覆盖医疗和机票取消的保险是明智的。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照印尼移民局电子签证网站和已宣布调价的新闻。费用可能很快变动，付款前请先看页面底部的来源链接。",
    },

    related: {
      destinations: ["malaysia", "vietnam", "thailand", "australia"],
      guides: [
        { label: "All Indonesia 入境申报，印尼移民总局", href: "https://allindonesia.imigrasi.go.id/" },
      ],
    },
  },

  rejectionTitle: "常见拒签原因",
  rejectionSub: "印尼不公布 e-VOA 被拒的原因。以下是递交前顾问最先检查的几点。",
  rejectionReasons: [
    { title: "护照有效期", body: "护照至少要有 6 个月有效期。快到期的护照请先换新。" },
    { title: "护照不在名单上", body: "落地签和 e-VOA 只面向移民总局名单上的国家。您的国家不在名单上，请申请访问签证。" },
    { title: "信息与护照不符", body: "姓名、护照号码和出生日期，必须与护照完全一致。" },
    { title: "照片或扫描件不清楚", body: "护照扫描件模糊、裁切，或照片不清楚，是常见的被退回原因。" },
    { title: "事由不对", body: "B1 用于旅游、探亲、短期商务会议等。工作和长期居留要办其他签证。" },
    { title: "想停的时间超出规定", body: "免签停留不能延期。可能想停超过 30 天的话，出发前就办 e-VOA。" },
  ],

  faqSub: "没找到答案？问下方的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "需要签证吗", q: "新加坡人去印尼需要签证吗？", a: "旅游停留不超过 30 天不需要。新加坡护照免签入境，但不能延期。e-VOA 可以延期一次 30 天。" },
    { category: "需要签证吗", q: "印尼落地签是什么？", a: "是 B1 落地签，可停留 30 天，出发前可以在线申请 e-VOA，也可以到机场办理。可以延期一次，再 30 天。" },
    { category: "需要签证吗", q: "住在新加坡的中国或印度护照持有人去印尼需要签证吗？", a: "办落地签或 e-VOA。印度在名单上，中国护照持有人申请前请先对照移民总局的国家名单。" },
    { category: "需要签证吗", q: "新加坡 PR 和准证持有人去印尼需要签证吗？", a: "要看护照。印尼看护照，所以按您所持护照那一行办。EP、S 准证、家属准证或 PR 身份不会改变这一点。" },
    { category: "申请", q: "怎么申请印尼 e-VOA？", a: "打开印尼移民局电子签证网站，填表、上传护照和照片，用 Mastercard、Visa 或 JCB 付费。一份申请最多可含五个人。" },
    { category: "申请", q: "e-VOA 要办多久？", a: "本指南读到的网站页面没有写明固定时间，请在出发前申请，并保留邮件。" },
    { category: "申请", q: "印尼 e-VOA 可以停留多久？", a: "30 天，可在网站上延期一次 30 天，合计 60 天。之后必须离境。" },
    { category: "费用", q: "印尼落地签多少钱？", a: "按目前信息是 50 万印尼盾。2026 年 8 月印尼宣布 e-VOA 75 万、柜台办理 100 万印尼盾，尚无生效日期，付款当天请查一下网站。" },
    { category: "费用", q: "去巴厘岛要付旅游税吗？", a: "外国游客去巴厘岛要另付旅游税，据报道是 15 万印尼盾，由巴厘省政府规定，不属于签证费用。" },
    { category: "入境卡", q: "All Indonesia 入境卡是什么？", a: "是免费的在线入境申报，涵盖移民、海关和健康。请在抵达前三天内提交，并出示二维码。" },
    { category: "出行前", q: "e-VOA 可以用来在印尼工作吗？", a: "不可以。B1 不允许销售商品或服务，也不能领取印尼个人或公司的报酬。工作要办其他签证。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，政府费用在政府网站上支付。" },
  ],

  sources: [
    { label: "印尼移民局电子签证网站", url: "https://evisa.imigrasi.go.id/web/home", display: "evisa.imigrasi.go.id" },
    { label: "印尼移民局，签证查询", url: "https://evisa.imigrasi.go.id/web/visa-selection", display: "evisa.imigrasi.go.id" },
    { label: "印尼移民总局，落地签国家名单", url: "https://www.imigrasi.go.id/wna/daftar-negara-voa-bvk-calling-visa", display: "imigrasi.go.id" },
    { label: "All Indonesia 入境申报", url: "https://allindonesia.imigrasi.go.id/", display: "allindonesia.imigrasi.go.id" },
    { label: "印尼之声，已宣布的落地签费用调整", url: "https://rri.co.id/en/national/2646854/indonesia-implements-tiered-visa-fees-for-efficient-arrivals", display: "rri.co.id" },
  ],

  price: {
    etaLabel: "办理时间",
    etaValue: "以政府网站为准",
    title: "电子落地签 · 30 天",
    sub: "VIZA 的协助免费：表格准备和材料核对。签证费在政府网站上支付。",
    foot: "VIZA 的服务免费。印尼签证费用直接支付给印尼移民局。",
  },

  aiPlaceholder: "问问印尼落地签：e-VOA、费用、All Indonesia…",
};

export default indonesia;
