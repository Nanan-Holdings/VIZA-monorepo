import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Airwallex wallet payment consent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AIRWALLEX_BASE_URL", "https://api-demo.airwallex.com");
    vi.stubEnv("AIRWALLEX_CLIENT_ID", "client_test");
    vi.stubEnv("AIRWALLEX_API_KEY", "key_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function loadClientWithConsentResponse() {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: "token_test", expires_at: "2099-01-01T00:00:00Z" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "cst_test",
            status: "REQUIRES_CUSTOMER_ACTION",
            customer_id: "cus_test",
            next_action: { type: "redirect", url: "https://provider.example/authorize" },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = await import("./client");
    return { client, fetchMock };
  }

  it("verifies WeChat consent with provider QR flow and CNY options", async () => {
    const { client, fetchMock } = await loadClientWithConsentResponse();

    await client.verifyAirwallexWalletPaymentConsent({
      paymentConsentId: "cst_test",
      method: "wechat_pay",
      requestId: "verify_wechat",
      returnUrl: "https://viza.example/client/settings/payment-methods",
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api-demo.airwallex.com/api/v1/pa/payment_consents/cst_test/verify");
    expect(JSON.parse(String(init?.body))).toEqual({
      request_id: "verify_wechat",
      payment_method: { type: "wechatpay", wechatpay: { flow: "qrcode" } },
      verification_options: { wechatpay: { currency: "CNY" } },
      return_url: "https://viza.example/client/settings/payment-methods",
    });
  });

  it("verifies Alipay consent with the Airwallex alipaycn QR flow", async () => {
    const { client, fetchMock } = await loadClientWithConsentResponse();

    await client.verifyAirwallexWalletPaymentConsent({
      paymentConsentId: "cst_test",
      method: "alipay",
      requestId: "verify_alipay",
      returnUrl: "https://viza.example/client/settings/payment-methods",
    });

    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      request_id: "verify_alipay",
      payment_method: { type: "alipaycn", alipaycn: { flow: "qrcode" } },
      return_url: "https://viza.example/client/settings/payment-methods",
    });
  });

  it("confirms an approved charge with the saved provider consent id", async () => {
    const { client, fetchMock } = await loadClientWithConsentResponse();

    await client.confirmPaymentIntentWithConsent({
      intentId: "int_test",
      paymentConsentId: "cst_test",
      requestId: "saved-consent-payment",
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api-demo.airwallex.com/api/v1/pa/payment_intents/int_test/confirm");
    expect(JSON.parse(String(init?.body))).toEqual({
      payment_consent_id: "cst_test",
      request_id: "saved-consent-payment",
    });
  });

  it("enables WeChat Settings consent only for an explicitly configured single-plan merchant", async () => {
    const client = await import("./client");

    expect(client.isAirwallexWechatRecurringConfigured()).toBe(false);
    vi.stubEnv("AIRWALLEX_WECHAT_RECURRING_FLOW", "single_plan");
    expect(client.isAirwallexWechatRecurringConfigured()).toBe(true);
    vi.stubEnv("AIRWALLEX_WECHAT_RECURRING_FLOW", "multi_plan");
    expect(client.isAirwallexWechatRecurringConfigured()).toBe(false);
  });
});
