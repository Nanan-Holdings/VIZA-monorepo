import { afterEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "./client";

describe("Stripe Checkout wallet parameters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("sends Alipay and web WeChat Pay without contacting live Stripe", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_local_only";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "cs_test_local",
          url: "https://checkout.stripe.test/cs_test_local",
          payment_intent: null,
          payment_status: "unpaid",
          status: "open",
          metadata: null,
          amount_total: 1000,
          currency: "usd",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createCheckoutSession({
      amountCents: 1000,
      currency: "USD",
      productName: "VIZA test package",
      successUrl: "https://viza.test/success",
      cancelUrl: "https://viza.test/cancel",
      applicationId: "application-test",
      orderId: "order-test",
      paymentMethodTypes: ["card", "alipay", "wechat_pay"],
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = new URLSearchParams(String(request?.body));
    expect(body.get("payment_method_types[0]")).toBe("card");
    expect(body.get("payment_method_types[1]")).toBe("alipay");
    expect(body.get("payment_method_types[2]")).toBe("wechat_pay");
    expect(body.get("payment_method_options[wechat_pay][client]")).toBe("web");
  });
});
