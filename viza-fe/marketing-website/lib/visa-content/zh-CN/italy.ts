import type { VisaContent } from "../types";

/**
 * 意大利申根签证（C类）— 简体中文翻译版本。
 *
 * 本文件为 lib/visa-content/italy.ts 的简体中文译文。
 * 所有费用、办理时限及材料要求须由运营/法务团队对照
 * vistoperitalia.esteri.it 及 esteri.it 最新内容核实后方可发布。
 * 注：vistoperitalia.esteri.it 在核查时返回404，发布前请运营团队确认链接可用。
 */
export const italy: VisaContent = {
  slug: "italy",

  heroTitle: "意大利申根签证",
  lede: "C类短期申根签证，在任意180天内最长可停留90天，适用于全部29个申根成员国。",
  heroImage: "/assets/heroes/italy.jpg",
  meta: [
    { k: "签证类型", v: "申根（C类）" },
    { k: "停留时长", v: "最长90天" },
    { k: "有效期", v: "任意180天内90天" },
    { k: "入境次数", v: "单次或多次" },
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
    { icon: "currency", k: "货币", v: "欧元（EUR）", sub: "意大利及欧盟境内普遍通用" },
    { icon: "pin", k: "热门目的地", v: "罗马 · 佛罗伦萨 · 威尼斯", sub: "另有米兰、阿马尔菲海岸、五渔村" },
  ],

  processTitle: "申根签证申请流程",
  processSub:
    "一次提交，全程托管。我们为您准备并审核完整材料包，协助预约领事馆，全程跟进至签证到手。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片、行程单及支撑材料。顾问将在提交前逐一核对意大利领事馆清单，确保无误。",
    },
    {
      title: "材料审核",
      body: "VIZA 顾问对照意大利领事馆要求逐项核查，填写申请表，并为您确认领事馆或 VFS Global 的预约名额。",
    },
    {
      title: "采集生物特征 & 领事馆审核",
      body: "您需亲自前往预约地点提交生物特征信息。我们持续跟踪领事馆审核进度，并及时通知您补充材料的请求。",
      statusRows: [
        { label: "生物特征预约已确认", ts: "6月15日 上午9:30", onTime: true },
        { label: "申请材料已递交领事馆", ts: "6月15日 中午12:00", onTime: true },
        { label: "等待领事馆审核", ts: "处理中" },
      ],
    },
    {
      title: "6月29日领取签证",
      body: "签证贴纸将粘贴于您的护照。VIZA 顾问会在签证可领取或安排快递时第一时间通知您。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "意大利领事馆遵照 vistoperitalia.esteri.it 发布的申根签证清单审核材料。VIZA 顾问在提交前逐项核验——补传材料次数不限，免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期须超过预定停留结束日期3个月以上 · 签发日期在10年内" },
    { name: "生物特征照片", sub: "35×45毫米 · 浅色纯色背景 · 近6个月内拍摄" },
    { name: "行程单及回程机票", sub: "往返机票均须在签证有效期内" },
    { name: "住宿证明及旅行医疗保险", sub: "酒店预订记录 · 保险覆盖申根全区，保额不低于3万欧元" },
  ],

  rejectionTitle: "申根签证被拒的常见原因",
  rejectionSub:
    "意大利领事馆将重点审查以下问题。VIZA 在您提交前提前标记风险。",
  rejectionReasons: [
    {
      title: "旅行保险不足",
      body: "保险未满足申根区全程最低3万欧元保额要求，或保险期限未覆盖整个停留期间。",
    },
    {
      title: "财力证明不充分",
      body: "无法证明有足够资金支付停留期间的住宿费、生活开销及回程旅费。",
    },
    {
      title: "出行目的不明确",
      body: "行程单无法清晰说明出行目的，或所提交的材料与申报的出行理由不一致。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "通过所有申根边境口岸时，请随身携带护照（含签证贴纸）、旅行保险证明、回程机票及住宿证明。90/180天规则适用于整个申根区。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次或多次", sub: "以领事馆批准为准" },
    { icon: "clock", k: "90/180天规则", v: "最长90天", sub: "任意180天滚动窗口内，计入所有申根国" },
  ],

  extensionTitle: "签证延期与逾期停留",
  extensionSub:
    "申根短期签证一般不可延期，仅在特殊情形下例外。逾期停留将对未来的申根出行产生严重影响。",
  extension: [
    { icon: "extend", k: "延期", v: "仅限特殊情形", sub: "不可抗力或人道主义原因" },
    { icon: "alert", k: "逾期后果", v: "禁止入境", sub: "申根区禁令最长5年 + 未来签证申请受阻" },
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
      q: "持意大利签证可以前往其他申根国家吗？",
      a: "可以。意大利签发的申根C类短期签证在批准的有效期及入境次数内，适用于全部29个申根成员国。申请时意大利须为您的主要目的地或首个入境国。",
    },
    {
      category: "基本信息",
      q: "90/180天规则是怎么计算的？",
      a: "在任意连续180天的滚动周期内，您在整个申根区的累计停留时间不得超过90天——不仅限于意大利，每个申根国家的停留天数均计入总数。",
    },
    {
      category: "申请流程",
      q: "应该提前多久申请？",
      a: "意大利领事馆建议出行前至少15天申请，且不超过6个月提前申请。我们建议在出行前4至6周提交，以预留足够的预约时间和审理时间。",
    },
    {
      category: "申请流程",
      q: "必须本人前往预约吗？",
      a: "是的。生物特征信息（指纹及照片）必须本人亲自到意大利领事馆或授权的 VFS Global 申请中心提交，此要求不可豁免。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "签证申请被拒怎么办？",
      a: "领事馆将出具注明拒签理由的通知书。政府签证费不予退还。VIZA 的服务费将全额退款，顾问会分析拒签原因并为您提供重新申请或提出申诉的建议。",
    },
  ],

  sources: [
    { label: "意大利外交部 — 意大利签证（Visto per Italia）", url: "https://vistoperitalia.esteri.it/", display: "vistoperitalia.esteri.it" },
    { label: "意大利外交部 — 官方门户", url: "https://www.esteri.it/en/", display: "esteri.it" },
  ],

  price: {
    etaLabel: "立即申请，预计领取时间",
    etaValue: "2026年6月29日 下午3:00",
    title: "申根签证 · 最长90天",
    saving: "含完整材料审核服务",
    sub: "全包价，含材料审核、表格填写及准时保障。",
    foot: "政府签证费在结账时收取并直接缴纳至领事馆；VIZA 服务费涵盖材料准备、审核及预约支持。",
  },

  aiPlaceholder: "关于意大利申根签证有任何问题尽管问——材料、生物特征采集、90/180天规则……",
};

export default italy;
