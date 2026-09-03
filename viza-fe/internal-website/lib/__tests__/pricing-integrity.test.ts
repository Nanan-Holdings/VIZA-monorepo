import { describe, expect, it } from "vitest";
import { PACKAGE_PRICING, pricingFor } from "../pricing";

/**
 * LANE G — visa-domain pricing correctness.
 *
 * Guards the catalogue against the two failure modes fixed alongside this
 * file: (1) duplicate rows for the same (country, canonical visa-type) pair
 * where the second row silently never wins the lookup, and (2) the
 * country-agnostic route-alias leak that let a generic e-visa param for one
 * country resolve to another country's package.
 */
describe("pricing catalogue integrity", () => {
  it("has no duplicate (country, canonical visa-type) rows", () => {
    // pricingFor() runs the same country-aware canonicalisation the app uses,
    // and returns the FIRST matching row. So a genuinely unique row must look
    // itself up by reference; a dead duplicate would resolve to the live row
    // (a different object) and fail this assertion.
    for (const entry of PACKAGE_PRICING) {
      expect(pricingFor(entry.country, entry.visaType)).toBe(entry);
    }

    // Belt-and-suspenders: the resolved lookups must cover every distinct row
    // (i.e. no two rows collapse onto one another).
    const resolved = new Set(
      PACKAGE_PRICING.map((entry) => pricingFor(entry.country, entry.visaType)),
    );
    expect(resolved.size).toBe(PACKAGE_PRICING.length);
  });

  it.each([
    ["cambodia", "KH_TOURIST_E_VISA"],
    ["indonesia", "ID_B1_EVOA"],
    ["vietnam", "VN_E_VISA"],
    ["thailand", "TH_TOURIST_E_VISA"],
    ["india", "IN_E_VISA"],
  ])("prices the sellable %s / %s package", (country, visaType) => {
    const pricing = pricingFor(country, visaType);
    expect(pricing).not.toBeNull();
    expect(pricing?.country).toBe(country);
    expect(pricing?.agencyFeeCents).toBeGreaterThan(0);
    expect(pricing?.currency).toHaveLength(3);
  });

  it("scopes the Vietnam e-visa route aliases to Vietnam only", () => {
    // Vietnam's own generic route params still resolve for Vietnam.
    expect(pricingFor("vietnam", "tourist_e_visa")?.visaType).toBe("VN_E_VISA");
    expect(pricingFor("vietnam", "e_visa_tourism")?.visaType).toBe("VN_E_VISA");

    // The same generic params must NOT be hijacked into VN_E_VISA for another
    // country (the pre-fix bug that surfaced "This visa isn't available yet").
    // Cambodia has no generic-route row, so this stays null rather than
    // silently resolving to Vietnam pricing.
    const cambodiaGeneric = pricingFor("cambodia", "tourist_e_visa");
    if (cambodiaGeneric) {
      expect(cambodiaGeneric.country).toBe("cambodia");
    } else {
      expect(cambodiaGeneric).toBeNull();
    }
  });

  it("no longer prices the removed Russia route", () => {
    expect(pricingFor("russia", "RU_E_VISA")).toBeNull();
    expect(PACKAGE_PRICING.some((entry) => entry.country === "russia")).toBe(false);
  });
});
