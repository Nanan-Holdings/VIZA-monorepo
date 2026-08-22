import { describe, expect, it } from "vitest";
import {
  isEligibleGovernmentFeeAllocation,
  normalizeOfficialFeePaymentMethod,
  officialFeeCheckoutUrl,
  resolveManagedOfficialFee,
} from "./managed-payment";

describe("managed official-fee payment policy", () => {
  it("defaults missing paymentMethod to the VIZA-managed card", () => {
    expect(normalizeOfficialFeePaymentMethod({})).toBe("viza_managed_virtual_card");
    expect(normalizeOfficialFeePaymentMethod(null)).toBe("viza_managed_virtual_card");
    expect(normalizeOfficialFeePaymentMethod({ paymentMethod: "one_time_user_card" })).toBe(
      "one_time_user_card",
    );
  });

  it("falls back to package pricing when application fee fields are null", () => {
    const resolved = resolveManagedOfficialFee({
      id: "uk-app",
      country: "united_kingdom",
      visa_type: "UK_STANDARD_VISITOR",
      government_fee_cents: null,
      government_fee_currency: null,
    });
    expect(resolved).toMatchObject({
      ok: true,
      amountCents: 13_500,
      currency: "GBP",
      catalog: { countryCode: "GB", provider: "ukvi_standard_visitor_official_fee" },
    });
  });

  it("resolves legacy Vietnam e-Visa aliases when the application fee amount is null", () => {
    const resolved = resolveManagedOfficialFee({
      id: "legacy-vietnam-app",
      country: "vietnam",
      visa_type: "evisa_tourism",
      government_fee_cents: null,
      government_fee_currency: "USD",
    });
    expect(resolved).toMatchObject({
      ok: true,
      amountCents: 2_500,
      currency: "USD",
      catalog: { countryCode: "VN", provider: "vietnam_evisa_official_fee" },
    });
  });

  it("prefers a positive application-specific amount over package pricing", () => {
    const resolved = resolveManagedOfficialFee({
      id: "au-app",
      country: "australia",
      visa_type: "AU_VISITOR_600",
      government_fee_cents: 20_500,
      government_fee_currency: "aud",
    });
    expect(resolved).toMatchObject({ ok: true, amountCents: 20_500, currency: "AUD" });
  });

  it("rejects free and offline routes before creating an intent", () => {
    expect(resolveManagedOfficialFee({
      id: "sgac",
      country: "singapore",
      visa_type: "SG_ARRIVAL_CARD",
    })).toMatchObject({ ok: false, code: "official_fee_not_electronic" });
    expect(resolveManagedOfficialFee({
      id: "italy",
      country: "italy",
      visa_type: "EU_SCHENGEN_C_SHORT_STAY",
    })).toMatchObject({ ok: false, code: "official_fee_not_electronic" });
  });

  it("requires a positive matching allocation in an issuable lifecycle state", () => {
    const charge = { amountCents: 13_500, currency: "GBP" };
    expect(isEligibleGovernmentFeeAllocation({
      id: "allocation",
      amount_cents: 13_500,
      currency: "gbp",
      state: "reserved_pending_treasury",
    }, charge)).toBe(true);
    expect(isEligibleGovernmentFeeAllocation({
      id: "allocation",
      amount_cents: 13_500,
      currency: "GBP",
      state: "consumed",
    }, charge)).toBe(false);
    expect(isEligibleGovernmentFeeAllocation({
      id: "allocation",
      amount_cents: 12_000,
      currency: "GBP",
      state: "issuable",
    }, charge)).toBe(false);
  });

  it("builds the controlled funding recovery URL", () => {
    expect(officialFeeCheckoutUrl("app/id with spaces")).toBe(
      "/client/checkout?applicationId=app%2Fid%20with%20spaces",
    );
  });
});
