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
  /** Legacy collection route. Applicant-facing flows always describe VIZA-managed payment. */
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
  {
    // Free demo flow: marketing advertises /visa/viza-test as Free, so
    // checkout collects nothing — both rails skip the payment provider
    // for zero-total packages (see isFreePackage + completeFreeOrder).
    country: "viza_test",
    visaType: "TEST_CHECKOUT",
    agencyFeeCents: 0,
    govtFeeCents: 0,
    currency: "USD",
    govtFeeChannel: "portal_direct",
  },
  // MKT-007: launch countries previously missing from pricing.
  {
    country: "saudi_arabia",
    visaType: "SA_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 8000, // ≈ SAR 300 tourist e-visa (ops to revise)
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 128900,
  },
  {
    country: "france",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000, // ≈ EUR 90; legacy portal_direct until VIZA virtual-card routing is wired
    currency: "USD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "italy",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000, // ≈ EUR 90; legacy portal_direct until VIZA virtual-card routing is wired
    currency: "USD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  // Big Five
  {
    country: "united_states",
    visaType: "B1_B2",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 18500,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "united_kingdom",
    visaType: "UK_STANDARD_VISITOR",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 13500,
    currency: "GBP",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "european_union",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "EUR",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "vietnam",
    visaType: "VN_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 2500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 89300,
  },
  // Asia-Pacific
  {
    country: "australia",
    visaType: "AU_VISITOR_600",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 19000,
    currency: "AUD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "japan",
    visaType: "JP_TOURIST",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 0,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "indonesia",
    visaType: "ID_C1_TOURIST",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 15000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 179300,
  },
  {
    country: "indonesia",
    visaType: "ID_B1_EVOA",
    agencyFeeCents: AGENCY_USD,
    // TODO(ops): confirm official Indonesia e-VoA govt fee
    // (Rp 500,000 ≈ USD 31); current live value USD 50.
    govtFeeCents: 5000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 107300,
  },
  {
    country: "south_korea",
    visaType: "KR_C39_SHORT_TERM_VISIT",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 4000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "thailand",
    visaType: "TH_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 4000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 100100,
  },
  {
    country: "malaysia",
    visaType: "MY_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 1500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 82100,
  },
  {
    country: "singapore",
    visaType: "SG_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 3000,
    currency: "SGD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "kenya",
    visaType: "KE_ETA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 3000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    wechatPayTotalFen: 92900,
  },
  {
    country: "hong_kong",
    visaType: "HK_VISIT_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 23000,
    currency: "HKD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "macau",
    visaType: "MO_VISIT_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 10000,
    currency: "MOP",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "new_zealand",
    visaType: "NZ_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 27200,
    currency: "NZD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "philippines",
    visaType: "PH_TEMPORARY_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 3000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  {
    country: "cambodia",
    visaType: "KH_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 3600,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 97200,
  },
  {
    country: "laos",
    visaType: "LA_TOURIST_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 5000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 107300,
  },
  {
    country: "sri_lanka",
    visaType: "LK_ETA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 5000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 107300,
  },
  {
    country: "india",
    visaType: "IN_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 2500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 89300,
  },
  {
    country: "maldives",
    visaType: "MV_IMUGA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 0,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  // EMEA + Americas
  {
    country: "egypt",
    visaType: "EG_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 2500,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 89300,
  },
  // Russia (RU_E_VISA) intentionally omitted: the route was removed from the
  // searchable destination catalogue and every other product surface (see
  // lib/__tests__/visa-destinations.test.ts). Keeping it priceable would let
  // guest checkout sell a route no other surface offers. Legacy display labels
  // for historical rows remain in visa-destinations.ts.
  {
    country: "turkey",
    visaType: "TR_E_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 5000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 107300,
  },
  {
    country: "united_arab_emirates",
    visaType: "AE_TOURIST_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "viza_passthrough",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 136100,
  },
  {
    country: "canada",
    visaType: "CA_TRV",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 10000,
    currency: "CAD",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
  // Remaining Schengen main-destination countries. One shared Type C product:
  // the same form, the same EUR 90 government fee and the same agency fee as
  // the france/italy rows above, so the marketing catalogue can offer all 29
  // rather than the three that happened to be priced first. Ops revises the
  // placeholder numbers in one pass with the rest of PACKAGE_PRICING.
  {
    country: "austria",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "belgium",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "bulgaria",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "croatia",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "czech_republic",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "denmark",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "estonia",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "finland",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "germany",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "greece",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "hungary",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "iceland",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "latvia",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "liechtenstein",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "lithuania",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "luxembourg",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "malta",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "netherlands",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "norway",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "poland",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "portugal",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "romania",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "slovakia",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "slovenia",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "spain",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "sweden",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "switzerland",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 9000,
    currency: "USD",
    govtFeeChannel: "portal_direct",
    wechatPayTotalFen: 71300,
  },
  {
    country: "south_africa",
    visaType: "ZA_VISITOR_VISA",
    agencyFeeCents: AGENCY_USD,
    govtFeeCents: 4750,
    currency: "ZAR",
    govtFeeChannel: "portal_direct",
    // MKT-013: placeholder CNY total ≈ USD-collected total × 7.2 —
    // ops to revise before launch (mirrors the Indonesia launch note).
    wechatPayTotalFen: 71300,
  },
];

function normalizePricingKey(value: string): string {
  return value.trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

/**
 * Canonicalise a visa-type code for pricing lookup. Country-aware: the
 * Vietnam e-visa route aliases below are the Vietnam intake's own generic
 * route params, so they must only collapse to VN_E_VISA when the country is
 * Vietnam. Applying them globally corrupts other countries' inputs — e.g.
 * `canonicalPricingVisaType("tourist_evisa")` used to become VN_E_VISA, so
 * `pricingFor("cambodia", "tourist_evisa")` matched nothing and guest
 * checkout showed "This visa isn't available yet".
 */
function canonicalPricingVisaType(visaType: string, country?: string): string {
  const normalized = normalizePricingKey(visaType);
  if (["DS160", "DS_160", "B1_B2", "B_1_B_2", "US_B1_B2", "US_DS160"].includes(normalized)) {
    return "B1_B2";
  }
  if (
    normalizePricingKey(country ?? "") === "VIETNAM" &&
    [
      "VIETNAM_E_VISA",
      "E_VISA_TOURISM",
      "EVISA_TOURISM",
      "TOURIST_E_VISA",
      "TOURIST_EVISA",
    ].includes(normalized)
  ) {
    return "VN_E_VISA";
  }
  return normalized;
}

export function pricingFor(
  country: string,
  visaType: string,
): PackagePricing | null {
  const normalizedCountry = normalizePricingKey(country);
  const normalizedVisaType = canonicalPricingVisaType(visaType, country);

  return (
    PACKAGE_PRICING.find(
      (p) =>
        normalizePricingKey(p.country) === normalizedCountry &&
        canonicalPricingVisaType(p.visaType, p.country) === normalizedVisaType,
    ) ?? null
  );
}

/**
 * True when the package collects nothing at checkout (free demo flows,
 * e.g. viza_test). Both guest checkout rails skip the payment provider
 * for these and mark the order paid directly.
 */
export function isFreePackage(pricing: PackagePricing): boolean {
  return pricing.agencyFeeCents === 0 && pricing.govtFeeCents === 0;
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
