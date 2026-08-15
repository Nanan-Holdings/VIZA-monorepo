import type { UkSubmissionResult } from "../submission-result.js";

export interface UkPrefillSummary {
  pagesFilled: string[];
  pagesSkipped?: string[];
  applicationReference?: string;
}

export function ukProgress(result: UkPrefillSummary): UkSubmissionResult["prefillProgress"] {
  return {
    pagesFilled: result.pagesFilled.length,
    pagesSkipped: result.pagesSkipped?.length ?? 0,
    totalPages: 44,
  };
}

export function ukSafePendingResult(
  readiness: { kind: "funding_required" | "payment_pending"; code: string },
  result: UkPrefillSummary,
): UkSubmissionResult {
  return {
    country: "UK",
    status: "stopped_at_pay",
    paymentStatus: readiness.kind === "funding_required" ? "funding_required" : "pending",
    paymentStateCode: readiness.code,
    ...(result.applicationReference ? { applicationReference: result.applicationReference } : {}),
    prefillProgress: ukProgress(result),
  };
}
