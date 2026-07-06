import type { VisaContent } from "../types";

/**
 * 意大利短期申根签证（C类，"Visto per turismo"）— 简体中文版本。
 *
 * 事实核查日期：2026-07-05，核对来源：vistoperitalia.esteri.it、
 * ambsingapore.esteri.it、ambpechino.esteri.it、visa.vfsglobal.com、
 * home-affairs.ec.europa.eu、travel-europe.europa.eu、mfa.gov.sg。
 * — 签证费：成人90欧元 / 6–11岁儿童45欧元 / 6岁以下免费（2024年6月11日起生效）。
 * — 审理时限：标准15个日历日（欧盟签证法典），必要时可延长至45天。
 * — 欧盟出入境系统（EES）自2026年4月10日起在所有外部边境全面运行，
 *   以生物特征记录取代护照盖章并自动检测逾期。意大利无电子入境卡。
 * — ETIAS（20欧元）确定于2026年第四季度启用——影响免签旅客（如新加坡
 *   护照持有人），不影响仍需签证的中国大陆护照持有人。
 *
 * 待运营确认事项：
 * — BLS International 新加坡的意大利签证服务费未在官方页面公布。
 * — 逾期罚款5,000–10,000欧元（意大利移民法 Art. 10-bis, D.Lgs 286/1998）
 *   经法律行业二手来源核实，非政府在线页面。
 * — 内政部生活费标准出自2000年3月1日指令（如1–5天停留约269.60欧元固定额），
 *   本次未在官方页面重新核实。
 * — 35×45毫米照片尺寸为申根/ICAO通用标准；领馆页面仅注明"护照尺寸、白底"。
 * — 新元换算按约1.50 SGD/EUR估算，汇率会波动。
 * — ETIAS 在2026年第四季度内的确切启用日期欧盟尚未公布。
 * — vistoperitalia.esteri.it 对自动抓取返回404（疑为反爬），发布前请人工确认链接可用。
 */
export const italy: VisaContent = {
  slug: "italy",

  heroTitle: "意大利申根签证",
  lede: "C类短期申根签证（意方称 \"Visto per turismo\"），任意180天内最长停留90天，通行全部29个申根国家。标准审理15个日历日——VIZA 顾问为您准备、递交并全程跟进。",
  heroImage: "/assets/heroes/italy.jpg",
  meta: [
    { k: "签证类型", v: "申根（C类）" },
    { k: "停留时长", v: "任意180天内90天" },
    { k: "有效期", v: "最长180天 · 多次最长5年" },
    { k: "入境次数", v: "单次 · 两次 · 多次" },
  ],
  tags: [
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "全套材料审核" },
    { icon: "bolt", label: "申根区通行" },
  ],

  overviewTitle: "意大利，概览",
  overviewSub:
    "凭意大利领事馆签发的申根签证，您可探索意大利风情，并在整个申根区内自由旅行，适用于旅游、探亲或短期出差。",
  glance: [
    { icon: "globe", k: "首都", v: "罗马", sub: "UTC+1（欧洲中部时间）/ +2（夏令时）" },
    { icon: "clock", k: "最佳旅行季", v: "4月–6月、9月–10月", sub: "气候宜人，游客较少" },
    { icon: "currency", k: "货币", v: "欧元（EUR）", sub: "1新元 ≈ 0.67欧元" },
    { icon: "pin", k: "热门目的地", v: "罗马 · 佛罗伦萨 · 威尼斯", sub: "另有米兰、阿马尔菲海岸、五渔村" },
  ],

  processTitle: "申根签证申请流程",
  processSub:
    "一次提交，全程托管。我们按官方 vistoperitalia.esteri.it 清单准备材料包，为您预约签证中心，全程跟进直至签证贴入护照。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片、行程单及支撑材料。顾问通过官方 vistoperitalia.esteri.it 工具生成对应领区的精确清单，递交前逐项核对。",
    },
    {
      title: "材料核验并预约递交",
      body: "VIZA 顾问填写申根申请表，并按您的居住地为您预约外包签证中心——新加坡为 BLS International，中国大陆为 VFS Global 意大利签证中心。",
    },
    {
      title: "采集生物特征 & 领事馆审核",
      body: "您需本人到场录入指纹（59个月内已采集过申根指纹可豁免）。领事馆标准审理为15个日历日，需进一步审查时可延至45天——我们持续跟踪进度，及时提醒补件请求。",
      statusRows: [
        { label: "生物特征预约已确认", ts: "6月15日 上午9:30", onTime: true },
        { label: "申请材料已递交领事馆", ts: "6月15日 中午12:00", onTime: true },
        { label: "等待领事馆审核", ts: "处理中" },
      ],
    },
    {
      title: "6月29日领取签证",
      body: "签证贴纸贴入护照，标注批准的入境次数与有效期。签证可领取或安排快递时，VIZA 顾问会第一时间通知您。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "意大利领事馆按 vistoperitalia.esteri.it 依国籍与居住地生成的申根清单审核材料。VIZA 顾问逐项核验——补传材料次数不限，免费。",
  documents: [
    { name: "申根签证申请表", sub: "填写完整并签名 · 领区清单由 vistoperitalia.esteri.it 官方工具生成" },
    { name: "护照及复印件", sub: "离开申根区后仍有3个月以上有效期 · 10年内签发 · 至少2页空白页" },
    { name: "护照照片", sub: "1张近照 · 35×45毫米 · 白底 · 符合ICAO标准" },
    { name: "领区居住证明", sub: "新加坡NRIC/有效居留证件（BLS 新加坡）· 中国大陆户口或居住证明（VFS 中国）" },
    { name: "旅行医疗保险", sub: "保额不低于3万欧元 · 覆盖整个申根区及全部停留期间" },
    { name: "往返机票预订单", sub: "已确认行程 · 前往多个申根国家须提供国家间交通证明" },
    { name: "住宿证明", sub: "覆盖每晚的酒店预订，或接待方出具的邀请住宿声明（dichiarazione di ospitalità）" },
    { name: "财力证明", sub: "近3个月银行流水 · 金额须符合意大利内政部生活费标准" },
    { name: "工作及经济约束力证明", sub: "在职证明（职位、年限、薪资）· 自雇者提供营业执照 · 学生提供在读证明" },
  ],

  rejectionTitle: "申根签证被拒的常见原因",
  rejectionSub:
    "意大利领事馆将重点审查以下问题。VIZA 在您提交前提前标记风险。",
  rejectionReasons: [
    {
      title: "停留目的及条件不成立",
      body: "行程单薄弱或前后矛盾、酒店预订无法核实，或材料与申报的旅游目的不符。",
    },
    {
      title: "生活费用证明不足",
      body: "银行流水低于内政部生活费标准，或无法证明资金足以覆盖停留期间开销及回程费用。",
    },
    {
      title: "离开申根区的意愿存疑",
      body: "与常居国的约束力薄弱——工作、家庭、资产等。这是中国大陆首次申请者最常见的拒签理由。",
    },
    {
      title: "旅行医疗保险无效或不足",
      body: "保额低于3万欧元、保险日期有误，或保单不覆盖整个申根区。",
    },
    {
      title: "提交虚假或不可信的材料",
      body: "伪造的预订单或在职证明将直接导致拒签，并可能在申根信息系统（SIS）中留下警示记录。",
    },
    {
      title: "已有SIS警示或逾期记录",
      body: "申根信息系统中存在拒绝入境警示，或有逾期停留历史——如今EES会自动留存记录。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "意大利无电子入境卡。自2026年4月10日起，欧盟出入境系统（EES）在边境采集指纹和面部图像，取代护照盖章——首次入境请预留生物特征登记时间。边检可能要求出示回程机票、住宿证明及生活费用证明。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次 · 两次 · 多次", sub: "以签证贴纸标注为准" },
    { icon: "clock", k: "90/180天规则", v: "最长90天", sub: "任意180天滚动窗口内，全申根区累计" },
    { icon: "photo", k: "EES生物特征", v: "边境采集", sub: "指纹+面部图像取代盖章 · 无入境卡" },
    { icon: "currency", k: "生活费抽查", v: "按要求出示", sub: "内政部指令：1–5天停留约269.60欧元固定标准" },
  ],

  extensionTitle: "签证延期与逾期停留",
  extensionSub:
    "延期仅限特殊情形——须向意大利当地警察总部（Questura）依欧盟签证法典第33条申请：不可抗力或人道主义原因免费，重大个人原因收费30欧元。总停留不得超过任意180天内90天，普通旅游延期不予批准。",
  extension: [
    { icon: "extend", k: "延期", v: "仅限特殊情形", sub: "在Questura办理 · 不可抗力免费，重大个人原因30欧元" },
    { icon: "alert", k: "逾期罚款", v: "5,000–10,000欧元", sub: "约7,500–15,000新元 · 境内查获另附驱逐令" },
    { icon: "ban", k: "入境禁令", v: "最长5年", sub: "全申根区生效 · 2026年4月起EES自动检测逾期" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "评分最高的签证平台 · 12,841条评价",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "AN",
        name: "苏慕仪",
        source: "Trustpilot · 4天前",
        title: "意大利之行，材料烦恼全搞定",
        body: "之前完全不知道有保险金额要求，VIZA 一下子就帮我找出来了。清单一次理清，签证顺利通过。",
      },
      {
        initials: "WL",
        name: "林威",
        source: "App Store · 10天前",
        title: "预约提醒让整个流程轻松很多",
        body: "采集生物特征前收到了清晰的提醒和需要携带的材料清单，三天后就去领了护照。",
      },
    ],
  },

  faqSub:
    "没找到答案？可在页面底部向 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "新加坡护照去意大利需要签证吗？",
      a: "不需要。新加坡护照持有人赴意大利及整个申根区旅游免签——任意180天内最长停留90天，无需任何费用。如今在边境通过EES登记生物特征（取代盖章）。ETIAS 预计于2026年第四季度启用后，新加坡公民出行前需办理20欧元、3年有效的ETIAS旅行许可——截至2026年7月尚未开放申请，一旦开放，VIZA 可代为办理。",
    },
    {
      category: "基本信息",
      q: "中国大陆护照去意大利需要签证吗？",
      a: "需要——申根C类签证。在中国大陆，申请通过VFS Global意大利签证中心（北京、上海、广州、重庆等）递交，由意大利驻华使领馆审发。合法居住在新加坡的中国公民则通过意大利驻新加坡大使馆指定的BLS International新加坡中心申请。2024年意大利是中国申请人最热门的申根目的地，获批率较高——无论哪条渠道，VIZA 均可全程代办并跟进。",
    },
    {
      category: "基本信息",
      q: "持意大利签证可以前往其他申根国家吗？",
      a: "可以。意大利签发的申根C类短期签证在批准的有效期及入境次数内，适用于全部29个申根国家。申请时意大利须为您的主要目的地或首个入境国。",
    },
    {
      category: "基本信息",
      q: "90/180天规则是怎么计算的？",
      a: "在任意连续180天的滚动周期内，您在整个申根区的累计停留不得超过90天——不仅限于意大利，每个申根国家的停留天数均计入总数。自2026年4月起，EES会自动核算。",
    },
    {
      category: "申请流程",
      q: "签证费用是多少？",
      a: "政府签证费为成人90欧元（约135新元），6–11岁儿童45欧元（约68新元），6岁以下免费——以当地货币缴纳，不予退还。外包签证中心另收服务费（如VFS Global中国为78元人民币；BLS新加坡按其标准另行收取）。",
    },
    {
      category: "申请流程",
      q: "审理需要多长时间？",
      a: "按欧盟签证法典，标准审理为递交后15个日历日，需进一步审查时可延至45天——中国旺季可能需要30至45天。请至少在出发前15个工作日递交，最早可提前6个月；我们建议提前4至6周，以预留预约名额。",
    },
    {
      category: "申请流程",
      q: "必须本人前往递交吗？",
      a: "是的。指纹在递交时于BLS International新加坡或中国大陆的VFS Global意大利签证中心采集——59个月内已为申根签证采集过指纹者可豁免。意大利没有电子签证。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "签证申请被拒怎么办？",
      a: "领事馆将出具注明拒签理由的通知书。90欧元政府签证费不予退还。VIZA 的服务费将全额退款，顾问会分析拒签原因，并为您提供重新申请或提出申诉的建议。",
    },
  ],

  sources: [
    { label: "Il Visto per l'Italia — 意大利外交部官方签证门户", url: "https://vistoperitalia.esteri.it", display: "vistoperitalia.esteri.it" },
    { label: "意大利驻新加坡大使馆 — 签证（BLS递交）", url: "https://ambsingapore.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/", display: "ambsingapore.esteri.it" },
    { label: "意大利驻北京大使馆 — 签证", url: "https://ambpechino.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/", display: "ambpechino.esteri.it" },
    { label: "VFS Global 中国 — 意大利签证费用信息", url: "https://visa.vfsglobal.com/chn/en/ita/visa-fee-information", display: "visa.vfsglobal.com" },
    { label: "欧盟委员会 — EES于2026年4月10日全面运行", url: "https://home-affairs.ec.europa.eu/news/entryexit-system-will-become-fully-operational-10-april-2026-2026-03-30_en", display: "home-affairs.ec.europa.eu" },
    { label: "欧盟官方 — EES与ETIAS最新时间表", url: "https://travel-europe.europa.eu/en/etias/about-etias/news-corner/revised-timeline-ees-and-etias", display: "travel-europe.europa.eu" },
    { label: "新加坡外交部 — 意大利旅行及签证信息", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/italy/", display: "mfa.gov.sg" },
  ],

  price: {
    etaLabel: "立即申请，预计领取时间",
    etaValue: "2026年6月29日 下午3:00",
    title: "申根签证（C类）· 最长90天",
    saving: "含完整材料审核服务",
    sub: "全包价，含材料审核、表格填写及准时保障。",
    foot: "政府签证费（成人90欧元）在结账时收取并缴纳至领事馆；VIZA 服务费涵盖材料准备、审核及预约支持。",
  },

  aiPlaceholder: "关于意大利申根签证有任何问题尽管问——材料、生物特征采集、90/180天规则……",
};

export default italy;
