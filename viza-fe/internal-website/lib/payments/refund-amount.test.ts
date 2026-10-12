import { describe, expect, it } from "vitest";
import {
  applyAgencyDiscountToRefundLines,
  betaAgencyDiscount,
  capRefundToCollectedAmount,
} from "./refund-amount";

describe("discount-aware refunds", () => {
  it("refunds only the agency fee actually collected after a beta discount", () => {
    expect(applyAgencyDiscountToRefundLines([
      { kind: "agency", amountCents: 9_900 },
      { kind: "govt", amountCents: 2_500 },
    ], 4_950)).toEqual([
      { kind: "agency", amountCents: 4_950 },
      { kind: "govt", amountCents: 2_500 },
    ]);
  });

  it("never asks Stripe to refund more than the recorded provider total", () => {
    expect(capRefundToCollectedAmount(12_400, {
      checkout_payment: { expected_amount_minor: 7_450 },
    })).toBe(7_450);
  });

  it("reads only a safe integer beta discount", () => {
    expect(betaAgencyDiscount({ beta: { discount_cents: 4_950 } })).toBe(4_950);
    expect(betaAgencyDiscount({ beta: { discount_cents: "4950" } })).toBe(0);
  });
});
