import type { VisaContent } from "../types";

/**
 * 印度电子旅游签证（e-Tourist Visa / ETA）— 简体中文版本。
 *
 * 事实核查日期：2026-07-05，核对来源：indianvisaonline.gov.in（evisa/tvoa.html、
 * evisa/、earrival/）、cgisf.gov.in、hcisingapore.gov.in、eoibeijing.gov.in、
 * india.blscn.cn、indianfrro.gov.in。内容与 lib/visa-content/india.ts 同步。
 *
 * 已确认要点：30天版政府费 USD 25（7–3月）/ USD 10（4–6月抵达），另加2.5%
 * 银行手续费；1年版 USD 40、5年版 USD 80（每公历年累计停留不超过180天）；
 * 提前4–120天申请，ETA 通常72小时内发送；签证不可延期、不可转换（紧急情形
 * 仅可经 e-FRRO 申请）；2026年4月1日起入境须提交免费电子入境卡（e-Arrival
 * Card）；中国大陆护照暂停使用 eVisa，2025年7月24日起可经 BLS 国际签证中心
 * 申请纸质旅游签证（标准为3个月单次，USD 100 / RMB 716 全包，约7个工作日）。
 *
 * 待运营确认事项：
 * — 30天版入境次数：门户页面写"Multiple Entry, non-extendable"，但费率表及
 *   多数使领馆历来称双次（double）——发布前请在实际申请表上核实。本页按门户
 *   说法采用"多次"。
 * — FRRO 逾期罚款档位（官方 PDF 因旧版 TLS 无法抓取）：INR 500 / 10,000 /
 *   50,000 来自二手摘要。
 * — 6个月 e-T2V 变体对新加坡的费用（通常为 USD 25）未确认。
 * — 4–6月 USD 10 优惠费率按申请日期还是抵达日期计，门户未明示。
 * — 新元换算按 1 USD ≈ 1.28 SGD（2026年7月），发布时请复核。
 */
export const india: VisaContent = {
  slug: "india",

  heroTitle: "印度电子旅游签证",
  lede: "全程在线申请的电子旅行授权（ETA），自首次入境起可停留30天，无需前往领事馆，审批结果通常72小时内发送至邮箱。VIZA 顾问全程代办并跟踪进度。",
  heroImage: "/assets/heroes/india.jpg",
  meta: [
    { k: "签证类型", v: "电子旅游签证（ETA）" },
    { k: "停留时长", v: "30天" },
    { k: "有效期", v: "自首次入境起30天" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "bolt", label: "全程在线" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "材料精简" },
  ],

  overviewTitle: "印度，概览",
  overviewSub:
    "电子旅游签证适用于旅游观光、探亲访友、短期瑜伽项目及非正式商务访问。新加坡护照入境印度并非免签——每次出行都需办理签证。计划长期多次往返的旅客可选择1年版（USD 40）或5年版（USD 80）多次入境签证，每公历年累计停留不超过180天。",
  glance: [
    { icon: "globe", k: "首都", v: "新德里", sub: "UTC+5:30（印度标准时间）" },
    { icon: "clock", k: "最佳旅行季", v: "10月–次年3月", sub: "大部分地区凉爽干燥" },
    { icon: "currency", k: "货币", v: "印度卢比（INR）", sub: "SGD 1 ≈ INR 65 · 城市地区银行卡普遍可用" },
    { icon: "pin", k: "热门目的地", v: "德里 · 孟买 · 斋浦尔", sub: "另有阿格拉、喀拉拉邦、瓦拉纳西、果阿" },
  ],

  processTitle: "电子签证申请流程",
  processSub:
    "一次提交，全程托管。我们核验材料后直接在 indianvisaonline.gov.in 官方门户递交，并跟踪至 ETA 送达您的邮箱。请在抵达前4至120天内申请——距出行不足4天完成申请或付款的，政府不予受理。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片及出行日期。顾问会先对照政府门户严格的文件大小和格式要求逐项核查，再行提交。",
    },
    {
      title: "材料审核",
      body: "我们将照片调整为白底正方形规格、护照扫描件转为规定的 PDF 格式，随后代您递交申请并支付政府费用（含2.5%银行手续费）。",
    },
    {
      title: "印度移民局审核",
      body: "审批结果通常在72小时内以邮件发送。我们持续监控门户状态，一旦收到补传材料的要求立即处理——未及时响应补传要求是拒签的主要原因之一。",
      statusRows: [
        { label: "申请已提交至门户", ts: "6月20日 上午10:15", onTime: true },
        { label: "已转交背景审查", ts: "6月20日 下午2:30", onTime: true },
        { label: "等待最终审批", ts: "处理中" },
      ],
    },
    {
      title: "6月23日收取 ETA",
      body: "电子旅行授权（ETA）将发送至您的邮箱并显示在 VIZA 应用中。请务必打印——入境时须在 eVisa 专用柜台出示纸质件，并于首次入境时采集指纹和照片。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "印度政府门户对文件大小和格式有精确要求。VIZA 顾问逐项核验——补传材料次数不限，免费。",
  documents: [
    { name: "护照个人信息页", sub: "仅限普通护照 · 自抵达日起有效期6个月以上 · 至少2页空白页 · PDF格式，10 KB–300 KB" },
    { name: "电子照片", sub: "白色背景 · 正方形 JPEG，10 KB–1 MB · 正脸免冠、不戴眼镜 · 近期拍摄" },
    { name: "回程或继程机票", sub: "eVisa 签证条件要求 · 入境时可能查验" },
    { name: "充足资金证明", sub: "须有足够停留期间开销的资金 · 入境时可能查验" },
    { name: "电子入境卡（e-Arrival Card）二维码", sub: "2026年4月1日起强制 · 抵达前72小时内在线免费提交" },
  ],

  rejectionTitle: "电子签证申请被拒的常见原因",
  rejectionSub:
    "印度移民局重点审查以下问题。VIZA 在您提交前逐一排查。",
  rejectionReasons: [
    {
      title: "上传文件质量差或不合规",
      body: "扫描件模糊、照片背景非白色、文件超出 10 KB–300 KB / 10 KB–1 MB 限制——这是最常见的拒签原因。忽略补传邮件将直接导致拒签。",
    },
    {
      title: "信息不一致",
      body: "表格中填写的姓名、护照号、出生日期或国籍与护照个人信息页不完全一致。",
    },
    {
      title: "护照有效期不足",
      body: "护照自抵达日起有效期不足6个月，或供盖章的空白页少于2页。",
    },
    {
      title: "护照类型不符合条件",
      body: "外交护照、公务护照及国际旅行证件不适用 eVisa 渠道，须前往使领馆申请。",
    },
    {
      title: "申请时间过晚",
      body: "距出行不足4天才完成申请或付款的，政府不予受理。",
    },
    {
      title: "不良出入境记录",
      body: "曾在印度逾期停留、违反签证规定或被列入黑名单，在背景审查中被发现。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "入境时请携带 ETA 打印件、回程机票及资金证明。eVisa 持有人须经33个指定机场或19个指定海港之一入境（出境可经任一获授权口岸）。2026年4月1日起，所有外国旅客须在抵达前72小时内在线提交免费电子入境卡（e-Arrival Card），入境时出示二维码——它取代了纸质入境登记卡。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "限30天有效期内" },
    { icon: "clock", k: "最长停留", v: "30天", sub: "自首次入境印度之日起计算" },
    { icon: "plane", k: "入境口岸", v: "33个机场 · 19个海港", sub: "首次入境时采集生物识别信息" },
    { icon: "doc", k: "电子入境卡", v: "抵达前72小时内提交", sub: "免费 · 2026年4月1日起强制" },
  ],

  extensionTitle: "签证延期与逾期停留",
  extensionSub:
    "电子旅游签证不可延期、不可转换为其他类别。仅在真正的紧急情形下可经 e-FRRO 门户申请延期——如需更长停留，请改办1年版或5年版签证。逾期停留者须先向外国人地区登记处（FRRO）取得出境许可（Exit Permit）方可离境，并按档位缴纳罚款；情节严重的可被起诉并列入黑名单，影响未来入境。",
  extension: [
    { icon: "ban", k: "延期", v: "不可延期", sub: "仅紧急情形可经 e-FRRO 申请" },
    { icon: "alert", k: "逾期罚款", v: "INR 500 – 50,000", sub: "≤15天 INR 500 · 16–90天 INR 10,000 · 超过90天 INR 50,000" },
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
      q: "新加坡护照去印度需要签证吗？",
      a: "需要。新加坡在印度 eVisa 适用国名单上，而非免签名单——每次出行都须办理 eVisa（或经印度驻新加坡最高专员公署办理普通签证）。VIZA 可全程代办 eVisa。",
    },
    {
      category: "基本信息",
      q: "印度电子旅游签证费用是多少？",
      a: "30天版政府费为 USD 25（约 SGD 32，7月–次年3月抵达），4–6月抵达降为 USD 10（约 SGD 13），另加2.5%银行手续费。1年多次版 USD 40（约 SGD 51），5年多次版 USD 80（约 SGD 102）。",
    },
    {
      category: "基本信息",
      q: "中国大陆护照可以申请印度 eVisa 吗？",
      a: "不可以——印度 eVisa 对中国大陆护照仍处于暂停状态。自2025年7月24日起，中国公民可通过 BLS 国际签证中心（北京、上海、广州）申请纸质旅游签证，标准为3个月单次入境，全包费用 USD 100 / RMB 716，审理约7个工作日。VIZA 可全程代办纸质签证申请。",
    },
    {
      category: "申请流程",
      q: "电子签证审理需要多长时间？",
      a: "审批结果通常在提交后72小时内以邮件发送。最早可在抵达前120天申请，且政府要求至少提前4天完成申请和付款——逾期不予受理。VIZA 以准时保障为时间线背书。",
    },
    {
      category: "申请流程",
      q: "想停留超过30天怎么办？",
      a: "30天版电子旅游签证不可延期。可改办1年版（USD 40）或5年版（USD 80）多次入境签证——两者均可多次往返，每公历年累计停留不超过180天。",
    },
    {
      category: "申请流程",
      q: "可以一次为全家申请吗？",
      a: "每位旅行者须凭各自护照和照片单独申请。VIZA 可同步处理多份申请，确保全家按同一时间线出行。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "电子签证申请被拒怎么办？",
      a: "印度政府收取的签证费不予退还，VIZA 的服务费将全额退款。顾问会分析拒签原因——多数源于上传文件质量或信息不一致，我们协助更正后重新递交。",
    },
  ],

  sources: [
    { label: "印度 eVisa 门户 — 电子旅游签证详情", url: "https://indianvisaonline.gov.in/evisa/tvoa.html", display: "indianvisaonline.gov.in" },
    { label: "各国电子旅游签证费率表（官方 PDF）", url: "https://indianvisaonline.gov.in/evisa/images/Etourist_fee_final.pdf", display: "indianvisaonline.gov.in" },
    { label: "电子入境卡（e-Arrival Card）官方门户", url: "https://indianvisaonline.gov.in/earrival/", display: "indianvisaonline.gov.in" },
    { label: "印度驻新加坡最高专员公署 — 电子旅游签证", url: "https://www.hcisingapore.gov.in/eTourist", display: "hcisingapore.gov.in" },
    { label: "BLS 国际 — 中国公民印度签证", url: "https://india.blscn.cn/touristvisa.php", display: "india.blscn.cn" },
    { label: "FRRO — 逾期停留罚款标准", url: "https://indianfrro.gov.in/frro/Financial_Penalty.pdf", display: "indianfrro.gov.in" },
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
