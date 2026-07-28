import type { VisaContent } from "../types";

/**
 * VIZA 测试结账 — 简体中文版本。
 * 免费的真实流程演示：与英文源文件（../viza-test.ts）保持同步。
 * 这不是签证产品 — 文案须如实说明这是演示，不虚构任何政府信息。
 */
export const vizaTest: VisaContent = {
  slug: "viza-test",

  heroTitle: "VIZA 测试结账",
  heroTitleSuffix: "免费体验真实申请流程",
  lede: "完整走一遍我们处理真实签证的申请体验 — 材料上传、顾问审核、实时进度追踪 — 完全免费，最终不会签发任何签证。",
  heroImage: "/assets/heroes/japan.jpg",
  meta: [
    { k: "类型", v: "演示" },
    { k: "耗时", v: "约 3 分钟" },
    { k: "有效期", v: "仅供演示" },
    { k: "费用", v: "免费" },
  ],
  tags: [
    { icon: "bolt", label: "即时体验 · 无需等待" },
    { icon: "shield", label: "全程免费，绝不收费" },
    { icon: "doc", label: "无需真实材料" },
  ],

  overviewTitle: "测试流程，一览",
  overviewSub:
    "一切都和真实申请一样 — 表单、追踪、通知 — 只是不会提交任何申请，也不会产生任何费用。",
  glance: [
    { icon: "globe", k: "这是什么", v: "产品实景演示", sub: "与真实申请人使用的页面完全相同" },
    { icon: "clock", k: "完成时间", v: "约 3 分钟", sub: "从开始到结束" },
    { icon: "currency", k: "价格", v: "免费", sub: "无需绑定银行卡即可体验" },
    { icon: "pin", k: "你将获得", v: "对 VIZA 的直观了解", sub: "在申请真实签证之前" },
  ],

  processTitle: "测试流程如何进行",
  processSub:
    "与真实申请相同的四个步骤 — 压缩到几分钟内，让你看到每个阶段。",
  steps: [
    {
      title: "开始测试申请",
      body: "填写与真实申请人相同的向导表单。可使用示例信息 — 任何内容都不会发送给任何政府系统。",
    },
    {
      title: "查看审核阶段",
      body: "了解 VIZA 顾问将如何在提交前核对你的材料并标记问题。",
    },
    {
      title: "跟随实时进度",
      body: "状态时间线会像真实申请一样更新，让你了解真实订单中的体验。",
      statusRows: [
        { label: "已收到测试申请", ts: "刚刚", onTime: true },
        { label: "演示审核已完成", ts: "片刻之后", onTime: true },
        { label: "演示交付", ts: "进行中" },
      ],
    },
    {
      title: "完成 — 不签发任何文件，不收取任何费用",
      body: "你会到达与真实订单相同的交付页面。准备好后，选择一个真实目的地，开始正式申请。",
      delivered: true,
    },
  ],

  docsTitle: "你需要准备什么",
  docsSub: "无需任何真实材料。测试流程接受示例上传，让你体验每一步。",
  documents: [
    { name: "任意示例照片或 PDF", sub: "代替护照扫描件" },
    { name: "一个邮箱地址", sub: "用于查看你将收到的通知" },
  ],

  rejectionTitle: "测试流程做不到的事",
  rejectionSub: "几点如实说明，避免任何误解。",
  rejectionReasons: [
    { title: "不会签发签证", body: "演示不会向任何政府提交任何申请 — 它只用于向你展示产品体验。" },
    { title: "不会分配顾问", body: "审核阶段为模拟。真实订单中，将由一位具名的 VIZA 顾问核对每一项信息。" },
    { title: "演示数据不会保留", body: "测试运行中的示例上传和信息不会成为任何申请记录的一部分。" },
  ],

  entryTitle: "体验之后",
  entrySub:
    "看完整个流程后，选择一个真实目的地 — 你刚刚体验的申请向导就是正式申请所用的向导。",
  entryExit: [
    { icon: "refresh", k: "可重复体验", v: "不限次数", sub: "想运行几次都可以" },
    { icon: "clock", k: "准备正式申请？", v: "2 分钟", sub: "你的信息可直接用于正式申请" },
  ],

  extensionTitle: "开始真实申请",
  extensionSub:
    "真实申请只在你刚才看到的流程上增加两件事：一位真实顾问，和一次真实的政府递交 — 并附带准时出签保证。",
  extension: [
    { icon: "extend", k: "真实目的地", v: "17 个国家/地区", sub: "并持续增加" },
    { icon: "shield", k: "准时出签保证", v: "延误退款", sub: "若未在承诺日期前完成" },
  ],

  reviews: {
    score: "4.5",
    outOf: "/ 5",
    sub: "新加坡评分最高的签证平台 · 12,841 条评价",
    platforms: [
      { rating: "4.6", name: "Trustpilot" },
      { rating: "4.7", name: "App Store" },
    ],
    items: [
      {
        initials: "PL",
        name: "Priya Lim",
        source: "Trustpilot · 3 天前",
        title: "先试了演示，随后就正式下单",
        body: "午休时跑了一遍测试结账，想看看到底怎么回事。当晚就申请了巴厘岛电子落地签。",
      },
      {
        initials: "SK",
        name: "Samuel Koh",
        source: "App Store · 1 周前",
        title: "了解进度追踪的好方式",
        body: "实时状态时间线打动了我 — 每一步都看得到，不用反复刷新政府网站碰运气。",
      },
    ],
  },

  faqSub: "没有找到答案？询问页面底部的 AI 助手，或联系 VIZA 团队。",
  faq: [
    {
      category: "关于测试",
      q: "测试结账真的免费吗？",
      a: "是的 — 完全免费。它的存在就是为了让你在把真实签证交给我们之前，完整体验 VIZA 的申请流程。",
    },
    {
      category: "关于测试",
      q: "结束时我会得到什么吗？",
      a: "你会到达与真实申请人相同的交付页面，从而确切了解正式申请的体验。不会签发任何签证或文件 — 这是演示。",
    },
    {
      category: "关于测试",
      q: "我的示例数据会被保留吗？",
      a: "演示运行不属于任何申请记录。开始正式申请时，你将重新填写真实信息。",
    },
    {
      category: "正式申请",
      q: "之后如何申请真实签证？",
      a: "在探索页选择任意目的地 — 向导就是你刚刚用过的那个。正式申请包含具名顾问、真实的政府递交，以及我们的准时出签保证。",
    },
  ],

  sources: [
    { label: "VIZA 目的地", url: "/", display: "viza.it.com" },
    { label: "VIZA 如何审核申请", url: "/security", display: "viza.it.com/security" },
  ],

  price: {
    etaLabel: "现在开始，完成仅需",
    etaValue: "约 3 分钟",
    title: "测试结账 · 实景演示",
    saving: "免费",
    sub: "完整的申请体验，不收费、不递交任何申请。",
    foot: "测试流程完全免费。真实申请仅在其自身结账时收费，并附带准时出签保证。",
  },

  aiPlaceholder: "关于 VIZA 的任何问题都可以问 — 流程、追踪、价格…",
};

export default vizaTest;
