import { describe, expect, it } from "vitest";
import {
  getDestinationDisplayName,
  getDestinationDisplayNameZh,
  getPopularVisaDestinationByPackage,
  SEARCHABLE_VISA_DESTINATIONS,
  VISA_DESTINATION_COUNTRY_GROUPS,
} from "@/lib/visa-destinations";

describe("automated online destination catalogue", () => {
  it("exposes dedicated Japan VJW and Kenya eTA products", () => {
    expect(getPopularVisaDestinationByPackage("japan", "JP_VISIT_JAPAN_WEB")).toMatchObject({
      visaNameZh: "Visit Japan Web 入境与海关申报",
      supportLabel: "Arrival declaration · compliance review",
    });
    expect(getPopularVisaDestinationByPackage("KE", "KE_ETA")).toMatchObject({
      visaNameZh: "肯尼亚电子旅行授权（eTA）",
      supportLabel: "Electronic travel authorization",
    });
  });

  it("does not recommend the removed Brazil or Russia routes", () => {
    expect(SEARCHABLE_VISA_DESTINATIONS.some((destination) => destination.country === "brazil")).toBe(false);
    expect(SEARCHABLE_VISA_DESTINATIONS.some((destination) => destination.country === "russia")).toBe(false);
    expect(VISA_DESTINATION_COUNTRY_GROUPS.some((group) => group.key === "brazil")).toBe(false);
    expect(VISA_DESTINATION_COUNTRY_GROUPS.some((group) => group.key === "russia")).toBe(false);
  });

  it("keeps legacy country labels available for historical status rows", () => {
    expect(getDestinationDisplayName("brazil")).toBe("Brazil");
    expect(getDestinationDisplayNameZh("russia")).toBe("俄罗斯");
  });
});
