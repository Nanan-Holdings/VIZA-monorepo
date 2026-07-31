import {
  isMalaysiaMdacApplication,
  isSgArrivalCardApplication,
  isThailandTdacApplication,
  isVietnamEVisaApplication,
  isVietnamPrearrivalApplication,
} from "@/lib/submission-queue";

export const RUNNER_POOL_FLOW_KEYS = [
  "vn_evisa",
  "vn_prearrival",
  "sgac",
  "mdac",
  "tdac",
  "kr_eform",
] as const;

export type RunnerPoolFlowKey = (typeof RUNNER_POOL_FLOW_KEYS)[number];

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
