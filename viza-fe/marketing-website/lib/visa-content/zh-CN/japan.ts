// zh-CN 简体中文翻译 — 日本签证内容
// 事实核查日期：2026-07-05，依据 mofa.go.jp、evisa.mofa.go.jp、sg.emb-japan.go.jp、
// visa.vfsglobal.com 及 services.digital.go.jp 官方信息。
// 待运营确认事项：
//   - 2026年7月1日起的新签证费（单次 JPY 15,000 / 多次 JPY 30,000）经领馆页面及
//     行业通告核实，未能直接读取 MOFA 页面（地域屏蔽）；请确认 VFS 新加坡实际收取的
//     新加坡元金额（其一页纸指南在 2026-07-05 仍显示旧价 S$26/S$53）。
//   - JPY 15,000 新费率是否同样适用于 eVISA 在线刷卡付款，尚待官方确认（预期一致）。
//   - 费率调整后各国互惠减免（含中国国籍）尚未确认。
//   - 日本驻新加坡大使馆针对中国公民的"观光"材料清单未能直接读取，下列材料为
//     MOFA/VFS 标准清单，发布前请对照最新清单 PDF。
//   - 新元换算按 JPY 100 ≈ SGD 0.87（2026年年中汇率），发布前请更新。
// 英文原文见 ../japan.ts

import type { VisaContent } from "../types";

export const japan: VisaContent = {
  slug: "japan",

  heroTitle: "日本旅游签证",
  lede: "日本短期停留（Temporary Visitor）单次签证，最长可停留90天，签发后3个月内须入境，可通过日本电子签（JAPAN eVISA）在线办理——由您的VIZA顾问全程准备、递交并跟踪。持新加坡护照者无需签证，可免签停留90天。",
  heroImage: "/assets/heroes/japan.jpg",
  meta: [
    { k: "签证类型", v: "短期停留" },
    { k: "停留时长", v: "最长90天" },
    { k: "有效期", v: "3个月内入境" },
    { k: "入境次数", v: "单次" },
  ],
  tags: [
    { icon: "bolt", label: "快速通道" },
    { icon: "shield", label: "准时保障" },
    { icon: "doc", label: "专家文件审核" },
  ],

  overviewTitle: "日本，一览无余",
  overviewSub:
    "短期停留签证适用于旅游观光、探亲访友及短期商务出行。新加坡公民可免签入境90天；居住在新加坡的需签证国籍人士（如中国公民）可通过 JAPAN eVISA 或 VFS Global 申请。",
  glance: [
    { icon: "globe", k: "首都", v: "东京", sub: "UTC +9（日本标准时间）" },
    { icon: "clock", k: "最佳旅行时间", v: "3月–5月 · 10月–11月", sub: "赏樱花与秋叶" },
    { icon: "currency", k: "货币", v: "日元（JPY）", sub: "SGD 1 ≈ JPY 115" },
    { icon: "pin", k: "热门目的地", v: "东京 · 京都 · 大阪", sub: "以及广岛、奈良、北海道" },
  ],

  processTitle: "日本签证申请流程",
  processSub:
    "一次性提交材料，VIZA顾问按外务省（MOFA）要求备齐全套材料，通过 JAPAN eVISA 门户或 VFS Global 新加坡递交并全程跟踪。请预留至少10个工作日——日本不受理任何加急申请。",
  steps: [
    {
      title: "在VIZA提交申请",
      body: "上传护照、证件照、新加坡居留准证、机票预订单及银行流水。须在出行日期前3个月内递交，我们将按您的出发日期倒排时间计划。",
    },
    {
      title: "材料审核与递交",
      body: "您的顾问代填 MOFA 官方申请表并编制逐日《滞在预定表》（Taizai Yoteihyo），逐项核对日本驻新加坡大使馆的清单要求，然后通过 eVISA 门户或 VFS Global 递交。",
    },
    {
      title: "使馆审核签证",
      body: "MOFA 官方标准为完整材料受理后5个工作日办结，但日本驻新加坡大使馆建议预留至少10个工作日。我们全程跟踪各领事审核环节，如有补件要求即时通知您。",
      statusRows: [
        { label: "申请已递交至日本大使馆", ts: "6月12日 上午9:00", onTime: true },
        { label: "材料已受理 — 领事审核中", ts: "6月12日 上午11:30", onTime: true },
        { label: "等待领事馆最终审批", ts: "处理中" },
      ],
    },
    {
      title: "6月17日下午2:00 签证送达",
      body: "eVISA 申请人将收到电子邮件发放的《签证发给通知（Visa Issuance Notice）》——值机时在手机屏幕上出示即可（不接受打印件）；纸质申请人则通过 VFS 领回贴有签证的护照。",
      delivered: true,
    },
  ],

  docsTitle: "所需申请材料",
  docsSub:
    "VIZA顾问在递交前审核每一份材料。补传文件次数不限，完全免费。",
  documents: [
    { name: "护照个人信息页", sub: "有效期须覆盖全程停留 · 至少2页空白页 · 无6个月有效期要求" },
    { name: "签证申请表", sub: "MOFA 官方表格——由您的顾问代为填写准备" },
    { name: "近期证件照", sub: "45×35毫米 · 纯白色背景 · 6个月内拍摄 · 不可戴眼镜" },
    { name: "新加坡居留证明", sub: "PR、工作准证、学生准证、家属准证或长期探访准证" },
    { name: "机票行程单", sub: "已确认或已预订的往返机票" },
    { name: "滞在预定表（逐日行程）", sub: "按 MOFA 格式列明每日安排及酒店名称、地址、电话" },
    { name: "资金证明", sub: "可覆盖全程费用的近期银行流水" },
  ],

  rejectionTitle: "日本签证常见被拒原因",
  rejectionSub:
    "外务省从不公开具体拒签理由，且被拒后6个月内不受理同一目的的新申请。VIZA会在您递交前提前排查以下风险点。",
  rejectionReasons: [
    { title: "资金证明不足", body: "银行流水不足以覆盖旅行开销，或申请前不久出现无法解释的大额入账。" },
    { title: "材料不完整或前后矛盾", body: "缺少滞在预定表，或行程、预订与申请表之间日期不一致——这是最常见的拒签原因。" },
    { title: "访问目的存疑", body: "与居住国联系薄弱，或被怀疑有赴日工作或超期居留的意图。" },
    { title: "曾有移民违规记录", body: "曾在日本超期居留或被遣返、有犯罪记录，或存在《出入国管理法》第5条规定的其他拒绝入境事由。" },
    { title: "递交至错误的使领馆", body: "未持有新加坡PR或长期准证的外国人，不能通过日本驻新加坡大使馆或VFS新加坡申请。" },
  ],

  entryTitle: "入境与离境规定",
  entrySub:
    "所有外国旅客入境时均须采集指纹及面部照片。建议提前在 Visit Japan Web（vjw.digital.go.jp）登记入境与海关信息并生成二维码——非强制但强烈推荐，羽田、成田、关西机场已启用一码通行的联合查验闸机。请随身备妥回程机票及资金证明。",
  entryExit: [
    { icon: "refresh", k: "入境次数", v: "单次", sub: "多次签证仅限符合条件的申请人" },
    { icon: "clock", k: "入境期限", v: "3个月内", sub: "自签证签发日期起计算" },
    { icon: "doc", k: "Visit Japan Web", v: "二维码（可选）", sub: "预先登记入境与海关信息" },
    { icon: "currency", k: "离境税", v: "JPY 3,000", sub: "≈ SGD 26 · 已含在机票票价内" },
  ],

  extensionTitle: "签证延期与超期居留",
  extensionSub:
    "短期停留原则上仅在患病等迫不得已的特殊情况下才获准延期，常规旅游延期几乎不被批准。在日本，超期居留属刑事犯罪，而非按日罚款。",
  extension: [
    { icon: "extend", k: "延期", v: "仅限特殊情况", sub: "获批后缴费：柜台 JPY 6,000 / 在线 JPY 5,500" },
    { icon: "alert", k: "超期处罚", v: "最高 JPY 3,000,000", sub: "≈ SGD 26,000 罚金，或最高3年监禁" },
    { icon: "ban", k: "禁止再入境", v: "1–10年", sub: "主动申报离境1年 · 被遣返5年 · 再犯10年" },
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
      q: "日本短期停留签证是什么？",
      a: "即日本面向旅游观光、探亲访友及短期商务的短期停留签证（Temporary Visitor），单次入境，可获准停留15、30或90天，签发后3个月内须入境。符合条件的申请人可通过 JAPAN eVISA（evisa.mofa.go.jp）全程在线办理，两种方式均由VIZA全程代办。",
    },
    {
      category: "基本信息",
      q: "持新加坡护照去日本需要签证吗？",
      a: "不需要。新加坡公民可免签以短期停留身份入境日本，最长90天，无任何费用，目前也无需预先登记。自2028财年起，新加坡公民登机前将需先获得 JESTA 电子旅行许可；在此之前只需有效护照即可（Visit Japan Web 二维码可选）。",
    },
    {
      category: "基本信息",
      q: "我持中国护照、居住在新加坡，应如何申请？",
      a: "中国普通护照持有人赴日一律需要签证。持新加坡PR或长期准证（EP、SP、学生准证、家属准证、LTVP）者，可通过 JAPAN eVISA 在线申请，或经 VFS Global 新加坡递交纸质申请——VIZA全程代办。若常住中国大陆，则须通过日本指定的旅行社办理。",
    },
    {
      category: "申请流程",
      q: "日本签证费用是多少？",
      a: "2026年7月1日起递交的申请，政府签证费为单次 JPY 15,000（约 SGD 130）、多次 JPY 30,000（约 SGD 260）——这是日本自1978年以来首次调整签证费。纸质申请另收 VFS Global 新加坡服务费 SGD 22。签证费仅在获签时收取。",
    },
    {
      category: "申请流程",
      q: "日本签证需要多长时间处理？",
      a: "MOFA 官方标准为完整材料受理次日起5个工作日，但日本驻新加坡大使馆建议至少预留10个工作日，且日本不受理任何加急。请在出行日期前3个月内递交；VIZA一次性提交完整材料，避免复杂个案因反复补件拖至一个月以上。",
    },
    {
      category: "退款、拒签与重新申请",
      q: "申请被拒后怎么办？",
      a: "外务省不公开拒签理由，且拒签之日起6个月内不受理同一目的的新申请。VIZA将全额退还服务费，分析材料中可能的薄弱环节，并在6个月限制期满后第一时间协助您递交更有力的新申请。",
    },
  ],

  sources: [
    { label: "JAPAN eVISA 官方门户（外务省）", url: "https://www.evisa.mofa.go.jp/", display: "evisa.mofa.go.jp" },
    { label: "日本外务省 — JAPAN eVISA 系统", url: "https://www.mofa.go.jp/j_info/visit/visa/visaonline.html", display: "mofa.go.jp" },
    { label: "日本外务省 — 短期停留免签国家名单", url: "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html", display: "mofa.go.jp" },
    { label: "日本外务省 — 签证费用", url: "https://www.mofa.go.jp/j_info/visit/visa/procedure/pagewe_000001_00391.html", display: "mofa.go.jp" },
    { label: "日本驻新加坡大使馆 — 赴日签证", url: "https://www.sg.emb-japan.go.jp/itpr_en/visit.html", display: "sg.emb-japan.go.jp" },
    { label: "VFS Global — 日本签证（新加坡）", url: "https://visa.vfsglobal.com/sgp/en/jpn/", display: "visa.vfsglobal.com" },
    { label: "Visit Japan Web（日本数字厅）", url: "https://services.digital.go.jp/en/visit-japan-web/", display: "services.digital.go.jp" },
  ],

  price: {
    etaLabel: "立即申请，预计送达",
    etaValue: "2026年6月17日 下午2:00",
    title: "短期停留签证 · 最长90天",
    saving: "比直接申请更高效",
    sub: "全包服务，含材料审核、申请准备及准时保障。",
    foot: "政府签证费与VIZA服务费在结账时统一收取，并享有准时保障。",
  },

  aiPlaceholder: "请随时提问关于日本签证的任何问题——eVISA资格、费用、新加坡免签政策……",
};

export default japan;
