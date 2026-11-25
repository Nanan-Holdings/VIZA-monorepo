import type { DestinationContent } from "../types";

/** 韩国 K-ETA 与签证，简体中文版。事实核对日期、来源与未能确认的事项见 ../south-korea.ts。 */
export const southKorea: DestinationContent = {
  slug: "south-korea",

  heroTitle: "新加坡办理韩国签证与 K-ETA",
  lede: "K-ETA 是韩国面向免签访客的线上电子旅行许可，费用 10,000 韩元。新加坡护照目前在韩国的 K-ETA 临时免除名单上，所以新加坡人既不用办签证，也不用办 K-ETA，只需要填一张免费的入境电子卡。住在新加坡、持其他护照的人，先查 K-ETA 国家名单；如果您的护照不在名单上，就要亲自去办短期访问签证。",
  heroImage: "/assets/heroes/south-korea.jpg",
  meta: [
    { k: "K-ETA 费用", v: "10,000 韩元" },
    { k: "K-ETA 有效期", v: "3 年" },
    { k: "新加坡护照", v: "至 2027 年 12 月 31 日免 K-ETA" },
    { k: "核对日期", v: "2026 年 11 月 25 日" },
  ],
  tags: [
    { icon: "shield", label: "VIZA 服务免费" },
    { icon: "doc", label: "材料核对" },
    { icon: "globe", label: "K-ETA 与签证" },
  ],

  page: {
    framing: "global",

    glance: {
      needVisa: "免签护照办 K-ETA，其他护照办签证，新加坡护照都不需要",
      govFee: "K-ETA 10,000 韩元，签证单次入境 52 新元起",
      processing: "K-ETA 一般 72 小时内，签证 8 个工作日",
      maxStay: "免签停留一般最长 90 天，单次入境签证有效期 3 个月",
      checked: "2026 年 11 月 25 日",
    },

    passports: {
      intro: "韩国把访客分成三类：免签且不用 K-ETA、免签但要办 K-ETA、需要签证。K-ETA 网站上有国家名单，告诉您的护照属于哪一类。名单上没有您的国家，就需要签证。",
      rows: [
        { passport: "新加坡", status: "无需签证，无需 K-ETA", note: "新加坡在 K-ETA 临时免除名单上，已延长到 2027 年 12 月 31 日。请在抵达前 3 天内填写免费的入境电子卡。" },
        { passport: "马来西亚", status: "请查 K-ETA 名单", note: "在 K-ETA 资格页面搜索马来西亚。如果需要 K-ETA，请至少在登机前 72 小时申请。" },
        { passport: "印度", status: "请查 K-ETA 名单", note: "名单上没有印度的话，就办签证。住在新加坡的人可到韩国签证申请中心办理。" },
        { passport: "印度尼西亚", status: "请查 K-ETA 名单", note: "做法相同：先搜名单，不在名单上就办签证。" },
        { passport: "菲律宾", status: "请查 K-ETA 名单", note: "使馆列明，菲律宾护照申请 59 天以内的商务或旅游签证，免收签证费。" },
        { passport: "越南", status: "请查 K-ETA 名单", note: "如果需要办签证，使馆页面上有越南专属的较低费用表。" },
        { passport: "中国（PRC）", status: "请查 K-ETA 名单", note: "中国公民团体游免签试行期是 2025 年 9 月 29 日至 2026 年 6 月 30 日，适用于在中国境内组团出行，不适用于从新加坡出发。" },
        { passport: "其他护照", status: "请搜 K-ETA 名单", note: "泰国免收韩国签证费。其他护照，以 K-ETA 页面为准。" },
      ],
    },

    visaTypes: {
      intro: "多数行程只会用到两样东西，一样是独立申请的，一样是签证。",
      items: [
        { title: "K-ETA", body: "免签访客的线上电子许可，适用于旅游、探亲、参加活动和不营利的商务。费用 10,000 韩元，有效期 3 年，可多次使用。只能在 K-ETA 网站或应用上自己申请，不要通过代理。" },
        { title: "短期访问签证，C-3-9", body: "用于旅游和短期访问，适合护照不在 K-ETA 名单上的人。在新加坡办理，分单次入境（有效期 3 个月）、两次入境（6 个月）和多次入境（5 年，需获批）。" },
        { title: "入境电子卡", body: "免费的线上卡，自 2025 年 2 月 24 日起实施。包括新加坡人在内，所有人都要在抵达前 3 天内填写；持有有效 K-ETA 的人免填。" },
        { title: "其他签证", body: "留学、工作和长期停留使用其他韩国签证代码，由使馆逐案审理。" },
      ],
    },

    residents: {
      intro: "使馆只受理持有效长期准证、居住在新加坡的外国人的签证申请，短期访客不符合资格。新加坡公民根本不需要申请。",
      rows: [
        { pass: "工作准证（EP）", body: "带上护照、准证复印件、3 个月的银行流水，以及最近 1 个月内开具、有亲笔签名和公司印章的在职证明。" },
        { pass: "S 准证", body: "与 EP 相同。如果您的准证带二维码，请再打印一份近期的 SGWORKPASS 扫描页。" },
        { pass: "家属准证（DP）", body: "您按无业申请人办理。需要配偶、父母或子女的雇主或学校出具的信件原件，该人的护照复印件，以及证明亲属关系的英文文件。" },
        { pass: "永久居民（PR）", body: "带上 PR 卡和有效的再入境许可，以及护照、照片、银行流水和在职证明。" },
        { pass: "新加坡公民", body: "无需签证，也无需 K-ETA。护照有效期要覆盖整个停留期，并填写入境电子卡。17 岁及以上的新加坡人还可以登记使用仁川机场的自动通关。" },
        { pass: "学生准证", body: "带上最近 1 个月内开具的学校证明信原件。学生不需要提供银行流水。" },
      ],
    },

    fees: {
      intro: "K-ETA 费用付给韩国，签证费通过签证中心付给使馆。下面的签证费自 2026 年 9 月 1 日起适用。VIZA 的协助免费。",
      rows: [
        { item: "K-ETA", amount: "10,000 韩元", note: "约合 7 至 8 美元，有效期 3 年。新加坡等免除国家无需办理。" },
        { item: "签证，单次入境 90 天以内", amount: "52 新元", note: "新加坡、马来西亚、印度、印尼、中国和菲律宾护照，除特殊规定外适用此档。" },
        { item: "签证，单次入境超过 90 天", amount: "78 新元", note: "有效期 3 个月内入境。" },
        { item: "签证，两次入境", amount: "91 新元", note: "有效期 6 个月。" },
        { item: "签证，多次入境", amount: "117 新元", note: "有效期 5 年，需获批。如果未获批，可能改发单次入境签证，差额不退。" },
        { item: "免收的情形", amount: "0 新元", note: "泰国所有签证免收。菲律宾的 59 天以内商务或旅游签证免收。" },
      ],
      processing: "K-ETA 一般在 72 小时内批准，所以至少提前这么久申请，能早就早。签证需要 8 个工作日，没有加急服务。签证费以现金或 PayNow 缴付，不予退还。签证获批之前，请不要先订机票和酒店。",
    },

    apply: {
      intro: "先回答最关键的一个问题：您的护照在 K-ETA 名单上吗？在的话，K-ETA 几分钟就能办好；不在的话，就要预约后亲自办签证。",
      guided: {
        title: "自助指引",
        body: "VIZA 先帮您判断护照属于哪一类，再带您填 K-ETA 表格，或按您的准证类型填签证表格并过清单。递交由您自己完成。",
      },
      fullService: {
        title: "全程代办",
        body: "VIZA 顾问替您准备签证材料，核对银行流水和信件，并告诉您预约当天要带什么。K-ETA 本身由您自己在 K-ETA 网站提交。",
      },
      steps: [
        { title: "查您的护照", body: "在 K-ETA 资格页面搜索您的国家。新加坡护照目前既不需要 K-ETA，也不需要签证。" },
        { title: "K-ETA 途径", body: "在 K-ETA 网站或应用上申请，支付 10,000 韩元。一般在 72 小时内批准，有效期 3 年。" },
        { title: "签证途径", body: "先预约韩国签证申请中心，再亲自带上表格、照片、护照、准证复印件、银行流水和信件前往。不接受直接上门，也不接受线上或电邮申请。" },
        { title: "取件并出行", body: "签证需要 8 个工作日。抵达前 3 天内填写入境电子卡，持有效 K-ETA 的人除外。" },
      ],
    },

    checklist: {
      intro: "以下是使馆对居住在新加坡的外国人办 C-3-9 签证要求的材料。K-ETA 只需要护照信息、照片和支付费用的银行卡。",
      groups: [
        {
          applicant: "所有人",
          items: [
            "签名的签证申请表，附一张白底照片，不接受电子签名",
            "护照，有效期至少 6 个月，原件和照片页的清晰复印件",
            "新加坡身份证、EP、S 准证、工作许可、学生准证、LTVP 或家属准证的清晰复印件",
            "收取工资的账户最近 3 个月的新加坡银行流水，纸质或电子版均可",
          ],
        },
        {
          applicant: "在职",
          items: [
            "最近 1 个月内开具的在职证明原件，有亲笔签名和公司印章",
            "持 LTVP 并工作的人：新加坡人力部的同意函",
          ],
        },
        {
          applicant: "自雇",
          items: ["最近 1 个月内打印的 ACRA 商业资料"],
        },
        {
          applicant: "家属准证与无业",
          items: [
            "配偶、父母或子女的雇主或学校出具的信件原件",
            "该人的护照复印件和英文的亲属关系证明",
            "非英文的文件需附使馆认证的翻译",
          ],
        },
        {
          applicant: "永久居民与学生",
          items: [
            "PR：有效的再入境许可",
            "学生：最近 1 个月内开具的学校证明信原件，不需要银行流水",
          ],
        },
      ],
    },

    travel: {
      intro: "韩国把大部分入境手续搬到了线上，登机前花几分钟，能省下在仁川的时间。",
      items: [
        { title: "入境电子卡", body: "在抵达前 3 天内到入境电子卡网站填写，免费。持有效 K-ETA 的人免填。免除国家的访客自愿办理 K-ETA，也能享受同样的便利。", href: "/arrival-cards/korea-e-arrival-card", linkLabel: "阅读电子入境卡指南" },
        { title: "Q-CODE", body: "Q-CODE 只针对到过指定检疫地区的旅客，从其他地方来的旅客不需要。出发前请查韩国疾病管理厅的网站。" },
        { title: "护照", body: "新加坡护照没有固定的最短有效期要求，但护照必须覆盖整个停留期。换了新护照，需要重新办 K-ETA。" },
        { title: "保险", body: "我们读到的官方页面没有把旅行保险列为条件，但为了医疗费用，建议购买。" },
        { title: "自动通关", body: "17 岁及以上的新加坡人，自 2025 年 12 月 1 日起可以登记使用仁川机场的自动通关。" },
      ],
    },

    reviewed: {
      date: "2026 年 11 月 25 日",
      note: "已对照 K-ETA 网站、入境电子卡网站和韩国驻新加坡大使馆的页面。临时免除已延长到 2027 年 12 月 31 日，出行前请先看页面底部的来源链接。",
    },

    related: {
      destinations: ["japan", "china", "vietnam", "thailand"],
      guides: [
        { label: "新加坡护照免签国家", href: "/guides/visa-free-countries-singapore-passport" },
        { label: "新加坡的中国护照持有人办签证", href: "/guides/visas-chinese-passport-holders-singapore" },
        { label: "新加坡的菲律宾和印度居民办签证", href: "/guides/visas-filipino-indian-residents-singapore" },
        { label: "电子旅行授权和签证的区别", href: "/guides/eta-vs-visa" },
        { label: "各国签证照片要求", href: "/guides/visa-photo-requirements" },
        { label: "K-ETA 官方申请网站", href: "https://www.k-eta.go.kr/portal/guidance/index.do?locale=en" },
        { label: "VIZA 签证资讯", href: "/blog" },
      ],
    },
  },

  rejectionTitle: "常见被拒原因",
  rejectionSub: "使馆一般不说明拒绝的原因。以下是使馆自己提醒过的几点，顾问会先帮您检查。",
  rejectionReasons: [
    { title: "准证复印件模糊", body: "使馆提醒，准证复印件模糊可能被拒。请清晰扫描，正反两面都要。" },
    { title: "提供虚假信息", body: "提供虚假信息可能被禁止申请签证，最长 3 年。每一栏都请如实填写。" },
    { title: "银行流水偏少", body: "使馆要求提供收取工资的账户最近 3 个月的流水，不接受海外银行和信用卡的对账单。" },
    { title: "信件太旧", body: "在职证明、学校证明和 ACRA 文件都要在最近 1 个月内开具，过旧的信件是常见的被退回原因。" },
    { title: "走错途径", body: "K-ETA 只适用于免签护照。您的国家不在名单上，办 K-ETA 没有用；短期停留新加坡的访客，也不能在这里办签证。" },
    { title: "订票太早", body: "使馆提醒获批之前不要订机票和酒店，这样万一被拒，您手里不会有要取消的订单。" },
  ],

  faqSub: "没找到答案？问下方的 AI 助手，或联系 VIZA 顾问。",
  faq: [
    { category: "K-ETA", q: "K-ETA 是什么？", a: "是面向免签访客的线上电子旅行许可，适用于旅游、探亲、参加活动和不营利的商务，登机前必须持有。" },
    { category: "K-ETA", q: "K-ETA 多少钱，有效期多久？", a: "10,000 韩元，约合 7 至 8 美元。有效期 3 年，可多次使用。换了新护照，需要重新办 K-ETA。" },
    { category: "K-ETA", q: "K-ETA 要多久批准？", a: "一般在 72 小时内批准，所以至少在登机前这么久申请，能早就早。" },
    { category: "K-ETA", q: "K-ETA 在哪里申请？", a: "只能在 K-ETA 网站或手机应用上申请。请小心代理和仿冒网站，K-ETA 网站本身就提醒过网络钓鱼。" },
    { category: "需要办吗", q: "新加坡人去韩国需要 K-ETA 吗？", a: "不需要。新加坡在 K-ETA 临时免除名单上，已延长到 2027 年 12 月 31 日。也不需要签证，但要在抵达前 3 天内填写免费的入境电子卡。" },
    { category: "需要办吗", q: "住在新加坡的马来西亚人、印度人和菲律宾人需要 K-ETA 吗？", a: "在 K-ETA 资格页面搜索您的国家。在名单上的，办 K-ETA；不在的，就要办签证，住在新加坡的人到韩国签证申请中心办理。" },
    { category: "需要办吗", q: "住在新加坡的中国护照持有人可以用团体游免签试行政策吗？", a: "不可以。该试行期是 2025 年 9 月 29 日至 2026 年 6 月 30 日，针对在中国境内参加特定团体游的中国公民，不适用于从新加坡出发。" },
    { category: "在新加坡办理", q: "谁可以在新加坡办韩国签证？", a: "只有持有效长期准证、居住在新加坡的外国人。短期访客不符合资格。" },
    { category: "在新加坡办理", q: "在新加坡到哪里办韩国签证？", a: "预约后亲自到韩国签证申请中心办理。不接受直接上门，也不接受线上或电邮申请。家人可以互相代交，朋友和旅行社不可以。" },
    { category: "在新加坡办理", q: "在新加坡办韩国签证要多少钱？", a: "自 2026 年 9 月 1 日起，单次入境 90 天以内 52 新元，超过 90 天 78 新元，两次入境 91 新元，多次入境 117 新元。以现金或 PayNow 缴付，不予退还。" },
    { category: "在新加坡办理", q: "韩国签证要办多久？", a: "8 个工作日，使馆没有加急服务。" },
    { category: "出行前", q: "需要填入境电子卡吗？", a: "需要，除非您持有有效的 K-ETA。抵达前 3 天内免费填写，该系统自 2025 年 2 月 24 日起实施。" },
    { category: "出行前", q: "VIZA 收费吗？", a: "不收费。VIZA 的协助免费，K-ETA 费用和签证费由您直接支付给相关机关。" },
  ],

  sources: [
    { label: "K-ETA，说明与费用", url: "https://www.k-eta.go.kr/portal/guidance/index.do?locale=en", display: "k-eta.go.kr" },
    { label: "K-ETA，临时免除通知", url: "https://www.k-eta.go.kr/portal/board/viewboarddetail.do?bbsSn=299707&locale=EN", display: "k-eta.go.kr" },
    { label: "韩国驻新加坡大使馆，K-ETA 常见问题", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2445/view.do?seq=738963&page=1", display: "overseas.mofa.go.kr" },
    { label: "韩国驻新加坡大使馆，K-ETA 免除通知", url: "https://www.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761395", display: "mofa.go.kr" },
    { label: "韩国驻新加坡大使馆，C-3-9 短期访问签证", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433&page=1", display: "overseas.mofa.go.kr" },
    { label: "韩国驻新加坡大使馆，2026 年 9 月 1 日起的签证费", url: "https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761414&page=1", display: "overseas.mofa.go.kr" },
    { label: "韩国驻新加坡大使馆，中国团体游免签试行", url: "https://www.mofa.go.kr/sg-en/brd/m_2435/view.do?seq=761557", display: "mofa.go.kr" },
    { label: "入境电子卡，使用指南", url: "https://www.e-arrivalcard.go.kr/portal/guide/eacGuide.do?locale=E", display: "e-arrivalcard.go.kr" },
  ],

  price: {
    etaLabel: "K-ETA 批准",
    etaValue: "一般 72 小时内",
    title: "K-ETA 与短期签证",
    sub: "VIZA 的协助免费：材料核对和申请准备。K-ETA 费用和签证费直接支付给相关机关。",
    foot: "VIZA 的服务免费。韩国的费用直接支付给签发机关。",
  },

  aiPlaceholder: "问问韩国 K-ETA 和签证：谁需要、费用、材料…",
};

export default southKorea;
