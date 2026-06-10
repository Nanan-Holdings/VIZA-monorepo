import type { VisaContent } from "../types";

/**
 * 土耳其电子签证内容 — 简体中文翻译。
 * 原文：lib/visa-content/turkiye.ts（最后核实：2026-06-10）。
 * 签证具体信息（费用、有效期、所需材料、拒签原因、入境条件）须由运营/法务
 * 对照官方电子签证门户（evisa.gov.tr）审核后方可发布。
 */
export const turkiye: VisaContent = {
  slug: "turkiye",

  heroTitle: "土耳其电子签证",
  lede: "由土耳其共和国颁发的官方电子签证，自签发之日起有效期180天，适用于旅游、过境及商务访问。",
  heroImage: "/assets/heroes/turkiye.jpg",
  meta: [
    { k: "签证类型", v: "电子签证（e-Visa）" },
    { k: "停留时长", v: "最长30天或90天" },
    { k: "有效期", v: "180天" },
    { k: "入境方式", v: "单次或多次" },
  ],
  tags: [
    { icon: "bolt", label: "快速审批" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "材料精简" },
  ],

  overviewTitle: "土耳其，概览",
  overviewSub:
    "跨越欧亚之桥——千年古迹、繁华集市、海滨度假胜地，以及举世闻名的美食文化。",
  glance: [
    { icon: "globe", k: "首都", v: "安卡拉", sub: "UTC+3（土耳其标准时间，不调整夏令时）" },
    { icon: "clock", k: "最佳旅行时间", v: "4月–6月 · 9月–10月", sub: "气候宜人，人流较少" },
    { icon: "currency", k: "货币", v: "土耳其里拉（TRY）", sub: "出行前请查询实时汇率" },
    { icon: "pin", k: "热门目的地", v: "伊斯坦布尔 · 卡帕多西亚 · 安塔利亚", sub: "另有以弗所、棉花堡、博德鲁姆" },
  ],

  processTitle: "土耳其电子签证办理流程",
  processSub:
    "一次提交，全程代办。我们与土耳其共和国电子签证门户对接，签发即刻通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片及出行日期。仅需预付政府签证费——VIZA 服务费在签证获批后收取。",
    },
    {
      title: "材料核验",
      body: "您的 VIZA 顾问将逐一核查国籍资质、护照有效期及所有必填项，随后直接提交至电子签证门户。",
    },
    {
      title: "电子签证处理中",
      body: "我们全程监控土耳其签证系统的每个环节，提前预警任何可能影响行程的延误。",
      statusRows: [
        { label: "申请已提交至电子签证门户", ts: "6月12日 上午 9:10", onTime: true },
        { label: "国籍资质已确认", ts: "6月12日 上午 9:45", onTime: true },
        { label: "等待最终签发", ts: "处理中" },
      ],
    },
    {
      title: "于6月13日上午10:00获取电子签证",
      body: "签证 PDF 将发送至您的邮箱及 VIZA 应用。请打印或保存——土耳其边检人员可能在入境时查验。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "您的 VIZA 顾问在提交前逐一核对每份材料。补传次数不限，免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期须超出预计停留结束日期6个月以上" },
    { name: "近期照片", sub: "浅色纯色背景 · 6个月内拍摄" },
    { name: "回程或后续行程机票", sub: "离境日期须在批准停留期内" },
    { name: "住宿证明", sub: "酒店预订单或邀请函" },
  ],

  rejectionTitle: "土耳其电子签证常见拒签原因",
  rejectionSub:
    "电子签证系统会自动识别以下问题。VIZA 在提交前审核您的申请，提前拦截风险。",
  rejectionReasons: [
    {
      title: "国籍不符合资质",
      body: "土耳其电子签证仅向特定国家公民开放。不符合资质的国籍须通过领事馆申请签证。",
    },
    {
      title: "护照有效期不足",
      body: "护照有效期须远超预计离境日期。具体要求因国籍而异。",
    },
    {
      title: "曾有移民违规记录",
      body: "曾在土耳其或申根区有逾期居留、被驱逐出境或被禁止入境的记录，可能导致自动拒签。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "请随身携带电子签证 PDF、有效回程机票及住宿证明，并严格遵守边检盖章所注明的允许停留期限。",
  entryExit: [
    { icon: "refresh", k: "入境方式", v: "单次或多次", sub: "取决于国籍——请查阅您的电子签证文件" },
    { icon: "clock", k: "激活期限", v: "180天", sub: "自电子签证签发日起计算" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "境内延期可通过当地省级移民管理局申请。逾期居留将受到严肃处理，并可能影响未来入境土耳其。",
  extension: [
    { icon: "extend", k: "延期", v: "可在境内办理", sub: "前往省级移民管理局申请" },
    { icon: "alert", k: "逾期处罚", v: "罚款 + 驱逐出境风险", sub: "可能被禁止未来入境土耳其" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "深受数千名旅客信赖 · 9,204 条评价",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.5", name: "App Store" },
    ],
    items: [
      {
        initials: "LX",
        name: "林晓燕",
        source: "Trustpilot · 2天前",
        title: "一夜之间搞定伊斯坦布尔行程",
        body: "傍晚提交申请，第二天早上电子签证 PDF 就到了。顾问还主动发现我的照片背景略有偏差并帮我修正，无需我额外操作。",
      },
      {
        initials: "WH",
        name: "王浩然",
        source: "App Store · 5天前",
        title: "简单省心，毫无压力",
        body: "以前都自己申请土耳其电子签证，这次用 VIZA 顺畅太多了。实时状态更新加上专属顾问答疑，物超所值。",
      },
    ],
  },

  faqSub:
    "没找到答案？可向页面底部的 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "土耳其电子签证是什么？",
      a: "土耳其电子签证是由土耳其共和国外交部颁发的官方电子旅行授权，允许符合条件的国家公民以旅游、过境或商务目的入境土耳其，无需前往领事馆办理。",
    },
    {
      category: "基本信息",
      q: "电子签证可用于商务出行吗？",
      a: "可以——电子签证适用于旅游、家庭探访、过境及短期商务会议。但不允许受薪就业或长期商业活动，此类情况需申请单独的工作签证。",
    },
    {
      category: "申请流程",
      q: "通过 VIZA 多快能收到电子签证？",
      a: "通过 VIZA 申请，大多数签证在24小时内获批。官方门户在旺季可能需要更长时间。我们以准时保障为承诺——如有延误，全额退款。",
    },
    {
      category: "申请流程",
      q: "可以为多名旅行者同时申请吗？",
      a: "可以。在 VIZA 申请中添加每位旅行者——顾问将统一提交，确保所有人同步处理。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "电子签证申请被拒后怎么办？",
      a: "土耳其政府将保留申请费。VIZA 服务费将全额退还，顾问将审查拒签原因并提供后续建议或领事馆申请途径。",
    },
  ],

  sources: [
    {
      label: "土耳其共和国电子签证门户",
      url: "https://www.evisa.gov.tr/",
      display: "evisa.gov.tr",
    },
    {
      label: "土耳其共和国外交部",
      url: "https://www.mfa.gov.tr/",
      display: "mfa.gov.tr",
    },
  ],

  price: {
    etaLabel: "立即申请，预计到达时间",
    etaValue: "2026年6月13日 上午10:00",
    title: "电子签证 · 土耳其",
    saving: "比直接申请更快",
    sub: "含政府签证费、材料审核及准时保障，一价全包。",
    foot: "政府签证费与 VIZA 服务费在结账时一并收取，并享有准时保障。",
  },

  aiPlaceholder: "关于土耳其签证，您有任何问题都可以问我——资质、办理进度、入境规定……",
};

export default turkiye;
