/**
 * Explicit runner-pool flows that are safe for the paid-order recovery
 * backfill. Vietnam eVisa deliberately is not listed: it stays on the sticky
 * legacy worker and must never be guessed into a shared-pool job.
 */
export const BACKFILL_POOL_FLOW_KEYS = [
  "vn_prearrival",
  "sgac",
  "mdac",
  "tdac",
  "kr_arrival_card",
  "kr_eform",
  "tw_entry_permit",
  "jp_vjw",
  "ke_eta",
] as const;

export type BackfillPoolFlowKey = (typeof BACKFILL_POOL_FLOW_KEYS)[number];

function normalize(value: string | null | undefined): string {
  return value?.trim().toUpperCase().replace(/[\s-]+/gu, "_") ?? "";
}

/**
 * Resolve only an unambiguous, currently supported shared-pool package.
 * Unknown countries/package types return null so callers can skip rather than
 * create a runner_job that the pool handler cannot safely dispatch.
 */
export function deriveBackfillPoolFlow(
  country: string | null | undefined,
  visaType: string | null | undefined,
): BackfillPoolFlowKey | null {
  const normalizedCountry = normalize(country);
  const normalizedVisaType = normalize(visaType);

  if (
    (normalizedCountry === "VN" || normalizedCountry === "VIETNAM" || normalizedCountry === "VIET_NAM")
    && normalizedVisaType === "VN_PREARRIVAL_DECLARATION"
  ) {
    return "vn_prearrival";
  }
  if (
    (normalizedCountry === "SG" || normalizedCountry === "SINGAPORE")
    && normalizedVisaType === "SG_ARRIVAL_CARD"
  ) {
    return "sgac";
  }
  if (
    (normalizedCountry === "MY" || normalizedCountry === "MALAYSIA")
    && normalizedVisaType === "MY_MDAC_ARRIVAL_CARD"
  ) {
    return "mdac";
  }
  if (
    (normalizedCountry === "TH" || normalizedCountry === "THAILAND")
    && normalizedVisaType === "TH_TDAC_ARRIVAL_CARD"
  ) {
    return "tdac";
  }
  if (
    (normalizedCountry === "KR" || normalizedCountry === "KOREA" || normalizedCountry === "SOUTH_KOREA")
    && (normalizedVisaType === "KR_C39_SHORT_TERM_VISIT" || normalizedVisaType === "KR_C_3_9")
  ) {
    return "kr_eform";
  }
  if (
    (normalizedCountry === "KR" || normalizedCountry === "KOREA" || normalizedCountry === "SOUTH_KOREA")
    && normalizedVisaType === "KR_E_ARRIVAL_CARD"
  ) {
    return "kr_arrival_card";
  }
  if (
    (normalizedCountry === "TW" || normalizedCountry === "TAIWAN")
    && normalizedVisaType === "TW_ENTRY_PERMIT"
  ) {
    return "tw_entry_permit";
  }
  if (
    (normalizedCountry === "JP" || normalizedCountry === "JAPAN")
    && normalizedVisaType === "JP_VISIT_JAPAN_WEB"
  ) {
    return "jp_vjw";
  }
  if (
    (normalizedCountry === "KE" || normalizedCountry === "KENYA")
    && normalizedVisaType === "KE_ETA"
  ) {
    return "ke_eta";
  }
  return null;
}
