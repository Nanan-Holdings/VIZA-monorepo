import type { VisaContent } from "../types";

/**
 * 泰国电子签证（旅游签 TR）内容 — 简体中文。
 * 原文：lib/visa-content/thailand.ts（最后核实：2026-07-05，依据
 * thaievisa.go.th、singapore.thaiembassy.org、tdac.immigration.go.th、
 * tatnews.org、bangkok.immigration.go.th、washingtondc.thaiembassy.org）。
 *
 * 待运营确认事项：
 *   - 60天免签缩短至30天的调整（2026年5月内阁原则通过）截至2026-07-05
 *     尚未刊登皇家公报，未生效——需每周对照 tatnews.org / 泰国外交部复查。
 *   - SGD 50 / SGD 250 政府费用仅确认适用于在新加坡递交的申请。
 *   - thaievisa.go.th 照片像素/文件大小规格未能直接核验；3.5 × 4.5 cm、
 *     白底为使馆指引口径。
 *   - 60天免签期间，中国公民“任意180天内累计90天”上限是否执行，
 *     暂无官方来源确认。
 */
export const thailand: VisaContent = {
  slug: "thailand",

  heroTitle: "泰国电子签证",
  lede: "泰国官方旅游签证（TR）已全面线上化，通过 thaievisa.go.th 签发——自签发之日起3个月有效，允许停留60天，境内可再延期一次30天。新加坡与中国护照目前旅游免签，单次可停留60天；无论免签入境还是办理签证，VIZA 均可全程代办，包括必填的 TDAC 数字入境卡。",
  heroImage: "/assets/heroes/thailand.jpg",
  meta: [
    { k: "签证类型", v: "电子签证（旅游 TR）" },
    { k: "停留时长", v: "60天" },
    { k: "有效期", v: "自签发之日起3个月" },
    { k: "入境方式", v: "单次" },
  ],
  tags: [
    { icon: "bolt", label: "快速审批" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "材料精简" },
  ],

  overviewTitle: "泰国，概览",
  overviewSub:
    "金碧辉煌的寺庙、碧绿的海岛、夜市美食与闻名世界的泰式料理——泰国让每一位旅行者都流连忘返。",
  glance: [
    { icon: "globe", k: "首都", v: "曼谷", sub: "UTC+7（印度支那时间，不调整夏令时）" },
    { icon: "clock", k: "最佳旅行时间", v: "11月–4月", sub: "大部分地区凉爽干燥" },
    { icon: "currency", k: "货币", v: "泰铢（THB）", sub: "1新元 ≈ 25泰铢" },
    { icon: "pin", k: "热门目的地", v: "曼谷 · 普吉岛 · 清迈", sub: "另有苏梅岛、甲米、清莱" },
  ],

  processTitle: "泰国电子签证办理流程",
  processSub:
    "自2025年1月1日起，泰国签证全面线上办理——无需前往使馆、无需递交护照原件。我们在 thaievisa.go.th 官方门户代为递交，全程跟踪领事进度，并在出发前为您办妥 TDAC 数字入境卡。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片、银行流水及已确认的行程预订。泰国驻新加坡大使馆建议至少提前21个工作日申请，且审理期间申请人须留在新加坡。",
    },
    {
      title: "材料核验",
      body: "您的 VIZA 顾问核对资金门槛（单次入境每人至少800新元）、照片规格及新加坡居留证明，随后直接提交至泰国驻新加坡大使馆管辖的官方电子签证门户。",
    },
    {
      title: "电子签证处理中",
      body: "领事审理通常在付款后5–10个工作日完成。我们实时监控每项进度，如领馆要求补件，第一时间处理，避免延误行程。",
      statusRows: [
        { label: "申请已提交至电子签证门户", ts: "7月8日 上午 8:30", onTime: true },
        { label: "材料已转交领事官员", ts: "7月8日 上午 11:00", onTime: true },
        { label: "等待领事审批", ts: "处理中" },
      ],
    },
    {
      title: "于7月17日下午3:00获取电子签证",
      body: "获批的电子签证 PDF 将发送至您的邮箱及 VIZA 应用。随后我们在您出发前72小时内为您提交免费的泰国数字入境卡（TDAC）——所有旅客均须填报。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "以下为泰国驻新加坡大使馆官方清单。您的 VIZA 顾问在提交前逐一核对每份材料，补传次数不限，免费。",
  documents: [
    { name: "护照个人信息页", sub: "自申请之日起有效期6个月以上 · 留有空白页 · 彩色扫描清晰" },
    { name: "近期照片", sub: "白色背景 · 3.5 × 4.5 cm 护照规格 · 6个月内拍摄" },
    { name: "往返行程预订", sub: "已确认的往返机票（或邮轮行程），须显示入境及离境泰国" },
    { name: "住宿证明", sub: "覆盖全程的酒店预订，或泰国邀请人出具的邀请函" },
    { name: "银行流水", sub: "近3个月 · 每人余额不低于800新元（METV多次签：近6个月 · 8,000新元并附在职证明）" },
    { name: "新加坡居留证明", sub: "非新加坡籍申请人：长期准证正反面，剩余有效期2个月以上" },
  ],

  rejectionTitle: "泰国电子签证常见拒签原因",
  rejectionSub:
    "泰国驻新加坡大使馆保留要求补件、约谈面试或不说明理由直接拒签的权利。VIZA 在提交前逐项排查所有已知风险点。",
  rejectionReasons: [
    {
      title: "资金证明不足或不清晰",
      body: "银行流水低于800新元（单次）或8,000新元（METV）门槛，或流水不完整、未显示申请人姓名。",
    },
    {
      title: "未在居住国申请",
      body: "电子签证须在合法居住地递交——新加坡使馆要求持有剩余有效期2个月以上的长期准证，且审理期间须留在新加坡。",
    },
    {
      title: "材料不完整或不清晰",
      body: "护照扫描模糊、缺少机票或酒店预订，或非泰文/英文材料未经翻译公证。",
    },
    {
      title: "照片不符合规格",
      body: "照片拍摄超过6个月、背景不符或不满足护照照片标准。",
    },
    {
      title: "移民记录问题",
      body: "曾在泰国逾期居留、被列入黑名单或有拒签史，都会影响审批。",
    },
    {
      title: "疑似非旅游目的",
      body: "有以旅游签打工或长期居留的迹象——频繁连续以旅游身份入境也会在口岸被重点排查。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "所有旅客——无论持签证还是免签入境——都必须在抵达前72小时内在线提交免费的泰国数字入境卡（TDAC）。请随身携带电子签证 PDF、回程机票及资金证明：移民官可抽查每人20,000泰铢（约785新元）现金或等值资产。",
  entryExit: [
    { icon: "refresh", k: "入境方式", v: "单次", sub: "再次入境须重新申请——多次往返可办 METV 多次签" },
    { icon: "clock", k: "激活期限", v: "3个月", sub: "自签证签发日起计算——请在此期限内入境" },
    { icon: "plane", k: "TDAC 数字入境卡", v: "抵达前72小时内", sub: "免费，官网 tdac.immigration.go.th · 2025年5月1日起强制" },
    { icon: "currency", k: "资金抽查", v: "每人20,000泰铢", sub: "约785新元 · 每个家庭40,000泰铢，由移民官酌情抽查" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "持旅游签证或免签入境者，均可在泰国任一移民局办理一次30天延期（TM.7 表格），通常当天办结。请务必在现有停留许可到期前申请；逾期居留按日罚款，长期逾期还将触发1至10年的再入境禁令。",
  extension: [
    { icon: "extend", k: "延期", v: "+30天", sub: "一次性 · TM.7 表格 · 1,900泰铢（约75新元）· 通常当天办结" },
    { icon: "alert", k: "逾期罚款", v: "500泰铢/天", sub: "约20新元/天 · 最高累计20,000泰铢（约785新元）" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "深受数千名旅客信赖 · 10,517 条评价",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "ZY",
        name: "张雨婷",
        source: "Trustpilot · 4天前",
        title: "清迈之旅，3天搞定签证",
        body: "泰国电子签证流程以前总让我很头疼。VIZA 负责了领事馆材料上传，还帮我确认了银行流水格式，签证 PDF 在出发前就早早发到手了。",
      },
      {
        initials: "CJ",
        name: "陈建国",
        source: "App Store · 1周前",
        title: "顾问及时发现材料问题",
        body: "我的照片背景不符合规格，顾问主动处理并重新提交，全程无需我操心。这种服务态度实属难得。",
      },
    ],
  },

  faqSub:
    "没找到答案？可向页面底部的 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "泰国旅游电子签证（TR）是什么？",
      a: "旅游签证（TR）是泰国皇家大使馆通过 thaievisa.go.th 官方门户签发的单次入境签证，自2025年1月1日起全面线上办理。自签发之日起3个月内有效，允许以旅游、休闲、探亲或就医为目的停留60天（自入境日起算）。另有多次入境版本 METV，有效期6个月，每次入境可停留60天。",
    },
    {
      category: "基本信息",
      q: "新加坡或中国护照需要办这个签证吗？",
      a: "短期旅游不需要——两国护照目前均可免签入境，每次最长停留60天（境内可再延期一次30天）。泰国内阁已原则通过将免签期缩短至30天的调整，但尚未生效。请注意：即使免签，也必须在抵达前72小时内提交免费的 TDAC 数字入境卡——VIZA 全程代办；如需用足60天并保留延期空间，我们也可代办 TR 电子签证。",
    },
    {
      category: "基本信息",
      q: "泰国数字入境卡（TDAC）是什么？",
      a: "自2025年5月1日起，所有经空、陆、海路入境泰国的外国旅客，都必须在抵达前72小时内在 tdac.immigration.go.th 免费提交 TDAC，取代原纸质 TM.6 入境卡。仅纯过境旅客和边境通行证持有人豁免。VIZA 的每份泰国订单均包含 TDAC 代填服务。",
    },
    {
      category: "基本信息",
      q: "持旅游电子签证可以工作或学习吗？",
      a: "不可以。旅游签证（TR）不允许就业、有偿活动或正式学习。工作、留学和退休均有对应的非移民签证类别。",
    },
    {
      category: "申请流程",
      q: "泰国电子签证费用是多少？",
      a: "在新加坡递交的申请，政府费用为：单次入境 TR 50新元，多次入境 METV 250新元——一经缴纳不予退还。VIZA 服务费在结账时透明列示，并包含免费的 TDAC 代填。",
    },
    {
      category: "申请流程",
      q: "泰国电子签证需要多长时间？",
      a: "领事审理通常在付款后5–10个工作日完成。泰国驻新加坡大使馆建议至少提前21个工作日申请，且在电子签证获批前须留在新加坡——请尽早启动。我们以准时保障为承诺。",
    },
    {
      category: "申请流程",
      q: "可以为全家同时申请吗？",
      a: "可以。在 VIZA 申请中添加每位旅行者——顾问将作为团体统一提交，确保所有人同步处理。请注意资金要求按人计算：单次入境 TR 每人须有800新元。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "泰国电子签证被拒后怎么办？",
      a: "泰国政府将保留政府费用——官方规定签证费一经缴纳不予退还。VIZA 服务费将全额退还。顾问将分析拒签原因（通常是资金证明或材料质量问题），协助补强后重新申请。",
    },
  ],

  sources: [
    {
      label: "泰国电子签证官方门户（外交部）",
      url: "https://www.thaievisa.go.th/",
      display: "thaievisa.go.th",
    },
    {
      label: "泰国驻新加坡大使馆——旅游签证（TR）",
      url: "https://singapore.thaiembassy.org/en/page/tourist-visa",
      display: "singapore.thaiembassy.org",
    },
    {
      label: "泰国数字入境卡（TDAC）官方网站（免费）",
      url: "https://tdac.immigration.go.th/",
      display: "tdac.immigration.go.th",
    },
    {
      label: "曼谷移民局第一分局——签证延期（TM.7）",
      url: "https://bangkok.immigration.go.th/en/visa-extension/",
      display: "bangkok.immigration.go.th",
    },
    {
      label: "泰国驻华盛顿大使馆——逾期居留规定",
      url: "https://washingtondc.thaiembassy.org/en/page/advice-on-thailand-visa-overstay-regulations",
      display: "washingtondc.thaiembassy.org",
    },
    {
      label: "泰国国家旅游局新闻——免签政策调整（2026年5月）",
      url: "https://www.tatnews.org/2026/05/thai-cabinet-approves-revision-of-60-day-visa-exemption-scheme-pending-royal-gazette-publication/",
      display: "tatnews.org",
    },
  ],

  price: {
    etaLabel: "立即申请，预计到达时间",
    etaValue: "2026年7月17日 下午3:00",
    title: "电子签证（TR）· 60天停留",
    saving: "比直接申请更快",
    sub: "含50新元政府费、材料审核、TDAC 代填及准时保障，一价全包。",
    foot: "政府费与 VIZA 服务费在结账时一并收取，并享有准时保障。",
  },

  aiPlaceholder: "关于泰国签证，您有任何问题都可以问我——免签政策、TDAC、延期、所需材料……",
};

export default thailand;
