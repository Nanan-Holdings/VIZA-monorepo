import { beforeEach, describe, expect, it, vi } from "vitest";

const airwallex = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  createConsent: vi.fn(),
  disableConsent: vi.fn(),
  verifyConsent: vi.fn(),
}));
const syncConsent = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const toDataUrl = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock("@/lib/airwallex/client", () => ({
  createAirwallexCustomer: airwallex.createCustomer,
  createAirwallexPaymentConsent: airwallex.createConsent,
  disableAirwallexPaymentConsent: airwallex.disableConsent,
  verifyAirwallexWalletPaymentConsent: airwallex.verifyConsent,
  getAirwallexEnvironment: () => "demo",
  isAirwallexConfigured: () => true,
  isAirwallexWechatRecurringConfigured: () => true,
}));
vi.mock("@/lib/airwallex/payment-consent-record", () => ({
  syncAirwallexWalletConsent: syncConsent,
}));
vi.mock("@/lib/payments/commercial-session", () => ({
  getCommercialAuthenticatedUser: getUser,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));
vi.mock("qrcode", () => ({ default: { toDataURL: toDataUrl } }));

import { POST } from "./route";

function thenable<T>(value: T) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "insert", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (result: T) => unknown) => Promise.resolve(resolve(value));
  return builder;
}

describe("wallet payment-consent route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      authUserId: "11111111-1111-4111-8111-111111111111",
      email: "applicant@example.com",
      name: "Applicant",
    });
    airwallex.createCustomer.mockResolvedValue({ id: "cus_provider" });
    airwallex.createConsent.mockResolvedValue({
      id: "cst_provider",
      status: "REQUIRES_PAYMENT_METHOD",
    });
    airwallex.verifyConsent.mockResolvedValue({
      id: "cst_provider",
      customer_id: "cus_provider",
      status: "REQUIRES_CUSTOMER_ACTION",
      next_action: { type: "redirect", qrcode: "https://provider.example/authorize" },
    });
    toDataUrl.mockResolvedValue("data:image/png;base64,providerqr");

    const countBuilder = thenable({ count: 0, error: null });
    const insertBuilder = thenable({ error: null }) as Record<string, unknown>;
    insertBuilder.single = vi.fn(async () => ({
      data: { id: "33333333-3333-4333-8333-333333333333" },
      error: null,
    }));
    const updateOne = thenable({ error: null });
    const updateTwo = thenable({ error: null });
    from
      .mockReturnValueOnce(countBuilder)
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(updateOne)
      .mockReturnValueOnce(updateTwo);
  });

  it("renders only the provider-returned authorization target as the QR", async () => {
    const response = await POST(
      new Request("https://viza.example/api/payments/bind/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "wechat_pay" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(airwallex.createConsent).toHaveBeenCalledWith({
      requestId: "wallet-consent-33333333-3333-4333-8333-333333333333",
      customerId: "cus_provider",
    });
    expect(airwallex.verifyConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentConsentId: "cst_provider",
        method: "wechat_pay",
      }),
    );
    expect(toDataUrl).toHaveBeenCalledWith(
      "https://provider.example/authorize",
      expect.objectContaining({ width: 280 }),
    );
    expect(body).toMatchObject({
      method: "wechat_pay",
      authorizationUrl: "https://provider.example/authorize",
      qrCodeDataUrl: "data:image/png;base64,providerqr",
    });
  });

  it("keeps an opaque provider QR payload while exposing only the HTTPS fallback URL", async () => {
    airwallex.verifyConsent.mockResolvedValue({
      id: "cst_provider",
      customer_id: "cus_provider",
      status: "REQUIRES_CUSTOMER_ACTION",
      next_action: {
        type: "render_qrcode",
        qrcode: "provider-opaque-qr-payload",
        url: "https://provider.example/fallback",
      },
    });

    const response = await POST(
      new Request("https://viza.example/api/payments/bind/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "alipay" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(toDataUrl).toHaveBeenCalledWith(
      "provider-opaque-qr-payload",
      expect.objectContaining({ width: 280 }),
    );
    expect(body.authorizationUrl).toBe("https://provider.example/fallback");
  });
});
