import "server-only";

import {
  SEARCHABLE_VISA_DESTINATIONS,
  type PopularVisaDestination,
} from "@/lib/visa-destinations";

export type CommercialPaymentProvider =
  | "stripe"
  | "wechat_pay"
  | "alipay"
  | "airwallex_card"
  | "airwallex_wechat"
  | "airwallex_alipay";

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

const MONTHLY_PRODUCTS: CommercialProduct[] = [
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
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function productIdForDestination(destination: Pick<PopularVisaDestination, "country" | "visaType">): string {
  return `pay_${slug(destination.country)}_${slug(destination.visaType)}`;
}

function amountFenForDestination(destination: PopularVisaDestination): number {
  if (destination.region === "Schengen") return 63900;

  const countryPrices: Record<string, number> = {
    singapore: 13900,
    malaysia: 13900,
    thailand: 13900,
    cambodia: 20900,
    indonesia: 20900,
    philippines: 20900,
    vietnam: 20900,
    united_arab_emirates: 27900,
    turkey: 27900,
    japan: 34900,
    south_korea: 34900,
    australia: 56900,
    new_zealand: 56900,
    canada: 63900,
    united_kingdom: 63900,
    united_states: 71900,
  };

  if (countryPrices[destination.country]) return countryPrices[destination.country];

  const regionPrices: Record<string, number> = {
    "North America": 63900,
    "South America": 41900,
    "Middle East": 27900,
    Africa: 34900,
    "Europe outside Schengen": 63900,
    Asia: 27900,
    "Europe / Asia": 27900,
    "Southeast Asia": 20900,
    "East Asia": 34900,
    "South Asia": 27900,
    Oceania: 56900,
  };

  return regionPrices[destination.region] ?? 34900;
}

function productForDestination(destination: PopularVisaDestination): CommercialProduct {
  return {
    id: productIdForDestination(destination),
    kind: "pay_per_application",
    name: `${destination.countryName} pay-per-application`,
    nameZh: `${destination.countryNameZh}次付申请`,
    description: `One VIZA service window for ${destination.countryName} ${destination.visaName}.`,
    descriptionZh: `${destination.countryNameZh}${destination.visaNameZh}的一次 VIZA 服务周期。`,
    amountFen: amountFenForDestination(destination),
    country: destination.country,
    visaType: destination.visaType,
  };
}

export const PAY_PER_APPLICATION_PRODUCTS: CommercialProduct[] = SEARCHABLE_VISA_DESTINATIONS
  .filter((destination) => destination.kind !== "group")
  .map(productForDestination);

export const COMMERCIAL_PRODUCTS: CommercialProduct[] = [
  ...MONTHLY_PRODUCTS,
  ...PAY_PER_APPLICATION_PRODUCTS,
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
