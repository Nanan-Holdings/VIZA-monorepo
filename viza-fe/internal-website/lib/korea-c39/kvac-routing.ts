export type KvacCenterCode =
  | "beijing"
  | "shanghai"
  | "guangzhou"
  | "wuhan"
  | "xian"
  | "shenyang";

export interface KvacCenter {
  code: KvacCenterCode;
  nameEn: string;
  nameZh: string;
  officialUrl: string;
  bookingUrl: string;
  addressZh: string;
  phone?: string;
  provinces: string[];
  serviceMode: "appointment_required" | "appointment_preferred";
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
    provinces: ["北京", "天津", "河北", "山西", "内蒙古", "新疆", "西藏", "青海"],
    serviceMode: "appointment_preferred",
  },
  {
    code: "shanghai",
    nameEn: "Korea Visa Application Center Shanghai",
    nameZh: "韩国签证申请中心（上海）",
    officialUrl: "https://www.visaforkorea-sh.com/",
    bookingUrl: "https://www.visaforkorea-sh.com/visacenter/booking/insert",
    addressZh: "上海市长宁区仙霞路99号尚嘉中心办公楼31层3101号",
    provinces: ["上海", "安徽", "江苏", "浙江"],
    serviceMode: "appointment_required",
  },
  {
    code: "guangzhou",
    nameEn: "Korea Visa Application Center Guangzhou",
    nameZh: "韩国签证申请中心（广州）",
    officialUrl: "https://www.visaforkorea-gz.com/",
    bookingUrl: "https://www.visaforkorea-gz.com/visacenter/booking/insert",
    addressZh: "广州市天河区珠江东路28号越秀金融大厦14层09-16单元",
    provinces: ["广东", "福建", "海南", "广西"],
    serviceMode: "appointment_preferred",
  },
  {
    code: "wuhan",
    nameEn: "Korea Visa Application Center Wuhan",
    nameZh: "韩国签证申请中心（武汉）",
    officialUrl: "https://www.koreavisa-wh.com/",
    bookingUrl: "https://www.koreavisa-wh.com/visacenter/booking/insert",
    addressZh: "武汉韩国签证申请中心",
    provinces: ["湖北", "湖南", "河南", "江西"],
    serviceMode: "appointment_preferred",
  },
  {
    code: "xian",
    nameEn: "Korea Visa Application Center Xi'an",
    nameZh: "韩国签证申请中心（西安）",
    officialUrl: "https://www.visaforkorea-xa.com/",
    bookingUrl: "https://www.visaforkorea-xa.com/visacenter/booking/insert",
    addressZh: "西安韩国签证申请中心",
    provinces: ["陕西", "甘肃", "宁夏"],
    serviceMode: "appointment_preferred",
  },
  {
    code: "shenyang",
    nameEn: "Korea Visa Application Center Shenyang",
    nameZh: "韩国签证申请中心（沈阳）",
    officialUrl: "https://www.visaforkorea-sy.com/",
    bookingUrl: "https://www.visaforkorea-sy.com/visacenter/booking/insert",
    addressZh: "沈阳韩国签证申请中心",
    provinces: ["辽宁", "吉林", "黑龙江"],
    serviceMode: "appointment_preferred",
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
  };
}
