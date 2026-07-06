// zh-CN 简体中文翻译 — 英国标准访客签证
// 最近事实核查：2026-07-05，依据 gov.uk、visa-fees.homeoffice.gov.uk、
// visas-immigration.service.gov.uk 及 homeofficemedia.blog.gov.uk：
//   - 6 个月标准访客签证费 GBP 135（新加坡官方价 SGD 240，中国 CNY 1,262）；
//     长期 2 年 GBP 506 / 5 年 GBP 903 / 10 年 GBP 1,128（2026 年 4 月 8 日起）。
//   - 新加坡护照免签证，但自 2025 年 1 月 8 日起须持 UK ETA（GBP 20）；
//     中国大陆护照属签证国籍，不适用 ETA，须申请标准访客签证。
//   - 生物采集后通常 3 周出结果；优先服务约 5 个工作日（+GBP 500），
//     超级优先约 1 个工作日（+GBP 1,000），视地区开放情况而定。
//   - 境内延期仅限总停留不超过 6 个月，费用 GBP 1,172。
//   - 逾期无按日罚款——按 Part Suitability（SUI 12.1，2025 年 11 月 11 日起）
//     处以 1–10 年再入境禁令；30 天内自费自愿离境不计入。
// 待运营确认事项：2016 年中英"6 个月费用换 2 年签证"安排已从官方费用
// 计算器消失，除非 UKVI 确认，按已取消处理；ETA 的 SGD 35 为换算价（官方
// 以英镑计费）；6 个月签证单次/多次入境由内政部酌定；优先服务开放情况
// 请在申请时向 VFS 确认。

import type { VisaContent } from "../types";

export const unitedKingdom: VisaContent = {
  slug: "united-kingdom",

  heroTitle: "英国标准访客签证",
  lede: "标准访客签证面向签证国籍旅客，可赴英旅游、探亲或参加商务会议，每次入境最长停留 6 个月。新加坡护照持有人无需签证——只需 GBP 20 的 UK ETA 电子旅行许可，两种途径 VIZA 均可全程代办。",
  heroImage: "/assets/heroes/united-kingdom.jpg",
  meta: [
    { k: "签证类型", v: "标准访客签证" },
    { k: "每次停留", v: "最长 6 个月" },
    { k: "有效期", v: "6 个月 · 可选 2–10 年" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "bolt", label: "快速通道 · 顾问全程协助" },
    { icon: "shield", label: "准时保证" },
    { icon: "doc", label: "材料全面审核" },
  ],

  overviewTitle: "英国概览",
  overviewSub:
    "标准访客签证（6 个月：GBP 135，新加坡官方价 SGD 240）适用于旅游、探亲及商务会议，另有 2 年、5 年、10 年多次往返长期签证可选。新加坡护照持有人无需此签证，凭 UK ETA（电子旅行许可）即可入境。",
  glance: [
    { icon: "globe", k: "首都", v: "伦敦", sub: "UTC +0 / 夏令时 BST" },
    { icon: "clock", k: "最佳出行时间", v: "5 月 – 9 月", sub: "气候温和 · 白昼最长" },
    { icon: "currency", k: "货币", v: "英镑（GBP）", sub: "GBP 1 ≈ SGD 1.78（内政部汇率）" },
    { icon: "pin", k: "热门目的地", v: "伦敦 · 爱丁堡 · 曼彻斯特", sub: "还有科茨沃尔德、巴斯与湖区" },
  ],

  processTitle: "申请流程",
  processSub:
    "一次提交，我们代填 UKVI 官方申请表、预约生物采集并全程跟踪审批——通常在生物采集后 3 周内出签。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "最早可在出行前 3 个月提交出行日期、护照及辅助材料。我们代您在官方系统 visas-immigration.service.gov.uk 填写申请表，包括英国住宿、行程费用、住址史及收入信息。",
    },
    {
      title: "材料审核",
      body: "VIZA 顾问逐项核对银行流水、在职证明与国内约束力证据，确保与申请表申报的收入和财务信息完全一致——这正是 UKVI 签证官的第一道核查。",
    },
    {
      title: "生物采集与 UKVI 审理",
      body: "您前往 VFS Global 签证申请中心采集指纹和面部照片（无需上传照片）。随后我们跟踪 UKVI 进度；视地区开放情况可加购优先服务（约 5 个工作日，+GBP 500）或超级优先服务（约 1 个工作日，+GBP 1,000）。",
      statusRows: [
        { label: "申请已提交至 UKVI", ts: "6月12日 上午9:00", onTime: true },
        { label: "已在 VFS Global 完成生物采集", ts: "6月13日 上午11:30", onTime: true },
        { label: "等待 UKVI 最终决定", ts: "进行中" },
      ],
    },
    {
      title: "7月3日 14:00 签证结果送达",
      body: "护照连同贴纸签证一并返还。顾问为您核对签证起止日期，并讲解入境时英国边检可能询问的问题。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "VIZA 顾问按照 UKVI 官方辅助材料指引逐一核查所有材料，文件重传次数不限且完全免费。",
  documents: [
    { name: "有效护照", sub: "有效期须覆盖全程停留 · 留一页空白页贴签证" },
    { name: "UKVI 在线申请表", sub: "出行日期、英国住宿、行程费用、住址史、收入等——由我们代填" },
    { name: "银行流水 / 资金证明", sub: "须体现资金来源并与申报收入一致 · 不接受超过 1 年的流水或信用卡账单" },
    { name: "在职或在读证明", sub: "公司抬头信注明职位、薪资、入职日期 · 或在读证明 · 自雇者提供营业执照/发票" },
    { name: "国内约束力证明", sub: "工作、房产、家庭关系——满足真实访客要求（V4.2）" },
    { name: "出行记录", sub: "旧护照上的出境记录复印件 · 无需提供酒店或机票订单" },
    { name: "认证翻译件", sub: "非英文材料须附译者签名、日期及联系方式的准确性声明" },
    { name: "生物特征采集", sub: "在 VFS Global 中心采集指纹和照片——无需上传照片" },
  ],

  rejectionTitle: "标准访客签证常见拒签原因",
  rejectionSub:
    "UKVI 签证官依据真实访客规则审查每份申请。VIZA 在提交前会主动排查这些风险。",
  rejectionReasons: [
    { title: "不符合真实访客要求", body: "最常见的拒签理由：与本国的家庭、社会或经济联系薄弱，或行程计划含糊，令签证官无法确信您会按期离英（访客规则 V4.2）。" },
    { title: "资金不足或来源不明", body: "流水未体现资金来源、近期出现大额不明入账，或余额与申报收入及行程费用不符。" },
    { title: "材料与申请表矛盾", body: "辅助材料必须与在线申请表填写的财务、工作及收入信息相互印证，任何出入都会导致拒签。" },
    { title: "不良移民记录", body: "此前在英国或其他国家的拒签、逾期或违反签证条件记录，包括过于频繁的连续访英被视为借访问之名居住。" },
    { title: "虚假材料或欺骗", body: "任何欺骗行为都会被拒签，且通常伴随 10 年再入境禁令。" },
    { title: "意图从事禁止活动", body: "有证据表明拟在英工作、未经许可使用私立医疗，或未持结婚访客签证而拟在英结婚。" },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "英国没有任何入境卡——既无电子入境卡也无纸质落地卡。承运方登机前会查验您的签证或 ETA；持有签证或 ETA 并不保证入境，最终由英国边检（Border Force）决定。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "每次最长停留 6 个月——长期签证与 ETA 同样适用" },
    { icon: "doc", k: "入境卡", v: "无需填写", sub: "无电子入境卡，也无纸质落地卡" },
    { icon: "plane", k: "过境查验", v: "自助闸机或人工柜台", sub: "新加坡 ETA 旅客可用 ePassport 自助闸机（10 岁以上，不盖章）；签证国籍旅客须过人工柜台" },
    { icon: "shield", k: "随身备查", v: "资金 · 住宿 · 回程", sub: "官方未设固定金额，但边检有权询问，不满意可拒绝入境" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "可在签证到期前于英国境内在线申请延期，但普通访客总停留不得超过 6 个月（仅医疗、学术等特殊情形可更长）。逾期没有按日罚款——代价是再入境禁令。",
  extension: [
    { icon: "extend", k: "延期", v: "总停留最长 6 个月", sub: "费用 GBP 1,172（≈ SGD 2,080）· 在 UKVCAS 采集生物特征 · 通常 8 周内出结果" },
    { icon: "alert", k: "逾期后果", v: "1–10 年再入境禁令", sub: "30 天内自费自愿离境不受禁令；欺骗或被强制遣返者禁令 10 年" },
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
      q: "新加坡护照需要英国签证吗？",
      a: "不需要。新加坡属免签国籍，赴英访问最长可停留 6 个月。但自 2025 年 1 月 8 日起，所有新加坡旅客（含婴儿）都须持英国电子旅行许可（UK ETA）：费用 GBP 20（约 SGD 35），通常 1 天内获批，有效期 2 年或至护照到期（以先到者为准），期间可无限次入境、每次最长 6 个月。VIZA 可代办 ETA 并在出发前核对信息。",
    },
    {
      category: "基本信息",
      q: "哪些人需要标准访客签证？可以工作吗？",
      a: "签证国籍旅客——包括中国大陆护照持有人（不适用 ETA）——必须在出行前取得标准访客签证。该签证涵盖旅游、探亲及商务会议，每次入境最长 6 个月，但不允许有偿工作、未经许可使用私立医疗，也不允许未持结婚访客签证而在英结婚。",
    },
    {
      category: "申请流程",
      q: "英国签证费用是多少？",
      a: "2026 年 4 月 8 日起：6 个月标准访客签证 GBP 135（新加坡官方价 SGD 240，中国大陆 CNY 1,262）。长期多次往返签证：2 年 GBP 506（SGD 900）、5 年 GBP 903（SGD 1,607）、10 年 GBP 1,128（SGD 2,007），每次入境同样最长停留 6 个月。新加坡护照的 ETA 费用为 GBP 20。",
    },
    {
      category: "申请流程",
      q: "英国签证需要多长时间处理？",
      a: "通常在生物特征采集后 3 周内出结果。视地区开放情况，优先服务可缩短至约 5 个工作日（+GBP 500），超级优先服务约 1 个工作日（+GBP 1,000）。ETA 通常 1 天内获批（建议预留 3 个工作日），且须收到批准邮件后方可启程。",
    },
    {
      category: "申请流程",
      q: "是否需要预约生物特征采集？",
      a: "需要——签证申请人须前往 VFS Global 签证申请中心采集指纹和面部照片，无需上传照片。中国大陆申请人可在境内 15 个 VFS 中心（含北京、上海、广州、深圳）办理；居住在新加坡的中国护照申请人可使用新加坡的 VFS Global 英国签证中心，并按新元价格缴费。ETA 申请人则完全无需到场，在 UK ETA App 中扫描护照并自拍即可。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "英国签证被拒后如何处理？",
      a: "UKVI 拒签后不退还申请费，您将收到说明拒签理由的通知。VIZA 的服务费全额退还，顾问将针对拒签理由（最常见为真实访客要求和资金问题）为您的重新申请提出改进方案。",
    },
  ],

  sources: [
    { label: "以标准访客身份访英 — GOV.UK", url: "https://www.gov.uk/standard-visitor", display: "gov.uk" },
    { label: "申请标准访客签证 — GOV.UK", url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa", display: "gov.uk" },
    { label: "辅助材料官方指引 — GOV.UK", url: "https://www.gov.uk/government/publications/visitor-visa-guide-to-supporting-documents/guide-to-supporting-documents-visiting-the-uk", display: "gov.uk" },
    { label: "申请 UK ETA 电子旅行许可 — GOV.UK", url: "https://www.gov.uk/eta/apply", display: "gov.uk" },
    { label: "官方签证费用计算器（中国，人民币）", url: "https://visa-fees.homeoffice.gov.uk/y/china/cny/visit/standard-visitor-visa---for-uk-isle-of-man-jersey-and-guernsey/all", display: "visa-fees.homeoffice.gov.uk" },
    { label: "在线签证申请系统", url: "https://visas-immigration.service.gov.uk/apply-visa-type/visit", display: "visas-immigration.service.gov.uk" },
  ],

  price: {
    etaLabel: "立即申请，目标出签时间",
    etaValue: "2026年7月3日 14:00",
    title: "标准访客签证 · 最长 6 个月",
    saving: "顾问全程协助 · 减少延误",
    sub: "含 UKVI 申请费、材料审核、生物采集预约及准时保证，全包价格。",
    foot: "UKVI 申请费与 VIZA 服务费在结账时一并收取，并附准时保证。",
  },

  aiPlaceholder: "关于英国访客签证，随时提问——材料、处理时间、申请资格……",
};

export default unitedKingdom;
