import type { VisaContent } from "../types";

/**
 * 澳大利亚访客签证（600 类）旅游签证流 — 简体中文版本，
 * 并包含符合条件护照（含新加坡）适用的 ETA（601 类）说明。
 *
 * 最近事实核查日期：2026-07-05，对照 immi.homeaffairs.gov.au、abf.gov.au、
 * singapore.highcommission.gov.au、china.embassy.gov.au 等官方来源。
 *
 * 待运营确认事项：
 *  1. 2026 年 7 月 1 日起的费用（AUD 250 / 630 / 1,845）仅经权威二级来源
 *     交叉核实——发布前请在官方签证费用估算器上确认。
 *  2. 处理时长百分位每月更新，发布前请刷新内政部官方数据。
 *  3. 45 × 35 mm 照片规格为 1419 表格长期标准，未在最新表格上复核。
 *  4. 中国区材料清单出自较早的使馆 PDF，请确认现行 AVAC 清单表述。
 *  5. 内政部无正式的护照 6 个月有效期规定，但航空公司可能自行要求，
 *     建议按 6 个月为最佳实践对外提示。
 *  6. 常旅客流“任意 24 个月内累计停留不超过 12 个月”出自二级来源，
 *     请在官方页面核实。
 */
export const australia: VisaContent = {
  slug: "australia",

  heroTitle: "澳大利亚访客签证",
  lede: "访客签证（600 类，旅游流）每次入境可停留 3、6 或 12 个月，通常自批准之日起 12 个月内可多次旅行。新加坡护照持有人可申请更快捷的 ETA（601 类）。无论哪种方式，您的 VIZA 顾问都会全程准备、递交并跟踪申请。",
  heroImage: "/assets/heroes/australia.jpg",
  meta: [
    { k: "签证类型", v: "访客签证 600 / ETA 601" },
    { k: "可停留时长", v: "每次入境 3 / 6 / 12 个月" },
    { k: "有效期", v: "最长 12 个月" },
    { k: "入境次数", v: "多次（常见批准方式）" },
  ],
  tags: [
    { icon: "bolt", label: "专业顾问全程准备材料" },
    { icon: "shield", label: "准时出签保证" },
    { icon: "doc", label: "完整材料审核" },
  ],

  overviewTitle: "澳大利亚，一览",
  overviewSub:
    "访客签证（600 类）是澳大利亚最主要的旅游及探亲签证。新加坡等符合条件的护照可改用仅限手机 App 申请的 ETA（601 类）——12 个月内多次入境，每次最长停留 3 个月。",
  glance: [
    { icon: "globe", k: "首都", v: "堪培拉", sub: "UTC +10 / +11（澳大利亚东部标准时间 / 夏令时）" },
    { icon: "clock", k: "最佳出行时间", v: "9 月 – 11 月 / 3 月 – 5 月", sub: "春秋两季 · 18 – 26°C" },
    { icon: "currency", k: "货币", v: "澳大利亚元", sub: "1 新元 ≈ 1.10 澳元（约）" },
    { icon: "pin", k: "热门目的地", v: "悉尼 · 墨尔本 · 大堡礁", sub: "另有黄金海岸、珀斯、乌鲁鲁" },
  ],

  processTitle: "澳大利亚访客签证办理流程",
  processSub:
    "提交一次即可。我们通过 ImmiAccount 递交申请，全程与澳大利亚内政部对接，签证一经批准即刻通知您。内政部约 50% 的旅游流申请在 11 天左右审结，90% 在 28 – 45 天内完成——建议出行前 1 – 2 个月递交。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照、一张 45 × 35 mm 照片、资金证明及支持材料。顾问会根据您的具体情况定制材料包，并告诉您签证官如何评估“真实访客”要求。",
    },
    {
      title: "材料审核",
      body: "您的 VIZA 顾问逐项对照澳大利亚内政部要求审核所有填写内容和支持材料，然后通过 ImmiAccount 在线递交申请。",
    },
    {
      title: "签证处理中",
      body: "我们每天监控您的 ImmiAccount 申请状态，并在签证官要求补充材料时第一时间响应——这是最常见的延误原因。请暂时不要购买机票：内政部官方建议在获批前不要出票。",
      statusRows: [
        { label: "申请已通过 ImmiAccount 递交", ts: "6月10日 10:00", onTime: true },
        { label: "健康及品格审查已启动", ts: "6月10日 14:30", onTime: true },
        { label: "等待签证官决定", ts: "处理中" },
      ],
    },
    {
      title: "6月21日 14:15 获取您的签证批准通知",
      body: "签证批准通知将通过邮件及 VIZA 应用发送给您。签证以电子方式关联至您的护照，无需贴签。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "您的 VIZA 顾问在提交前会逐一核查每份材料。重新上传次数不限，且免费。",
  documents: [
    { name: "护照个人信息页", sub: "彩色扫描件 · 有效期须覆盖全部停留期（建议 6 个月以上）" },
    { name: "护照照片", sub: "近期彩色照片一张 · 45 × 35 mm · 纯色背景" },
    { name: "资金证明", sub: "银行流水（3 – 6 个月）、工资单或纳税记录" },
    { name: "在职或在读证明", sub: "含准假信息的雇主信 · 营业执照 · 在读证明" },
    { name: "行程与回国约束力证明", sub: "行程安排 + 与本国的联系——获批前请勿购买机票" },
    { name: "邀请材料", sub: "探亲访友时：邀请人联系方式、护照/签证复印件及支持信" },
    { name: "未成年人（18 岁以下）材料", sub: "载明父母双方的出生证明 · 一方不随行时需 1229 表同意书" },
    { name: "中国大陆申请人", sub: "身份证正反面、户口簿，以及中英文双语的 54 表（家庭成员表）" },
  ],

  rejectionTitle: "澳大利亚访客签证被拒的常见原因",
  rejectionSub:
    "澳大利亚内政部可能以下列任一原因拒绝申请。VIZA 会在您提交前提前标记这些风险。",
  rejectionReasons: [
    { title: "不符合“真实访客”要求", body: "与本国联系薄弱——无稳定工作、家庭或资产——旅行目的含糊，或移民记录显示有滞留意图。这是 600 类签证最常见的拒签原因。" },
    { title: "资金证明不足", body: "银行流水未体现稳定的储蓄或收入记录，或存在无法解释的近期大额入账，都无法证明您有能力负担全部停留费用。" },
    { title: "材料不完整或质量差", body: "缺少在职证明、扫描件模糊，或中国大陆申请人缺少身份证、户口簿、54 表等身份材料，都会导致延误甚至拒签。" },
    { title: "虚假或误导性信息", body: "任何虚假材料或前后矛盾之处都可能触发 PIC 4020 条款下的拒签，并附加 3 年内禁止再次申请。" },
    { title: "此前有签证违规记录", body: "曾超期逗留、违反签证条件，或存在尚未结束的再入境限制期（PIC 4013/4014），均会导致拒签。" },
    { title: "健康或品格问题", body: "不满足健康要求（对年长申请人及长期停留尤其相关），或因犯罪记录等触发 s501 品格条款。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "签证以电子方式关联至您的护照——落地不发任何签证，登机前必须已持有 ETA 或 600 类签证。所有入境旅客须填写入境旅客卡（IPC；数字版澳大利亚旅行申报 ATD 正在部分澳航航线试点），并须严格如实申报生物安全物品。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次（常见批准方式）", sub: "在签证有效期内可自由往返" },
    { icon: "doc", k: "入境卡", v: "入境旅客卡（IPC）", sub: "纸质为主 · 数字版 ATD 在部分飞往布里斯班/悉尼/墨尔本的澳航航班试点" },
    { icon: "bolt", k: "SmartGate 快捷通关", v: "所有电子护照", sub: "新加坡及中国电子护照均可使用" },
    { icon: "alert", k: "生物安全申报", v: "食品、植物、动物制品须申报", sub: "虚假申报将被当场重罚" },
  ],

  extensionTitle: "签证延期与超期逗留",
  extensionSub:
    "澳大利亚访客签证无法“延期”——正确做法是在当前签证到期前，通过 ImmiAccount 在境内递交一份新的 600 类申请（政府费 630 澳元；若签证附有 8503“不得续签”条件则无法申请）。等待审理期间过桥签证可保持您的合法身份。澳大利亚没有按天计罚的超期罚款：超期 28 天以上会触发 3 年禁止再入境，且超期者将成为非法滞留人员，面临拘留和遣返，费用由本人承担。",
  extension: [
    { icon: "extend", k: "延长停留", v: "境内新申请 600 类", sub: "630 澳元 · 到期前 2 – 3 周递交 · 受 8503 条件限制" },
    { icon: "ban", k: "超期 28 天以上", v: "3 年禁止再入境", sub: "PIC 4014 条款 · 28 天内主动离境一般可避免" },
    { icon: "alert", k: "超期罚款", v: "无每日罚款——但遣返费用自负", sub: "非法滞留 · 有被拘留风险 · 形成对澳政府的债务" },
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
        initials: "LX",
        name: "刘雪",
        source: "Trustpilot · 1周前",
        title: "5 天内获得签证批准",
        body: "流程顺畅得难以置信。顾问帮我把所有材料都准备好了，我几乎只需要上传护照就行。",
      },
      {
        initials: "ZW",
        name: "赵伟",
        source: "应用商店 · 3周前",
        title: "顾问帮我保住了申请",
        body: "我最初提供的银行对账单材料不够充分。顾问详细指导我需要补充哪些内容，最终一次性获批。",
      },
    ],
  },

  faqSub: "找不到答案？可使用本页底部的 AI 助手提问。",
  faq: [
    {
      category: "基本信息",
      q: "澳大利亚访客签证（600 类）是什么？",
      a: "600 类访客签证（旅游流）是澳大利亚标准的旅游及探亲签证。内政部会批准每次入境停留 3、6 或 12 个月——旅游目的以 3 个月最为常见——通常自批准之日起 12 个月内可旅行，单次或多次入境由签证官酌情决定。",
    },
    {
      category: "基本信息",
      q: "新加坡护照持有人去澳大利亚需要签证吗？",
      a: "需要——新加坡并非免签，但可申请 ETA（601 类）：12 个月内多次入境，每次最长停留 3 个月，通常几分钟至 12 小时内获批。ETA 只能通过官方“Australian ETA”手机 App 申请（服务费 20 澳元，需 NFC 读取护照芯片并现场拍照）——VIZA 全程协助您完成。停留超过 3 个月或 ETA 被拒时，我们会改为递交 600 类签证。",
    },
    {
      category: "基本信息",
      q: "中国大陆护照持有人怎么办理？",
      a: "中国护照不符合 ETA 申请条件，须通过 ImmiAccount 申请 600 类访客签证——居住在新加坡的中国申请人同样可以在线递交。需额外准备：身份证正反面、户口簿，以及中英文双语的 54 表。经常往返澳大利亚的申请人可选择常旅客流——10 年多次入境签证（每次停留 3 个月），2026 年 7 月 1 日起费用为 1,845 澳元。",
    },
    {
      category: "申请流程",
      q: "签证费用是多少？",
      a: "自 2026 年 7 月 1 日起，600 类旅游流政府费为境外申请 250 澳元（约 220 新元）、境内申请 630 澳元（约 555 新元）。ETA（601 类）不收签证费，仅收 20 澳元（约 18 新元）App 服务费。费用按递交当日标准锁定。",
    },
    {
      category: "申请流程",
      q: "签证处理需要多长时间？",
      a: "ETA 通常在几分钟至 12 小时内获批。600 类旅游流方面，内政部约一半的申请在 11 天内审结，90% 在 28 – 45 天内完成（2026 年初数据）。建议出行前 1 – 2 个月递交，并在获批前不要购买机票——这是内政部的官方建议。",
    },
    {
      category: "申请流程",
      q: "可以在一个订单中为家庭成员申请签证吗？",
      a: "可以。每位出行人员需要单独申请，但您的 VIZA 顾问可以协调统一递交，确保所有申请在同一时间线上审核。18 岁以下儿童需要额外材料——载明父母双方的出生证明，以及父母一方不随行时的 1229 表同意书。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "申请被拒了怎么办？",
      a: "澳大利亚内政部将保留政府申请费。VIZA 的服务费将全额退还。顾问会与您一起梳理拒签原因——最常见的是“真实访客”要求——并就如何加强下一次申请提供建议。",
    },
  ],

  sources: [
    { label: "澳大利亚内政部——访客签证（600 类）旅游流", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600/tourist-stream-overseas", display: "immi.homeaffairs.gov.au" },
    { label: "澳大利亚内政部——电子旅行许可 ETA（601 类）", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601", display: "immi.homeaffairs.gov.au" },
    { label: "澳大利亚内政部——现行签证收费", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/fees-and-charges/current-visa-pricing", display: "immi.homeaffairs.gov.au" },
    { label: "澳大利亚内政部——全球签证处理时长", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times", display: "immi.homeaffairs.gov.au" },
    { label: "ImmiAccount——澳大利亚在线签证递交系统", url: "https://online.immi.gov.au/lusc/login", display: "online.immi.gov.au" },
    { label: "澳大利亚边防局——入境旅客卡（IPC）", url: "https://www.abf.gov.au/entering-and-leaving-australia/crossing-the-border/at-the-border/incoming-passenger-card-(ipc)", display: "abf.gov.au" },
    { label: "澳大利亚驻新加坡高级专员公署——签证与移民", url: "https://singapore.highcommission.gov.au/sing/Visas_and_Migration.html", display: "singapore.highcommission.gov.au" },
    { label: "澳大利亚驻华使馆——访客签证（600 类）旅游流材料清单", url: "https://china.embassy.gov.au/files/bjng/Visitor%20Visa%20-%20Tourist%20Stream%20(Subclass%20600).pdf", display: "china.embassy.gov.au" },
  ],

  price: {
    etaLabel: "立即申请，预计到签时间",
    etaValue: "2026年6月21日 14:15",
    title: "访客签证 600 类 · 旅游流 · 最长 12 个月有效期",
    saving: "一次递交，一次获批",
    sub: "含政府费用、材料准备及准时出签保证，一价全包。",
    foot: "政府费用与 VIZA 服务费在结账时一并收取，并附准时出签保证。",
  },

  aiPlaceholder: "有关澳大利亚签证的任何问题，欢迎提问——费用、处理时间、所需材料……",
};

export default australia;
