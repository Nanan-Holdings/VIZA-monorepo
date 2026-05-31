import "server-only";

export type CommercialPaymentProvider = "stripe" | "wechat_pay" | "alipay";

export type CommercialProductKind = "monthly" | "pay_per_application";

export interface CommercialProduct {
  id: string;
  kind: CommercialProductKind;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  amountFen: number;
  country?: string;
  visaType?: string;
}

export const COMMERCIAL_PRODUCTS: CommercialProduct[] = [
  {
    id: "monthly_access",
    kind: "monthly",
    name: "VIZA Access monthly plan",
    nameZh: "VIZA Access 月付方案",
    description: "Monthly VIZA access for up to 7 destination countries.",
    descriptionZh: "每月最多 7 个目的地国家的 VIZA 申请入口。",
    amountFen: 17900,
  },
  {
    id: "monthly_pro",
    kind: "monthly",
    name: "VIZA Pro monthly plan",
    nameZh: "VIZA Pro 月付方案",
    description: "Monthly VIZA access for up to 14 destination countries, with AI, group and Travel Agent tools.",
    descriptionZh: "每月最多 14 个目的地国家，并包含 AI、团单和 Travel Agent 能力。",
    amountFen: 34900,
  },
  {
    id: "pay_singapore",
    kind: "pay_per_application",
    name: "Singapore pay-per-application",
    nameZh: "新加坡次付申请",
    description: "One VIZA service window for Singapore visitor intake.",
    descriptionZh: "新加坡访客入境资料的一次 VIZA 服务周期。",
    amountFen: 13900,
    country: "singapore",
    visaType: "entry_visa_or_visit_pass",
  },
  {
    id: "pay_malaysia",
    kind: "pay_per_application",
    name: "Malaysia pay-per-application",
    nameZh: "马来西亚次付申请",
    description: "One VIZA service window for Malaysia visitor intake.",
    descriptionZh: "马来西亚访客入境资料的一次 VIZA 服务周期。",
    amountFen: 13900,
    country: "malaysia",
    visaType: "visa_exemption_or_evisa_tourism",
  },
  {
    id: "pay_thailand",
    kind: "pay_per_application",
    name: "Thailand pay-per-application",
    nameZh: "泰国次付申请",
    description: "One VIZA service window for Thailand visitor intake.",
    descriptionZh: "泰国访客入境资料的一次 VIZA 服务周期。",
    amountFen: 13900,
    country: "thailand",
    visaType: "visa_exemption_or_tourist_visa",
  },
  {
    id: "pay_indonesia",
    kind: "pay_per_application",
    name: "Indonesia pay-per-application",
    nameZh: "印度尼西亚次付申请",
    description: "One VIZA service window for Indonesia visitor intake.",
    descriptionZh: "印度尼西亚访客签证的一次 VIZA 服务周期。",
    amountFen: 20900,
    country: "indonesia",
    visaType: "B211A",
  },
  {
    id: "pay_vietnam",
    kind: "pay_per_application",
    name: "Vietnam pay-per-application",
    nameZh: "越南次付申请",
    description: "One VIZA service window for Vietnam visitor intake.",
    descriptionZh: "越南旅游电子签证的一次 VIZA 服务周期。",
    amountFen: 20900,
    country: "vietnam",
    visaType: "evisa_tourism",
  },
  {
    id: "pay_cambodia",
    kind: "pay_per_application",
    name: "Cambodia pay-per-application",
    nameZh: "柬埔寨次付申请",
    description: "One VIZA service window for Cambodia visitor intake.",
    descriptionZh: "柬埔寨电子签证和入境资料的一次 VIZA 服务周期。",
    amountFen: 20900,
    country: "cambodia",
    visaType: "tourist_evisa",
  },
  {
    id: "pay_united_arab_emirates",
    kind: "pay_per_application",
    name: "United Arab Emirates pay-per-application",
    nameZh: "阿联酋次付申请",
    description: "One VIZA service window for UAE visitor intake.",
    descriptionZh: "阿联酋访客入境资料的一次 VIZA 服务周期。",
    amountFen: 27900,
    country: "united_arab_emirates",
    visaType: "visa_free_or_tourist_visa",
  },
  {
    id: "pay_turkey",
    kind: "pay_per_application",
    name: "Turkiye pay-per-application",
    nameZh: "土耳其次付申请",
    description: "One VIZA service window for Turkiye visitor intake.",
    descriptionZh: "土耳其电子签证的一次 VIZA 服务周期。",
    amountFen: 27900,
    country: "turkey",
    visaType: "evisa_tourism_business",
  },
  {
    id: "pay_japan",
    kind: "pay_per_application",
    name: "Japan pay-per-application",
    nameZh: "日本次付申请",
    description: "One VIZA service window for Japan visitor intake.",
    descriptionZh: "日本短期电子签证和入境资料的一次 VIZA 服务周期。",
    amountFen: 34900,
    country: "japan",
    visaType: "short_term_tourism_evisa",
  },
  {
    id: "pay_south_korea",
    kind: "pay_per_application",
    name: "South Korea pay-per-application",
    nameZh: "韩国次付申请",
    description: "One VIZA service window for South Korea visitor intake.",
    descriptionZh: "韩国 C-3/K-ETA 路线的一次 VIZA 服务周期。",
    amountFen: 34900,
    country: "south_korea",
    visaType: "c3_or_keta",
  },
  {
    id: "pay_australia",
    kind: "pay_per_application",
    name: "Australia pay-per-application",
    nameZh: "澳大利亚次付申请",
    description: "One VIZA service window for Australia visitor intake.",
    descriptionZh: "澳大利亚访客签证的一次 VIZA 服务周期。",
    amountFen: 56900,
    country: "australia",
    visaType: "visitor_subclass_600",
  },
  {
    id: "pay_new_zealand",
    kind: "pay_per_application",
    name: "New Zealand pay-per-application",
    nameZh: "新西兰次付申请",
    description: "One VIZA service window for New Zealand visitor intake.",
    descriptionZh: "新西兰访客签证和旅客申报的一次 VIZA 服务周期。",
    amountFen: 56900,
    country: "new_zealand",
    visaType: "visitor_visa",
  },
  {
    id: "pay_schengen",
    kind: "pay_per_application",
    name: "Schengen Area pay-per-application",
    nameZh: "申根区次付申请",
    description: "One VIZA service window for a Schengen Type C destination.",
    descriptionZh: "一个申根 C 类主要目的地的一次 VIZA 服务周期。",
    amountFen: 63900,
    country: "schengen_area",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
  },
  {
    id: "pay_united_kingdom",
    kind: "pay_per_application",
    name: "United Kingdom pay-per-application",
    nameZh: "英国次付申请",
    description: "One VIZA service window for UK visitor intake.",
    descriptionZh: "英国标准访客签证的一次 VIZA 服务周期。",
    amountFen: 63900,
    country: "united_kingdom",
    visaType: "UK_STANDARD_VISITOR",
  },
  {
    id: "pay_canada",
    kind: "pay_per_application",
    name: "Canada pay-per-application",
    nameZh: "加拿大次付申请",
    description: "One VIZA service window for Canada visitor intake.",
    descriptionZh: "加拿大访客签证的一次 VIZA 服务周期。",
    amountFen: 63900,
    country: "canada",
    visaType: "visitor_visa",
  },
  {
    id: "pay_united_states",
    kind: "pay_per_application",
    name: "United States pay-per-application",
    nameZh: "美国次付申请",
    description: "One VIZA service window for the DS-160 visitor workflow.",
    descriptionZh: "美国 DS-160 访客签证流程的一次 VIZA 服务周期。",
    amountFen: 71900,
    country: "united_states",
    visaType: "DS160",
  },
];

export function getCommercialProduct(productId: string): CommercialProduct | null {
  return COMMERCIAL_PRODUCTS.find((product) => product.id === productId) ?? null;
}

export function formatCny(amountFen: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: amountFen % 100 === 0 ? 0 : 2,
  }).format(amountFen / 100);
}

export function commercialProductFeeType(product: CommercialProduct): string {
  return product.kind === "monthly" ? "subscription_fee" : "one_time_application_fee";
}
