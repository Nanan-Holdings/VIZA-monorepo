/**
 * Government-fee routing per country (PAY-003).
 *
 * Single source of truth for how the destination-country fee is
 * collected for each visa package. The runner code references this
 * map; docs/payments/government-fee-routing.md mirrors it.
 *
 * Mechanism vocabulary:
 *   - runner_escrow_card  : the runner pays the portal with a virtual
 *                            card minted from VIZA's escrow account.
 *   - client_in_portal    : the runner pauses at the payment screen
 *                            and the client enters their own card.
 *   - applicant_direct_link : the runner surfaces a portal-supplied
 *                              payment link; the client pays out of
 *                              band; the runner resumes when an
 *                              inbound confirmation email arrives.
 *   - paper_only_no_fee   : no portal-side fee; collected at the
 *                            in-person appointment or by paper
 *                            transfer.
 */

export type GovtFeeMechanism =
  | "runner_escrow_card"
  | "client_in_portal"
  | "applicant_direct_link"
  | "paper_only_no_fee";

export interface RoutingEntry {
  country: string;
  visaType: string;
  mechanism: GovtFeeMechanism;
}

export const GOVT_FEE_ROUTING: ReadonlyArray<RoutingEntry> = [
  { country: "united_states", visaType: "B1_B2", mechanism: "applicant_direct_link" },
  { country: "united_kingdom", visaType: "UK_STANDARD_VISITOR", mechanism: "client_in_portal" },
  { country: "european_union", visaType: "EU_SCHENGEN_C_SHORT_STAY", mechanism: "client_in_portal" },
  { country: "vietnam", visaType: "VN_E_VISA", mechanism: "runner_escrow_card" },
  { country: "australia", visaType: "AU_VISITOR_600", mechanism: "client_in_portal" },
  { country: "japan", visaType: "JP_TOURIST", mechanism: "paper_only_no_fee" },
  { country: "indonesia", visaType: "B211A", mechanism: "runner_escrow_card" },
  { country: "indonesia", visaType: "ID_C1_TOURIST", mechanism: "runner_escrow_card" },
  { country: "indonesia", visaType: "ID_B1_EVOA", mechanism: "runner_escrow_card" },
  { country: "egypt", visaType: "EG_E_VISA", mechanism: "runner_escrow_card" },
  { country: "south_korea", visaType: "KR_C39_SHORT_TERM_VISIT", mechanism: "applicant_direct_link" },
  { country: "thailand", visaType: "TH_TOURIST_E_VISA", mechanism: "runner_escrow_card" },
  { country: "malaysia", visaType: "MY_TOURIST_E_VISA", mechanism: "runner_escrow_card" },
  { country: "singapore", visaType: "SG_VISITOR_VISA", mechanism: "client_in_portal" },
  { country: "hong_kong", visaType: "HK_VISIT_VISA", mechanism: "paper_only_no_fee" },
  { country: "macau", visaType: "MO_VISIT_VISA", mechanism: "paper_only_no_fee" },
  { country: "new_zealand", visaType: "NZ_VISITOR_VISA", mechanism: "client_in_portal" },
  { country: "russia", visaType: "RU_E_VISA", mechanism: "runner_escrow_card" },
  { country: "turkey", visaType: "TR_E_VISA", mechanism: "runner_escrow_card" },
  { country: "united_arab_emirates", visaType: "AE_TOURIST_VISA", mechanism: "runner_escrow_card" },
  { country: "canada", visaType: "CA_TRV", mechanism: "client_in_portal" },
  { country: "maldives", visaType: "MV_IMUGA", mechanism: "paper_only_no_fee" },
  { country: "philippines", visaType: "PH_TEMPORARY_VISITOR_VISA", mechanism: "applicant_direct_link" },
  { country: "cambodia", visaType: "KH_TOURIST_E_VISA", mechanism: "runner_escrow_card" },
  { country: "laos", visaType: "LA_TOURIST_E_VISA", mechanism: "runner_escrow_card" },
  { country: "sri_lanka", visaType: "LK_ETA", mechanism: "runner_escrow_card" },
  { country: "india", visaType: "IN_E_VISA", mechanism: "runner_escrow_card" },
  { country: "south_africa", visaType: "ZA_VISITOR_VISA", mechanism: "applicant_direct_link" },
  // RUN-SA-002: Saudi e-Visa is online-pay; VIZA collects via escrow (fee TBD
  // until saudi_arabia is added to lib/pricing.ts — PAYP-001).
  { country: "saudi_arabia", visaType: "SA_E_VISA", mechanism: "runner_escrow_card" },
  // PAYP-001: France + Italy (Schengen) — applicant pays the VAC/consulate directly.
  { country: "france", visaType: "EU_SCHENGEN_C_SHORT_STAY", mechanism: "client_in_portal" },
  { country: "italy", visaType: "EU_SCHENGEN_C_SHORT_STAY", mechanism: "client_in_portal" },
];

export class UnknownPackageError extends Error {
  constructor(country: string, visaType: string) {
    super(
      `payment-routing: no entry for ${country}/${visaType}. Add to GOVT_FEE_ROUTING.`,
    );
    this.name = "UnknownPackageError";
  }
}

export function routingFor(
  country: string,
  visaType: string,
): RoutingEntry {
  const found = GOVT_FEE_ROUTING.find(
    (r) => r.country === country && r.visaType === visaType,
  );
  if (!found) throw new UnknownPackageError(country, visaType);
  return found;
}

/* ------------------------- RUN-ID-002 additions ------------------------- */

/** Who collects the government fee. */
export type Collector = "viza" | "portal" | "applicant" | "none";

/** What the runner should do at the government-payment step. */
export type FeePolicy = "collect" | "halt" | "paper";

export function collectorFor(mechanism: GovtFeeMechanism): Collector {
  switch (mechanism) {
    case "runner_escrow_card":
      return "viza";
    case "client_in_portal":
      return "portal";
    case "applicant_direct_link":
      return "applicant";
    case "paper_only_no_fee":
      return "none";
  }
}

export function policyFor(mechanism: GovtFeeMechanism): FeePolicy {
  switch (mechanism) {
    case "runner_escrow_card":
      return "collect"; // runner pays the portal with VIZA's escrow card
    case "client_in_portal":
    case "applicant_direct_link":
      return "halt"; // runner stops at the pay screen; someone else pays
    case "paper_only_no_fee":
      return "paper"; // no portal fee
  }
}

/**
 * Government fee in cents (USD), mirroring viza-fe/internal-website/lib/pricing.ts
 * `govtFeeCents`. Kept here so the runner can assert the routing fee without a
 * cross-package import. Edit alongside pricing.ts.
 */
export const GOVT_FEE_CENTS: Record<string, Record<string, number>> = {
  indonesia: { B211A: 15000, ID_C1_TOURIST: 18500, ID_B1_EVOA: 5000 },
  egypt: { EG_E_VISA: 2500 },
  malaysia: { MY_TOURIST_E_VISA: 1500 },
  canada: { CA_TRV: 10000 },
  turkey: { TR_E_VISA: 5000 },
  thailand: { TH_TOURIST_E_VISA: 4000 },
  united_arab_emirates: { AE_TOURIST_VISA: 9000 },
};

export function feeCentsFor(country: string, visaType: string): number | null {
  return GOVT_FEE_CENTS[country]?.[visaType] ?? null;
}

/* ------------------------- PAYP-001 routing decision ------------------------- */

const AGENCY_FEE_CENTS = 9900; // flat USD 99 (mirrors pricing.ts AGENCY_USD)

/**
 * Full per-country fee table (mirrors viza-fe/internal-website/lib/pricing.ts +
 * the marketing mirror, MKT-006). Government fee is in the listed currency;
 * agency fee is USD. Kept here to avoid a cross-package import — edit
 * alongside pricing.ts. Covers all 16 launch countries.
 */
export interface PackageFee {
  govtCents: number;
  /** Currency the government fee is collected in. */
  currency: string;
}
export const PACKAGE_FEES: Record<string, Record<string, PackageFee>> = {
  indonesia: {
    B211A: { govtCents: 15000, currency: "USD" },
    ID_C1_TOURIST: { govtCents: 18500, currency: "USD" },
    ID_B1_EVOA: { govtCents: 5000, currency: "USD" },
  },
  egypt: { EG_E_VISA: { govtCents: 2500, currency: "USD" } },
  australia: { AU_VISITOR_600: { govtCents: 19000, currency: "AUD" } },
  saudi_arabia: { SA_E_VISA: { govtCents: 8000, currency: "USD" } },
  united_kingdom: { UK_STANDARD_VISITOR: { govtCents: 13500, currency: "GBP" } },
  vietnam: { VN_E_VISA: { govtCents: 2500, currency: "USD" } },
  malaysia: { MY_TOURIST_E_VISA: { govtCents: 1500, currency: "USD" } },
  japan: { JP_TOURIST: { govtCents: 0, currency: "USD" } },
  united_states: { B1_B2: { govtCents: 18500, currency: "USD" } },
  canada: { CA_TRV: { govtCents: 10000, currency: "CAD" } },
  turkey: { TR_E_VISA: { govtCents: 5000, currency: "USD" } },
  thailand: { TH_TOURIST_E_VISA: { govtCents: 4000, currency: "USD" } },
  united_arab_emirates: { AE_TOURIST_VISA: { govtCents: 9000, currency: "USD" } },
  france: { EU_SCHENGEN_C_SHORT_STAY: { govtCents: 9000, currency: "USD" } },
  italy: { EU_SCHENGEN_C_SHORT_STAY: { govtCents: 9000, currency: "USD" } },
  india: { IN_E_VISA: { govtCents: 2500, currency: "USD" } },
};

export interface RoutingDecision {
  country: string;
  visaType: string;
  mechanism: GovtFeeMechanism;
  collector: Collector;
  policy: FeePolicy;
  agencyFeeCents: number;
  govtFeeCents: number;
  currency: string;
  /** Amount VIZA collects up front: agency + (gov fee only when VIZA collects it). */
  collectedTotalCents: number;
}

/** Typed routing decision for a launch package. Throws UnknownPackageError. */
export function decisionFor(country: string, visaType: string): RoutingDecision {
  const routing = routingFor(country, visaType);
  const fee = PACKAGE_FEES[country]?.[visaType];
  if (!fee) throw new UnknownPackageError(country, visaType);
  const collector = collectorFor(routing.mechanism);
  const policy = policyFor(routing.mechanism);
  // VIZA only adds the government fee to the up-front charge when VIZA collects
  // it (runner_escrow_card). Otherwise the applicant pays the gov fee on the
  // portal/at the VAC, so we collect the agency fee only.
  const collectedTotalCents =
    collector === "viza" ? AGENCY_FEE_CENTS + fee.govtCents : AGENCY_FEE_CENTS;
  return {
    country,
    visaType,
    mechanism: routing.mechanism,
    collector,
    policy,
    agencyFeeCents: AGENCY_FEE_CENTS,
    govtFeeCents: fee.govtCents,
    currency: fee.currency,
    collectedTotalCents,
  };
}
