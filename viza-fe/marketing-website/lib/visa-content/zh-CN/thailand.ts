import type { VisaContent } from "../types";

/**
 * 泰国电子签证（旅游签 TR）内容 — 简体中文翻译。
 * 原文：lib/visa-content/thailand.ts（最后核实：2026-06-10）。
 * 签证具体信息（费用、有效期、所需材料、拒签原因、入境条件）须由运营/法务
 * 对照官方泰国电子签证门户（thaievisa.go.th）审核后方可发布。
 */
export const thailand: VisaContent = {
  slug: "thailand",

  heroTitle: "泰国电子签证",
  lede: "通过泰国电子签证门户颁发的官方旅游签证（TR），允许停留60天，并可在境内申请一次30天延期。",
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
    { icon: "currency", k: "货币", v: "泰铢（THB）", sub: "出行前请查询实时汇率" },
    { icon: "pin", k: "热门目的地", v: "曼谷 · 普吉岛 · 清迈", sub: "另有苏梅岛、甲米、清莱" },
  ],

  processTitle: "泰国电子签证办理流程",
  processSub:
    "一次提交，全程代办。我们与泰国皇家大使馆电子签证系统对接，签发即刻通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、照片、资金证明及出行日期。仅需预付政府领事费——VIZA 服务费在签证获批后收取。",
    },
    {
      title: "材料核验",
      body: "您的 VIZA 顾问将逐一核查所有字段和附件，随后直接提交至泰国电子签证门户。",
    },
    {
      title: "电子签证处理中",
      body: "我们全程监控泰国皇家领事馆系统的每项更新，及时发现并处理任何可能延误行程的问题。",
      statusRows: [
        { label: "申请已提交至电子签证门户", ts: "6月14日 上午 8:30", onTime: true },
        { label: "材料已转交领事官员", ts: "6月14日 上午 11:00", onTime: true },
        { label: "等待领事审批", ts: "处理中" },
      ],
    },
    {
      title: "于6月17日下午3:00获取电子签证",
      body: "签证标签 PDF 将发送至您的邮箱及 VIZA 应用。请打印或保存——泰国移民局将在入境时查验。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "您的 VIZA 顾问在提交前逐一核对每份材料。补传次数不限，免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期6个月以上 · 扫描清晰" },
    { name: "近期照片", sub: "纯白或浅色背景 · 6个月内拍摄" },
    { name: "回程或后续行程机票", sub: "离境日期须在60天停留期内" },
    { name: "银行流水或资金证明", sub: "最低2万泰铢（或等值外币）· 近3个月流水" },
  ],

  rejectionTitle: "泰国电子签证常见拒签原因",
  rejectionSub:
    "泰国皇家领事馆在审核时会重点关注以下问题。VIZA 在提交前审核您的申请，提前拦截风险。",
  rejectionReasons: [
    {
      title: "资金证明不足",
      body: "申请人须证明有足够资金覆盖整个停留期费用。银行流水不足或缺失是最常见的拒签原因。",
    },
    {
      title: "材料不完整或不清晰",
      body: "护照扫描模糊、照片不符合规格或缺少辅助材料，将导致申请被自动扣留或拒绝。",
    },
    {
      title: "曾有逾期居留或移民违规记录",
      body: "曾在泰国逾期居留或违反入境条件的记录，可能导致未来申请被拒。",
    },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "请随身携带电子签证标签、有效回程机票及住宿或资金证明，并须从官方口岸入境。",
  entryExit: [
    { icon: "refresh", k: "入境方式", v: "单次", sub: "再次入境须重新申请签证" },
    { icon: "clock", k: "激活期限", v: "3个月", sub: "自签证签发日起计算——请在此期限内入境" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "旅游签证可在任一泰国移民局办理一次30天延期。逾期居留将被处以罚款，并留下可能影响未来申请的记录。",
  extension: [
    { icon: "extend", k: "延期", v: "+30天", sub: "一次性，在泰国移民局办理" },
    { icon: "alert", k: "逾期罚款", v: "500泰铢/天", sub: "最高累计至20,000泰铢" },
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
      a: "旅游签证（TR）是由泰国皇家大使馆及领事馆通过 thaievisa.go.th 门户颁发的官方签证，自签发之日起3个月内有效，允许以旅游、休闲、探亲或就医为目的停留60天（从入境日起算）。",
    },
    {
      category: "基本信息",
      q: "持旅游电子签证可以工作或学习吗？",
      a: "不可以。旅游签证（TR）不允许就业、收费活动或正式学习。工作、留学和退休均有对应的非移民签证类别。",
    },
    {
      category: "申请流程",
      q: "通过 VIZA 申请泰国电子签证需要多长时间？",
      a: "通过 VIZA 申请，大多数电子签证在2–4个工作日内获批，与领事馆处理时限保持一致。我们以准时保障为承诺——如有延误，全额退款。",
    },
    {
      category: "申请流程",
      q: "可以为全家同时申请吗？",
      a: "可以。在 VIZA 申请中添加每位旅行者——顾问将作为团体统一提交，确保所有人同步处理。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "泰国电子签证被拒后怎么办？",
      a: "泰国政府将保留领事费。VIZA 服务费将全额退还。顾问将审查拒签通知并提供重新申请或其他签证途径的建议。",
    },
  ],

  sources: [
    {
      label: "泰国官方电子签证门户",
      url: "https://www.thaievisa.go.th/tourist-visa",
      display: "thaievisa.go.th",
    },
    {
      label: "泰国外交部——签证问答",
      url: "https://www.mfa.go.th/en/publicservice/questions-answers-on-thai-visa?cate=5d5bcb4e15e39c30600068d3",
      display: "mfa.go.th",
    },
    {
      label: "泰国移民局",
      url: "https://www.immigration.go.th/",
      display: "immigration.go.th",
    },
  ],

  price: {
    etaLabel: "立即申请，预计到达时间",
    etaValue: "2026年6月17日 下午3:00",
    title: "电子签证（TR）· 60天停留",
    saving: "比直接申请更快",
    sub: "含领事费、材料审核及准时保障，一价全包。",
    foot: "领事费与 VIZA 服务费在结账时一并收取，并享有准时保障。",
  },

  aiPlaceholder: "关于泰国签证，您有任何问题都可以问我——资质、延期、所需材料……",
};

export default thailand;
