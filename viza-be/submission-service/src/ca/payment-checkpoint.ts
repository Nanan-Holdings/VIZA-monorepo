import { isTrustedCanadaApplicationUrl } from "./readiness.js";

export interface CanadaPaymentEvidenceInput {
  url: string;
  headingTexts: readonly string[];
  buttonTexts: readonly string[];
  cardFieldCount: number;
}

export interface CanadaPaymentEvidenceResult {
  reached: boolean;
  entryReady: boolean;
  reason:
    | "official_payment_checkpoint"
    | "unofficial_host"
    | "payment_heading_not_observed"
    | "payment_action_not_observed";
}

const PAYMENT_HEADINGS = new Set(["Pay your fees", "Payment"]);
const PAYMENT_ACTIONS = new Set(["Pay", "Continue to payment", "Pay and submit"]);

/**
 * Observation-only evidence gate. Fee-related explanatory copy by itself is
 * deliberately insufficient, and this helper never fills or clicks payment
 * controls.
 */
export function assessCanadaPaymentEvidence(
  input: CanadaPaymentEvidenceInput,
): CanadaPaymentEvidenceResult {
  if (!isTrustedCanadaApplicationUrl(input.url)) {
    return { reached: false, entryReady: false, reason: "unofficial_host" };
  }
  const headingObserved = input.headingTexts.some((value) =>
    PAYMENT_HEADINGS.has(value.trim()),
  );
  if (!headingObserved) {
    return {
      reached: false,
      entryReady: false,
      reason: "payment_heading_not_observed",
    };
  }
  const actionObserved = input.buttonTexts.some((value) =>
    PAYMENT_ACTIONS.has(value.trim()),
  );
  if (!actionObserved) {
    return {
      reached: false,
      entryReady: false,
      reason: "payment_action_not_observed",
    };
  }
  return {
    reached: true,
    entryReady: input.cardFieldCount > 0,
    reason: "official_payment_checkpoint",
  };
}
