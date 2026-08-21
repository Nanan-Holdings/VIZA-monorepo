import {
  isTaiwanEntryPermitApplication,
  isKoreaEArrivalCardApplication,
  isMalaysiaMdacApplication,
  isJapanVisitJapanWebApplication,
  isKenyaEtaApplication,
  isSgArrivalCardApplication,
  isThailandTdacApplication,
  isVietnamEVisaApplication,
  isVietnamPrearrivalApplication,
} from "@/lib/submission-queue";
import { normalizeCountry } from "./countries";

export const RUNNER_POOL_FLOW_KEYS = [
  "vn_evisa",
  "vn_prearrival",
  "sgac",
  "mdac",
  "tdac",
  "kr_eform",
  "kr_arrival_card",
  "tw_entry_permit",
  "jp_vjw",
  "ke_eta",
] as const;

export type RunnerPoolFlowKey = (typeof RUNNER_POOL_FLOW_KEYS)[number];

const SHARED_RUNNER_POOL_COUNTRIES = new Set([
  "vietnam",
  "singapore",
  "malaysia",
  "thailand",
  "south_korea",
  "taiwan",
  "japan",
  "kenya",
]);

export function isSharedRunnerPoolCountry(country: string): boolean {
  return SHARED_RUNNER_POOL_COUNTRIES.has(normalizeCountry(country));
}

/**
 * Production placement policy for typed runner flows.
 *
 * Vietnam e-Visa must stay on the sticky legacy worker because the official
 * application, card handoff, payment and 3DS continuation share one browser
 * session. Every strict pool flow remains pool-only once the controlled
 * cutover is selected; the migration flag is retained only for old config
 * compatibility and cannot re-enable an unsafe direct runner_job insert.
 */
export function shouldUseSharedRunnerPool(
  flowKey: RunnerPoolFlowKey,
  migrationEnabled: boolean,
): boolean {
  if (flowKey === "vn_evisa") return false;
  void migrationEnabled;
  return true;
}

export function resolveRunnerPoolFlow(
  country: string | null | undefined,
  visaType: string | null | undefined,
): RunnerPoolFlowKey | null {
  if (isKoreaEArrivalCardApplication(country, visaType)) return "kr_arrival_card";
  if (isSgArrivalCardApplication(country, visaType)) return "sgac";
  if (isMalaysiaMdacApplication(country, visaType)) return "mdac";
  if (isThailandTdacApplication(country, visaType)) return "tdac";
  if (isVietnamPrearrivalApplication(country, visaType)) return "vn_prearrival";
  if (isVietnamEVisaApplication(country, visaType)) return "vn_evisa";
  if (isTaiwanEntryPermitApplication(country, visaType)) return "tw_entry_permit";
  if (isJapanVisitJapanWebApplication(country, visaType)) return "jp_vjw";
  if (isKenyaEtaApplication(country, visaType)) return "ke_eta";
  const normalizedCountry = country?.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  const normalizedVisaType = visaType?.trim().toUpperCase() ?? "";
  if (
    (normalizedCountry === "kr" ||
      normalizedCountry === "korea" ||
      normalizedCountry === "south_korea") &&
    (normalizedVisaType === "KR_C39_SHORT_TERM_VISIT" ||
      normalizedVisaType === "KR_C_3_9" ||
      normalizedVisaType.includes("C39"))
  ) {
    return "kr_eform";
  }
  return null;
}
