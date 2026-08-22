import { describe, it, expect } from "vitest";
import {
  paymentMethodsFor,
  stripeCheckoutPaymentMethodsFor,
} from "./method-availability";

/** PAYP-004: payment-method availability resolves per country (config-driven). */
describe("paymentMethodsFor", () => {
  it("Indonesia C1 offers card + WeChat + Alipay", () => {
    const m = paymentMethodsFor("indonesia", "ID_C1_TOURIST");
    expect(m.card).toBe(true);
    expect(m.wechat).toBe(true);
    expect(m.alipay).toBe(true);
  });

  it("expands wallet availability from the configured package matrix", () => {
    const m = paymentMethodsFor("united_states", "B1_B2");
    expect(m.card).toBe(true);
    expect(m.wechat).toBe(true);
    expect(m.alipay).toBe(true);
  });

  it("card is always available even for unknown packages", () => {
    expect(paymentMethodsFor("narnia", "NONE").card).toBe(true);
  });

  it("maps eligible wallets to Stripe Checkout method names", () => {
    expect(stripeCheckoutPaymentMethodsFor("indonesia", "ID_C1_TOURIST")).toEqual([
      "card",
      "alipay",
      "wechat_pay",
    ]);
  });

  it("maps supported package currencies to Stripe wallets", () => {
    expect(stripeCheckoutPaymentMethodsFor("united_states", "B1_B2")).toEqual([
      "card",
      "alipay",
      "wechat_pay",
    ]);
    expect(stripeCheckoutPaymentMethodsFor("united_states", "DS160")).toEqual([
      "card",
      "alipay",
      "wechat_pay",
    ]);
    expect(
      stripeCheckoutPaymentMethodsFor("new_zealand", "NZ_VISITOR_VISA"),
    ).toEqual(["card", "alipay"]);
  });

  it("keeps Stripe card-only for unsupported package currencies", () => {
    expect(stripeCheckoutPaymentMethodsFor("macau", "MO_VISIT_VISA")).toEqual([
      "card",
    ]);
    expect(
      stripeCheckoutPaymentMethodsFor("south_africa", "ZA_VISITOR_VISA"),
    ).toEqual(["card"]);
  });

  it("keeps unknown packages card-only", () => {
    expect(stripeCheckoutPaymentMethodsFor("narnia", "NONE")).toEqual(["card"]);
  });
});
