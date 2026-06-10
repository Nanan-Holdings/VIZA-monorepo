// zh-CN 简体中文翻译 — 加拿大签证内容
// 注意：签证费用、适用国籍及处理时长等具体信息，发布前须由运营/法务团队核实。
// 英文原文见 ../canada.ts

import type { VisaContent } from "../types";

export const canada: VisaContent = {
  slug: "canada",

  heroTitle: "加拿大电子旅行授权（eTA）",
  lede: "加拿大eTA专为乘飞机入境的免签国籍旅客而设——有效期5年，可多次入境，直接绑定护照。由您的VIZA顾问全程代办，确认无误后提交。",
  heroImage: "/assets/heroes/canada.jpg",
  meta: [
    { k: "签证类型", v: "电子旅行授权（eTA）" },
    { k: "停留时长", v: "最长6个月" },
    { k: "有效期", v: "5年" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "bolt", label: "通常数分钟即可获批" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "流程简便" },
  ],

  overviewTitle: "加拿大，一览无余",
  overviewSub:
    "加拿大eTA适用于符合资格的免签国籍旅客乘机入境加拿大，涵盖旅游观光、探亲访友及短期商务出行。",
  glance: [
    { icon: "globe", k: "首都", v: "渥太华", sub: "UTC −5（东部标准时间）" },
    { icon: "clock", k: "最佳旅行时间", v: "6月–8月 · 12月–3月", sub: "夏日暖阳或冬季滑雪季" },
    { icon: "currency", k: "货币", v: "加拿大元（CAD）", sub: "刷卡消费普及" },
    { icon: "pin", k: "热门目的地", v: "多伦多 · 温哥华 · 班夫", sub: "以及蒙特利尔、尼亚加拉大瀑布、魁北克城" },
  ],

  processTitle: "加拿大eTA申请流程",
  processSub:
    "大多数eTA在数分钟内即可自动获批。VIZA确保您的申请零错误，让出行当天不留任何隐患。",
  steps: [
    {
      title: "在VIZA提交申请",
      body: "提供护照信息、国籍及出行目的，我们将从您的账户资料中预填IRCC的eTA表格，避免手动输入错误。",
    },
    {
      title: "申请审核与递交",
      body: "您的VIZA顾问逐项核实姓名拼写、护照号码、国籍等每项信息是否符合IRCC要求，确认无误后提交。",
    },
    {
      title: "IRCC处理eTA申请",
      body: "大多数申请在数分钟内即可获批；少数申请需转交人工审核，可能需要数天时间。我们实时跟踪您的申请状态。",
      statusRows: [
        { label: "申请已提交至IRCC", ts: "6月20日 下午3:10", onTime: true },
        { label: "自动资格审核通过", ts: "6月20日 下午3:11", onTime: true },
        { label: "等待最终审批", ts: "处理中" },
      ],
    },
    {
      title: "6月20日下午3:15 eTA获批",
      body: "批准信息已电子关联至您的护照，无需打印任何文件。VIZA向您发送确认通知，并提醒您出行时携带该护照。",
      delivered: true,
    },
  ],

  docsTitle: "所需申请材料",
  docsSub:
    "加拿大eTA所需材料极少。您的VIZA顾问在递交前逐项核对每个信息的准确性。",
  documents: [
    { name: "有效护照", sub: "用于飞往加拿大的护照 · 在整个停留期间内有效" },
    { name: "电子邮件地址", sub: "用于接收IRCC通知及eTA确认邮件" },
    { name: "支付方式", sub: "加拿大政府费用7加元 · 信用卡或借记卡均可" },
    { name: "出行记录（如需人工审核）", sub: "IRCC可能要求提供额外信息用于人工审核" },
  ],

  rejectionTitle: "eTA申请常见被拒原因",
  rejectionSub:
    "大多数eTA申请即时获批，但某些情况可能导致拒绝或转入人工审核。VIZA在递交前提前识别以下风险点。",
  rejectionReasons: [
    { title: "国籍不在适用范围内", body: "eTA仅适用于指定免签国家/地区的国籍持有人。需要签证才能入境加拿大的旅客，须改为申请临时居民签证。" },
    { title: "刑事记录或移民违规历史", body: "曾有严重犯罪记录、曾被驱逐出加拿大，或在此前申请中提供虚假信息，均可能导致拒绝。" },
    { title: "护照信息错误或护照已过期", body: "申请信息与护照数据不符——包括护照过期——将导致自动拒绝。VIZA的审核会在递交前发现并纠正此类问题。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "您的eTA已电子关联至护照，值机及抵达加拿大边境时请出示同一本护照。加拿大边境服务局（CBSA）官员在入境时确定您的授权停留时长。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "5年内有效或护照到期前均可使用" },
    { icon: "clock", k: "每次停留时长", v: "最长6个月", sub: "以CBSA入境时授权为准" },
  ],

  extensionTitle: "延期停留与超期居留",
  extensionSub:
    "希望延长停留时间的访客，须在授权停留期到期前，在加拿大境内提交延期申请。",
  extension: [
    { icon: "extend", k: "延期", v: "在线向IRCC申请", sub: "在授权停留期到期前提交" },
    { icon: "alert", k: "超期处罚", v: "被遣返 + 未来禁止入境", sub: "可能影响未来访问或移民申请资格" },
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
      q: "加拿大eTA是什么？",
      a: "电子旅行授权（eTA）是符合资格的免签国籍外国人乘飞机前往加拿大的入境前必备许可。eTA直接电子关联至您的护照，无需单独盖章或携带纸质文件——值机及抵达加拿大边境时，出示申请时使用的同一本护照即可。",
    },
    {
      category: "基本信息",
      q: "eTA适用于陆路或水路入境吗？",
      a: "不适用。eTA仅针对乘坐飞机入境加拿大的旅客。符合免签资格、通过陆路或水路边境口岸入境的旅客无需eTA，但其他入境要求仍然适用。",
    },
    {
      category: "申请流程",
      q: "eTA多快能获批？",
      a: "大多数eTA在IRCC自动化系统处理后数分钟内即可获批。少数申请会被转交人工审核，可能需要数天时间。VIZA持续监控您的申请状态，有任何变化立即通知您。",
    },
    {
      category: "申请流程",
      q: "申请eTA后换了新护照怎么办？",
      a: "您的eTA与申请时使用的护照唯一绑定。换发新护照后，出行前须重新申请eTA并关联至新护照。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "eTA申请被拒后怎么办？",
      a: "7加元的政府费用不予退还。IRCC对eTA拒绝原因披露有限；但VIZA会审查您的情况，核实申请资格，并告知您是否需要改为申请全额临时居民签证。",
    },
  ],

  sources: [
    { label: "IRCC — 电子旅行授权（eTA）", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html", display: "canada.ca" },
    { label: "IRCC — eTA申请门户", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html", display: "canada.ca" },
    { label: "IRCC — eTA处理时长说明", url: "https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1063&top=16", display: "ircc.canada.ca" },
  ],

  price: {
    etaLabel: "立即申请，预计送达",
    etaValue: "2026年6月20日 下午3:15",
    title: "加拿大 eTA · 5年有效期",
    saving: "通常数分钟即可获批",
    sub: "全包服务，含材料审核、申请提交及准时保障。",
    foot: "IRCC政府费用与VIZA服务费在结账时统一收取。",
  },

  aiPlaceholder: "请随时提问关于加拿大eTA的任何问题——资格要求、处理时长、续签……",
};

export default canada;
