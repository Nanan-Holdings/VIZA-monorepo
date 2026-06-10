// zh-CN 简体中文翻译 — 美国签证内容
// 注意：签证费用、面试等待时间及适用国籍等具体信息，发布前须由运营/法务团队核实。
// 英文原文见 ../united-states.ts

import type { VisaContent } from "../types";

export const unitedStates: VisaContent = {
  slug: "united-states",

  heroTitle: "美国 B1/B2 访客签证",
  lede: "美国标准访客签证，适用于旅游观光、探亲访友及短期商务出行。大多数国籍最长有效期可达10年，可多次入境，每次最长停留6个月。VIZA全程指导DS-160表格填写及面试准备。",
  heroImage: "/assets/heroes/united-states.jpg",
  meta: [
    { k: "签证类型", v: "B1/B2" },
    { k: "停留时长", v: "最长6个月" },
    { k: "有效期", v: "最长10年（因国籍而异）" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "shield", label: "含面试辅导" },
    { icon: "doc", label: "DS-160审核" },
    { icon: "bolt", label: "优先预约" },
  ],

  overviewTitle: "美国，一览无余",
  overviewSub:
    "B1/B2签证涵盖旅游观光、探亲访友、就医治疗及短期商务活动，不包含工作许可。",
  glance: [
    { icon: "globe", k: "首都", v: "华盛顿特区", sub: "UTC −5至−10（因州而异）" },
    { icon: "clock", k: "最佳旅行时间", v: "5月–9月", sub: "因地区而异" },
    { icon: "currency", k: "货币", v: "美元（USD）", sub: "几乎全国均可刷卡消费" },
    { icon: "pin", k: "热门目的地", v: "纽约 · 洛杉矶 · 旧金山", sub: "以及芝加哥、拉斯维加斯、迈阿密、夏威夷" },
  ],

  processTitle: "B1/B2签证申请流程",
  processSub:
    "美国签证需完成DS-160在线申请并参加现场面试。VIZA负责准备全部表格，为您进行面试辅导，并全程跟踪预约进展。",
  steps: [
    {
      title: "在VIZA提交申请",
      body: "告知您的出行记录、工作情况及访美目的，我们将为您起草DS-160表格，并逐项核对领事馆指引要求。",
    },
    {
      title: "DS-160审核与递交",
      body: "您的VIZA顾问完成DS-160终审，代您缴纳MRV签证费，并为您预约距离最近的美国使馆或领事馆最早可用的面试名额。",
    },
    {
      title: "面试准备与进度跟踪",
      body: "我们将发送个性化面试辅导材料、高频问题集及材料清单。面试当天，顾问全程待命，随时解答临时问题。",
      statusRows: [
        { label: "DS-160已确认并完成面试预约", ts: "7月3日 上午10:15", onTime: true },
        { label: "面试辅导包已发送", ts: "7月3日 下午2:00", onTime: true },
        { label: "面试定于7月10日 — 准备中", ts: "处理中" },
      ],
    },
    {
      title: "7月14日 护照连同签证返还",
      body: "面试通过后，贴有B1/B2签证印章的护照将快递送回。VIZA顾问确认签收，并为您说明入境注意事项。",
      delivered: true,
    },
  ],

  docsTitle: "所需申请材料",
  docsSub:
    "面试前，VIZA顾问会逐项核查每份材料的完整性及一致性。补传文件次数不限，完全免费。",
  documents: [
    { name: "有效护照", sub: "有效期须超过预计赴美日期至少6个月 · 所有旧版护照" },
    { name: "DS-160确认页", sub: "打印或保存条形码页 · 通过ceac.state.gov完成填写" },
    { name: "财务证明", sub: "银行流水、工资单或担保函（最近3个月）" },
    { name: "与本国联系证明", sub: "工作证明、房产证明或家庭关系证明，以证明有意向回国" },
  ],

  rejectionTitle: "B1/B2签证常见被拒原因",
  rejectionSub:
    "美国领事官员默认申请人具有移民倾向。VIZA在面试前协助您针对以下风险点做好充分准备。",
  rejectionReasons: [
    { title: "未能证明非移民意图", body: "最常见的拒签依据（《移民与国籍法》第214(b)条）：签证官无法认定申请人有意图返回本国。稳定的工作、家庭及财务联系至关重要。" },
    { title: "DS-160填写错误或不完整", body: "表格中存在错误、遗漏，或与辅助材料前后矛盾，都会在面试中引起高度关注。VIZA的审核会在递交前发现并纠正这些问题。" },
    { title: "曾有美国签证违规或超期记录", body: "曾有超期居留、无合法授权工作，或在此前申请中提供虚假信息，可能导致多年禁入或永久取消资格。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "B1/B2签证印章并不保证入境。最终入境许可及授权停留时长由美国海关与边境保护局（CBP）在入境口岸决定。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "有效期最长10年（自签发日起，因国籍而异）" },
    { icon: "clock", k: "每次停留时长", v: "最长6个月", sub: "以CBP入境时授权为准" },
  ],

  extensionTitle: "签证延期与超期居留",
  extensionSub:
    "在I-94到期前，可向美国移民局（USCIS）申请延期停留。超期居留——哪怕仅一天——将带来严重的长期后果。",
  extension: [
    { icon: "extend", k: "延期", v: "向USCIS提交申请", sub: "在I-94到期前递交I-539表格" },
    { icon: "alert", k: "超期处罚", v: "签证作废 + 未来禁入", sub: "非法居留180天以上→禁入3年；1年以上→禁入10年" },
  ],

  reviews: {
    score: "4.7",
    outOf: "/ 5",
    sub: "全球旅行者的信赖之选 · 18,540条评价",
    platforms: [
      { rating: "4.8", name: "Trustpilot" },
      { rating: "4.6", name: "App Store" },
    ],
    items: [
      {
        initials: "CY",
        name: "陈雅婷",
        source: "Trustpilot · 1周前",
        title: "面试辅导是制胜关键",
        body: "我之前曾被拒签一次。VIZA的模拟面试题和DS-160审核让我信心大增——这次面试顺利通过了。",
      },
      {
        initials: "WH",
        name: "王浩然",
        source: "App Store · 3周前",
        title: "半天搞定DS-160",
        body: "表格看起来很复杂，但顾问手把手带我填写了每个部分。下周就拿到了面试预约。",
      },
    ],
  },

  faqSub:
    "没有找到您需要的答案？请使用下方AI助手提问，或直接联系您的VIZA顾问。",
  faq: [
    {
      category: "基本信息",
      q: "B1/B2访客签证是什么？",
      a: "B1/B2是美国非移民签证，适用于临时访问：B1涵盖商务活动（会议、谈判、参展等），B2涵盖旅游、休闲及探亲访友。大多数申请人获批的是B1/B2合并签证。此签证与ESTA电子旅行授权不同，ESTA仅适用于免签计划国家的公民。",
    },
    {
      category: "基本信息",
      q: "持B1/B2签证可以在美国工作吗？",
      a: "不可以。B1/B2签证不授权任何形式的就业或有偿工作。志愿者、实习生或任何接受美国雇主报酬的人员，须申请其他类别的签证。",
    },
    {
      category: "申请流程",
      q: "整个B1/B2申请流程需要多长时间？",
      a: "正确填写DS-160表格约需1至2小时。各使馆面试等待时间从数天到数周不等。面试通过后，护照通常在3至10个工作日内寄回。VIZA持续监控等待时间，为您预约最早可用名额。",
    },
    {
      category: "申请流程",
      q: "未成年人需要参加面试吗？",
      a: "自2025年9月起，美国国务院已取消基于年龄的面试豁免政策。所有首次申请B1/B2签证的人员——包括14岁以下儿童及79岁以上申请人——均须参加现场面试。特定续签情况下可能适用有限豁免（申请人年满18岁时持有的上一本签证在12个月内到期者）。VIZA将根据您所在使馆的具体规定，告知您是否符合续签豁免资格。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "面试被拒后怎么办？",
      a: "MRV申请费不予退还。签证官会告知拒签依据（通常为第214(b)条）。VIZA将对您的申请材料进行复盘，找出薄弱环节，协助您准备更充分的申请——大多数申请人可立即重新申请，除非被告知须等待一段时间。",
    },
  ],

  sources: [
    { label: "美国国务院 — 访客签证（B1/B2）", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html", display: "travel.state.gov" },
    { label: "DS-160在线非移民签证申请（CEAC）", url: "https://ceac.state.gov/genniv/", display: "ceac.state.gov" },
    { label: "USCIS — 非法居留与不可入境性", url: "https://www.uscis.gov/laws-and-policy/other-resources/unlawful-presence-and-inadmissibility", display: "uscis.gov" },
  ],

  price: {
    etaLabel: "目标面试日期",
    etaValue: "2026年7月10日 上午9:00",
    title: "美国 B1/B2 签证 · 最长10年有效期",
    saving: "含专家全程辅导",
    sub: "全包服务，含DS-160审核、面试辅导及准时保障。",
    foot: "MRV申请费与VIZA服务费在结账时统一收取。",
  },

  aiPlaceholder: "请随时提问关于美国B1/B2签证的任何问题——DS-160、面试、处理时长……",
};

export default unitedStates;
