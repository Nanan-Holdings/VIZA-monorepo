/**
 * Marketing display pricing (MKT-006).
 *
 * CANONICAL SOURCE: viza-fe/internal-website/lib/pricing.ts
 * (`PACKAGE_PRICING`). This is a marketing-side MIRROR — the two packages do
 * not share a node_modules workspace, so the portal is the source of truth and
 * this file is kept in sync on pricing changes (a true shared package requires
 * monorepo workspace wiring; tracked as a follow-up). Values are in minor
 * units (cents) of the listed currency, matching the portal.
 *
 * Currency display policy (USD/collection-currency → display SGD):
 *   - Agency fee is USD; government fee is in the portal's collection currency.
 *   - Both are converted to the display currency (SGD) using the static FX
 *     table below (ops-maintained; no live FX at render). Rounded up to a
 *     whole SGD for display.
 */

export type GovtCurrency = "USD" | "GBP" | "AUD" | "CAD";

export interface MarketingPricing {
  visaType: string;
  /** Agency fee, USD minor units. */
  agencyUsdCents: number;
  /** Government fee, minor units of `govtCurrency`. */
  govtCents: number;
  govtCurrency: GovtCurrency;
}

const AGENCY_USD_CENTS = 9900;

/** Static display FX → SGD (ops-maintained). 1 unit of currency = N SGD. */
const FX_TO_SGD: Record<GovtCurrency, number> = {
  USD: 1.35,
  GBP: 1.71,
  AUD: 0.89,
  CAD: 0.99,
};

/** Keyed by the CountryMeta.visaType (lib/countries.ts). Mirrors PACKAGE_PRICING. */
export const PRICING: Record<string, MarketingPricing> = {
  B211A: { visaType: "B211A", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 15000, govtCurrency: "USD" },
  EG_E_VISA: { visaType: "EG_E_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 2500, govtCurrency: "USD" },
  AU_VISITOR_600: { visaType: "AU_VISITOR_600", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 19000, govtCurrency: "AUD" },
  SA_E_VISA: { visaType: "SA_E_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 8000, govtCurrency: "USD" },
  UK_STANDARD_VISITOR: { visaType: "UK_STANDARD_VISITOR", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 13500, govtCurrency: "GBP" },
  VN_E_VISA: { visaType: "VN_E_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 2500, govtCurrency: "USD" },
  MY_TOURIST_E_VISA: { visaType: "MY_TOURIST_E_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 1500, govtCurrency: "USD" },
  JP_TOURIST: { visaType: "JP_TOURIST", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 0, govtCurrency: "USD" },
  B1_B2: { visaType: "B1_B2", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 18500, govtCurrency: "USD" },
  CA_TRV: { visaType: "CA_TRV", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 10000, govtCurrency: "CAD" },
  TR_E_VISA: { visaType: "TR_E_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 5000, govtCurrency: "USD" },
  TH_TOURIST_E_VISA: { visaType: "TH_TOURIST_E_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 4000, govtCurrency: "USD" },
  AE_TOURIST_VISA: { visaType: "AE_TOURIST_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 9000, govtCurrency: "USD" },
  EU_SCHENGEN_C_SHORT_STAY: { visaType: "EU_SCHENGEN_C_SHORT_STAY", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 9000, govtCurrency: "USD" },
  IN_E_VISA: { visaType: "IN_E_VISA", agencyUsdCents: AGENCY_USD_CENTS, govtCents: 2500, govtCurrency: "USD" },
};

/** Total fee for a visa type, in whole SGD (rounded up). null if unknown. */
export function totalSgd(visaType: string): number | null {
  const p = PRICING[visaType];
  if (!p) return null;
  const agencySgd = (p.agencyUsdCents / 100) * FX_TO_SGD.USD;
  const govtSgd = (p.govtCents / 100) * FX_TO_SGD[p.govtCurrency];
  return Math.ceil(agencySgd + govtSgd);
}

export interface PriceBreakdownSgd {
  /** Government fee in whole SGD. */
  govtSgd: number;
  /** VIZA agency/processing fee in whole SGD. */
  agencySgd: number;
  /** Sum of the two, in whole SGD. */
  totalSgd: number;
}

/**
 * Government / agency / total split in whole SGD for the price card. Drives the
 * sticky price card across all country pages so displayed numbers always match
 * the canonical pricing mirror. null if the visa type is unknown.
 */
export function priceBreakdownSgd(visaType: string): PriceBreakdownSgd | null {
  const p = PRICING[visaType];
  if (!p) return null;
  const govtSgd = Math.ceil((p.govtCents / 100) * FX_TO_SGD[p.govtCurrency]);
  const agencySgd = Math.ceil((p.agencyUsdCents / 100) * FX_TO_SGD.USD);
  return { govtSgd, agencySgd, totalSgd: govtSgd + agencySgd };
}

/** Formatted display fee, e.g. "SGD 264". null if unknown. */
export function displayFeeSGD(visaType: string): string | null {
  const total = totalSgd(visaType);
  return total == null ? null : `SGD ${total}`;
}
