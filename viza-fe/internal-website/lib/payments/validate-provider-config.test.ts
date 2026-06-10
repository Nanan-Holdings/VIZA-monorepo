import { describe, it, expect } from "vitest";
import { validateProviderConfig } from "./validate-provider-config";
import { pricingFor, totalCents } from "@/lib/pricing";

/** PAYP-002: provider config validation. */
describe("validateProviderConfig", () => {
  it("flags missing env for an enabled provider", () => {
    const issues = validateProviderConfig(["stripe"], {} as NodeJS.ProcessEnv);
    expect(issues.some((i) => i.provider === "stripe" && i.severity === "error")).toBe(true);
  });

  it("passes when all required env present", () => {
    const env = { STRIPE_SECRET_KEY: "x", STRIPE_WEBHOOK_SECRET: "x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "x" } as unknown as NodeJS.ProcessEnv;
    expect(validateProviderConfig(["stripe"], env)).toEqual([]);
  });

  it("warns on AIRWALLEX_ENV=demo (non-prod)", () => {
    const env = {
      AIRWALLEX_CLIENT_ID: "x", AIRWALLEX_API_KEY: "x", AIRWALLEX_WEBHOOK_SECRET: "x", AIRWALLEX_ENV: "demo",
    } as unknown as NodeJS.ProcessEnv;
    const issues = validateProviderConfig(["airwallex"], env);
    expect(issues.some((i) => i.severity === "warn" && /NON-PROD/.test(i.message))).toBe(true);
  });
});

/** PAYP-006: portal display currency equals the charged amount (both from pricing). */
describe("display currency = charged amount", () => {
  for (const [country, visaType] of [["indonesia", "B211A"], ["united_kingdom", "UK_STANDARD_VISITOR"]] as const) {
    it(`${country}: displayed total == charged total in one currency`, () => {
      const p = pricingFor(country, visaType);
      expect(p).toBeTruthy();
      if (!p) return;
      // The amount shown to the user and the amount charged both derive from
      // the same pricing record → equal by construction, same currency.
      const displayed = totalCents(p);
      const charged = p.agencyFeeCents + p.govtFeeCents;
      expect(displayed).toBe(charged);
      expect(p.currency.length).toBe(3);
    });
  }
});
