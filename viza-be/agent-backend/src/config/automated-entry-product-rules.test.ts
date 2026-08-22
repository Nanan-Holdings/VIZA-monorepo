import { describe, expect, it } from "vitest";
import {
  AUTOMATED_ENTRY_PRODUCT_RULES,
  getAutomatedEntryProductRule,
} from "./automated-entry-product-rules.js";

describe("first-phase automated entry product rules", () => {
  it("covers only Chinese ordinary-passport tourism", () => {
    expect(AUTOMATED_ENTRY_PRODUCT_RULES.map((rule) => rule.destinationCountry)).toEqual([
      "japan",
      "kenya",
    ]);
    expect(AUTOMATED_ENTRY_PRODUCT_RULES.every((rule) =>
      rule.passportCountryIso3 === "CHN" &&
      rule.passportType === "ordinary" &&
      rule.tripPurpose === "tourism",
    )).toBe(true);
  });

  it("recommends separate VJW and Kenya eTA products", () => {
    const japan = getAutomatedEntryProductRule("japan", "CHN");
    const kenya = getAutomatedEntryProductRule("kenya", "CHN");
    expect(japan?.arrivalCardTypes).toEqual(["JP_VISIT_JAPAN_WEB"]);
    expect(japan?.productRecommendations.map((product) => product.productCode)).toEqual([
      "JP_VISIT_JAPAN_WEB",
    ]);
    expect(japan?.productRecommendations[0]?.requirement).toBe("optional");
    expect(japan?.conditions.vjw_recommended_before_arrival).toBe(true);
    expect(japan?.conditions.paper_ed_card_alternative_available).toBe(true);
    expect(kenya?.productRecommendations.map((product) => product.productCode)).toEqual([
      "KE_ETA",
    ]);
    expect(kenya?.conditions.standard_fee_usd).toBe(30);
  });

  it("does not invent rules for other passports or non-tourism purposes", () => {
    expect(getAutomatedEntryProductRule("japan", "SGP")).toBeNull();
    expect(getAutomatedEntryProductRule("kenya", "CHN", "ordinary", "business")).toBeNull();
  });
});
