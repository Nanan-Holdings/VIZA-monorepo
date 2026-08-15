import {
  isMalaysiaMdacApplication,
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
] as const;

export type RunnerPoolFlowKey = (typeof RUNNER_POOL_FLOW_KEYS)[number];

const SHARED_RUNNER_POOL_COUNTRIES = new Set([
  "vietnam",
  "singapore",
  "malaysia",
  "thailand",
  "south_korea",
]);

export function isSharedRunnerPoolCountry(country: string): boolean {
  return SHARED_RUNNER_POOL_COUNTRIES.has(normalizeCountry(country));
}

/**
 * Production placement policy for typed runner flows.
 *
 * Vietnam e-Visa must stay on the sticky legacy worker because the official
 * application, card handoff, payment and 3DS continuation share one browser
 * session. Vietnam pre-arrival is already pool-only; the remaining flows are
 * controlled by the migration gate.
 */
export function shouldUseSharedRunnerPool(
  flowKey: RunnerPoolFlowKey,
  migrationEnabled: boolean,
): boolean {
  if (flowKey === "vn_evisa") return false;
  if (flowKey === "vn_prearrival") return true;
  return migrationEnabled;
}

export function resolveRunnerPoolFlow(
  country: string | null | undefined,
  visaType: string | null | undefined,
): RunnerPoolFlowKey | null {
  if (isSgArrivalCardApplication(country, visaType)) return "sgac";
  if (isMalaysiaMdacApplication(country, visaType)) return "mdac";
  if (isThailandTdacApplication(country, visaType)) return "tdac";
  if (isVietnamPrearrivalApplication(country, visaType)) return "vn_prearrival";
  if (isVietnamEVisaApplication(country, visaType)) return "vn_evisa";
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
