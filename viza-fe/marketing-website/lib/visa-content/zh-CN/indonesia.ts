import type { VisaContent } from "../types";

/**
 * 印度尼西亚（巴厘岛）电子落地签证（e-VOA）— 简体中文版本。
 * zh-CN 翻译，签证具体信息（费用、有效期、材料清单、拒签原因）
 * 在发布前须由运营/法务人员对照官方来源进行核实。
 */
export const indonesia: VisaContent = {
  slug: "indonesia",

  heroTitle: "印度尼西亚（巴厘岛）电子落地签",
  heroTitleSuffix: "适用于新加坡护照持有人",
  lede: "单次入境电子落地签证，自签发之日起 90 天内有效，每次可停留 30 天。由您的 VIZA 顾问全程提交并追踪进度。",
  heroImage: "/assets/heroes/indonesia.jpg",
  meta: [
    { k: "签证类型", v: "电子落地签（e-VOA）" },
    { k: "可停留时长", v: "30 天" },
    { k: "有效期", v: "90 天" },
    { k: "入境次数", v: "单次" },
  ],
  tags: [
    { icon: "bolt", label: "快速通道 · 24 小时内出签" },
    { icon: "shield", label: "准时出签保证" },
    { icon: "doc", label: "所需材料极少" },
  ],

  overviewTitle: "印度尼西亚，一览",
  overviewSub:
    "电子落地签允许新加坡护照持有人入境印度尼西亚，用于旅游、探亲、商务会议或就医。",
  glance: [
    { icon: "globe", k: "首都", v: "雅加达", sub: "UTC +7（印度尼西亚西部时间）" },
    { icon: "clock", k: "最佳出行时间", v: "4 月 – 10 月", sub: "旱季 · 27 – 32°C" },
    { icon: "currency", k: "货币", v: "印度尼西亚盾", sub: "1 新元 ≈ 12,250 印尼盾" },
    { icon: "pin", k: "热门目的地", v: "巴厘岛 · 雅加达 · 龙目岛", sub: "另有日惹、婆罗摩火山、努沙佩尼达" },
  ],

  processTitle: "电子落地签办理流程",
  processSub:
    "提交一次即可。我们全程与印度尼西亚移民局对接，签证一旦准备就绪即刻通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、近期照片及出行日期。仅需预付政府费用——VIZA 服务费在签证批准后收取。",
    },
    {
      title: "材料审核",
      body: "您的 VIZA 顾问逐项核查所有填写内容，确认无误后直接向印度尼西亚移民局提交申请。",
    },
    {
      title: "签证处理中",
      body: "我们追踪移民局内部每个处理环节，以便在影响您行程之前提前发现任何延误。",
      statusRows: [
        { label: "申请已发送至移民局主管", ts: "5月8日 05:45", onTime: true },
        { label: "已转交内部审查部门", ts: "5月8日 08:12", onTime: true },
        { label: "等待最终批准", ts: "处理中" },
      ],
    },
    {
      title: "5月9日 15:03 获取您的电子落地签",
      body: "PDF 签证文件将发送至您的邮箱及 VIZA 应用。打印或保存至手机钱包，在入境通道出示即可。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "您的 VIZA 顾问在提交前会逐一核查每份材料。重新上传次数不限，且免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期 6 个月以上 · 清晰扫描件" },
    { name: "近期照片", sub: "纯色背景 · 6 个月内拍摄" },
    { name: "回程机票", sub: "须在 30 天内离境" },
    { name: "酒店或住宿证明", sub: "预订确认函 · 任意平台均可" },
  ],

  rejectionTitle: "电子落地签被拒的常见原因",
  rejectionSub:
    "印度尼西亚移民局可能以下列任一原因拒绝申请。VIZA 会在您提交前提前标记这些风险。",
  rejectionReasons: [
    { title: "护照已过期", body: "使用已过期或入境时距到期不足 6 个月的护照申请将被拒绝。" },
    { title: "有犯罪记录", body: "根据印度尼西亚法律，有定罪记录或未结案件可能导致旅游签证申请被拒。" },
    { title: "此前有违规记录", body: "过去 5 年内曾超期逗留或违反印度尼西亚签证规定。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "请携带电子落地签 PDF、有效的回程机票及住宿证明。该签证允许单次入境，自抵达之日起可停留 30 天。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次", sub: "再次入境需重新申请签证" },
    { icon: "clock", k: "激活期限", v: "90 天", sub: "自签发日期起计算" },
  ],

  extensionTitle: "签证延期与超期逗留",
  extensionSub:
    "电子落地签可在印度尼西亚境内任一移民局办理一次延期，额外延长 30 天。超期逗留将产生每日罚款，并可能影响未来签证申请。",
  extension: [
    { icon: "extend", k: "可延期", v: "+30 天", sub: "一次，须在境内办理" },
    { icon: "alert", k: "超期罚款", v: "每天 1,000,000 印尼盾", sub: "约每天 82 新元" },
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
        initials: "LM",
        name: "李明",
        source: "Trustpilot · 3天前",
        title: "不到一天拿到巴厘岛电子落地签",
        body: "晚上 11 点提交申请，第二天早上起来签证 PDF 已经到邮箱了。应用内的状态更新让整个过程透明清晰，完全放心。",
      },
      {
        initials: "ZH",
        name: "张慧",
        source: "应用商店 · 1周前",
        title: "顾问帮我避免了照片被拒",
        body: "顾问发现我的照片背景不符合要求，帮我重新上传了一张。如果自己直接提交，根本不会注意到这个问题。",
      },
    ],
  },

  faqSub:
    "找不到答案？可使用本页底部的 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "印度尼西亚电子落地签是什么？",
      a: "电子落地签是由印度尼西亚移民局在行程开始前签发的 30 天单次入境旅游签证，取代了以往需要在机场办理的纸质落地签——您抵达时签证已在系统中登记。",
    },
    {
      category: "基本信息",
      q: "电子落地签可以用于商务活动吗？",
      a: "可以——电子落地签覆盖旅游、探亲、过境及短期商务会议。若需从事有偿工作或长期出差，则需申请相应的工作签证。",
    },
    {
      category: "申请流程",
      q: "VIZA 处理电子落地签需要多长时间？",
      a: "大多数电子落地签在 24 小时内出签。直接通过移民局申请通常需要 2 至 3 天。我们以准时出签保证作为承诺——如果逾期，全额退款。",
    },
    {
      category: "申请流程",
      q: "可以在一个申请中为全家人办理签证吗？",
      a: "可以。在申请中添加每位出行人员——顾问会统一提交，确保所有人在同一时间线上获得批准。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "电子落地签被拒了怎么办？",
      a: "印度尼西亚移民局将保留政府费用。VIZA 的服务费将全额退还，顾问会帮助您了解拒签原因，并在符合条件后协助重新申请。",
    },
  ],

  sources: [
    { label: "印度尼西亚官方电子签证申请平台", url: "https://evisa.imigrasi.go.id/", display: "evisa.imigrasi.go.id" },
    { label: "印度尼西亚移民总局", url: "https://www.imigrasi.go.id/", display: "imigrasi.go.id" },
    { label: "印度尼西亚外交部", url: "https://kemlu.go.id/", display: "kemlu.go.id" },
  ],

  price: {
    etaLabel: "立即申请，预计到签时间",
    etaValue: "2026年5月9日 15:03",
    title: "电子落地签 · 30 天停留",
    saving: "快 21 小时",
    sub: "含政府费用、材料审核及准时出签保证，一价全包。",
    foot: "政府费用与 VIZA 服务费在结账时一并收取，并附准时出签保证。",
  },

  aiPlaceholder: "有关印度尼西亚签证的任何问题，欢迎提问——费用、处理时间、所需材料……",
};

export default indonesia;
