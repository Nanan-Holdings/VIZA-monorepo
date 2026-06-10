// zh-CN 简体中文翻译 — 马来西亚电子签证（旅游）
// 签证详情（费用、有效期、允许活动、材料要求及拒签原因）发布前须由运营/法务
// 对照马来西亚移民局官方指引进行核实。
// 注：许多国籍入境马来西亚无需签证；本内容适用于需要办理签证的国籍。

import type { VisaContent } from "../types";

export const malaysia: VisaContent = {
  slug: "malaysia",

  heroTitle: "马来西亚电子签证",
  lede: "马来西亚旅游电子签证为单次入境电子签证，最长可停留 30 天，出发前在线审批，抵达任何国际入境口岸时与护照一同出示即可。",
  heroImage: "/assets/heroes/malaysia.jpg",
  meta: [
    { k: "签证类型", v: "电子签证（旅游）" },
    { k: "每次停留", v: "30 天" },
    { k: "有效期", v: "3 个月" },
    { k: "入境次数", v: "单次" },
  ],
  tags: [
    { icon: "bolt", label: "快速通道 · 48 小时内完成" },
    { icon: "shield", label: "准时保证" },
    { icon: "doc", label: "所需材料极少" },
  ],

  overviewTitle: "马来西亚概览",
  overviewSub:
    "马来西亚旅游电子签证适用于休闲观光和探亲，最长停留 30 天。由马来西亚移民局（Jabatan Imigresen Malaysia）线上处理，所有国际入境口岸均可使用。",
  glance: [
    { icon: "globe", k: "首都", v: "吉隆坡", sub: "UTC +8（马来西亚标准时间）" },
    { icon: "clock", k: "最佳出行时间", v: "3 月 – 10 月", sub: "西海岸旱季 · 东海岸旱季为 11 月 – 2 月" },
    { icon: "currency", k: "货币", v: "马来西亚林吉特（MYR）", sub: "出发前请确认最新汇率" },
    { icon: "pin", k: "热门目的地", v: "吉隆坡 · 槟城 · 兰卡威", sub: "还有沙巴、砂拉越与金马仑高原" },
  ],

  processTitle: "马来西亚电子签证申请流程",
  processSub:
    "一次提交，全程由我们对接马来西亚移民局，电子签证准备好后立即通知您。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照信息页、近期证件照及出行日期。确认预计入境口岸——机场、陆路口岸或海港。",
    },
    {
      title: "材料审核",
      body: "VIZA 顾问逐项核查材料的准确性与完整性，然后通过官方 eVISA 系统提交至马来西亚移民局。",
    },
    {
      title: "电子签证处理中",
      body: "我们全程监控申请进度，如有任何补件请求，将立即提醒您。",
      statusRows: [
        { label: "申请已提交至马来西亚移民局", ts: "8月15日 上午8:30", onTime: true },
        { label: "申请审核中", ts: "8月15日 下午2:00", onTime: true },
        { label: "等待最终批准", ts: "进行中" },
      ],
    },
    {
      title: "8月17日 10:00 电子签证送达",
      body: "批准函将发送至您的邮箱和 VIZA App。打印或保存至手机，入境时与护照一并出示。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "VIZA 顾问在提交前逐一核查所有材料，文件重传次数不限且完全免费。",
  documents: [
    { name: "护照信息页", sub: "有效期须超过预计出境日期 6 个月以上 · 清晰扫描件" },
    { name: "近期证件照", sub: "纯白色或浅色背景 · 正面免冠 · 6 个月内拍摄" },
    { name: "回程机票", sub: "须在抵达后 30 天内离境马来西亚" },
    { name: "住宿证明", sub: "酒店预订确认单或邀请函" },
  ],

  rejectionTitle: "马来西亚电子签证常见拒绝原因",
  rejectionSub:
    "马来西亚移民局可能因以下任一原因拒绝申请。VIZA 在提交前会主动排查这些风险。",
  rejectionReasons: [
    { title: "护照有效期不足", body: "护照有效期须在预计离开马来西亚之日起至少还有 6 个月。" },
    { title: "旅行材料不完整", body: "缺少已确认的回程机票或住宿证明是最常见的拒绝原因之一。" },
    { title: "过往移民违规记录", body: "此前在马来西亚或其他国家的逾期居留、被驱逐出境或入境禁令记录，均可能导致拒绝。" },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "在入境检查台出示电子签证批准函及护照。30 天停留期自抵达日期起计算，非签证签发日期。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次", sub: "再次入境须重新申请电子签证" },
    { icon: "clock", k: "停留期限", v: "30 天", sub: "自抵达日起计算" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "短期延期须在到期前亲自前往移民局办理，视批准情况而定。根据《1959/63 年移民法》，逾期居留属违法行为，可处最高 10,000 林吉特罚款或最长 5 年监禁，或两者并罚。",
  extension: [
    { icon: "extend", k: "延期", v: "须经审批", sub: "在签证到期前亲自前往移民局申请" },
    { icon: "alert", k: "逾期后果", v: "最高罚款 10,000 林吉特或监禁", sub: "最长监禁 5 年；和解金 3,000 林吉特（《移民法》1959/63 第 15 条）" },
  ],

  reviews: {
    score: "4.6",
    outOf: "/ 5",
    sub: "评分最高的签证平台 · 12,841 条评价",
    platforms: [
      { rating: "4.6", name: "Trustpilot" },
      { rating: "4.7", name: "App Store" },
    ],
    items: [
      {
        initials: "DM",
        name: "丁敏",
        source: "Trustpilot · 1周前",
        title: "不到 2 天顺利批准，全程无忧",
        body: "顾问仔细检查了所有材料，提交前发现我的照片背景不太符合要求，及时帮我调整了。批准函在出行前很早就送到了。",
      },
      {
        initials: "CW",
        name: "陈伟",
        source: "应用商店 · 3周前",
        title: "省去了所有烦恼",
        body: "我不太清楚马来西亚需要哪些材料。VIZA 给了我一份清晰的清单，审核了我的上传文件，电子签证比预期更快到手。",
      },
    ],
  },

  faqSub:
    "没找到想要的答案？可使用页面底部的 AI 助手提问，或直接联系您的 VIZA 顾问。",
  faq: [
    {
      category: "基本信息",
      q: "什么是马来西亚旅游电子签证？",
      a: "马来西亚旅游电子签证由马来西亚移民局（Jabatan Imigresen Malaysia）签发，允许符合条件的护照持有人以旅游或探亲为目的单次入境马来西亚，最长停留 30 天。",
    },
    {
      category: "基本信息",
      q: "所有入境口岸都接受电子签证吗？",
      a: "是的，马来西亚电子签证适用于所有国际机场、主要陆路口岸和海港。申请时请注明预计入境口岸，以确保信息记录无误。",
    },
    {
      category: "申请流程",
      q: "马来西亚移民局处理电子签证需要多长时间？",
      a: "材料提交齐全后，通常在 1–3 个工作日内完成处理。VIZA 全程监控申请进度，并以准时保证为支撑——如果我们延误，将退还服务费。",
    },
    {
      category: "申请流程",
      q: "可以为全家一起申请吗？",
      a: "可以。每位旅行者需要各自的电子签证，但您可以在 VIZA 的一份申请中添加所有家庭成员，顾问将统一提交，确保大家同步收到批准结果。",
    },
    {
      category: "退款、拒绝与重新申请",
      q: "马来西亚电子签证被拒后如何处理？",
      a: "马来西亚移民局拒绝申请后不退还政府费用。VIZA 的服务费将全额退还。顾问将分析拒绝通知，告知您重新申请前需要更正的内容。",
    },
  ],

  sources: [
    { label: "MyVISA — 马来西亚官方电子签证申请系统（Jabatan Imigresen Malaysia）", url: "https://malaysiavisa.imi.gov.my/evisa/", display: "malaysiavisa.imi.gov.my" },
    { label: "马来西亚移民局", url: "https://www.imi.gov.my", display: "imi.gov.my" },
  ],

  price: {
    etaLabel: "立即申请，预计到达时间",
    etaValue: "2026年8月17日 10:00",
    title: "旅游电子签证 · 停留 30 天",
    saving: "比自行申请快 1 天",
    sub: "含政府费用、材料审核及准时保证，全包价格。",
    foot: "政府费用与 VIZA 服务费在结账时一并收取，并附准时保证。",
  },

  aiPlaceholder: "关于马来西亚电子签证，随时提问——申请资格、所需材料、处理时间……",
};

export default malaysia;
