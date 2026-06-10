// zh-CN 简体中文翻译 — 日本签证内容
// 注意：签证费用、材料要求及适用国籍等具体信息，发布前须由运营/法务团队核实。
// 英文原文见 ../japan.ts

import type { VisaContent } from "../types";

export const japan: VisaContent = {
  slug: "japan",

  heroTitle: "日本旅游签证",
  lede: "日本单次短期停留签证，最长可在日本停留90天。符合资格的申请人现可通过日本电子签（eVISA）在线申请，全程由您的VIZA顾问专业管理。",
  heroImage: "/assets/heroes/japan.jpg",
  meta: [
    { k: "签证类型", v: "旅游签证" },
    { k: "停留时长", v: "最长90天" },
    { k: "有效期", v: "90天" },
    { k: "入境次数", v: "单次" },
  ],
  tags: [
    { icon: "bolt", label: "快速通道" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "专家文件审核" },
  ],

  overviewTitle: "日本，一览无余",
  overviewSub:
    "日本短期签证适用于旅游观光、探亲访友、文化交流及短期商务出行，是全球最受欢迎的旅游目的地之一。",
  glance: [
    { icon: "globe", k: "首都", v: "东京", sub: "UTC +9（日本标准时间）" },
    { icon: "clock", k: "最佳旅行时间", v: "3月–5月 · 10月–11月", sub: "赏樱花与秋叶" },
    { icon: "currency", k: "货币", v: "日元（JPY）", sub: "普遍偏好现金支付" },
    { icon: "pin", k: "热门目的地", v: "东京 · 京都 · 大阪", sub: "以及广岛、奈良、北海道" },
  ],

  processTitle: "日本签证申请流程",
  processSub:
    "一次性提交材料，VIZA顾问全程负责准备、递交及实时跟踪大使馆各环节进展。",
  steps: [
    {
      title: "在VIZA提交申请",
      body: "上传护照、照片、行程单及相关辅助材料，告知出发日期，我们将为您制定时间计划。",
    },
    {
      title: "材料审核与递交",
      body: "您的VIZA顾问逐项核对日本使馆清单上的每一项要求，确认无误后代您提交完整申请包。",
    },
    {
      title: "使馆签证处理",
      body: "我们全程跟踪申请在领事馆各审核阶段的进展，如有补件要求即时通知您。",
      statusRows: [
        { label: "申请已递交至日本领事馆", ts: "6月12日 上午9:00", onTime: true },
        { label: "材料已受理 — 审核中", ts: "6月12日 上午11:30", onTime: true },
        { label: "等待领事馆最终审批", ts: "处理中" },
      ],
    },
    {
      title: "6月17日下午2:00 签证送达",
      body: "贴有签证贴纸的护照（或符合资格国籍的eVISA PDF文件）将通过快递退还或供本人自取，全程由顾问指引。",
      delivered: true,
    },
  ],

  docsTitle: "所需申请材料",
  docsSub:
    "VIZA顾问在递交前审核每一份材料。补传文件次数不限，完全免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期须超过预计抵日日期至少6个月 · 清晰无遮挡扫描件" },
    { name: "近期证件照", sub: "45×45毫米 · 纯白色背景 · 6个月内拍摄" },
    { name: "行程单", sub: "已确认或预订中的机票信息" },
    { name: "住宿证明", sub: "酒店预订确认单或邀请函" },
  ],

  rejectionTitle: "日本签证常见被拒原因",
  rejectionSub:
    "日本领事馆对每份申请均进行严格审核。VIZA会在您递交前提前识别以下常见风险点。",
  rejectionReasons: [
    { title: "与本国联系不足", body: "申请材料未能证明申请人在本国有稳定的工作、家庭或房产等联系，令人怀疑有意图超期居留，此类申请常遭拒签。" },
    { title: "材料不完整或前后矛盾", body: "行程信息缺失、姓名不一致，或财务证明不清晰，是直接拒签的主要原因。" },
    { title: "曾有移民违规记录", body: "曾在日本或其他国家有超期居留、违反签证规定或被驱逐出境的记录，均可能导致拒签。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "请随身携带签证及护照。日本移民局在入境时会核验生物特征信息，请确保所有信息与申请资料完全一致。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次", sub: "再次入境需重新申请签证" },
    { icon: "clock", k: "使用期限", v: "90天", sub: "自签证签发日期起计算" },
  ],

  extensionTitle: "签证延期与超期居留",
  extensionSub:
    "旅游短期签证通常无法在日本境内办理延期。超期居留将受到严厉处罚：被驱逐出境并被禁止再次入境1至5年（多次违规最高10年），具体视情节而定。",
  extension: [
    { icon: "extend", k: "延期", v: "不可延期", sub: "旅游签证不可在境内延期" },
    { icon: "alert", k: "超期处罚", v: "驱逐出境 + 禁止入境", sub: "禁止再次入境1–5年（多次违规最高10年）" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "全球旅行者的信赖之选 · 14,203条评价",
    platforms: [
      { rating: "4.7", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "LX",
        name: "李晓梅",
        source: "Trustpilot · 5天前",
        title: "一次通过，顺利拿到日本签证",
        body: "材料清单非常清楚，顾问还发现我的证件照尺寸不符合45毫米规格。最终4个工作日就获批了。",
      },
      {
        initials: "ZW",
        name: "张伟杰",
        source: "App Store · 2周前",
        title: "行程准备毫无压力",
        body: "我完全不知道需要提供详细的每日行程，VIZA提供了模板并在递交前帮我审核了一遍，整个过程非常顺畅。",
      },
    ],
  },

  faqSub:
    "没有找到您需要的答案？请使用下方AI助手提问，或直接联系您的VIZA顾问。",
  faq: [
    {
      category: "基本信息",
      q: "日本短期旅游签证是什么？",
      a: "日本短期旅游签证是由日本驻外使领馆签发的单次入境签证，允许持证人在日本境内停留最长90天，适用于旅游观光、探亲访友或短期商务出行。符合资格的国籍可通过日本eVISA系统（evisa.mofa.go.jp）在线申请。",
    },
    {
      category: "基本信息",
      q: "旅游签证可以用于商务会议吗？",
      a: "可以。参加会议、考察洽谈或参展活动均在短期签证允许范围内。但持证人在日本境内不可从日本企业领取薪酬或任何形式的报酬。",
    },
    {
      category: "申请流程",
      q: "日本签证需要多长时间处理？",
      a: "完整申请材料递交后，领事馆通常需要5至7个工作日处理。VIZA提交的申请材料完整充分，可最大程度减少补件往返，确保申请按时推进。",
    },
    {
      category: "申请流程",
      q: "家庭成员可以一起申请吗？",
      a: "可以。每位家庭成员须单独申请签证，但您的VIZA顾问会将申请作为关联组合一并提交，以确保批准结果在同一时间线内。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "申请被拒后怎么办？",
      a: "日本使馆不公开具体拒签原因。VIZA将对您的申请材料进行分析，提供加强本国联系证明的建议，并在满足所需等待期后协助您重新申请。",
    },
  ],

  sources: [
    { label: "日本外务省 — 签证信息", url: "https://www.mofa.go.jp/j_info/visit/visa/", display: "mofa.go.jp" },
    { label: "日本eVISA官方申请门户（外务省）", url: "https://www.evisa.mofa.go.jp/message", display: "evisa.mofa.go.jp" },
    { label: "出入国在留管理厅 — 入境/居留手续", url: "https://www.moj.go.jp/isa/", display: "moj.go.jp" },
  ],

  price: {
    etaLabel: "立即申请，预计送达",
    etaValue: "2026年6月17日 下午2:00",
    title: "日本旅游签证 · 最长90天停留",
    saving: "比直接申请更高效",
    sub: "全包服务，含材料审核、申请准备及准时保障。",
    foot: "领事馆签证费与VIZA服务费在结账时统一收取，并享有准时保障。",
  },

  aiPlaceholder: "请随时提问关于日本签证的任何问题——材料要求、处理时长、eVISA资格……",
};

export default japan;
