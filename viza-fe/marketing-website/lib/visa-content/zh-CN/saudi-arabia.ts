import type { VisaContent } from "../types";

/**
 * 沙特阿拉伯旅游电子签证 — 简体中文版本。
 * zh-CN 翻译，签证具体信息（费用、有效期、材料清单、拒签原因）
 * 在发布前须由运营/法务人员对照官方来源进行核实。
 *
 * 参考：visa.visitsaudi.com 及 moi.gov.sa，核实日期：2026-06-10。
 * 注：2025年6月起设有 30 天宽限期（通过 Absher/Tawasul 办理），
 * 每日超期罚款及当前具体金额在每次内容更新前须重新核实。
 */
export const saudiArabia: VisaContent = {
  slug: "saudi-arabia",

  heroTitle: "沙特阿拉伯电子签证",
  lede: "多次入境旅游电子签证，自签发之日起 365 天内有效，每次最长停留 90 天。在线申请，由您的 VIZA 顾问全程追踪。",
  heroImage: "/assets/heroes/saudi-arabia.jpg",
  meta: [
    { k: "签证类型", v: "电子签证（e-Visa）" },
    { k: "每次可停留时长", v: "90 天" },
    { k: "有效期", v: "365 天" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "bolt", label: "快速通道 · 24 小时内出签" },
    { icon: "shield", label: "准时出签保证" },
    { icon: "doc", label: "所需材料极少" },
  ],

  overviewTitle: "沙特阿拉伯，一览",
  overviewSub:
    "沙特阿拉伯旅游电子签证向符合条件的旅行者开放王国大门，用于休闲度假、历史遗迹探访及文化体验——无需担保人，无需事先预约大使馆。",
  glance: [
    { icon: "globe", k: "首都", v: "利雅得", sub: "UTC +3（阿拉伯标准时间）" },
    { icon: "clock", k: "最佳出行时间", v: "11 月 – 3 月", sub: "凉爽季节 · 18 – 27°C" },
    { icon: "currency", k: "货币", v: "沙特里亚尔", sub: "1 新元 ≈ 2.80 沙特里亚尔（约）" },
    { icon: "pin", k: "热门目的地", v: "利雅得 · 吉达 · 阿勒乌拉", sub: "另有德尔伊耶、NEOM、红海海岸" },
  ],

  processTitle: "沙特阿拉伯电子签证办理流程",
  processSub:
    "提交一次即可。我们全程与沙特阿拉伯电子签证主管部门对接，签证一经批准即刻通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照个人信息页、近期照片及出行日期。无需预约大使馆。",
    },
    {
      title: "材料审核",
      body: "您的 VIZA 顾问逐项核查所有内容是否符合沙特电子签证要求，确认无误后直接提交至官方申请平台。",
    },
    {
      title: "签证处理中",
      body: "我们追踪每个处理环节，以便在影响您出行计划之前提前发现任何延误。",
      statusRows: [
        { label: "申请已提交至沙特电子签证平台", ts: "6月13日 08:30", onTime: true },
        { label: "身份及护照核验已完成", ts: "6月13日 11:15", onTime: true },
        { label: "等待最终批准", ts: "处理中" },
      ],
    },
    {
      title: "6月14日 14:15 获取您的电子签证",
      body: "签证批准通知将发送至您的邮箱及 VIZA 应用。打印或保存至手机——在沙特入境口岸须出示。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "您的 VIZA 顾问在提交前会逐一核查每份材料。重新上传次数不限，且免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期 6 个月以上 · 清晰扫描件" },
    { name: "近期照片", sub: "纯白色背景 · 6 个月内拍摄" },
    { name: "回程机票", sub: "须在停留期限内离境" },
    { name: "酒店或住宿证明", sub: "预订确认函 · 任意平台均可" },
  ],

  rejectionTitle: "沙特电子签证被拒的常见原因",
  rejectionSub:
    "沙特阿拉伯电子签证主管部门可能以下列任一原因拒绝申请。VIZA 会在您提交前提前标记这些风险。",
  rejectionReasons: [
    { title: "护照有效期不足", body: "护照在预计抵达日期之后不足 6 个月到期，申请将不予受理。" },
    { title: "国籍不在适用范围内", body: "沙特旅游电子签证仅面向约 50 个符合条件国家的护照持有人开放。不在范围内的国籍须通过大使馆申请签证。" },
    { title: "此前有违规记录或存在安全隐患", body: "曾超期逗留沙特、曾被驱逐出境，或安全审查存在问题，可能导致申请被自动拒绝。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "在所有沙特入境口岸，请携带电子签证批准文件、有效的回程机票及酒店预订确认函。签证以电子方式关联至您的护照。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "在 365 天有效期内可自由往返" },
    { icon: "clock", k: "激活期限", v: "365 天", sub: "自签发之日起计算" },
  ],

  extensionTitle: "签证延期与超期逗留",
  extensionSub:
    "超过 90 天停留限制的延期申请可通过 Absher 平台或内政部办理。超期逗留将产生每日罚款（每天 100 沙特里亚尔），最高罚款上限为 50,000 沙特里亚尔，并可能面临监禁及遣返处罚。",
  extension: [
    { icon: "extend", k: "可延期", v: "通过 Absher 申请", sub: "内政部官方平台" },
    { icon: "alert", k: "超期罚款", v: "每天 100 沙特里亚尔", sub: "最高 50,000 沙特里亚尔 · 可能面临监禁——详见 moi.gov.sa" },
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
        initials: "SY",
        name: "孙艳",
        source: "Trustpilot · 4天前",
        title: "一夜之间获批沙特电子签证",
        body: "傍晚提交申请，第二天早上就收到了批准通知。整个流程透明顺畅——所有状态更新都能在 VIZA 应用中实时查看。",
      },
      {
        initials: "HB",
        name: "黄博",
        source: "应用商店 · 2周前",
        title: "顾问让申请毫无压力",
        body: "我不清楚需要哪些材料。顾问一步一步引导我，并帮我完成了整个提交流程。",
      },
    ],
  },

  faqSub: "找不到答案？可使用本页底部的 AI 助手提问。",
  faq: [
    {
      category: "基本信息",
      q: "沙特阿拉伯旅游电子签证是什么？",
      a: "沙特阿拉伯旅游电子签证是一种多次入境的在线签发许可，允许符合条件的护照持有人前往沙特王国进行休闲旅游、文化体验和历史遗迹探访，无需大使馆面签或担保人。",
    },
    {
      category: "基本信息",
      q: "电子签证包含旅行保险吗？",
      a: "是的——沙特阿拉伯旅游电子签证的签证费中已包含强制性旅行保险，保险覆盖在沙特境内停留期间的紧急医疗费用。",
    },
    {
      category: "申请流程",
      q: "VIZA 处理沙特电子签证需要多长时间？",
      a: "大多数沙特旅游电子签证在 24 小时内获批。直接通过政府平台申请通常需要 1 至 3 个工作日。我们以准时出签保证作为承诺——如果逾期，全额退款。",
    },
    {
      category: "申请流程",
      q: "可以在一个订单中为全家人申请签证吗？",
      a: "可以。在申请过程中添加每位出行人员——顾问会统一提交，确保所有批准通知在同一时间线上到达。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "沙特电子签证被拒了怎么办？",
      a: "沙特主管部门将保留政府费用。VIZA 的服务费将全额退还。顾问会与您一起梳理拒签原因，并评估是否适合重新申请或改为大使馆申请。",
    },
  ],

  sources: [
    { label: "沙特电子签证官方申请平台", url: "https://visa.visitsaudi.com", display: "visa.visitsaudi.com" },
    { label: "Visit Saudi——旅游及签证信息", url: "https://www.visitsaudi.com", display: "visitsaudi.com" },
    { label: "沙特内政部——Absher 平台", url: "https://absher.sa", display: "absher.sa" },
  ],

  price: {
    etaLabel: "立即申请，预计到签时间",
    etaValue: "2026年6月14日 14:15",
    title: "电子签证 · 365 天有效期 · 每次停留 90 天",
    saving: "快 1 天",
    sub: "含政府费用、旅行保险、材料审核及准时出签保证，一价全包。",
    foot: "政府费用与 VIZA 服务费在结账时一并收取，并附准时出签保证。",
  },

  aiPlaceholder: "有关沙特阿拉伯签证的任何问题，欢迎提问——费用、处理时间、所需材料……",
};

export default saudiArabia;
