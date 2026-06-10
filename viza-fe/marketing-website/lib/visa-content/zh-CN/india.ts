import type { VisaContent } from "../types";

/**
 * 印度电子旅游签证（e-Visa）— 简体中文翻译版本。
 *
 * 本文件为 lib/visa-content/india.ts 的简体中文译文，涵盖30天双次入境
 * e-Tourist Visa（e-T1V）变体。所有费用、有效期及材料要求须由运营/法务团队
 * 对照 indianvisaonline.gov.in 最新内容核实后方可发布。
 */
export const india: VisaContent = {
  slug: "india",

  heroTitle: "印度电子旅游签证",
  lede: "全程在线申请的电子旅游签证，自首次入境起可停留30天，支持双次入境，无需亲赴领事馆。",
  heroImage: "/assets/heroes/india.jpg",
  meta: [
    { k: "签证类型", v: "电子签证（旅游）" },
    { k: "停留时长", v: "30天" },
    { k: "有效期", v: "自首次入境起30天" },
    { k: "入境次数", v: "双次" },
  ],
  tags: [
    { icon: "bolt", label: "全程在线" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "材料精简" },
  ],

  overviewTitle: "印度，概览",
  overviewSub:
    "电子旅游签证适用于旅游观光、非正式商务访问、短期医疗及参加会议等活动，全程在线申请，无需到馆。",
  glance: [
    { icon: "globe", k: "首都", v: "新德里", sub: "UTC+5:30（印度标准时间）" },
    { icon: "clock", k: "最佳旅行季", v: "10月–次年3月", sub: "大部分地区凉爽干燥" },
    { icon: "currency", k: "货币", v: "印度卢比（INR）", sub: "城市地区银行卡普遍可用" },
    { icon: "pin", k: "热门目的地", v: "德里 · 孟买 · 斋浦尔", sub: "另有阿格拉、喀拉拉邦、瓦拉纳西、果阿" },
  ],

  processTitle: "电子签证申请流程",
  processSub:
    "一次提交，全程托管。我们核验您的材料并直接提交至印度政府官方门户，全程跟踪审核进度，将电子旅行授权（ETA）发送至您的邮箱。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片及出行日期。顾问将对照印度电子签证要求逐项核查后再行提交——无需前往领事馆。",
    },
    {
      title: "材料审核",
      body: "VIZA 顾问对照政府门户要求逐项核查，随后代您提交申请。",
    },
    {
      title: "印度移民局审核",
      body: "移民局对申请进行审查。我们持续监控门户状态，并及时通知您补充材料的请求。",
      statusRows: [
        { label: "申请已提交至门户", ts: "6月20日 上午10:15", onTime: true },
        { label: "已转交背景审查", ts: "6月20日 下午2:30", onTime: true },
        { label: "等待最终审批", ts: "处理中" },
      ],
    },
    {
      title: "6月23日收取电子签证",
      body: "电子旅行授权（ETA）将发送至您的邮箱并显示在 VIZA 应用中。请打印或保存备用——入境时需在移民柜台出示。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "印度政府门户对照片及护照扫描件有严格要求。VIZA 顾问在提交前逐项核验——补传材料次数不限，免费。",
  documents: [
    { name: "护照个人信息页", sub: "自抵达之日起有效期不少于6个月 · 扫描件须清晰" },
    { name: "近期免冠照片", sub: "纯白色背景 · 近6个月内拍摄 · 正方形格式" },
    { name: "回程或继程机票", sub: "须显示在签证有效期内离境" },
    { name: "充足资金证明", sub: "银行流水单或同等证明，显示停留期间有足够资金" },
  ],

  rejectionTitle: "电子签证申请被拒的常见原因",
  rejectionSub:
    "印度移民局将重点审查以下问题。VIZA 在您提交前提前标记风险。",
  rejectionReasons: [
    {
      title: "照片不符合规格",
      body: "未满足纯白色背景、正脸、正方形格式等严格要求的照片是最常见的拒签原因之一。",
    },
    {
      title: "护照有效期不足",
      body: "护照在预定抵达印度日期起有效期不足6个月，或空白页少于两页。",
    },
    {
      title: "既往签证违规记录",
      body: "曾在任何国家出现逾期停留、被驱逐出境或签证违规记录，在背景审查中被标记。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "入境时请携带电子签证（ETA）打印件或电子版、回程机票及住宿信息。仅限在指定电子签证机场和海港口岸入境。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "双次", sub: "仅限指定电子签证机场及海港口岸" },
    { icon: "clock", k: "最长停留", v: "30天", sub: "自首次入境印度之日起计算" },
  ],

  extensionTitle: "签证延期与逾期停留",
  extensionSub:
    "电子旅游签证一般不可延期。如需延期，须在印度境内向外国人地区登记处（FRRO）申请，且仅在特殊情形下批准。",
  extension: [
    { icon: "extend", k: "延期", v: "仅可通过FRRO申请", sub: "特殊情形，不保证批准" },
    { icon: "alert", k: "逾期处罚", v: "驱逐出境及禁令", sub: "未来签证申请可能被拒；或面临法律追究" },
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
        initials: "DK",
        name: "邓凯",
        source: "Trustpilot · 6天前",
        title: "3天搞定印度电子签证，省心省力",
        body: "政府门户自己搞真的很乱。VIZA 帮我处理了照片格式，提交完所有材料，72小时内就收到ETA了。",
      },
      {
        initials: "SR",
        name: "苏睿",
        source: "App Store · 1周前",
        title: "照片问题被提前发现，避免了麻烦",
        body: "我的照片背景不对，顾问马上发现了。当天重新提交，签证顺利下来，全程没有任何波折。",
      },
    ],
  },

  faqSub:
    "没找到答案？可在页面底部向 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "持印度电子旅游签证可以做什么？",
      a: "电子旅游签证允许旅游观光、非正式商务访问（不得从事有偿工作）、短期瑜伽/健康项目及参加会议。医疗目的需申请独立的电子医疗签证。",
    },
    {
      category: "基本信息",
      q: "电子签证是否适用于印度所有口岸？",
      a: "不是。电子旅游签证仅限在官方批准的指定机场和海港口岸入境，完整名单发布于 indianvisaonline.gov.in。陆路边境口岸一般不在适用范围内。",
    },
    {
      category: "申请流程",
      q: "电子签证审理需要多长时间？",
      a: "标准审理时间为提交后72小时，部分申请可更快获批。请至少在预定抵达日期前4天提交申请。30天双次入境电子旅游签证一经签发，不可延期，亦不可转换为其他类别。",
    },
    {
      category: "申请流程",
      q: "可以一次为全家申请吗？",
      a: "每位旅行者须凭各自护照和照片单独申请电子签证。VIZA 可同步处理多份申请，确保全家按同一时间出行。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "电子签证申请被拒怎么办？",
      a: "印度政府收取的签证费不予退还。VIZA 的服务费将全额退款。顾问会分析拒签原因，指导您在解决问题后重新申请。在大多数情况下，处理完被标记的问题后即可重新申请。",
    },
  ],

  sources: [
    { label: "印度电子签证 — 政府官方门户", url: "https://indianvisaonline.gov.in/", display: "indianvisaonline.gov.in" },
    { label: "印度移民局 — 内政部", url: "https://boi.gov.in/", display: "boi.gov.in" },
  ],

  price: {
    etaLabel: "立即申请，预计到达时间",
    etaValue: "2026年6月23日 下午3:00",
    title: "电子旅游签证 · 30天停留",
    saving: "全程在线——无需前往领事馆",
    sub: "全包价，含材料审核、照片核验及准时保障。",
    foot: "政府签证费在结账时收取并直接提交至 indianvisaonline.gov.in；VIZA 服务费涵盖材料准备、照片合规核查及状态监控。",
  },

  aiPlaceholder: "关于印度电子签证有任何问题尽管问——材料、照片要求、入境口岸……",
};

export default india;
