// zh-CN 简体中文 — 马来西亚 eVISA 单次入境签证（旅游）
// 最近事实核查：2026-07-05，依据官方来源：
//   - malaysiavisa.imi.gov.my（官方 eVISA 申请系统 MyVISA）
//   - imi.gov.my（马来西亚移民局：签证费、逾期居留处罚 s.15(4)、延期规则）
//   - kln.gov.my（官方 eVISA FAQ；马来西亚驻新加坡最高专员署入境及签证程序）
//   - imigresen-online.imi.gov.my/mdac（MDAC 电子入境卡）
//   - my.china-embassy.gov.cn（中马互免签证协定 FAQ）
// 已确认要点：单次入境、停留 30 天且不可延期；签证自签发起 3 个月有效；
// 官方审理 48 小时（仅计工作日）；逾期居留最高罚款 10,000 林吉特或监禁 5 年，
// 和解金 3,000 林吉特；新加坡公民免签且免 MDAC；中国公民依中马互免协定
// （2025年7月17日生效）免签每次 30 天、每 180 天累计不超过 90 天，仍须提交 MDAC。
// 待运营确认事项：
//   1. 在线申请总费用：官方按国籍收取签证费 RM20–50；另加的约 RM105 手续费
//      仅见于第三方来源（官方系统需登录），请在系统内核实实际总价。
//   2. 能否从新加坡境内申请：2021 年官方 FAQ 称系统屏蔽马来西亚/新加坡/以色列；
//      2024 年 6 月最高专员署 PDF 称除马来西亚/以色列/朝鲜外全球均可，需确认现行规则。
//   3. 逾期再入境禁令（1–5 年）出自二手来源（Fragomen），imi.gov.my 未载明。
//   4. 落地签费用 RM200 出自二手来源。
//   5. 传闻 2026 年 2 月 17 日起收紧中国公民 90/180 天限制，官方页面未证实。

import type { VisaContent } from "../types";

export const malaysia: VisaContent = {
  slug: "malaysia",

  heroTitle: "马来西亚 eVISA 电子签证",
  lede: "马来西亚 eVISA（单次入境签证 SEV）面向约 30 个需签证国籍的旅游访客：单次入境、停留 30 天且不可延期，自签发之日起 3 个月内有效。新加坡与中国护照持有人均可免签入境——无论您属于哪种情况，VIZA 都为您全程办妥。",
  heroImage: "/assets/heroes/malaysia.jpg",
  meta: [
    { k: "签证类型", v: "eVISA（SEV · 旅游）" },
    { k: "每次停留", v: "30 天" },
    { k: "有效期", v: "3 个月" },
    { k: "入境次数", v: "单次" },
  ],
  tags: [
    { icon: "bolt", label: "官方审理 · 48 小时" },
    { icon: "shield", label: "准时保证" },
    { icon: "doc", label: "材料预审" },
  ],

  overviewTitle: "马来西亚概览",
  overviewSub:
    "eVISA 适用于旅游与探亲，每次入境最长停留 30 天。由马来西亚移民局（Jabatan Imigresen Malaysia）通过官方 MyVISA 系统在线签发——自 2024 年 5 月 31 日新加坡指定代理渠道终止后，这是唯一的官方申请渠道。",
  glance: [
    { icon: "globe", k: "首都", v: "吉隆坡", sub: "UTC +8（马来西亚标准时间）" },
    { icon: "clock", k: "最佳出行时间", v: "3 月 – 10 月", sub: "西海岸旱季 · 东海岸旱季为 11 月 – 2 月" },
    { icon: "currency", k: "货币", v: "马来西亚林吉特（MYR）", sub: "SGD 1 ≈ RM 3.30" },
    { icon: "pin", k: "热门目的地", v: "吉隆坡 · 槟城 · 兰卡威", sub: "还有沙巴、砂拉越与金马仑高原" },
  ],

  processTitle: "马来西亚 eVISA 申请流程",
  processSub:
    "一次提交，我们直接在官方 eVISA 系统（malaysiavisa.imi.gov.my）递交并全程跟踪，出发前还会提醒您提交 MDAC 电子入境卡。",
  steps: [
    {
      title: "在 VIZA 提交申请",
      body: "上传护照信息页、35 × 50 毫米影楼证件照、已确认的回程机票及住宿证明。移民局建议至少提前 2 周申请——我们确保您在安全时间窗内。",
    },
    {
      title: "材料审核",
      body: "VIZA 顾问将每一项信息与护照逐字核对——任何不一致都会使签证失效，且费用不予退还——随后通过官方系统递交，绝不经任何第三方或代理网站。",
    },
    {
      title: "eVISA 处理中",
      body: "马来西亚移民局官方审理时间为 48 小时，且仅计工作日——周末及马来西亚和申请人所在国的公共假期不计入。我们实时监控进度，一有延误立即预警。",
      statusRows: [
        { label: "申请已在官方 eVISA 系统递交", ts: "8月15日 上午8:30", onTime: true },
        { label: "移民局审核中", ts: "8月15日 下午2:00", onTime: true },
        { label: "等待最终批准", ts: "进行中" },
      ],
    },
    {
      title: "8月17日 10:00 eVISA 送达",
      body: "eVISA 将发送至您的邮箱和 VIZA App——可打印或保存电子版。随后我们会提醒您在抵达前 3 天内提交免费的 MDAC 入境卡。",
      delivered: true,
    },
  ],

  docsTitle: "所需材料",
  docsSub:
    "VIZA 顾问在提交前按官方规格逐一核查所有材料，文件重传次数不限且完全免费。",
  documents: [
    { name: "护照信息页", sub: "自抵达马来西亚之日起有效期须超过 6 个月 · 至少 3 页空白页 · 清晰扫描件" },
    { name: "影楼证件照", sub: "35 × 50 毫米 · 纯白背景无阴影 · 6 个月内拍摄 · 不得修图或加边框——扫描件或 P 图会被系统自动拒绝" },
    { name: "已确认的回程或续程票", sub: "机票、火车票或巴士票订单 · 自驾出行可提交注明车辆信息的书面说明" },
    { name: "住宿证明", sub: "已付款的酒店订单——如住亲友家：附地址的说明信、房东的马来西亚身份证件及其马来西亚联系电话" },
    { name: "出生证明（12 岁以下儿童）", sub: "12 岁以下儿童必须上传" },
    { name: "说明信（如适用）", sub: "以英文 PDF 致移民官，解释缺失材料或特殊情况" },
  ],

  rejectionTitle: "马来西亚 eVISA 常见拒签原因",
  rejectionSub:
    "马来西亚移民局逐案裁量，可不说明理由直接拒签。VIZA 在提交前会为您排查所有已知风险点。",
  rejectionReasons: [
    { title: "信息与护照不一致", body: "申请信息与旅行证件之间的任何差异都会使 eVisa 失效。付款后如需更正，必须重新付费申请——费用不予退还。" },
    { title: "照片不符合规格", body: "经修图、带边框、非影楼拍摄、尺寸错误（非 35 × 50 毫米）、背景有阴影或拍摄超过 6 个月的照片，会被系统自动拒绝。" },
    { title: "护照有效期不足", body: "自抵达之日起有效期不足 6 个月，或空白页少于 3 页。" },
    { title: "支持材料缺失", body: "没有已确认的回程或续程票、没有已付款住宿或房东证件及联系方式、或 12 岁以下儿童缺少出生证明。" },
    { title: "从不符合条件的地点申请", body: "系统屏蔽在马来西亚境内发起的申请；持旅游签证在第三国旅行期间也无法申请。" },
    { title: "通过非官方网站申请", body: "移民局未指定任何代理——经假冒或仿冒网站提交的申请风险自负。VIZA 只在官方系统递交。" },
  ],

  entryTitle: "入境与出境规定",
  entrySub:
    "除新加坡公民外，所有旅客须在抵达前 3 天内免费提交 MDAC 电子入境卡。入境时边检可能查验：护照、eVISA 打印件或电子版、登机牌、回程机票、住宿证明及足够的旅费。持有 eVisa 并不保证入境——最终决定权在边检官员。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次", sub: "再次入境须重新申请 eVISA" },
    { icon: "clock", k: "停留期限", v: "30 天", sub: "自抵达日起计算 · 不可延期" },
    { icon: "doc", k: "MDAC 入境卡", v: "抵达前 3 天内提交", sub: "免费 · imigresen-online.imi.gov.my/mdac · 2024 年 1 月 1 日起强制" },
    { icon: "plane", k: "自助通关闸机", v: "符合条件的国籍可用", sub: "不盖入境章——请自行记录允许停留期" },
  ],

  extensionTitle: "签证延期与逾期居留",
  extensionSub:
    "官方 eVISA FAQ 明确规定：30 天停留期不允许延期，马来西亚驻外使领馆也无权延签。仅在极端情况下——重病、事故或本国发生战乱——方可亲自前往移民局以 IMM.55 表格申请短期社交访问准证延期，是否批准由官员裁量。",
  extension: [
    { icon: "extend", k: "延期", v: "不允许", sub: "仅限极端情况 · IMM.55 表格亲自办理，由官员裁量" },
    { icon: "alert", k: "逾期居留处罚", v: "最高罚款 RM 10,000", sub: "≈ 3,000 新元——或最长监禁 5 年，或两者并罚；和解金 RM 3,000 ≈ 900 新元（《1959/63 年移民法》第 15(4) 条）" },
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
      q: "什么是马来西亚 eVISA？",
      a: "eVISA（单次入境签证 SEV）由马来西亚移民局通过官方 MyVISA 系统签发的电子旅游签证：单次入境、停留 30 天，自签发之日起 3 个月内有效。它仅适用于约 30 个需要签证访马的国籍——包括新加坡人在内的大多数访客并不需要。",
    },
    {
      category: "基本信息",
      q: "新加坡或中国护照持有人需要这个签证吗？",
      a: "不需要。新加坡公民免签入境，抵达时获 30 天入境准证，且是唯一免交 MDAC 入境卡的国籍。中国护照持有人依中马互免签证协定（2025 年 7 月 17 日生效）免签，每次入境可停留 30 天，每 180 天内累计不超过 90 天，但仍须在抵达前 3 天内提交 MDAC。无论哪种情况，VIZA 都会核实您的具体要求，并全程代办 MDAC 及入境材料。",
    },
    {
      category: "申请流程",
      q: "马来西亚移民局审理 eVISA 需要多长时间？",
      a: "官方审理时间为 48 小时，且仅计工作日——周末及马来西亚和您所在国的公共假期不计入。移民局建议至少提前 2 周申请。VIZA 收到材料后立即递交、全程监控，并提供准时保证。",
    },
    {
      category: "申请流程",
      q: "马来西亚 eVISA 需要多少费用？",
      a: "政府签证费按国籍收取，为 RM 20 至 RM 50（约 6–15 新元；中国公民为 RM 30）。在线系统另收手续费，普遍报道约为 RM 105（约 32 新元）。VIZA 在结账时给出一个全包价，涵盖政府费用、材料审核及准时保证。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "马来西亚 eVISA 被拒后如何处理？",
      a: "拒签后政府费用不予退还，即使付款后只是更正一处笔误也须重新付费申请。VIZA 的服务费将全额退还，顾问会分析拒签原因、修正问题并为您管理重新申请。",
    },
  ],

  sources: [
    { label: "马来西亚官方 eVISA 申请系统（MyVISA）", url: "https://malaysiavisa.imi.gov.my/", display: "malaysiavisa.imi.gov.my" },
    { label: "官方 eVISA FAQ——有效期、审理时间、材料与照片规格", url: "https://www.kln.gov.my/documents/1620528/0/FAQ+eVisa+Malaysia/0cae1cfc-576a-459f-a839-bbeae935bed1?version=1.0", display: "kln.gov.my" },
    { label: "马来西亚驻新加坡最高专员署——入境及签证程序", url: "https://www.kln.gov.my/documents/34253/9682852/ENTRY+AND+VISA+PROCEDURE+TO+MALAYSIA.pdf/25d8fce1-b1b2-419e-aa23-366ef06afcaf", display: "kln.gov.my" },
    { label: "马来西亚移民局——各国签证费", url: "https://www.imi.gov.my/index.php/en/main-services/visa/visa-fees/", display: "imi.gov.my" },
    { label: "马来西亚移民局——逾期居留处罚（《移民法》第 15(4) 条）", url: "https://www.imi.gov.my/index.php/en/main-services/entry-requirement-into-malaysia-en/frequently-committed-offences/", display: "imi.gov.my" },
    { label: "MDAC 马来西亚电子入境卡（官方系统）", url: "https://imigresen-online.imi.gov.my/mdac/main", display: "imigresen-online.imi.gov.my" },
    { label: "中国驻马来西亚大使馆——中马互免签证协定 FAQ", url: "https://my.china-embassy.gov.cn/eng/fwzc/lsyw/qz/202508/t20250801_11681401.htm", display: "my.china-embassy.gov.cn" },
  ],

  price: {
    etaLabel: "立即申请，预计到达时间",
    etaValue: "2026年8月17日 10:00",
    title: "旅游 eVISA（SEV）· 停留 30 天",
    saving: "比自行申请快 1 天",
    sub: "含政府费用、材料审核及准时保证，全包价格。",
    foot: "政府费用与 VIZA 服务费在结账时一并收取，并附准时保证。",
  },

  aiPlaceholder: "关于马来西亚 eVISA，随时提问——申请资格、所需材料、处理时间……",
};

export default malaysia;
