// zh-CN 简体中文翻译 — 英国标准访客签证
// 签证详情（费用、有效期、允许活动、材料要求及拒签原因）发布前须由运营/法务
// 对照 UKVI 官方指引进行核实。

import type { VisaContent } from "../types";

export const unitedKingdom: VisaContent = {
  slug: "united-kingdom",

  heroTitle: "英国标准访客签证",
  lede: "标准访客签证允许符合条件的护照持有人以旅游、探亲或短期商务活动为目的入境英国，通常每次入境可停留最长 6 个月。",
  heroImage: "/assets/heroes/united-kingdom.jpg",
  meta: [
    { k: "签证类型", v: "标准访客签证" },
    { k: "每次停留", v: "最长 6 个月" },
    { k: "有效期", v: "6 个月" },
    { k: "入境次数", v: "单次 / 多次" },
  ],
  tags: [
    { icon: "bolt", label: "快速通道 · 顾问全程协助" },
    { icon: "shield", label: "准时保证" },
    { icon: "doc", label: "材料全面审核" },
  ],

  overviewTitle: "英国概览",
  overviewSub:
    "标准访客签证适用于旅游、探亲、短期商务会议及其他获准活动。UKVI 还提供长期签证（2 年、5 年或 10 年）可供申请。",
  glance: [
    { icon: "globe", k: "首都", v: "伦敦", sub: "UTC +0 / 夏令时 BST" },
    { icon: "clock", k: "最佳出行时间", v: "5 月 – 9 月", sub: "气候温和 · 白昼最长" },
    { icon: "currency", k: "货币", v: "英镑（GBP）", sub: "出发前请确认最新汇率" },
    { icon: "pin", k: "热门目的地", v: "伦敦 · 爱丁堡 · 曼彻斯特", sub: "还有科茨沃尔德、巴斯与湖区" },
  ],

  processTitle: "申请流程",
  processSub:
    "一次提交，全程由我们对接英国签证与移民局（UKVI），决定出来后立即通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "填写出行信息，上传护照及辅助材料，并在需要时确认生物特征采集预约时段。",
    },
    {
      title: "材料审核",
      body: "VIZA 顾问逐项核查材料的完整性与准确性，然后代您向 UKVI 提交申请。",
    },
    {
      title: "申请处理中",
      body: "我们全程监控 UKVI 进度，在任何补件请求影响您的审批前第一时间提醒您。",
      statusRows: [
        { label: "申请已提交至 UKVI", ts: "6月12日 上午9:00", onTime: true },
        { label: "生物特征已采集 · 申请审核中", ts: "6月13日 上午11:30", onTime: true },
        { label: "等待 UKVI 最终决定", ts: "进行中" },
      ],
    },
    {
      title: "6月20日 14:00 签证结果送达",
      body: "贴纸签证或 BRP 取件函将发送至您的邮箱和 VIZA App，顾问将为您讲解后续步骤。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "VIZA 顾问在提交前逐一核查所有材料，文件重传次数不限且完全免费。",
  documents: [
    { name: "有效护照", sub: "原件 + 信息页扫描件 · 有效期须覆盖全程停留" },
    { name: "财力证明", sub: "最近 3–6 个月银行流水" },
    { name: "行程单", sub: "已确认的往返机票及住宿信息" },
    { name: "辅助说明信", sub: "注明出行目的 · 如适用须附雇主证明或担保函" },
  ],

  rejectionTitle: "标准访客签证常见拒签原因",
  rejectionSub:
    "UKVI 可能因以下任一原因拒绝申请。VIZA 在提交前会主动排查这些风险。",
  rejectionReasons: [
    { title: "财力证明不足", body: "UKVI 要求申请人提供可信证据，证明其有能力支付旅行费用并在签证期满后离开英国。" },
    { title: "与本国联系不够充分", body: "若 UKVI 认为申请人不会按时回国，申请将被拒签——雇佣关系、家庭及房产证明有助于说明。" },
    { title: "材料不完整或前后矛盾", body: "日期不符、扫描件模糊或缺少辅助说明信是最常见的拒签原因之一。" },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "入境时请随身携带贴纸签证（或数字状态证明）、回程机票、住宿信息及财力证明，英国边境执法部门可能在抵达时查验。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次或多次", sub: "以 UKVI 批准的签证为准" },
    { icon: "clock", k: "使用期限", v: "签证有效期内", sub: "请核对贴纸签证上的起始和截止日期" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "标准访客签证通常不允许在英国境内延期。逾期居留属严重移民违规行为，将影响日后的签证申请。",
  extension: [
    { icon: "extend", k: "延期", v: "通常不允许", sub: "如需再次访英，须从本国重新申请新签证" },
    { icon: "alert", k: "逾期后果", v: "被遣返并列入禁止入境名单", sub: "可能导致被驱逐出境及再入境禁令" },
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
        initials: "WL",
        name: "王丽华",
        source: "Trustpilot · 2周前",
        title: "签证比预期更快通过",
        body: "顾问发现我的银行流水少了一页，在提交前就帮我补齐了。签证在正常时限内顺利通过，整个过程没有任何压力。",
      },
      {
        initials: "RN",
        name: "任宁",
        source: "应用商店 · 1个月前",
        title: "UKVI 所需材料一目了然",
        body: "之前自己申请时被财力证明要求搞得一头雾水。VIZA 详细告诉我该上传什么，一次就通过了。",
      },
    ],
  },

  faqSub:
    "没找到想要的答案？可使用页面底部的 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "什么是英国标准访客签证？",
      a: "标准访客签证由英国签证与移民局（UKVI）签发，允许符合条件的旅行者以旅游、探亲或经批准的短期商务活动（如会议和研讨会）为目的入境英国，每次最长停留 6 个月。",
    },
    {
      category: "基本信息",
      q: "持标准访客签证可以工作或学习吗？",
      a: "不可以。标准访客签证不允许有偿受雇工作。以休闲为目的的短期学习（最长 30 天）在特定条件下可能获准，但任何有偿工作均需另行申请英国工作签证。详情请参阅 UKVI 官方指引中的获准活动完整列表。",
    },
    {
      category: "申请流程",
      q: "英国签证需要多长时间处理？",
      a: "UKVI 目标在 15 个工作日内作出决定（标准申请）。优先服务和超级优先服务（视所在地而定）可分别缩短至 5 个工作日或次个工作日。实际处理时间可能有所变化，建议提前申请。",
    },
    {
      category: "申请流程",
      q: "是否需要预约生物特征采集？",
      a: "大多数首次申请人需前往签证申请中心（VAC）采集生物特征。VIZA 顾问将根据您的国籍确认是否需要预约，并协助您选择正确的 VAC。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "英国签证被拒后如何处理？",
      a: "UKVI 拒签后不退还申请费。您将收到一份说明拒签原因的通知。VIZA 的服务费将全额退还，顾问将分析拒签原因，为您的新一轮申请提供改进建议。",
    },
  ],

  sources: [
    { label: "英国标准访客签证 — GOV.UK", url: "https://www.gov.uk/standard-visitor", display: "gov.uk/standard-visitor" },
    { label: "申请来英 — GOV.UK", url: "https://www.gov.uk/apply-to-come-to-the-uk", display: "gov.uk/apply-to-come-to-the-uk" },
    { label: "英国签证与移民局（UKVI）", url: "https://www.gov.uk/government/organisations/uk-visas-and-immigration", display: "gov.uk/ukvi" },
  ],

  price: {
    etaLabel: "立即申请，目标到达时间",
    etaValue: "2026年6月20日 14:00",
    title: "标准访客签证 · 最长 6 个月",
    saving: "顾问全程协助 · 减少延误",
    sub: "含 UKVI 申请费、材料审核、生物特征采集指导及准时保证，全包价格。",
    foot: "UKVI 申请费与 VIZA 服务费在结账时一并收取，并附准时保证。",
  },

  aiPlaceholder: "关于英国访客签证，随时提问——材料、处理时间、申请资格……",
};

export default unitedKingdom;
