import { describe, expect, it } from "vitest";
import { getPaymentProviderConfigReport, isPublicHttpsCallbackUrl, validateProviderConfig } from "./validate-provider-config";
import { pricingFor, totalCents } from "@/lib/pricing";

const liveStripeEnv = {
  NODE_ENV: "development",
  STRIPE_SECRET_KEY: "sk_live_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_example",
} as unknown as NodeJS.ProcessEnv;

/** PAYP-002: provider config validation. */
describe("validateProviderConfig", () => {
  it("flags missing env for an enabled provider", () => {
    const issues = validateProviderConfig(["stripe"], {} as NodeJS.ProcessEnv);
    expect(issues.some((issue) => issue.provider === "stripe" && issue.severity === "error")).toBe(true);
  });

  it("passes when live Stripe configuration is complete", () => {
    expect(validateProviderConfig(["stripe"], liveStripeEnv)).toEqual([]);
  });

  it("warns on Airwallex demo config outside production", () => {
    const env = {
      AIRWALLEX_CLIENT_ID: "x",
      AIRWALLEX_API_KEY: "x",
      AIRWALLEX_WEBHOOK_SECRET: "x",
      AIRWALLEX_ENV: "demo",
      NODE_ENV: "development",
    } as unknown as NodeJS.ProcessEnv;
    const issues = validateProviderConfig(["airwallex"], env);
    expect(issues.some((issue) => issue.severity === "warn" && /NON-PROD/.test(issue.message))).toBe(true);
  });

  it("makes known test credentials an error in production", () => {
    const issues = validateProviderConfig(["stripe"], {
      ...liveStripeEnv,
      STRIPE_SECRET_KEY: "sk_test_example",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example",
      NODE_ENV: "production",
    });
    expect(issues).toContainEqual(expect.objectContaining({ provider: "stripe", severity: "error" }));
  });

  it("requires PhotonPay signing, verification, site, and API configuration", () => {
    const issues = validateProviderConfig(["photonpay"], {
      NODE_ENV: "development",
      PHOTONPAY_BASE_URL: "https://x-api.photonpay.com",
      PHOTONPAY_APP_ID: "app",
      PHOTONPAY_APP_SECRET: "secret",
      PHOTONPAY_SITE_ID: "site",
    });
    expect(issues[0]?.message).toContain("PHOTONPAY_PRIVATE_KEY(_PATH)");
    expect(issues[0]?.message).toContain("PHOTONPAY_PLATFORM_PUBLIC_KEY(_PATH)");
  });

  it("requires distinct public HTTPS payment and refund callbacks for WeChat", () => {
    const env = {
      NODE_ENV: "production",
      WECHAT_PAY_MCH_ID: "merchant",
      WECHAT_PAY_APP_ID: "app",
      WECHAT_PAY_API_V3_KEY: "key",
      WECHAT_PAY_MERCHANT_SERIAL_NO: "serial",
      WECHAT_PAY_PRIVATE_KEY: "private-key",
      WECHAT_PAY_NOTIFY_URL: "https://app.viza.it.com/api/wechat-pay/notify",
      WECHAT_PAY_REFUND_NOTIFY_URL: "http://localhost/api/wechat-pay/refund/notify",
    } as unknown as NodeJS.ProcessEnv;
    expect(validateProviderConfig(["wechat"], env)).toContainEqual(expect.objectContaining({
      provider: "wechat",
      severity: "error",
      message: expect.stringContaining("WECHAT_PAY_REFUND_NOTIFY_URL"),
    }));
    expect(validateProviderConfig(["wechat"], {
      ...env,
      WECHAT_PAY_REFUND_NOTIFY_URL: "https://app.viza.it.com/api/wechat-pay/refund/notify",
    })).toEqual([]);
  });

  it.each([
    "https://localhost/api/wechat-pay/notify",
    "https://127.0.0.1/api/wechat-pay/notify",
    "https://10.1.2.3/api/wechat-pay/notify",
    "https://172.20.1.2/api/wechat-pay/notify",
    "https://192.168.1.2/api/wechat-pay/notify",
    "https://169.254.1.2/api/wechat-pay/notify",
    "https://[::1]/api/wechat-pay/notify",
    "https://[fd00::1]/api/wechat-pay/notify",
    "https://service.internal/api/wechat-pay/notify",
    "https://callback.example/api/wechat-pay/notify",
    "https://app.viza.it.com:8443/api/wechat-pay/notify",
    "https://app.viza.it.com/api/wechat-pay/notify?token=secret",
  ])("rejects non-public or ambiguous WeChat callback URL %s", (url) => {
    expect(isPublicHttpsCallbackUrl(url, "/api/wechat-pay/notify")).toBe(false);
  });

  it("accepts the exact public WeChat callback shape", () => {
    expect(isPublicHttpsCallbackUrl(
      "https://app.viza.it.com/api/wechat-pay/notify",
      "/api/wechat-pay/notify",
    )).toBe(true);
  });
});

describe("getPaymentProviderConfigReport", () => {
  it("requires an explicit selection in production while still identifying the active card rail", () => {
    const report = getPaymentProviderConfigReport({ ...liveStripeEnv, NODE_ENV: "production" });
    expect(report.enabledProviders).toEqual(["stripe"]);
    expect(report.selectionExplicit).toBe(false);
    expect(report.ready).toBe(false);
  });

  it("accepts, normalizes, and deduplicates an explicit provider list", () => {
    const report = getPaymentProviderConfigReport({
      ...liveStripeEnv,
      NODE_ENV: "production",
      VIZA_ENABLED_PAYMENT_PROVIDERS: " Stripe, stripe ",
    });
    expect(report.enabledProviders).toEqual(["stripe"]);
    expect(report.ready).toBe(true);
  });

  it("fails closed for unknown providers", () => {
    const report = getPaymentProviderConfigReport({
      ...liveStripeEnv,
      NODE_ENV: "production",
      VIZA_ENABLED_PAYMENT_PROVIDERS: "stripe,paypal",
    });
    expect(report.ready).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ provider: "configuration", severity: "error" }));
  });

  it("reconciles the explicit list with PhotonPay's authoritative runtime switch", () => {
    const report = getPaymentProviderConfigReport({
      ...liveStripeEnv,
      NODE_ENV: "production",
      PHOTONPAY_ENABLED: "true",
      VIZA_ENABLED_PAYMENT_PROVIDERS: "stripe",
    });
    expect(report.enabledProviders).toEqual(["photonpay", "stripe"]);
    expect(report.ready).toBe(false);
    expect(report.issues.some((issue) => /active card provider: photonpay/.test(issue.message))).toBe(true);
  });

  it("reports development problems without throwing", () => {
    const report = getPaymentProviderConfigReport({ NODE_ENV: "development" });
    expect(report.enabledProviders).toEqual(["stripe"]);
    expect(report.ready).toBe(false);
    expect(report.issues.some((issue) => issue.severity === "warn")).toBe(true);
  });
});

/** PAYP-006: portal display currency equals the charged amount (both from pricing). */
describe("display currency = charged amount", () => {
  it("does not expose retired Indonesia B211A pricing", () => {
    expect(pricingFor("indonesia", "B211A")).toBeNull();
  });

  for (const [country, visaType] of [["indonesia", "ID_C1_TOURIST"], ["united_kingdom", "UK_STANDARD_VISITOR"]] as const) {
    it(`${country}: displayed total == charged total in one currency`, () => {
      const pricing = pricingFor(country, visaType);
      expect(pricing).toBeTruthy();
      if (!pricing) return;
      expect(totalCents(pricing)).toBe(pricing.agencyFeeCents + pricing.govtFeeCents);
      expect(pricing.currency.length).toBe(3);
    });
  }
});
