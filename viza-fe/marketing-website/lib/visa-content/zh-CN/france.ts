import type { VisaContent } from "../types";

/**
 * 法国申根短期签证（C类）— 简体中文版本。
 *
 * 本文件为 lib/visa-content/france.ts 的简体中文对应版本。
 * 申请流程：在官方门户 France-Visas（france-visas.gouv.fr）在线填表，
 * 再前往外包中心录入生物特征并递交材料——中国大陆为 TLScontact（中智签证），
 * 新加坡为 VFS Global。新加坡护照免签。
 *
 * 最近事实核查：2026-07-05，依据 france-visas.gouv.fr、service-public.gouv.fr、
 * diplomatie.gouv.fr、travel-europe.europa.eu、home-affairs.ec.europa.eu、
 * visa.vfsglobal.com 及 mfa.gov.sg。
 * — 签证费：成人90欧元，6–11岁儿童45欧元，6岁以下免费（2024年6月11日起欧盟统一）。
 * — EES 生物特征出入境系统自2026年4月10日起全面运行。
 * — ETIAS（20欧元）预计2026年第四季度对免签国民启用。
 *
 * 发布前需运营核实的事项：
 * 1. VFS Global 新加坡中心的法国签证服务费（第三方称约合34欧元）——
 *    请在 visa.vfsglobal.com/sgp/en/fra 核实。
 * 2. 法国逾期罚款金额各方报道不一（198欧元 vs 最高3,750欧元）；实际以
 *    遣送令和 IRTF 入境禁令为主——本文有意不发布按日罚款数字。
 * 3. 每日生活费参考标准（65 / 32.50 / 120欧元）广为引用，但未能在官方
 *    页面重新核实。
 * 4. ETIAS 在2026年第四季度内的确切启用日期欧盟尚未公布。
 * 5. IRTF 禁令时长（通常最长3年，可延长）未对照现行 CESEDA 法条核实。
 */
export const france: VisaContent = {
  slug: "france",

  heroTitle: "法国申根签证",
  lede: "C类短期申根签证——任意180天内最长停留90天，通行全部29个申根成员国。在 France-Visas 官网申请，经 VFS Global 或 TLScontact（中智签证）递交，VIZA 顾问全程托管。新加坡护照免签，无需办理。",
  heroImage: "/assets/heroes/france.jpg",
  meta: [
    { k: "签证类型", v: "申根短期（C类）" },
    { k: "停留时长", v: "任意180天内90天" },
    { k: "有效期", v: "按行程签发，最长5年" },
    { k: "入境次数", v: "单次 · 两次 · 多次" },
  ],
  tags: [
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "全套材料审核" },
    { icon: "globe", label: "29国申根区通行" },
  ],

  overviewTitle: "法国，概览",
  overviewSub:
    "凭法国签发的申根签证，您可赴法旅游、探亲或短期商务出行，并在整个申根区内自由通行。",
  glance: [
    { icon: "globe", k: "首都", v: "巴黎", sub: "UTC+1（欧洲中部时间）/ +2（夏令时）" },
    { icon: "clock", k: "最佳旅行季", v: "4月–6月、9月–10月", sub: "气候温和，游客较少" },
    { icon: "currency", k: "货币", v: "欧元（EUR）", sub: "SGD 1 ≈ EUR 0.69" },
    { icon: "pin", k: "热门目的地", v: "巴黎 · 尼斯 · 里昂", sub: "另有波尔多、斯特拉斯堡、圣米歇尔山" },
  ],

  processTitle: "申根签证申请流程",
  processSub:
    "一次提交，全程托管。我们代填 France-Visas 官方申请表，备齐完整材料包，预约生物特征采集，并跟进领事馆审理直至签证贴入护照。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片、行程及支撑材料。顾问在官方 France-Visas 网站完成在线申请表，并在递交前逐项对照领事馆清单核查。",
    },
    {
      title: "材料审核",
      body: "我们核验保险保额（不低于3万欧元）、银行流水、预订单及约束力材料，并为您确认预约——中国大陆在 TLScontact（中智签证）中心，新加坡在 VFS Global。",
    },
    {
      title: "采集生物特征 & 领事馆审理",
      body: "您需本人到场录入指纹并递交材料。按欧盟签证法规，标准审理为15个自然日，复杂个案可延至45天——我们持续跟踪进度，并及时转达补充材料要求。",
      statusRows: [
        { label: "生物特征采集已完成", ts: "6月12日 上午9:00", onTime: true },
        { label: "材料已递交领事馆", ts: "6月12日 上午11:30", onTime: true },
        { label: "等待领事馆审理", ts: "处理中" },
      ],
    },
    {
      title: "6月26日领取签证",
      body: "签证贴纸贴入护照——效期从您的实际行程日期起，信誉良好的常旅客可获1至5年多次往返签证。签证可领取或安排快递时我们第一时间通知您。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "法国领事馆严格执行 France-Visas 材料清单。VIZA 顾问在递交前逐项核验——补传材料次数不限，免费。",
  documents: [
    { name: "France-Visas 申请表", sub: "官网在线填写 · 打印并附 CERFA 回执/条形码" },
    { name: "护照", sub: "离开申根区后仍有3个月以上效期 · 10年内签发 · 至少2页空白页" },
    { name: "照片2张", sub: "符合 ICAO 标准 · 35×45毫米 · 彩色 · 浅色纯色背景" },
    { name: "旅行医疗保险", sub: "保额不低于3万欧元 · 覆盖全部申根国家及整个停留期" },
    { name: "住宿证明", sub: "覆盖全程的酒店预订、租约，或法国接待人出具的接待证明（attestation d'accueil）" },
    { name: "财力证明", sub: "近3个月银行流水 · 参考标准：有酒店约65欧元/天，有接待人约32.50欧元/天" },
    { name: "往返交通", sub: "离开申根区的往返机票预订" },
    { name: "社会经济约束力证明", sub: "在职证明（含收入及准假）、营业执照、在读证明或退休金等收入证明" },
  ],

  rejectionTitle: "申根签证被拒的常见原因",
  rejectionSub:
    "领事馆重点审查以下问题——均为申根区最常见的拒签理由。VIZA 在您递交前提前排查。",
  rejectionReasons: [
    {
      title: "出行目的不明确",
      body: "最常见的拒签代码：材料无法令人信服地证明停留目的和条件，或申报目的与支撑材料相互矛盾。",
    },
    {
      title: "生活费用不足",
      body: "银行流水低于法国的每日参考标准（有酒店约65欧元/天，有接待人约32.50欧元/天），或出现无法解释的大额入账。",
    },
    {
      title: "回国意愿存疑",
      body: "国内约束力薄弱——缺乏稳定工作、收入、房产或家庭责任，领事馆无法确信您会在签证到期前离境。",
    },
    {
      title: "预订或材料不可靠",
      body: "未确认或虚假的酒店、机票预订，或提交伪造材料——后者还会触发未来禁令。",
    },
    {
      title: "旅行保险不合规",
      body: "保额低于3万欧元、未覆盖整个申根区，或保险期限未覆盖全部行程日期。",
    },
    {
      title: "既往申根记录不良",
      body: "曾经逾期停留、被列入 SIS 预警系统，或与既往申请记录存在矛盾。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "法国无任何纸质或电子入境卡。自2026年4月10日起，欧盟出入境系统（EES）在边境对您进行生物特征登记——人脸照片加指纹——取代护照盖章。请随身携带资金、住宿、保险证明及回程机票，边检可能查验。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "以签发为准", sub: "单次、两次或多次——由领事馆决定" },
    { icon: "clock", k: "90/180天规则", v: "最长90天", sub: "任意180天滚动窗口内，全部申根国合并计算" },
    { icon: "shield", k: "EES 登记", v: "照片 + 指纹", sub: "2026年4月10日起首次入境时办理 · 12岁以下免录指纹" },
    { icon: "calendar", k: "ETIAS", v: "暂不需要", sub: "预计2026年第四季度对免签国民启用 · 20欧元" },
  ],

  extensionTitle: "签证延期与逾期停留",
  extensionSub:
    "仅在签证签发后出现不可抗力、人道主义原因或重大突发个人/职业事由时，法国省政府方可延期C类签证——旅游需要一律不予受理，且申根区累计停留不得超过90天。EES 现已自动记录每一次逾期，哪怕只有一天。",
  extension: [
    { icon: "extend", k: "延期", v: "仅限特殊情形", sub: "规费30欧元（≈ SGD 44）· 不可抗力或人道主义原因免费" },
    { icon: "alert", k: "逾期后果", v: "遣送 + 入境禁令", sub: "申根全区 IRTF 禁令 · EES 自动标记 · 严重影响未来签证及 ETIAS 申请" },
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
        initials: "MC",
        name: "陈美琪",
        source: "Trustpilot · 5天前",
        title: "第一次申请申根签证，全程无压力",
        body: "自己弄的时候材料清单看得头疼。VIZA 的顾问在提交前发现了保险上的两个问题，最后签证顺利下来了。",
      },
      {
        initials: "RT",
        name: "谭瑞轩",
        source: "App Store · 2周前",
        title: "预约提醒太贴心了",
        body: "每个环节都收到通知——预约确认、材料递交、领取提醒。全程不需要自己去催领事馆。",
      },
    ],
  },

  faqSub:
    "没找到答案？可在页面底部向 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "新加坡护照去法国需要签证吗？",
      a: "不需要。新加坡护照免签进入法国及整个申根区——任意180天内最长停留90天，可旅游、探亲或商务，无签证、无费用。自2026年4月10日起，首次入境时需在 EES 登记（照片+指纹）；ETIAS 启用后（预计2026年第四季度），需办理20欧元（≈ SGD 29）的旅行许可，有效期3年。VIZA 持续跟踪政策变化，确保您出行不踩坑。",
    },
    {
      category: "基本信息",
      q: "中国大陆护照需要签证吗？",
      a: "需要，且无免签待遇——须办理C类申根签证：先在 France-Visas 官网申请，再到中国大陆的 TLScontact（中智签证）中心递交；合法居住在新加坡的中国公民可经 VFS Global 新加坡中心申请。好消息是：2024年法国对中国申请人的批准率约93.9%，且信誉良好的常旅客常获1至5年多次往返签证。工作、收入及约束力材料是成败关键，VIZA 为您专业备齐。",
    },
    {
      category: "基本信息",
      q: "持法国签证可以前往其他申根国家吗？",
      a: "可以。法国签发的C类签证在批准的效期及入境次数内适用于全部29个申根国。申请时法国须为您的主要目的地或首个入境国，且90/180天规则合并计算所有申根国家的停留天数。",
    },
    {
      category: "申请流程",
      q: "签证费用是多少？",
      a: "政府签证费为成人90欧元（≈ SGD 131），6至11岁儿童45欧元（≈ SGD 66），6岁以下免费——2024年6月11日起欧盟统一费率，拒签不退。签证中心（VFS Global 或 TLScontact）另收约30至40欧元的服务费。",
    },
    {
      category: "申请流程",
      q: "审理需要多久？应该提前多久申请？",
      a: "欧盟签证法规定标准审理为15个自然日，复杂个案可延至45天。最早可在出行前6个月申请，最迟须在出行前15天递交。中国大陆旺季建议预留30至45天。我们建议提前4至6周申请，以留足预约时间。",
    },
    {
      category: "申请流程",
      q: "必须本人前往预约吗？",
      a: "是的。指纹采集及纸质材料须本人递交——新加坡在 VFS Global（180 Clemenceau Avenue，Haw Par Centre），中国大陆在各 TLScontact 中心。指纹录入后59个月内可复用，期间再次申请或可免于到场。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "签证申请被拒怎么办？",
      a: "领事馆将出具注明拒签理由的通知书；按法国规定，递交后2个月无答复亦视为默示拒签。90欧元政府费不予退还。VIZA 服务费全额退款，顾问会分析拒签理由、重新完善材料后协助您再次申请或提出申诉。",
    },
  ],

  sources: [
    { label: "France-Visas — 法国政府官方签证门户", url: "https://www.france-visas.gouv.fr/en/visa-de-court-sejour", display: "france-visas.gouv.fr" },
    { label: "France-Visas — 官方签证收费标准", url: "https://france-visas.gouv.fr/documents/d/france-visas/frais-de-visa-anglais", display: "france-visas.gouv.fr" },
    { label: "Service-Public.fr — 申根短期签证规定", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F16146?lang=en", display: "service-public.gouv.fr" },
    { label: "法国外交部 — EES 出入境系统", url: "https://www.diplomatie.gouv.fr/en/services-to-foreigners/visiting-france/ees-the-new-european-border-entryexit-system-goes-live-on-10-april-2026", display: "diplomatie.gouv.fr" },
    { label: "欧盟 — ETIAS 官方信息网站", url: "https://travel-europe.europa.eu/etias", display: "travel-europe.europa.eu" },
    { label: "VFS Global — 新加坡法国签证申请", url: "https://visa.vfsglobal.com/sgp/en/fra", display: "visa.vfsglobal.com" },
    { label: "新加坡外交部 — 法国旅行信息", url: "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/france/", display: "mfa.gov.sg" },
  ],

  price: {
    etaLabel: "立即申请，预计领取时间",
    etaValue: "2026年6月26日 下午3:00",
    title: "申根签证（C类）· 停留90天",
    saving: "含完整材料审核服务",
    sub: "全包价，含材料审核、France-Visas 表格代填及准时保障。",
    foot: "政府签证费（90欧元 ≈ SGD 131）在结账时收取并缴纳至领事馆；签证中心服务费于预约现场另行支付。VIZA 服务费涵盖材料准备、审核及预约支持。",
  },

  aiPlaceholder: "关于法国申根签证有任何问题尽管问——费用、材料、90/180天规则……",
};

export default france;
