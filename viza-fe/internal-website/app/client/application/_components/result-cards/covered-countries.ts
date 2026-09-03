/**
 * Every product that can reach SubmissionStatusStep must declare its terminal
 * success presentation. A country alone is insufficient: arrival cards,
 * e-visas, and paper handoffs within the same country have different evidence
 * thresholds and result adapters.
 */
type SuccessPresentation = "terminal-success-panel" | "review-associated-state";

type ResultPresentationDeclaration = {
  country: string;
  visaType: string;
  adapter: string;
  successPresentation: SuccessPresentation;
};

export const RESULT_PRESENTATION_REGISTRY = [
  { country: "US", visaType: "US_DS160", adapter: "us", successPresentation: "terminal-success-panel" },
  { country: "FR", visaType: "EU_SCHENGEN_C_SHORT_STAY", adapter: "fr", successPresentation: "terminal-success-panel" },
  { country: "UK", visaType: "UK_STANDARD_VISITOR", adapter: "uk", successPresentation: "review-associated-state" },
  { country: "AU", visaType: "AU_VISITOR_600", adapter: "au", successPresentation: "review-associated-state" },
  { country: "VN", visaType: "VN_E_VISA", adapter: "vn-evisa", successPresentation: "review-associated-state" },
  { country: "VN", visaType: "VN_PREARRIVAL_DECLARATION", adapter: "arrival-card", successPresentation: "terminal-success-panel" },
  { country: "SG", visaType: "SG_ARRIVAL_CARD", adapter: "sg-arrival-card", successPresentation: "terminal-success-panel" },
  { country: "MY", visaType: "MY_MDAC_ARRIVAL_CARD", adapter: "arrival-card", successPresentation: "terminal-success-panel" },
  { country: "MY", visaType: "MY_TOURIST_E_VISA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "TH", visaType: "TH_TDAC_ARRIVAL_CARD", adapter: "arrival-card", successPresentation: "terminal-success-panel" },
  { country: "TH", visaType: "TH_TOURIST_E_VISA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "PH", visaType: "PH_ETRAVEL_ARRIVAL_CARD", adapter: "arrival-card", successPresentation: "terminal-success-panel" },
  { country: "PH", visaType: "PH_ETRAVEL_DEPARTURE_CARD", adapter: "arrival-card", successPresentation: "terminal-success-panel" },
  { country: "KR", visaType: "KR_E_ARRIVAL_CARD", adapter: "arrival-card", successPresentation: "terminal-success-panel" },
  { country: "KR", visaType: "KR_C39_SHORT_TERM_VISIT", adapter: "kr-kvac", successPresentation: "review-associated-state" },
  { country: "JP", visaType: "JP_VISIT_JAPAN_WEB", adapter: "automated-online", successPresentation: "terminal-success-panel" },
  { country: "JP", visaType: "JP_TOURIST", adapter: "jp-agency", successPresentation: "review-associated-state" },
  { country: "KE", visaType: "KE_ETA", adapter: "automated-online", successPresentation: "terminal-success-panel" },
  { country: "TW", visaType: "TW_ENTRY_PERMIT", adapter: "tw", successPresentation: "terminal-success-panel" },
  { country: "ID", visaType: "ID_B1_EVOA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "ID", visaType: "ID_C1_TOURIST", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "EG", visaType: "EG_E_VISA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "SA", visaType: "SA_E_VISA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "AE", visaType: "AE_TOURIST_VISA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "CA", visaType: "CA_TRV", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "CA", visaType: "CA_STUDY_PERMIT", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "TR", visaType: "TR_E_VISA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "IT", visaType: "IT_SCHENGEN_C_SHORT_STAY", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
  { country: "IN", visaType: "IN_E_VISA", adapter: "generic-evisa", successPresentation: "terminal-success-panel" },
] as const satisfies readonly ResultPresentationDeclaration[];

export type ResultPresentation = (typeof RESULT_PRESENTATION_REGISTRY)[number];

export function hasDeclaredResultPresentation(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  const normalizedCountry = country?.trim().toUpperCase();
  const normalizedVisaType = visaType?.trim().toUpperCase();
  return RESULT_PRESENTATION_REGISTRY.some((entry) =>
    entry.country === normalizedCountry && entry.visaType === normalizedVisaType,
  );
}
