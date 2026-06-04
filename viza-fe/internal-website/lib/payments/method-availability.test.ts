import { describe, it, expect } from "vitest";
import { paymentMethodsFor } from "./method-availability";

/** PAYP-004: payment-method availability resolves per country (config-driven). */
describe("paymentMethodsFor", () => {
  it("Indonesia/B211A offers card + WeChat + Alipay", () => {
    const m = paymentMethodsFor("indonesia", "B211A");
    expect(m.card).toBe(true);
    expect(m.wechat).toBe(true);
    expect(m.alipay).toBe(true);
  });

  it("non-WeChat countries fall back to card only", () => {
    const m = paymentMethodsFor("united_states", "B1_B2");
    expect(m.card).toBe(true);
    expect(m.wechat).toBe(false);
    expect(m.alipay).toBe(false);
  });

  it("card is always available even for unknown packages", () => {
    expect(paymentMethodsFor("narnia", "NONE").card).toBe(true);
  });
});
