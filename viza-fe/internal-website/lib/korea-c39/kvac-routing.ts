export type KvacCenterCode =
  | "beijing"
  | "shanghai"
  | "guangzhou"
  | "wuhan"
  | "xian"
  | "shenyang"
  | "chengdu"
  | "qingdao";

export interface KvacCenter {
  code: KvacCenterCode;
  nameEn: string;
  nameZh: string;
  officialUrl: string;
  bookingUrl: string | null;
  addressZh: string;
  phone?: string;
  provinces: string[];
  consularPostZh: string;
  consularPostEn: string;
  serviceMode: "appointment_required" | "appointment_preferred" | "center_guidance_required";
  liveBookingMode: "sms_sync_supported" | "site_recon_only" | "official_guidance_only";
  acceptsWalkIn: boolean | null;
  appointmentRuleZh: string;
  appointmentRuleEn: string;
  liveBookingRuleZh: string;
  liveBookingRuleEn: string;
  importantNoticesZh: string[];
  importantNoticesEn: string[];
  sourceUrls: string[];
  sourceCheckedAt: string;
}

export interface KvacRoutingInput {
  currentResidenceProvince?: string | null;
  hasResidenceProof?: boolean | null;
  hukouProvince?: string | null;
}

export interface KvacRoutingResult {
  basis: "current_residence" | "hukou" | "ambiguous";
  recommended: KvacCenter;
  alternatives: KvacCenter[];
  matchedProvince: string | null;
  allCenters: KvacCenter[];
}

const MUNICIPALITY_ALIASES: Record<string, string> = {
  北京市: "北京",
  上海市: "上海",
  天津市: "天津",
  重庆市: "重庆",
};

export const KVAC_CENTERS: KvacCenter[] = [
  {
    code: "beijing",
    nameEn: "Korea Visa Application Center Beijing",
    nameZh: "韩国签证申请中心（北京）",
    officialUrl: "https://www.visaforkorea-bj.com/",
    bookingUrl: "https://www.visaforkorea-bj.com/visacenter/booking/insert",
    addressZh: "北京市辖区韩国签证申请中心",
    phone: "400-813-3666",
    provinces: ["北京", "天津", "河北", "山西", "内蒙古", "新疆", "西藏", "青海"],
    consularPostZh: "大韩民国驻中国大使馆",
    consularPostEn: "Embassy of the Republic of Korea in China",
    serviceMode: "appointment_preferred",
    liveBookingMode: "sms_sync_supported",
    acceptsWalkIn: true,
    appointmentRuleZh: "北京中心提供网约优先服务；预约成功后到场需携带预约确认单打印件。",
    appointmentRuleEn: "Beijing offers appointment-priority service. Bring the printed appointment confirmation after booking.",
    liveBookingRuleZh: "VIZA 已验证北京 visaforkorea 官网短信同步流程：后端可点击官网发码，用户在 VIZA 输入验证码后继续读取官方时段；最终预约仍需用户授权。",
    liveBookingRuleEn: "VIZA has validated Beijing visaforkorea SMS sync: the backend can trigger the official SMS, the user enters the code in VIZA, and the worker observes the official slot. Final booking still requires user approval.",
    importantNoticesZh: [
      "手机号码填写大陆 11 位号码，不带 +86 或连字符。",
      "官网提示同一申请人不要重复预约，重复预约可能被取消。",
      "建议提前下载并填写 5 页签证申请表，到场签字提交。",
    ],
    importantNoticesEn: [
      "Enter the mainland China 11-digit mobile number without +86 or hyphens.",
      "Do not create duplicate reservations for the same applicant; duplicates may be cancelled.",
      "Download and fill the 5-page visa application form before visiting; sign it in wet ink.",
    ],
    sourceUrls: [
      "https://www.visaforkorea-bj.com/visacenter/booking/insert",
      "https://www.visaforkorea-bj.com/info/center",
    ],
    sourceCheckedAt: "2026-07-02",
  },
  {
    code: "shanghai",
    nameEn: "Korea Visa Application Center Shanghai",
    nameZh: "韩国签证申请中心（上海）",
    officialUrl: "https://www.visaforkorea-sh.com/",
    bookingUrl: "https://www.visaforkorea-sh.com/visacenter/booking/insert",
    addressZh: "上海市长宁区仙霞路99号尚嘉中心办公楼31层3101号",
    provinces: ["上海", "安徽", "江苏", "浙江"],
    consularPostZh: "大韩民国驻上海总领事馆",
    consularPostEn: "Consulate General of the Republic of Korea in Shanghai",
    serviceMode: "appointment_required",
    liveBookingMode: "sms_sync_supported",
    acceptsWalkIn: false,
    appointmentRuleZh: "上海中心官方预约页提示：未提前预约者无法现场受理；旅游签证需预约后线下申请。",
    appointmentRuleEn: "Shanghai states that applicants without an advance reservation cannot be accepted on site; tourist visa applicants should book before visiting.",
    liveBookingRuleZh: "上海使用同构 visaforkorea 预约页；VIZA 可进入短信同步流程，但真实发码/最终确认需用户验证码和最终授权。",
    liveBookingRuleEn: "Shanghai uses the same visaforkorea booking family. VIZA can enter SMS-sync flow, but live SMS and final confirmation require the user's code and approval.",
    importantNoticesZh: [
      "旅游签证申请请优先完成线上预约。",
      "除旅游签证以外，其他签证类型以中心/领馆当日说明为准。",
      "到场时携带预约确认单和已填写签证申请表。",
    ],
    importantNoticesEn: [
      "Book online before visiting for tourist visa submission.",
      "For non-tourist categories, follow the center or consulate's current instructions.",
      "Bring the appointment confirmation and completed visa application form.",
    ],
    sourceUrls: ["https://www.visaforkorea-sh.com/visacenter/booking/insert"],
    sourceCheckedAt: "2026-07-02",
  },
  {
    code: "guangzhou",
    nameEn: "Korea Visa Application Center Guangzhou",
    nameZh: "韩国签证申请中心（广州）",
    officialUrl: "https://www.visaforkorea-gz.com/",
    bookingUrl: "https://www.visaforkorea-gz.com/visacenter/booking/insert",
    addressZh: "广州市天河区珠江东路28号越秀金融大厦14层09-16单元",
    provinces: ["广东", "福建", "海南", "广西"],
    consularPostZh: "大韩民国驻广州总领事馆",
    consularPostEn: "Consulate General of the Republic of Korea in Guangzhou",
    serviceMode: "appointment_preferred",
    liveBookingMode: "sms_sync_supported",
    acceptsWalkIn: true,
    appointmentRuleZh: "广州中心官方预约页提示：没有预约也可按工作日办公时间现场取号申请；预约可减少等待。",
    appointmentRuleEn: "Guangzhou states that applicants without an appointment may take an on-site number during business hours; booking can reduce waiting time.",
    liveBookingRuleZh: "广州使用同构 visaforkorea 预约页；VIZA 可进入短信同步流程。无预约也可现场取号，但预约通常可减少等待。",
    liveBookingRuleEn: "Guangzhou uses the same visaforkorea booking family. VIZA can enter SMS-sync flow. Walk-in numbers may be available, but booking usually reduces waiting.",
    importantNoticesZh: [
      "预约后请下载并填写签证申请表；申请表不能双面打印，最后一页需手写签名。",
      "C-3-9 如缺少必要文件可能被拒签，请按广州总领馆/中心要求准备材料。",
      "同一预约号码的非直系亲属申请人需与预约人一起到场。",
    ],
    importantNoticesEn: [
      "Download and complete the visa application form after booking; do not print double-sided and wet-sign the final page.",
      "C-3-9 applications may be refused if required documents are missing; follow Guangzhou consulate/center instructions.",
      "Non-immediate-family applicants under the same reservation number should visit together with the booking person.",
    ],
    sourceUrls: [
      "https://www.visaforkorea-gz.com/visacenter/booking/insert",
      "https://www.visaforkorea-gz.com/",
    ],
    sourceCheckedAt: "2026-07-02",
  },
  {
    code: "wuhan",
    nameEn: "Korea Visa Application Center Wuhan",
    nameZh: "韩国签证申请中心（武汉）",
    officialUrl: "https://www.koreavisa-wh.com/",
    bookingUrl: "https://www.koreavisa-wh.com/zh-CN",
    addressZh: "武汉市江汉区新华路218号浦发银行大厦16层3-6室",
    phone: "4008-008-389",
    provinces: ["湖北", "湖南", "河南", "江西"],
    consularPostZh: "大韩民国驻武汉总领事馆",
    consularPostEn: "Consulate General of the Republic of Korea in Wuhan",
    serviceMode: "appointment_preferred",
    liveBookingMode: "site_recon_only",
    acceptsWalkIn: null,
    appointmentRuleZh: "武汉总领馆公告介绍 2025-07-15 起由武汉签证申请中心办理旅游、留学、商务、探亲、结婚等签证；家属死亡、看护病人、修学旅行团、公务签证需访问领事馆申请。",
    appointmentRuleEn: "The Wuhan consulate announced that the Wuhan visa center handles tourist, study, business, family visit, marriage and similar visas from 2025-07-15; bereavement, patient care, school trip, and official-duty visas should be filed at the consulate.",
    liveBookingRuleZh: "武汉中心使用独立站点，当前 VIZA 只验证入口可达与规则展示；如遇预约、账号、短信或人工审核，必须停在 manual checkpoint。",
    liveBookingRuleEn: "Wuhan uses a separate site. VIZA currently validates entry reachability and rule guidance only; booking/account/SMS/manual review gates must stop as manual checkpoints.",
    importantNoticesZh: [
      "武汉中心是否必须预约需以中心当前页面为准；无法确认时请先电话/邮件核实。",
      "特殊人道/公务类情形不要直接走普通 KVAC 预约，应按领馆公告到领事馆申请。",
    ],
    importantNoticesEn: [
      "Confirm current appointment requirements with the Wuhan center when the center page is unclear.",
      "Humanitarian or official-duty cases should follow the consulate notice rather than ordinary KVAC booking.",
    ],
    sourceUrls: [
      "https://www.mofa.go.kr/cn-wuhan-zh/brd/m_974/view.do?seq=761729",
      "https://www.koreavisa-wh.com/zh-CN",
    ],
    sourceCheckedAt: "2026-07-02",
  },
  {
    code: "xian",
    nameEn: "Korea Visa Application Center Xi'an",
    nameZh: "韩国签证申请中心（西安）",
    officialUrl: "https://www.visaforkorea-xa.com/",
    bookingUrl: "https://www.visaforkorea-xa.com/visacenter/booking/insert",
    addressZh: "西安韩国签证申请中心",
    provinces: ["陕西", "甘肃", "宁夏"],
    consularPostZh: "大韩民国驻西安总领事馆",
    consularPostEn: "Consulate General of the Republic of Korea in Xi'an",
    serviceMode: "appointment_preferred",
    liveBookingMode: "sms_sync_supported",
    acceptsWalkIn: null,
    appointmentRuleZh: "西安中心提供提前预约入口；领区为陕西、甘肃、宁夏。现场受理规则请以中心最新公告为准。",
    appointmentRuleEn: "Xi'an provides an advance booking entry and serves Shaanxi, Gansu and Ningxia. On-site acceptance rules should be checked against the latest center notice.",
    liveBookingRuleZh: "西安使用同构 visaforkorea 预约页；VIZA 可进入短信同步流程。现场受理规则仍需以中心当日公告为准。",
    liveBookingRuleEn: "Xi'an uses the same visaforkorea booking family. VIZA can enter SMS-sync flow. Walk-in handling still depends on current center notices.",
    importantNoticesZh: [
      "预约前请确认西安中心最新签证申请指南和放假通知。",
      "如用户现居住地和户籍不同，优先按可证明的现居住地判断领区。",
    ],
    importantNoticesEn: [
      "Check the latest Xi'an visa guide and closure notices before booking.",
      "If residence and hukou differ, use current residence when proof is available.",
    ],
    sourceUrls: ["https://www.visaforkorea-xa.com/"],
    sourceCheckedAt: "2026-07-02",
  },
  {
    code: "shenyang",
    nameEn: "Korea Visa Application Center Shenyang",
    nameZh: "韩国签证申请中心（沈阳）",
    officialUrl: "https://visaforkorea-sy030.com/",
    bookingUrl: "https://visaforkorea-sy030.com/en/schedule-an-appointment.html",
    addressZh: "沈阳韩国签证申请中心",
    phone: "+86 024 2296 5320",
    provinces: ["辽宁", "吉林", "黑龙江"],
    consularPostZh: "大韩民国驻沈阳总领事馆",
    consularPostEn: "Consulate General of the Republic of Korea in Shenyang",
    serviceMode: "appointment_preferred",
    liveBookingMode: "site_recon_only",
    acceptsWalkIn: null,
    appointmentRuleZh: "沈阳中心由 VFS Global 运营，官网提供预约入口；电话渠道曾公告调整，预约前应核对最新联系方式。",
    appointmentRuleEn: "Shenyang is operated by VFS Global and provides a booking entry. Contact options have changed in notices, so confirm the latest contact details before booking.",
    liveBookingRuleZh: "沈阳由 VFS Global 站点承载，当前 VIZA 只验证入口可达；账号、短信、实名或 VFS 队列必须作为 manual checkpoint。",
    liveBookingRuleEn: "Shenyang is on a VFS Global site. VIZA currently validates entry reachability only; account, SMS, real-name, or VFS queue gates must become manual checkpoints.",
    importantNoticesZh: [
      "沈阳中心页面可能按 VFS 流程跳转，worker 需按 VFS 页面 checkpoint 处理。",
      "如遇电话/SMS/账号验证，应暂停并让用户输入一次性验证码。",
    ],
    importantNoticesEn: [
      "The Shenyang flow may redirect through VFS pages; the worker should treat VFS checkpoints explicitly.",
      "Pause for user input when phone, SMS, or account verification appears.",
    ],
    sourceUrls: ["https://visaforkorea-sy030.com/"],
    sourceCheckedAt: "2026-07-02",
  },
  {
    code: "chengdu",
    nameEn: "Korea Visa Application Center Chengdu",
    nameZh: "韩国签证申请中心（成都）",
    officialUrl: "https://www.koreavisa-cd.com/zh-CN",
    bookingUrl: "https://www.koreavisa-cd.com/zh-CN/reservation/apply",
    addressZh: "成都市锦江区东御街18号百扬大厦1栋35层1-2单元",
    phone: "400-0622-123",
    provinces: ["四川", "重庆", "云南", "贵州"],
    consularPostZh: "大韩民国驻成都总领事馆",
    consularPostEn: "Consulate General of the Republic of Korea in Chengdu",
    serviceMode: "appointment_preferred",
    liveBookingMode: "site_recon_only",
    acceptsWalkIn: true,
    appointmentRuleZh: "成都中心实行网上预约办理签证；预约迟到者需和一般申请人一样正常取号等待。网上预约只能提前预约 7 个工作日的到访时间，开放当月及后续两个月。",
    appointmentRuleEn: "Chengdu uses online appointment handling. Late arrivals wait as ordinary applicants. Online booking is available 7 working days ahead and for the current month plus two following months.",
    liveBookingRuleZh: "成都使用独立预约站点，当前 VIZA 只验证入口可达与规则展示；若需打印访问预约证，必须在官方确认返回后保存证明。",
    liveBookingRuleEn: "Chengdu uses a separate booking site. VIZA currently validates entry reachability and rule guidance only; visit-appointment proof must be saved only after official confirmation.",
    importantNoticesZh: [
      "预约后必须打印访问预约证并携带；打印后不能变更预约。",
      "如未提前填写申请书，需比预约时间提前 20 分钟以上到达。",
      "同一人不要重复预约，重复预约可能被取消。",
    ],
    importantNoticesEn: [
      "Print and bring the visit appointment certificate; it cannot be changed after printing.",
      "Arrive at least 20 minutes early if the application form is not pre-filled.",
      "Do not duplicate reservations for the same person; duplicates may be cancelled.",
    ],
    sourceUrls: [
      "https://www.koreavisa-cd.com/zh-CN/reservation/apply",
      "https://www.koreavisa-cd.com/zh-CN",
    ],
    sourceCheckedAt: "2026-07-02",
  },
  {
    code: "qingdao",
    nameEn: "Consulate General of the Republic of Korea in Qingdao",
    nameZh: "大韩民国驻青岛总领事馆签证业务",
    officialUrl: "https://www.mofa.go.kr/cn-qingdao-zh/index.do",
    bookingUrl: null,
    addressZh: "青岛市城阳区春阳路88号",
    phone: "86-532-8897-6001",
    provinces: ["山东"],
    consularPostZh: "大韩民国驻青岛总领事馆",
    consularPostEn: "Consulate General of the Republic of Korea in Qingdao",
    serviceMode: "center_guidance_required",
    liveBookingMode: "official_guidance_only",
    acceptsWalkIn: null,
    appointmentRuleZh: "青岛领区暂无可确认的统一 KVAC 在线预约入口；请按青岛总领事馆最新签证公告、材料指南或指定代办机构要求办理。",
    appointmentRuleEn: "No unified Qingdao KVAC online booking portal is confirmed. Follow the Qingdao consulate's latest visa notices, document guide, or designated agency instructions.",
    liveBookingRuleZh: "青岛当前没有可确认的统一在线预约入口；VIZA 不承诺自动预约，只展示领馆/指定代办机构指引。",
    liveBookingRuleEn: "Qingdao has no confirmed unified online booking portal. VIZA does not claim automated booking here and only shows consulate/designated-agency guidance.",
    importantNoticesZh: [
      "山东申请人不要默认选择北京/上海/广州；先按青岛总领事馆签证公告确认递签方式。",
      "如需代办机构，使用领馆公布的指定代办机构名单，不在页面内承诺自动预约。",
    ],
    importantNoticesEn: [
      "Applicants in Shandong should not default to Beijing, Shanghai or Guangzhou; first confirm the Qingdao filing channel from consulate notices.",
      "If an agency is required, use the consulate-published designated agency list; VIZA will not claim automated booking without a confirmed portal.",
    ],
    sourceUrls: [
      "https://www.mofa.go.kr/cn-qingdao-zh/brd/m_1381/list.do",
      "https://www.mofa.go.kr/cn-qingdao-zh/brd/m_1374/list.do",
    ],
    sourceCheckedAt: "2026-07-02",
  },
];

function normalizeProvince(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withoutSuffix = trimmed
    .replace(/省$/u, "")
    .replace(/市$/u, "")
    .replace(/壮族自治区$/u, "")
    .replace(/回族自治区$/u, "")
    .replace(/维吾尔自治区$/u, "")
    .replace(/自治区$/u, "");
  return MUNICIPALITY_ALIASES[trimmed] ?? withoutSuffix;
}

function findCenter(province: string | null): KvacCenter | null {
  if (!province) return null;
  return KVAC_CENTERS.find((center) => center.provinces.includes(province)) ?? null;
}

export function resolveKvacCenter(input: KvacRoutingInput): KvacRoutingResult {
  const residence = normalizeProvince(input.currentResidenceProvince);
  const hukou = normalizeProvince(input.hukouProvince);
  const residenceCenter = input.hasResidenceProof ? findCenter(residence) : null;
  const hukouCenter = findCenter(hukou);
  const recommended = residenceCenter ?? hukouCenter ?? KVAC_CENTERS[0];
  const basis = residenceCenter ? "current_residence" : hukouCenter ? "hukou" : "ambiguous";

  return {
    basis,
    recommended,
    alternatives: KVAC_CENTERS.filter((center) => center.code !== recommended.code),
    matchedProvince: residenceCenter ? residence : hukouCenter ? hukou : null,
    allCenters: KVAC_CENTERS,
  };
}
