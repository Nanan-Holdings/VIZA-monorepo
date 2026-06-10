import type { VisaContent } from "../types";

/**
 * 澳大利亚访客签证（600 类）旅游签证流 — 简体中文版本。
 * zh-CN 翻译，签证具体信息（费用、有效期、材料清单、拒签原因）
 * 在发布前须由运营/法务人员对照官方来源进行核实。
 *
 * 参考：immi.homeaffairs.gov.au，核实日期：2026-06-10。
 */
export const australia: VisaContent = {
  slug: "australia",

  heroTitle: "澳大利亚访客签证",
  lede: "多次入境访客签证（600 类），授予最长 3 个月、6 个月或 12 个月的停留期，自批准之日起 1 年内有效。在线申请，由您的 VIZA 顾问全程管理。",
  heroImage: "/assets/heroes/australia.jpg",
  meta: [
    { k: "签证类型", v: "访客签证 600 类" },
    { k: "可停留时长", v: "最长 3 / 6 / 12 个月" },
    { k: "有效期", v: "1 年" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "bolt", label: "专业顾问全程准备材料" },
    { icon: "shield", label: "准时出签保证" },
    { icon: "doc", label: "完整材料审核" },
  ],

  overviewTitle: "澳大利亚，一览",
  overviewSub:
    "访客签证（600 类）是澳大利亚最主要的旅游及探亲签证类型，允许符合条件的旅行者在有效期内多次入境澳大利亚。",
  glance: [
    { icon: "globe", k: "首都", v: "堪培拉", sub: "UTC +10 / +11（澳大利亚东部标准时间 / 夏令时）" },
    { icon: "clock", k: "最佳出行时间", v: "9 月 – 11 月 / 3 月 – 5 月", sub: "春秋两季 · 18 – 26°C" },
    { icon: "currency", k: "货币", v: "澳大利亚元", sub: "1 新元 ≈ 1.10 澳元（约）" },
    { icon: "pin", k: "热门目的地", v: "悉尼 · 墨尔本 · 大堡礁", sub: "另有黄金海岸、珀斯、乌鲁鲁" },
  ],

  processTitle: "澳大利亚访客签证办理流程",
  processSub:
    "提交一次即可。我们全程与澳大利亚内政部对接，签证一经批准即刻通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、资金证明、行程安排及支持材料。顾问将根据您的具体情况量身定制申请材料包。",
    },
    {
      title: "材料审核",
      body: "您的 VIZA 顾问在通过 ImmiAccount 系统递交申请前，逐项审核所有填写内容和支持材料是否符合澳大利亚内政部的要求。",
    },
    {
      title: "签证处理中",
      body: "我们持续监控您的申请状态，并在签证官要求补充材料时主动协调跟进。",
      statusRows: [
        { label: "申请已通过 ImmiAccount 递交", ts: "6月10日 10:00", onTime: true },
        { label: "健康及品格审查已启动", ts: "6月10日 14:30", onTime: true },
        { label: "等待签证官决定", ts: "处理中" },
      ],
    },
    {
      title: "6月14日 14:15 获取您的签证批准通知",
      body: "签证批准通知将通过邮件及 VIZA 应用发送给您。签证以电子方式关联至您的护照，无需贴签。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "您的 VIZA 顾问在提交前会逐一核查每份材料。重新上传次数不限，且免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期至少覆盖预计停留期后 6 个月" },
    { name: "资金证明", sub: "银行对账单 · 最近 3 个月" },
    { name: "行程安排", sub: "机票预订及住宿确认函" },
    { name: "辅助证明材料", sub: "如适用，提供在职证明、与本国联系证明或担保人信函" },
  ],

  rejectionTitle: "澳大利亚访客签证被拒的常见原因",
  rejectionSub:
    "澳大利亚内政部可能以下列任一原因拒绝申请。VIZA 会在您提交前提前标记这些风险。",
  rejectionReasons: [
    { title: "与本国联系不足", body: "签证官会审查申请人的就业、房产、家庭等证明，以确认其在签证到期前会返回本国。" },
    { title: "资金证明不充分", body: "银行流水不足或存在无法解释的大额存款，可能引发对申请人在澳期间自给能力的质疑。" },
    { title: "此前有签证违规或被拒记录", body: "曾超期逗留、在澳大利亚或其他国家被拒签，或有不良品格记录，均可能导致本次申请被拒。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "您的签证以电子方式关联至护照。在入境柜台请携带批准通知邮件及回程或续程机票证明。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "在有效期内可自由往返" },
    { icon: "clock", k: "有效期", v: "1 年", sub: "自批准之日起计算" },
  ],

  extensionTitle: "签证延期与超期逗留",
  extensionSub:
    "需要延长停留的访客签证持有人，可在签证到期前在澳大利亚境内申请“进一步停留”。超期逗留是严重违规行为，可能导致禁止入境。",
  extension: [
    { icon: "extend", k: "进一步停留", v: "在境内申请", sub: "须在当前签证到期前递交" },
    { icon: "alert", k: "超期后果", v: "禁止入境 3 年", sub: "情节严重者可能被永久拒绝入境" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "评分最高的签证平台 · 12,841 条评价",
    platforms: [
      { rating: "4.6", name: "Trustpilot" },
      { rating: "4.7", name: "App Store" },
    ],
    items: [
      {
        initials: "LX",
        name: "刘雪",
        source: "Trustpilot · 1周前",
        title: "5 天内获得签证批准",
        body: "流程顺畅得难以置信。顾问帮我把所有材料都准备好了，我几乎只需要上传护照就行。",
      },
      {
        initials: "ZW",
        name: "赵伟",
        source: "应用商店 · 3周前",
        title: "顾问帮我保住了申请",
        body: "我最初提供的银行对账单材料不够充分。顾问详细指导我需要补充哪些内容，最终一次性获批。",
      },
    ],
  },

  faqSub: "找不到答案？可使用本页底部的 AI 助手提问。",
  faq: [
    {
      category: "基本信息",
      q: "澳大利亚访客签证（600 类）是什么？",
      a: "600 类访客签证是澳大利亚标准的旅游及探亲签证，允许在有效期内多次入境，停留期为 3 个月、6 个月或 12 个月，具体取决于澳大利亚内政部根据您的申请所批准的时长。",
    },
    {
      category: "基本信息",
      q: "我需要前往大使馆进行生物特征采集吗？",
      a: "大多数申请人无需亲自到场。但根据您的国籍和旅行记录，澳大利亚内政部可能要求进行健康检查或额外的生物特征采集。",
    },
    {
      category: "申请流程",
      q: "签证处理需要多长时间？",
      a: "处理时间因国籍和个人情况而存在显著差异。简单申请通常在一周内决定，复杂案例可能需要数周。VIZA 会准备尽可能完善的申请材料包，以缩短处理时间。",
    },
    {
      category: "申请流程",
      q: "可以在一个订单中为家庭成员申请签证吗？",
      a: "可以。每位出行人员需要单独申请，但您的 VIZA 顾问可以协调统一提交，确保所有申请在同一时间线上审核。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "申请被拒了怎么办？",
      a: "澳大利亚内政部将保留政府申请费。VIZA 的服务费将全额退还。顾问会与您一起梳理拒签原因，并就如何加强未来申请或申请复议提供建议。",
    },
  ],

  sources: [
    { label: "澳大利亚内政部——访客签证（600 类）", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600", display: "immi.homeaffairs.gov.au" },
    { label: "ImmiAccount——澳大利亚在线签证递交系统", url: "https://online.immi.gov.au/lusc/login", display: "online.immi.gov.au" },
    { label: "澳大利亚边境力量——入境澳大利亚", url: "https://www.abf.gov.au/entering-and-leaving-australia", display: "abf.gov.au" },
  ],

  price: {
    etaLabel: "立即申请，预计到签时间",
    etaValue: "2026年6月14日 14:15",
    title: "访客签证 600 类 · 最长 12 个月有效期",
    saving: "快 2 天",
    sub: "含政府费用、材料准备及准时出签保证，一价全包。",
    foot: "政府费用与 VIZA 服务费在结账时一并收取，并附准时出签保证。",
  },

  aiPlaceholder: "有关澳大利亚签证的任何问题，欢迎提问——费用、处理时间、所需材料……",
};

export default australia;
