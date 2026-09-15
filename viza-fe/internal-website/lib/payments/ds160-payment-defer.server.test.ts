import { describe, expect, it } from "vitest";
import {
  applyDs160PaymentDeferOverride,
  DS160_PAYMENT_DEFER_APPLICATION_ID_ENV,
  DS160_PAYMENT_DEFERRED_REASON,
  isDs160PaymentDeferEnabled,
} from "./ds160-payment-defer.server";
import type { SubmissionAccessDecision } from "./submission-access";

const applicationId = "11111111-1111-4111-8111-111111111111";
const target = {
  applicationId,
  country: "united_states",
  visaType: "B1_B2",
};

function environment(overrides: Record<string, string> = {}) {
  return {
    NODE_ENV: "development",
    [DS160_PAYMENT_DEFER_APPLICATION_ID_ENV]: applicationId,
    ...overrides,
  };
}

function unpaidDecision(
  status: SubmissionAccessDecision["status"] = "payment_required",
): SubmissionAccessDecision {
  return {
    status,
    accessLevel: "standard",
    agencyFee: {
      status: "required",
      amountCents: 9_900,
      amountDueCents: 9_900,
      currency: "USD",
    },
    officialFee: {
      status: "required",
      amountCents: 18_500,
      amountDueCents: 18_500,
      currency: "USD",
    },
    entitlementId: "entitlement-1",
    orderId: null,
    paymentRecordId: null,
    allocationId: null,
    accessGrantId: null,
    checkoutUrl: null,
    returnTo: "/client/application/long-form?step=review",
    reason: "agency_and_official_fee_required",
  };
}

describe("DS-160 local payment deferral", () => {
  it("enables only the exact local US DS-160 application", () => {
    expect(isDs160PaymentDeferEnabled(target, environment())).toBe(true);
    expect(isDs160PaymentDeferEnabled({ ...target, country: "US" }, environment())).toBe(true);
    expect(isDs160PaymentDeferEnabled({ ...target, visaType: "DS160" }, environment())).toBe(true);
  });

  it.each([
    ["missing configuration", { [DS160_PAYMENT_DEFER_APPLICATION_ID_ENV]: "" }],
    ["mismatched application", { [DS160_PAYMENT_DEFER_APPLICATION_ID_ENV]: "other-app" }],
    ["production", { NODE_ENV: "production" }],
  ])("stays disabled for %s", (_label, overrides: Record<string, string>) => {
    expect(isDs160PaymentDeferEnabled(target, environment(overrides))).toBe(false);
  });

  it("rejects non-US and non-DS-160 targets", () => {
    expect(isDs160PaymentDeferEnabled({ ...target, country: "vietnam" }, environment())).toBe(false);
    expect(isDs160PaymentDeferEnabled({ ...target, visaType: "VN_E_VISA" }, environment())).toBe(false);
  });

  it("makes access ready while preserving required financial statuses and amounts", () => {
    const decision = unpaidDecision();
    const result = applyDs160PaymentDeferOverride(decision, target, environment());

    expect(result).toMatchObject({
      status: "ready",
      reason: DS160_PAYMENT_DEFERRED_REASON,
      paymentOverride: {
        kind: "ds160_payment_deferred",
        scope: "ds160",
        financialStatus: "deferred",
      },
      agencyFee: { status: "required", amountDueCents: 9_900 },
      officialFee: { status: "required", amountDueCents: 18_500 },
    });
    expect(result.entitlementId).toBe(decision.entitlementId);
  });

  it("does not override review-required or unconfigured decisions", () => {
    const review = unpaidDecision("review_required");
    expect(applyDs160PaymentDeferOverride(review, target, environment())).toBe(review);

    const paymentRequired = unpaidDecision();
    expect(applyDs160PaymentDeferOverride(paymentRequired, target, {
      NODE_ENV: "development",
    })).toBe(paymentRequired);
  });
});
