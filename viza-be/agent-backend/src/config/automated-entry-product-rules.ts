import {
  recommendVisaProduct,
  type VisaProductRecommendation,
} from "./visa-product-registry.js";

/**
 * First-phase rules for products that VIZA can submit through an official
 * online portal. These rows deliberately stay separate from the historical
 * 11-country x 7-passport reviewed matrix, whose release gate is fixed at 77
 * rows. The qualification service can merge these rows after collecting the
 * same passport/purpose inputs.
 */
export interface AutomatedEntryProductRule {
  ruleKey: string;
  destinationCountry: "japan" | "kenya";
  passportCountryIso3: "CHN";
  passportType: "ordinary";
  tripPurpose: "tourism";
  maxStayDays: number | null;
  outcome: "visa_exempt" | "visa_required" | "conditional";
  visaType: string | null;
  arrivalCardTypes: string[];
  requiredInputs: string[];
  conditions: Record<string, unknown>;
  sourceUrl: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt: string;
  reviewDueAt: string;
  productRecommendations: VisaProductRecommendation[];
}

const VERIFIED_AT = "2026-08-20T00:00:00.000Z";
const REVIEW_DUE_AT = "2026-11-20";

function product(
  productCode: "JP_VISIT_JAPAN_WEB" | "KE_ETA",
): VisaProductRecommendation[] {
  const recommendation = recommendVisaProduct(
    productCode,
    productCode === "JP_VISIT_JAPAN_WEB" ? "optional" : "required",
  );
  return recommendation ? [recommendation] : [];
}

export const AUTOMATED_ENTRY_PRODUCT_RULES: readonly AutomatedEntryProductRule[] = [
  {
    ruleKey: "japan:CHN:ordinary:tourism:jp-vjw-2026",
    destinationCountry: "japan",
    passportCountryIso3: "CHN",
    passportType: "ordinary",
    tripPurpose: "tourism",
    maxStayDays: null,
    outcome: "visa_required",
    visaType: null,
    arrivalCardTypes: ["JP_VISIT_JAPAN_WEB"],
    requiredInputs: [],
    conditions: {
      first_phase_scope: "Chinese ordinary-passport tourism travellers",
      vjw_recommended_before_arrival: true,
      paper_ed_card_alternative_available: true,
      vjw_covers: ["immigration_procedure", "customs_declaration"],
      vjw_is_not_a_visa: true,
      japan_visa_route_is_separate_and_out_of_scope: true,
      live_automation_requires_digital_agency_authorization: true,
      launch_compliance_gate_source:
        "Visit Japan Web Terms of Use (2026-07-22), Article 8(3); verify current official wording before enabling live submission",
      government_fee_usd: 0,
      official_portal_url: "https://services.digital.go.jp/en/visit-japan-web/",
    },
    sourceUrl: "https://www.digital.go.jp/en/policies/visit_japan_web",
    effectiveFrom: null,
    effectiveTo: null,
    verifiedAt: VERIFIED_AT,
    reviewDueAt: REVIEW_DUE_AT,
    productRecommendations: product("JP_VISIT_JAPAN_WEB"),
  },
  {
    ruleKey: "kenya:CHN:ordinary:tourism:ke-eta-2026",
    destinationCountry: "kenya",
    passportCountryIso3: "CHN",
    passportType: "ordinary",
    tripPurpose: "tourism",
    maxStayDays: null,
    outcome: "visa_exempt",
    visaType: null,
    arrivalCardTypes: [],
    requiredInputs: [],
    conditions: {
      first_phase_scope: "Chinese ordinary-passport tourism travellers",
      eta_required_before_journey: true,
      eta_replaces_traditional_visa_for_most_travellers: true,
      eta_valid_for_travel_within_days_of_issuance: 90,
      stay_duration_decided_at_entry: true,
      passport_validity_months: 6,
      standard_fee_usd: 30,
      expedited_surcharge_usd: 100,
      standard_processing_time_business_days: 3,
      official_portal_url: "https://etakenya.go.ke/",
      exemption_check_required_for_other_passport_or_travel_routes: true,
    },
    sourceUrl: "https://etakenya.go.ke/form/apply/how-to-apply?type=tourist",
    effectiveFrom: null,
    effectiveTo: null,
    verifiedAt: VERIFIED_AT,
    reviewDueAt: REVIEW_DUE_AT,
    productRecommendations: product("KE_ETA"),
  },
];

export const AUTOMATED_ENTRY_PRODUCT_RULE_MAP = new Map(
  AUTOMATED_ENTRY_PRODUCT_RULES.map((rule) => [
    `${rule.destinationCountry}:${rule.passportCountryIso3}:${rule.passportType}:${rule.tripPurpose}`,
    rule,
  ]),
);

export function getAutomatedEntryProductRule(
  destinationCountry: string,
  passportCountryIso3: string,
  passportType = "ordinary",
  tripPurpose = "tourism",
): AutomatedEntryProductRule | null {
  return (
    AUTOMATED_ENTRY_PRODUCT_RULE_MAP.get(
      `${destinationCountry}:${passportCountryIso3}:${passportType}:${tripPurpose}`,
    ) ?? null
  );
}
