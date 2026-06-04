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
  indonesia: { B211A: 15000, ID_C1_TOURIST: 18500 },
};

export function feeCentsFor(country: string, visaType: string): number | null {
  return GOVT_FEE_CENTS[country]?.[visaType] ?? null;
}
