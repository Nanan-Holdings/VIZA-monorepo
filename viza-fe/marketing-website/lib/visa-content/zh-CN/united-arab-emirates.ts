import type { VisaContent } from "../types";

/**
 * 阿拉伯联合酋长国电子签证内容 — 简体中文翻译。
 * 原文：lib/visa-content/united-arab-emirates.ts（最后核实：2026-06-10）。
 * 签证具体信息（费用、有效期、所需材料、拒签原因、入境条件）须由运营/法务
 * 对照官方 ICP 门户（icp.gov.ae）及迪拜 GDRFA（gdrfad.gov.ae）审核后方可发布。
 */
export const unitedArabEmirates: VisaContent = {
  slug: "united-arab-emirates",

  heroTitle: "阿联酋电子签证",
  lede: "用于旅游和短期访问的官方阿联酋电子签证，允许停留30天或60天，并可申请延期。出行前在线办理，无需前往大使馆。",
  heroImage: "/assets/heroes/united-arab-emirates.jpg",
  meta: [
    { k: "签证类型", v: "电子签证（旅游）" },
    { k: "停留时长", v: "30天或60天" },
    { k: "有效期", v: "自签发之日起约58天" },
    { k: "入境方式", v: "单次或多次" },
  ],
  tags: [
    { icon: "bolt", label: "快速审批" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "材料精简" },
  ],

  overviewTitle: "阿拉伯联合酋长国，概览",
  overviewSub:
    "未来感十足的天际线、广袤金色沙漠、奢华购物体验与全年明媚阳光——阿联酋是连接东西方的枢纽目的地。",
  glance: [
    { icon: "globe", k: "首都", v: "阿布扎比", sub: "UTC+4（海湾标准时间，不调整夏令时）" },
    { icon: "clock", k: "最佳旅行时间", v: "10月–4月", sub: "气温凉爽，适合户外活动" },
    { icon: "currency", k: "货币", v: "阿联酋迪拉姆（AED）", sub: "自1997年起与美元挂钩" },
    { icon: "pin", k: "热门目的地", v: "迪拜 · 阿布扎比 · 沙迦", sub: "另有哈伊马角、富查伊拉" },
  ],

  processTitle: "阿联酋电子签证办理流程",
  processSub:
    "一次提交，全程代办。我们与阿联酋联邦身份与公民事务局（ICP）门户对接，签发即刻通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片及出行信息。仅需预付政府签证费——VIZA 服务费在签证获批后收取。",
    },
    {
      title: "材料核验",
      body: "您的 VIZA 顾问将核查国籍资质、护照扫描质量及所有必填项，随后直接提交至 ICP 门户。",
    },
    {
      title: "电子签证处理中",
      body: "我们全程监控阿联酋签证系统的每个阶段，及时标记任何延误，让您随时掌握进展。",
      statusRows: [
        { label: "申请已提交至 ICP 门户", ts: "6月15日 上午 10:00", onTime: true },
        { label: "身份及旅行证件已核验", ts: "6月15日 下午 1:30", onTime: true },
        { label: "等待电子签证最终签发", ts: "处理中" },
      ],
    },
    {
      title: "于6月18日中午12:00获取电子签证",
      body: "签证 PDF 将发送至您的邮箱及 VIZA 应用。请打印或保存——阿联酋移民局将在入境时扫描查验。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "您的 VIZA 顾问在提交前逐一核对每份材料。补传次数不限，免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期须超出停留结束日期6个月以上 · 扫描清晰" },
    { name: "近期照片", sub: "纯白背景 · 6个月内拍摄" },
    { name: "回程或后续行程机票", sub: "离境日期须在批准停留期内" },
    { name: "住宿证明", sub: "酒店确认函或邀请函" },
  ],

  rejectionTitle: "阿联酋电子签证常见拒签原因",
  rejectionSub:
    "ICP 系统会自动核查以下问题。VIZA 在提交前审核您的申请，提前拦截风险。",
  rejectionReasons: [
    {
      title: "护照扫描不完整或不清晰",
      body: "阿联酋系统要求提供完整清晰、无裁剪的个人信息页扫描件。模糊或部分遮挡的扫描件将被自动拒绝。",
    },
    {
      title: "安全或刑事记录标记",
      body: "有高风险出行记录、特定刑事定罪或在阿联酋被禁止入境的申请人，不符合电子签证申请资质。",
    },
    {
      title: "曾有移民违规记录",
      body: "曾逾期居留阿联酋签证或违反入境条件，将留下可能阻碍未来申请的记录。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "请随身携带电子签证 PDF 及有效回程机票。请严格遵守允许停留期限——阿联酋移民局会密切追踪离境日期。",
  entryExit: [
    { icon: "refresh", k: "入境方式", v: "单次或多次", sub: "取决于申请时所选签证类别" },
    { icon: "clock", k: "激活期限", v: "约58天", sub: "自电子签证签发日起计算——请在此期限前入境" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "旅游电子签证可在到期前通过 ICP 门户或迪拜 GDRFA 在线申请延期，延期时长与原签证一致。逾期居留将触发每日罚款，并有可能在出境时被列入旅行禁令。",
  extension: [
    { icon: "extend", k: "延期", v: "可在线办理", sub: "在到期前通过 ICP 门户或 GDRFA 申请——延期时长与原签证一致" },
    { icon: "alert", k: "逾期罚款", v: "50迪拉姆/天", sub: "出境时还面临被禁止入境的风险" },
  ],

  reviews: {
    score: "4.7",
    outOf: "/ 5",
    sub: "深受数千名旅客信赖 · 8,932 条评价",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.8", name: "App Store" },
    ],
    items: [
      {
        initials: "MQ",
        name: "孟庆华",
        source: "Trustpilot · 3天前",
        title: "不到3天拿到迪拜签证",
        body: "第一次申请阿联酋签证，对照片规格有些担心。顾问在提交前发现背景颜色问题并帮我处理好了，全程毫无压力。",
      },
      {
        initials: "SL",
        name: "苏丽萍",
        source: "App Store · 6天前",
        title: "实时状态更新让我安心不少",
        body: "全程实时看着申请走完每个环节，签证签发的瞬间就知道了——不用反复刷邮件。以后申请签证只用这个。",
      },
    ],
  },

  faqSub:
    "没找到答案？可向页面底部的 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "阿联酋旅游电子签证是什么？",
      a: "阿联酋旅游电子签证是由联邦身份、公民、海关与港口安全局（ICP）颁发的官方电子授权，允许符合条件的旅行者以旅游、休闲、家庭探访或过境为目的入境阿联酋，无需前往大使馆。",
    },
    {
      category: "基本信息",
      q: "持一张电子签证可以游览全部七个酋长国吗？",
      a: "可以。阿联酋电子签证在全部七个酋长国通用——迪拜、阿布扎比、沙迦、阿治曼、哈伊马角、富查伊拉及乌姆盖万，酋长国之间无边境检查。",
    },
    {
      category: "申请流程",
      q: "通过 VIZA 多快能收到阿联酋电子签证？",
      a: "通过 VIZA 申请，大多数签证在2–4个工作日内获批。简单案例处理速度可能更快。我们以准时保障为承诺——如有延误，全额退款。",
    },
    {
      category: "申请流程",
      q: "可以为多名家庭成员同时申请吗？",
      a: "可以。在 VIZA 申请中添加每位旅行者——顾问将统一提交，确保所有人同步处理，并以匹配的签证一同抵达。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "阿联酋电子签证被拒后怎么办？",
      a: "阿联酋政府将保留申请费。VIZA 服务费将全额退还。顾问将审查拒签原因——通常为材料问题——并提供重新申请或其他入境方式的建议。",
    },
  ],

  sources: [
    {
      label: "阿联酋联邦身份、公民、海关与港口安全局（ICP）",
      url: "https://icp.gov.ae/en/services-details/?serviceid=64afe3c1035448005bd52e60",
      display: "icp.gov.ae",
    },
    {
      label: "迪拜居留与外国人事务总局（GDRFA）",
      url: "https://www.gdrfad.gov.ae/en/services/f9e586fe-0642-11ec-0320-0050569629e8",
      display: "gdrfad.gov.ae",
    },
    {
      label: "阿联酋官方政府门户——旅游签证",
      url: "https://u.ae/en/information-and-services/visa-and-emirates-id/tourist-visa",
      display: "u.ae",
    },
  ],

  price: {
    etaLabel: "立即申请，预计到达时间",
    etaValue: "2026年6月18日 中午12:00",
    title: "电子签证 · 阿联酋旅游",
    saving: "比直接申请更快",
    sub: "含政府签证费、材料审核及准时保障，一价全包。",
    foot: "政府签证费与 VIZA 服务费在结账时一并收取，并享有准时保障。",
  },

  aiPlaceholder: "关于阿联酋签证，您有任何问题都可以问我——入境规定、延期、符合条件的国籍……",
};

export default unitedArabEmirates;
