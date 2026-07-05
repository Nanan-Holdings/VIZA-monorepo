// zh-CN 简体中文内容 — 加拿大访客签证（TRV）与电子旅行授权（eTA）
// 事实核查日期：2026-07-05，依据 canada.ca 及 ircc.canada.ca 官方信息。
// 待运营确认事项：
//   - TRV 实时审理周期（“中国递交约8–14周 / 新加坡递交数周”来自 IRCC 月度数据的
//     第三方汇总，官方查询工具当时返回 403，发布前请在官方工具复核）；
//   - 新元换算按 CAD 1 ≈ SGD 0.94（2026年中参考汇率），发布前请核实；
//   - 2024年11月后是否仍普遍签发10年多次签证属签证官酌情决定，非公开规则；
//   - 驱逐令禁入期（1年/虚假陈述5年）为 CBSA 个案执法，并非自动罚则；
//   - lib/pricing.ts 中 CA_TRV 政府费仅含 CAD 100，价格卡未含 CAD 85 生物识别费。
// 英文原文见 ../canada.ts

import type { VisaContent } from "../types";

export const canada: VisaContent = {
  slug: "canada",

  heroTitle: "加拿大访客签证（TRV）与 eTA",
  lede: "中国大陆护照需申请加拿大访客签证（TRV）：最长10年多次往返，每次停留最长6个月；新加坡护照乘机入境仅需7加元的电子旅行授权（eTA），通常数分钟获批。无论哪种，VIZA全程代办，含生物识别预约。",
  heroImage: "/assets/heroes/canada.jpg",
  meta: [
    { k: "签证类型", v: "访客签证 / eTA" },
    { k: "停留时长", v: "最长6个月" },
    { k: "有效期", v: "最长10年" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "bolt", label: "eTA数分钟获批" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "代办生物识别预约" },
  ],

  overviewTitle: "加拿大，一览无余",
  overviewSub:
    "加拿大允许访客每次入境停留最长6个月。中国大陆护照持有人须申请访客签证（TRV）——100加元签证费加85加元生物识别费，有效期最长10年；新加坡护照乘机入境只需7加元的eTA。",
  glance: [
    { icon: "globe", k: "首都", v: "渥太华", sub: "UTC −5（东部标准时间）" },
    { icon: "clock", k: "最佳旅行时间", v: "6月–8月 · 12月–3月", sub: "夏日暖阳或冬季滑雪季" },
    { icon: "currency", k: "货币", v: "加拿大元（CAD）", sub: "CAD 1 ≈ SGD 0.94" },
    { icon: "pin", k: "热门目的地", v: "多伦多 · 温哥华 · 班夫", sub: "以及蒙特利尔、尼亚加拉大瀑布、魁北克城" },
  ],

  processTitle: "加拿大签证申请流程",
  processSub:
    "全部流程通过IRCC在线完成——加拿大没有落地签。新加坡护照数分钟拿到eTA；TRV申请人只需多跑一次生物识别采集，其余交给我们。",
  steps: [
    {
      title: "在VIZA提交申请",
      body: "上传护照、照片及行程信息。我们为您填妥IMM 5257申请表和IMM 5645家庭信息表，并通过IRCC官方门户递交。新加坡护照则直接申请7加元的eTA，通常数分钟内获批。",
    },
    {
      title: "前往VFS Global采集生物识别（仅TRV）",
      body: "我们为您预约就近的VFS签证申请中心采集指纹和照片——中国大陆各主要城市及新加坡均有网点。费用85加元，有效期10年；如您的生物识别信息仍在有效期内，此步骤可完全跳过。",
    },
    {
      title: "IRCC审理您的签证",
      body: "中国递交的访客签证目前平均需8–14周；新加坡在线递交通常数周内出结果。我们持续跟踪IRCC状态，补件要求当天响应，确保流程不停滞。",
      statusRows: [
        { label: "申请已通过IRCC门户递交", ts: "7月6日 上午9:40", onTime: true },
        { label: "已在VFS Global完成生物识别", ts: "7月18日 上午11:05", onTime: true },
        { label: "等待最终审批", ts: "处理中" },
      ],
    },
    {
      title: "9月25日下午3:15前取回护照",
      body: "获批后，护照送至签证中心贴签，随后快递返还给您。签证为多次入境——签证上的有效期是您最后一次可以入境加拿大的日期，而非必须离境的日期。",
      delivered: true,
    },
  ],

  docsTitle: "所需申请材料",
  docsSub:
    "eTA申请只需护照、电子邮箱和一张信用卡/借记卡。TRV申请需备齐以下材料——您的VIZA顾问在递交IRCC前逐项核对。",
  documents: [
    { name: "有效护照", sub: "须覆盖整个停留期 · 签证及停留期以护照到期日为上限，剩余有效期越长越好" },
    { name: "IMM 5257申请表", sub: "访客签证申请表 · 每位申请人一份，儿童也不例外" },
    { name: "IMM 5645家庭信息表", sub: "中国大陆申请人必填 · 列明父母、配偶及子女信息" },
    { name: "签证照片", sub: "35 × 45毫米，纯白背景 · 电子版JPEG/PNG，240 KB–4 MB" },
    { name: "资金证明", sub: "近3–6个月银行流水，加工资单或收入证明" },
    { name: "行程单或邀请函", sub: "机票酒店预订，或加拿大邀请人的信息及其在加身份证明" },
    { name: "国内约束力证明", sub: "在职证明、房产、在读证明、家庭关系——这是最主要的拒签理由" },
    { name: "生物识别信息", sub: "在VFS中心采集指纹和照片 · 85加元 · 有效期10年" },
  ],

  rejectionTitle: "加拿大访客签证常见拒签原因",
  rejectionSub:
    "IRCC公开其拒签依据，其中最常见的是IRPR 179(b)条——签证官不相信您会按期离开加拿大。VIZA在递交前逐项排查以下风险。",
  rejectionReasons: [
    { title: "签证官不相信您会离开加拿大", body: "最常见的拒签理由（IRPR 179(b)条）：与本国的家庭、工作、房产或资金联系薄弱，或曾在其他国家逾期停留。" },
    { title: "资金不足或来源不明", body: "银行流水不足以覆盖行程、有无法解释的大额入账，或缺少收入来源证明。" },
    { title: "访问目的模糊", body: "没有行程安排、出行日期前后矛盾，或邀请函缺少邀请人在加身份和地址信息。" },
    { title: "申请材料不完整", body: "缺少IMM 5257或家庭信息表、表格留空、材料未翻译，或未按要求采集生物识别。" },
    { title: "虚假陈述", body: "使用虚假材料或隐瞒过往拒签记录（IRPA第40条）——将被禁止入境加拿大5年。" },
    { title: "不可入境情形", body: "刑事记录（包括酒驾）、既往移民违规，或IRPA规定的医疗、安全类事由。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "加拿大没有强制的入境申报卡——ArriveCAN提前申报为可选项（主要机场可在落地前72小时内提前提交海关申报）。eTA在航空公司值机时电子核验；CBSA边境官员可能查验资金证明、返程机票和住宿信息，并现场确定您的准许停留期。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "签证有效期指最后可入境日期，并非必须离境日期" },
    { icon: "clock", k: "每次停留时长", v: "最长6个月", sub: "由CBSA官员现场确定 · 未盖章则默认自入境起6个月" },
    { icon: "plane", k: "入境申报卡", v: "无需填写", sub: "ArriveCAN提前申报为可选项，落地前72小时内可提交" },
  ],

  extensionTitle: "延期停留与超期居留",
  extensionSub:
    "延期需在线申请访客记录（Visitor Record）——IRCC建议在准许停留期结束前至少30天递交，等待审批期间可凭“维持身份”合法停留。加拿大没有按日计算的逾期罚款，但失去身份代价高昂并会记录在案。",
  extension: [
    { icon: "extend", k: "延期", v: "访客记录 · 100加元", sub: "停留期结束前至少30天在线申请 · 约合94新元" },
    { icon: "alert", k: "超期居留", v: "身份恢复费246.25加元", sub: "仅限逾期90天内（约合231新元）· 逾期更久将面临驱逐令及1年禁入" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "全球旅行者的信赖之选 · 15,712条评价",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "SL",
        name: "孙丽华",
        source: "Trustpilot · 4天前",
        title: "不到5分钟就获批了",
        body: "VIZA顾问刚提交完申请，我还没喝完一杯咖啡，批准邮件就到了。整个过程顺畅无比。",
      },
      {
        initials: "MZ",
        name: "马志远",
        source: "App Store · 2周前",
        title: "帮我发现了护照号码录入错误",
        body: "审核步骤发现我把护照号码中的两个数字写反了。要是到了机场才发现，那才真的麻烦。",
      },
    ],
  },

  faqSub:
    "没有找到您需要的答案？请使用下方AI助手提问，或直接联系您的VIZA顾问。",
  faq: [
    {
      category: "基本信息",
      q: "去加拿大需要签证还是eTA？",
      a: "取决于您的护照。中国大陆护照不在eTA适用范围内，无论乘机、陆路还是海路入境，都需要申请访客签证（TRV）。新加坡护照免签：乘机入境只需7加元的eTA（从美国陆路或海路入境连eTA都不需要），eTA有效期5年、不限入境次数。无论适用哪种，VIZA都为您全程代办。",
    },
    {
      category: "基本信息",
      q: "每次能停留多久？能拿到10年签证吗？",
      a: "默认每次入境可停留最长6个月——由CBSA边境官员现场确定；如护照未盖章，则自动按入境起6个月计算。TRV最长可签发10年，以护照及生物识别有效期为上限；但自2024年底起，具体有效期由签证官酌情决定，不再自动按最长年限签发。",
    },
    {
      category: "申请流程",
      q: "申请加拿大签证需要多少费用？",
      a: "eTA：7加元（约合6.6新元）。访客签证：每人100加元（约合94新元），家庭上限500加元；另加生物识别费每人85加元（约合80新元，家庭上限170加元）。生物识别信息10年有效，再次申请时通常可免此费用。",
    },
    {
      category: "申请流程",
      q: "审理需要多长时间？",
      a: "eTA通常数分钟内获批，少数需数天，建议出票前先申请。访客签证因递交国家而异：中国递交目前平均8–14周，新加坡在线递交通常数周出结果，另需加上生物识别预约时间。VIZA为您预约生物识别，并全程跟踪IRCC审理状态。",
    },
    {
      category: "申请流程",
      q: "在哪里采集生物识别信息？",
      a: "TRV申请人须前往VFS Global签证申请中心采集指纹和照片——中国大陆各主要城市均有网点，在新加坡合法居住的申请人也可在新加坡中心办理。eTA申请完全无需生物识别。采集一次后，10年内的访客类申请均可沿用。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "如果被拒签怎么办？",
      a: "IRCC不退还政府费用，但VIZA的服务费全额退还。您的顾问会与您一起研读拒签信——绝大多数拒签源于IRPR 179(b)条（国内约束力不足）或资金问题——并针对性补强后重新递交。",
    },
  ],

  sources: [
    { label: "IRCC — 各国入境要求（谁需要eTA、谁需要签证）", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html", display: "canada.ca" },
    { label: "IRCC — eTA说明（费用、有效期、适用范围）", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/facts.html", display: "canada.ca" },
    { label: "IRCC — 访客签证介绍", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/about-visitor-visa.html", display: "canada.ca" },
    { label: "IRCC — 官方收费标准（eTA、TRV、生物识别、身份恢复）", url: "https://ircc.canada.ca/english/information/fees/fees.asp", display: "ircc.canada.ca" },
    { label: "IRCC — 延长停留（访客记录）", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/extend-stay.html", display: "canada.ca" },
    { label: "IRCC — 官方审理时长查询工具", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html", display: "canada.ca" },
  ],

  price: {
    etaLabel: "立即申请，预计送达",
    etaValue: "2026年9月25日 下午3:15",
    title: "访客签证（TRV）· 多次入境",
    saving: "代办生物识别预约",
    sub: "全包服务，含材料审核、IRCC门户递交、生物识别预约及准时保障。",
    foot: "IRCC政府费用与VIZA服务费在结账时统一收取，并享有准时保障。",
  },

  aiPlaceholder: "请随时提问关于加拿大签证的任何问题——eTA与TRV的区别、费用、生物识别、审理时长……",
};

export default canada;
