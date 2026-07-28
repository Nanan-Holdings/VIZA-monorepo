// zh-CN 简体中文翻译 — 美国签证内容
// 事实核查日期：2026-07-05，核对来源：travel.state.gov、ceac.state.gov、
// esta.cbp.dhs.gov、cbp.gov、evus.gov、uscis.gov、federalregister.gov、ustraveldocs.com。
// 待运营确认事项：
//   - 250美元“签证诚信费”（Visa Integrity Fee）：2025年7月4日立法通过，但截至2026年中
//     尚未开始征收，也未列入 travel.state.gov 费用表——报价前须再次核实。
//   - ESTA（40.27美元）与 EVUS（30.75美元）的2026年CPI调整金额来自第三方来源，
//     以官方支付页面为准。
//   - 新加坡面试后护照返还时间（“约1周”）来自 ustraveldocs 指引，具体因案而异。
//   - 新元换算按 ≈1.30 SGD/USD（2026年中）估算，需定期更新。
//   - 750美元加急面试服务（2026年7月1日–12月31日，10个工作日内安排面试，仅限
//     指定使领馆）是否适用于新加坡使馆尚未确认。
// 英文原文见 ../united-states.ts

import type { VisaContent } from "../types";

export const unitedStates: VisaContent = {
  slug: "united-states",

  heroTitle: "美国 B1/B2 访客签证",
  lede: "美国领事馆签发的访客签证，适用于旅游观光、探亲访友及商务出行。新加坡及中国大陆护照均可获发10年有效、多次入境签证，每次最长停留6个月。VIZA全程负责DS-160填写、面试预约及辅导。持新加坡护照、停留不超过90天？我们直接为您办理ESTA。",
  heroImage: "/assets/heroes/united-states.jpg",
  meta: [
    { k: "签证类型", v: "B1/B2" },
    { k: "停留时长", v: "每次最长6个月" },
    { k: "有效期", v: "10年" },
    { k: "入境次数", v: "多次" },
  ],
  tags: [
    { icon: "shield", label: "含面试辅导" },
    { icon: "doc", label: "DS-160审核" },
    { icon: "bolt", label: "优先预约" },
  ],

  overviewTitle: "美国，一览无余",
  overviewSub:
    "B1/B2签证涵盖旅游观光、探亲访友、就医治疗及短期商务活动，不含工作许可。新加坡护照停留90天以内可改用ESTA电子旅行授权（40美元）；中国大陆护照必须办理签证，且出行前须完成EVUS登记。",
  glance: [
    { icon: "globe", k: "首都", v: "华盛顿特区", sub: "UTC −5至−10（因州而异）" },
    { icon: "clock", k: "最佳旅行时间", v: "5月–9月", sub: "因地区而异" },
    { icon: "currency", k: "政府费用", v: "185美元（约240新元）", sub: "MRV签证费 · 不予退还 · 新加坡及中国国籍无附加互惠费" },
    { icon: "pin", k: "热门目的地", v: "纽约 · 洛杉矶 · 旧金山", sub: "以及芝加哥、拉斯维加斯、迈阿密、夏威夷" },
  ],

  processTitle: "B1/B2签证申请流程",
  processSub:
    "需完成DS-160在线申请并前往美国驻新加坡大使馆现场面试。目前面试排期不足2周，面试通过后约1周返还护照——VIZA负责准备全部表格并全程跟踪。使馆建议至少提前3个月申请。",
  steps: [
    {
      title: "在VIZA提交申请",
      body: "告知您的出行记录、工作情况及访美目的。我们为您起草DS-160表格——包括必填的社交媒体账号申报——并逐项核对领事馆指引要求。",
    },
    {
      title: "递交DS-160并预约面试",
      body: "您的VIZA顾问在ceac.state.gov完成DS-160终审，通过ustraveldocs.com代缴185美元MRV签证费，并为您锁定美国驻新加坡大使馆最早的面试名额——目前排期不足2周。",
    },
    {
      title: "面试准备与进度跟踪",
      body: "我们将发送个性化面试辅导材料、高频问题集及材料清单。面试时将采集十指指纹及照片。面试当天，顾问全程待命，随时解答临时问题。",
      statusRows: [
        { label: "DS-160已确认并完成面试预约", ts: "7月3日 上午10:15", onTime: true },
        { label: "面试辅导包已发送", ts: "7月3日 下午2:00", onTime: true },
        { label: "面试定于7月10日 — 准备中", ts: "处理中" },
      ],
    },
    {
      title: "7月17日 护照连同签证返还",
      body: "面试通过后，通常约1周即可领回贴有10年有效B1/B2签证的护照。VIZA顾问确认签收并说明入境注意事项，中国护照持有人的EVUS登记也由我们代办。",
      delivered: true,
    },
  ],

  docsTitle: "所需申请材料",
  docsSub:
    "面试前，VIZA顾问会逐项核查每份材料的完整性及一致性。补传文件次数不限，完全免费。",
  documents: [
    { name: "有效护照", sub: "新加坡及中国护照：有效期覆盖停留期即可（六个月免除条款国家）· 至少1页空白页" },
    { name: "DS-160确认页", sub: "打印或保存条形码页 · 通过ceac.state.gov填写 · 含社交媒体账号申报" },
    { name: "电子照片", sub: "600×600至1200×1200像素 · 白色背景 · 6个月内拍摄 · 不得佩戴眼镜" },
    { name: "MRV缴费收据及预约确认函", sub: "185美元经ustraveldocs.com/sg缴纳 · 美国驻新加坡大使馆面试确认" },
    { name: "财务证明（建议提供）", sub: "银行流水、工资单或担保函，证明有能力支付旅行费用" },
    { name: "与本国联系证明（建议提供）", sub: "工作证明、房产或家庭关系材料，证明有意向回国——第214(b)条审查核心" },
  ],

  rejectionTitle: "B1/B2签证常见被拒原因",
  rejectionSub:
    "美国领事官员默认申请人具有移民倾向。VIZA在面试前协助您针对以下风险点做好充分准备。",
  rejectionReasons: [
    { title: "未能证明非移民意图 — 《移民与国籍法》第214(b)条", body: "最常见的拒签依据：签证官无法认定您会返回本国。稳定的工作、房产、家庭及财务联系至关重要。此拒签并非永久性——情况改变后可重新申请，但185美元费用不予退还。" },
    { title: "申请不完整 / 行政审查 — 第221(g)条", body: "材料缺失或需额外安全审查。须在一年内补交所要求的材料，否则须重新申请并再次缴费。VIZA的递交前审核可避免绝大多数221(g)搁置。" },
    { title: "欺诈或虚假陈述 — 第212(a)(6)(C)(i)条", body: "任何虚假陈述或伪造文件将触发永久禁止入境，须申请豁免方可解除。填写DS-160切勿猜测或夸大。" },
    { title: "曾有非法滞留记录 — 第212(a)(9)(B)条", body: "此前在美非法滞留超过180天将触发3年禁止入境；满1年则触发10年禁令。" },
    { title: "资金不足 / 公共负担 — 第212(a)(4)条", body: "无法证明有能力支付旅行费用——赴美就医的申请人尤须注意。清晰的财务证明即可化解。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "美国无需填写入境卡——航空及海路入境会自动生成电子I-94记录（可在i94.cbp.dhs.gov查询）。签证不保证入境：CBP边检官员会现场拍照核验、决定停留期限，并可能要求出示回程机票、资金证明及住宿信息。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "多次", sub: "新加坡及中国护照均为自签发日起10年有效" },
    { icon: "clock", k: "每次停留时长", v: "最长6个月", sub: "由CBP入境时决定 · 记录于电子I-94" },
    { icon: "plane", k: "ESTA（新加坡护照）", v: "最长90天", sub: "须持回程或续程机票 · 不可延期" },
    { icon: "alert", k: "EVUS（中国护照）", v: "登机前必须完成登记", sub: "在evus.gov缴纳30美元 · 有效期2年 · 未登记航空公司将拒绝登机" },
  ],

  extensionTitle: "签证延期与超期居留",
  extensionSub:
    "持B1/B2入境者可在I-94到期前向USCIS递交I-539表格申请延期——USCIS建议至少提前45天。美国没有按日计算的超期罚款，但后果远为严重：超期哪怕一天签证即自动作废，长期超期将触发多年禁止入境。ESTA入境不可延期。",
  extension: [
    { icon: "extend", k: "延期", v: "每次最长6个月", sub: "I-539表格 · 在线420美元（约545新元）/ 纸质470美元（约610新元）" },
    { icon: "alert", k: "超期处罚", v: "签证作废 + 禁止入境", sub: "无按日罚款 · 超期180天以上→禁入3年 · 满1年→禁入10年 · 并丧失ESTA资格" },
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
      q: "新加坡护照持有人需要办B1/B2签证吗？",
      a: "通常不需要。新加坡是美国免签计划（VWP）成员国，旅游或商务停留90天以内只需办理ESTA电子旅行授权——在esta.cbp.dhs.gov缴纳40美元（约52新元），有效期2年，通常几分钟内获批（建议至少提前72小时申请）。以下情况才需B1/B2签证：停留超过90天，或不符合免签计划资格——例如2021年1月12日后曾赴古巴、2011年3月1日后曾赴伊朗、伊拉克、朝鲜、利比亚、索马里、苏丹、叙利亚或也门，或曾被ESTA拒签、有超期记录。VIZA会按您的行程选择合适的申请路径。",
    },
    {
      category: "基本信息",
      q: "中国大陆护照持有人如何申请？",
      a: "中国大陆护照赴美必须持签证，不适用ESTA。好消息是：B1/B2签证为10年有效、多次入境，除185美元MRV费外无附加互惠费。两项中国护照专属规定：持10年签证者每次出行前须在evus.gov完成EVUS登记（30美元，有效期2年）；居住在新加坡的中国公民可凭在新居留证明在美国驻新加坡大使馆面试申请。签证申请与EVUS登记均由VIZA代办。",
    },
    {
      category: "基本信息",
      q: "持B1/B2签证可以在美国工作吗？",
      a: "不可以。B1/B2签证不授权任何形式的就业或有偿工作。B1涵盖商务会议、参展及谈判，B2涵盖旅游、探亲及就医。任何接受美国雇主报酬的人员须申请其他类别的签证。",
    },
    {
      category: "申请流程",
      q: "B1/B2签证的费用是多少？",
      a: "政府MRV签证费为185美元（约240新元），不予退还，新加坡及中国国籍无额外签发费。2025年7月立法新增的250美元“签证诚信费”目前尚未开始征收——VIZA持续跟踪，若政策落地会在您付款前提示。2026年7月至12月期间，可选缴纳750美元加急费，在指定使领馆保证10个工作日内安排面试。",
    },
    {
      category: "申请流程",
      q: "整个B1/B2申请流程需要多长时间？",
      a: "新加坡的排期非常理想：根据travel.state.gov全球面试等待时间数据，目前面试名额2周内即可约到；面试通过后护照通常约1周寄回，仅在触发第221(g)条行政审查时才会延长。使馆仍建议至少提前3个月申请。VIZA每日监控名额，为您锁定最早的面试时间。",
    },
    {
      category: "申请流程",
      q: "未成年人需要参加面试吗？",
      a: "需要。自2025年9月至10月起，美国国务院已取消几乎所有面试豁免，包括按年龄豁免的政策：14岁以下儿童及79岁以上申请人现均须现场面试。目前主要保留的豁免是：全额有效期B1/B2签证到期后12个月内续签，且上次签发时申请人已年满18岁。VIZA会为您确认续签是否符合豁免条件。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "面试被拒后怎么办？",
      a: "185美元MRV费不予退还。签证官会告知拒签依据——最常见为第214(b)条。VIZA将复盘您的申请材料，找出薄弱环节，协助您准备更充分的申请；大多数申请人在自身情况发生实质改变后即可重新申请。",
    },
  ],

  sources: [
    { label: "美国国务院 — 访客签证（B1/B2）", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html", display: "travel.state.gov" },
    { label: "DS-160在线非移民签证申请（CEAC）", url: "https://ceac.state.gov/genniv/", display: "ceac.state.gov" },
    { label: "美国签证申请 — 新加坡（预约面试）", url: "https://www.ustraveldocs.com/sg/sg-niv-appointmentschedule.asp", display: "ustraveldocs.com" },
    { label: "签证服务费用表（MRV 185美元）", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html", display: "travel.state.gov" },
    { label: "免签计划与ESTA（新加坡，90天）", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html", display: "travel.state.gov" },
    { label: "ESTA官方申请网站", url: "https://esta.cbp.dhs.gov/", display: "esta.cbp.dhs.gov" },
    { label: "EVUS官方登记网站（中国10年签证持有人）", url: "https://www.evus.gov/", display: "evus.gov" },
    { label: "USCIS — I-539延期申请表", url: "https://www.uscis.gov/i-539", display: "uscis.gov" },
    { label: "USCIS — 非法居留与不可入境性", url: "https://www.uscis.gov/laws-and-policy/other-resources/unlawful-presence-and-inadmissibility", display: "uscis.gov" },
    { label: "签证拒签说明（第214(b)、221(g)、212(a)条）", url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/visa-denials.html", display: "travel.state.gov" },
  ],

  price: {
    etaLabel: "目标面试日期",
    etaValue: "2026年7月10日 上午9:00",
    title: "美国 B1/B2 签证 · 10年有效期",
    saving: "含专家全程辅导",
    sub: "全包服务，含DS-160审核、面试辅导及准时保障。",
    foot: "MRV申请费与VIZA服务费在结账时统一收取。",
  },

  aiPlaceholder: "请随时提问关于美国B1/B2签证的任何问题——DS-160、ESTA、面试、处理时长……",
};

export default unitedStates;
