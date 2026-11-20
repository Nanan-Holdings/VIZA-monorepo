import type { UkSubmissionResult } from "../submission-result.js";
import type { UkResumeResult } from "./resume.js";
import { UK_PAGE_ORDER } from "./page-bindings.js";

export type UkCheckpoint = NonNullable<UkSubmissionResult["checkpoint"]>;

export interface UkPrefillSummary {
  pagesFilled: string[];
  pagesSkipped?: string[];
  applicationReference?: string;
  checkpoint?: UkCheckpoint;
}

export function ukProgress(result: UkPrefillSummary): UkSubmissionResult["prefillProgress"] {
  return {
    pagesFilled: result.pagesFilled.length,
    pagesSkipped: result.pagesSkipped?.length ?? 0,
    totalPages: UK_PAGE_ORDER.length,
  };
}

export interface UkMappedRunnerResult {
  payload: UkSubmissionResult;
  /** Only an observed declaration/payment boundary is a handoff terminal. */
  handoffReady: boolean;
  reachedStep: UkCheckpoint | "payment_review_required";
}

/**
 * Convert the browser result into the customer-safe persisted contract.
 * Payment is removed from VIZA: reaching the official payment page is an
 * honest needs-attention checkpoint, not a generic success or a card charge.
 */
export function mapUkResumeResult(result: Exclude<UkResumeResult, { status: "failed" }>): UkMappedRunnerResult {
  const reference = "applicationReference" in result && result.applicationReference
    ? { applicationReference: result.applicationReference }
    : {};
  const progress = ukProgress(result);

  if (result.status === "stopped_at_pay") {
    return {
      payload: {
        country: "UK",
        status: "stopped_at_pay",
        paymentStatus: "review_required",
        staffReviewCode: "payment_removed",
        checkpoint: "payment",
        ...reference,
        prefillProgress: progress,
      },
      handoffReady: true,
      reachedStep: "payment",
    };
  }

  if (result.status === "halted_before_pay") {
    const checkpoint = result.checkpoint ?? "review";
    return {
      payload: {
        country: "UK",
        status: "needs_attention",
        checkpoint,
        reason: result.reason,
        ...reference,
        prefillProgress: progress,
      },
      handoffReady: checkpoint === "declaration",
      reachedStep: checkpoint,
    };
  }

  // These states are retained for historical compatibility in the browser
  // result union, but they are never a VIZA handoff terminal. In particular,
  // do not turn a generic non-failed payment result into payment success.
  return {
    payload: {
      country: "UK",
      status: "needs_attention",
      checkpoint: "payment",
      reason: "UK payment processing is removed; staff review is required",
      ...reference,
      prefillProgress: progress,
    },
    handoffReady: false,
    reachedStep: "payment_review_required",
  };
}

export function ukSafePendingResult(
  readiness: { kind: "funding_required" | "payment_pending"; code: string },
  result: UkPrefillSummary,
): UkSubmissionResult {
  return {
    country: "UK",
    status: "stopped_at_pay",
    checkpoint: "payment",
    paymentStatus: readiness.kind === "funding_required" ? "funding_required" : "pending",
    paymentStateCode: readiness.code,
    ...(result.applicationReference ? { applicationReference: result.applicationReference } : {}),
    prefillProgress: ukProgress(result),
  };
}
