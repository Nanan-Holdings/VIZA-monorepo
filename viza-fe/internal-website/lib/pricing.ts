/**
 * Per-package pricing config (PAY-001).
 *
 * Single source of truth for the agency-fee + government-fee + currency
 * combination. The numbers are placeholders sized to roughly match
 * each portal's published government fee, plus a flat USD 99 agency
 * fee — ops fills the real values before public launch.
 *
 * The order schema (0052_orders_pay001.sql) stores cents; this config
 * also stores cents for consistency.
 */

export interface PackagePricing {
  /** Internal country code (matches `visa_packages.country`). */
  country: string;
  /** Internal visa-type code (matches `visa_packages.visa_type`). */
  visaType: string;
  /** Agency fee in minor units. Defaults to USD 99 across packages. */
  agencyFeeCents: number;
  /** Pass-through destination-country fee in minor units. */
  govtFeeCents: number;
  /** Currency the government collects in (matches portal). */
  currency: string;
  /** Whether the government fee is collected by VIZA (Stripe) or paid on the portal directly. */
  govtFeeChannel: "viza_passthrough" | "portal_direct";
  /**
   * WeChat Pay total in 分 (1 CNY = 100 fen). When set, the package is
   * eligible for the WeChat Pay Native checkout. Hard-coded per
   * package — WeChat Pay (Mainland merchant) only settles in CNY, so
   * no FX is done at capture time.
   */
  wechatPayTotalFen?: number;
}

const AGENCY_USD = 9900;

/**
 * Placeholder pricing — counsel/ops review before launch.
 * Numbers reflect each portal's nominal government-fee tier as of
 * 2026-Q2; many flex by passport type / nationality / variant. Real
 * pricing will live in the visa_packages.metadata JSONB or in a
 * follow-on per-variant table.
 */
export const PACKAGE_PRICING: PackagePricing[] = [
  // Big Five
  {
    country: "indonesia",
    visaType: "B211A",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 15000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // ≈ USD 249 → CNY 1799 (ops to revise before launch).
    wechatPayTotalFen: 179900,
  },
  {
    country: "united_states",
    visaType: "B1_B2",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 18500,
    currency: "USD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "united_kingdom",
    visaType: "UK_STANDARD_VISITOR",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 13500,
    currency: "GBP",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "european_union",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "EUR",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "vietnam",
    visaType: "VN_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 2500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  // Asia-Pacific
  {
    country: "australia",
    visaType: "AU_VISITOR_600",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 19000,
    currency: "AUD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "japan",
    visaType: "JP_TOURIST",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 0,
    currency: "USD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "indonesia",
    visaType: "ID_C1_TOURIST",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 15000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "south_korea",
    visaType: "KR_C39_SHORT_TERM_VISIT",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 4000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "thailand",
    visaType: "TH_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 4000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "malaysia",
    visaType: "MY_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 1500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "singapore",
    visaType: "SG_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 3000,
    currency: "SGD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "hong_kong",
    visaType: "HK_VISIT_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 23000,
    currency: "HKD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "macau",
    visaType: "MO_VISIT_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 10000,
    currency: "MOP",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "new_zealand",
    visaType: "NZ_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 27200,
    currency: "NZD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "philippines",
    visaType: "PH_TEMPORARY_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 3000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "cambodia",
    visaType: "KH_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 3600,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "laos",
    visaType: "LA_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 5000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "sri_lanka",
    visaType: "LK_ETA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 5000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "india",
    visaType: "IN_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 2500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "maldives",
    visaType: "MV_IMUGA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 0,
    currency: "USD",
    govtFeeChannel: "portal_direct",
  },
  // EMEA + Americas
  {
    country: "egypt",
    visaType: "EG_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 2500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "russia",
    visaType: "RU_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 5200,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "turkey",
    visaType: "TR_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 5000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "united_arab_emirates",
    visaType: "AE_TOURIST_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
  },
  {
    country: "canada",
    visaType: "CA_TRV",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 10000,
    currency: "CAD",
    govtFeeChannel: "portal_direct",
  },
  {
    country: "south_africa",
    visaType: "ZA_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 4750,
    currency: "ZAR",
    govtFeeChannel: "portal_direct",
  },
];

export function pricingFor(
  country: string,
  visaType: string,
): PackagePricing | null {
  return (
    PACKAGE_PRICING.find(
      (p) => p.country === country && p.visaType === visaType,
    ) ?? null
  );
}

export function totalCents(pricing: PackagePricing): number {
  return pricing.agencyFeeCents + pricing.govtFeeCents;
}

export class WechatPayNotSupportedError extends Error {
  constructor(country: string, visaType: string) {
    super(
      `WeChat Pay total not configured for ${country}/${visaType} (add wechatPayTotalFen to PACKAGE_PRICING).`,
    );
    this.name = "WechatPayNotSupportedError";
  }
}

/**
 * Lookup helper for the WeChat Pay Native checkout. Returns the
 * package row + the resolved CNY total in 分. Throws if the package
 * isn't yet enabled for WeChat Pay — gives the marketing CTA something
 * loud to surface rather than a silent 500.
 */
export function wechatPricingFor(
  country: string,
  visaType: string,
): { pricing: PackagePricing; totalFen: number } {
  const pricing = pricingFor(country, visaType);
  if (!pricing) {
    throw new WechatPayNotSupportedError(country, visaType);
  }
  if (!pricing.wechatPayTotalFen) {
    throw new WechatPayNotSupportedError(country, visaType);
  }
  return { pricing, totalFen: pricing.wechatPayTotalFen };
}
