import { describe, it, expect } from "vitest";
import { mapStripeRefundEvent } from "./refund-status";

/** PAYP-005: refund/chargeback event → internal state. */
describe("mapStripeRefundEvent", () => {
  it("maps full vs partial refunds", () => {
    expect(mapStripeRefundEvent("charge.refunded")).toBe("refunded");
    expect(mapStripeRefundEvent("charge.refunded", false)).toBe("partially_refunded");
  });
  it("maps failed refund + disputes", () => {
    expect(mapStripeRefundEvent("refund.failed")).toBe("refund_failed");
    expect(mapStripeRefundEvent("charge.dispute.created")).toBe("disputed");
  });
  it("ignores unrelated events", () => {
    expect(mapStripeRefundEvent("payment_intent.succeeded")).toBe("none");
  });
});
