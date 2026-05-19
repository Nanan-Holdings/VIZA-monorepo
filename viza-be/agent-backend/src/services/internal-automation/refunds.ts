import type {
  Application,
  PaymentRecord,
  RefundRecord,
} from "../../db/schema.js";
import {
  mapExternalStatusToLifecycleStatus,
  normalizeExternalStatus,
  normalizeResultStatus,
} from "./external-status.js";
import { normalizeLifecycleStatus, normalizeStatusToken } from "./status.js";

export type RefundApplicationLike = Pick<
  Application,
  "status" | "submittedAt" | "packetStatus" | "packetReadyAt" | "externalStatus" | "resultStatus"
>;

export type RefundPaymentLike = Pick<
  PaymentRecord,
  "id" | "amountCents" | "currency" | "status" | "feeType"
>;

export type ExistingRefundLike = Pick<
  RefundRecord,
  "amountCents" | "status"
>;

export type RefundDecision =
  | "eligible"
  | "ineligible"
  | "manual_review";

export interface RefundEligibilityInput {
  application: Partial<RefundApplicationLike>;
  payment: RefundPaymentLike | null;
  existingRefunds?: readonly ExistingRefundLike[];
}

export interface RefundEligibilityResult {
  decision: RefundDecision;
  eligible: boolean;
  refundableAmountCents: number;
  currency: string | null;
  paymentRecordId: string | null;
  reasonCode: string;
  reason: string;
  policy: {
    version: "viza.refund_policy.v1";
    rule: string;
  };
}

const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "success",
  "complete",
  "completed",
  "captured",
]);

const OPEN_REFUND_STATUSES = new Set([
  "requested",
  "approved",
  "pending",
  "processing",
]);

const COMPLETED_REFUND_STATUSES = new Set([
  "refunded",
  "completed",
  "succeeded",
  "success",
]);

const NON_REFUNDABLE_FEE_TYPES = new Set(["government_fee"]);

export function evaluateRefundEligibility(
  input: RefundEligibilityInput
): RefundEligibilityResult {
  if (!input.payment) {
    return buildResult(
      "ineligible",
      0,
      null,
      null,
      "payment_missing",
      "No payment record was provided.",
      "payment_required"
    );
  }

  const paymentStatus = normalizeStatusToken(input.payment.status);
  const currency = input.payment.currency;
  if (!PAID_PAYMENT_STATUSES.has(paymentStatus)) {
    return buildResult(
      "ineligible",
      0,
      currency,
      input.payment.id,
      "payment_not_captured",
      "Only captured payments can be refunded.",
      "captured_payment_required"
    );
  }

  if (NON_REFUNDABLE_FEE_TYPES.has(normalizeStatusToken(input.payment.feeType))) {
    return buildResult(
      "ineligible",
      0,
      currency,
      input.payment.id,
      "non_refundable_fee_type",
      "This fee type is not refundable through website automation.",
      "non_refundable_fee_type"
    );
  }

  const openRefund = input.existingRefunds?.find((refund) =>
    OPEN_REFUND_STATUSES.has(normalizeStatusToken(refund.status))
  );
  if (openRefund) {
    return buildResult(
      "ineligible",
      0,
      currency,
      input.payment.id,
      "refund_already_open",
      "A refund request is already in progress.",
      "one_open_refund"
    );
  }

  const refundedAmount = (input.existingRefunds ?? [])
    .filter((refund) =>
      COMPLETED_REFUND_STATUSES.has(normalizeStatusToken(refund.status))
    )
    .reduce((total, refund) => total + refund.amountCents, 0);
  const refundableAmount = Math.max(input.payment.amountCents - refundedAmount, 0);
  if (refundableAmount === 0) {
    return buildResult(
      "ineligible",
      0,
      currency,
      input.payment.id,
      "fully_refunded",
      "The captured payment has already been fully refunded.",
      "remaining_amount_required"
    );
  }

  const resultStatus = normalizeResultStatus(input.application.resultStatus);
  const externalStatus = normalizeExternalStatus(input.application.externalStatus);
  const lifecycleStatus =
    resultStatus ??
    (externalStatus
      ? mapExternalStatusToLifecycleStatus(externalStatus)
      : normalizeLifecycleStatus(input.application.status)) ??
    "draft";

  if (
    lifecycleStatus === "external_submission_in_progress" ||
    lifecycleStatus === "submitted" ||
    lifecycleStatus === "approved" ||
    lifecycleStatus === "rejected" ||
    Boolean(input.application.submittedAt)
  ) {
    return buildResult(
      "ineligible",
      0,
      currency,
      input.payment.id,
      "external_or_result_started",
      "Refunds are not automatically eligible after external submission or result handling starts.",
      "stop_after_external_submission"
    );
  }

  const packetStatus = normalizeStatusToken(input.application.packetStatus ?? "");
  if (packetStatus === "ready" || packetStatus === "generated" || input.application.packetReadyAt) {
    return buildResult(
      "manual_review",
      refundableAmount,
      currency,
      input.payment.id,
      "packet_already_prepared",
      "A packet has already been prepared and needs staff review before refunding.",
      "manual_review_after_packet"
    );
  }

  return buildResult(
    "eligible",
    refundableAmount,
    currency,
    input.payment.id,
    "eligible_before_packet_handoff",
    "The payment is eligible for refund before packet handoff.",
    "automatic_before_packet_handoff"
  );
}

function buildResult(
  decision: RefundDecision,
  refundableAmountCents: number,
  currency: string | null,
  paymentRecordId: string | null,
  reasonCode: string,
  reason: string,
  rule: string
): RefundEligibilityResult {
  return {
    decision,
    eligible: decision === "eligible",
    refundableAmountCents,
    currency,
    paymentRecordId,
    reasonCode,
    reason,
    policy: {
      version: "viza.refund_policy.v1",
      rule,
    },
  };
}
