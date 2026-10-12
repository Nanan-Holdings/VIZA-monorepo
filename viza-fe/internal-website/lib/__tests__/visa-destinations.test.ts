import { describe, expect, it } from "vitest";
import {
  getCanonicalApplicationProductCountry,
  getCanonicalVisaDestinationCountry,
  getDestinationDisplayName,
  getDestinationDisplayNameZh,
  getFormVisaType,
  getPopularVisaDestinationByPackage,
  getVisaDestinationKey,
  getVisaTypeDestinationCountry,
  getVisaPackageTitle,
  SEARCHABLE_VISA_DESTINATIONS,
  VISA_DESTINATION_COUNTRY_GROUPS,
} from "@/lib/visa-destinations";
import zhMessages from "@/messages/zh.json";

describe("automated online destination catalogue", () => {
  it("exposes dedicated Japan VJW and Kenya eTA products", () => {
    expect(getPopularVisaDestinationByPackage("japan", "JP_VISIT_JAPAN_WEB")).toMatchObject({
      visaNameZh: "入境与海关申报",
      supportLabel: "Arrival declaration · compliance review",
    });
    expect(getPopularVisaDestinationByPackage("KE", "KE_ETA")).toMatchObject({
      visaNameZh: "电子旅行授权",
      supportLabel: "Electronic travel authorization",
    });
    expect(getVisaPackageTitle("japan", "JP_VISIT_JAPAN_WEB", "zh-CN")).toBe("日本入境与海关申报");
    expect(getVisaPackageTitle("kenya", "KE_ETA", "zh-CN")).toBe("肯尼亚电子旅行授权");
  });

  it("localizes every Japan and Kenya form step in the Chinese interface", () => {
    expect(zhMessages.application.dynamicSteps).toMatchObject({
      "Traveller and Passport": "旅客与护照",
      "Arrival and Stay": "入境与停留",
      "Immigration Declaration": "入境申报",
      "Applicant and Passport": "申请人与护照",
      "Travel and Accommodation": "行程与住宿",
      "Fee and Declaration": "费用与声明",
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

  it("preserves aliases and normalized fallbacks for unknown or empty countries", () => {
    expect(getCanonicalVisaDestinationCountry(" USA ")).toBe("united_states");
    expect(getCanonicalVisaDestinationCountry("United States of America")).toBe("united_states");
    expect(getCanonicalVisaDestinationCountry(" 越南 ")).toBe("vietnam");
    expect(getCanonicalVisaDestinationCountry("Unknown Place")).toBe("unknown_place");
    expect(getCanonicalVisaDestinationCountry("   ")).toBe("");
  });

  it("preserves unique, ambiguous, empty and aliased visa-type ownership", () => {
    expect(getFormVisaType(" B1/B2 ")).toBe("DS160");
    expect(getVisaTypeDestinationCountry(" DS-160 ")).toBe("united_states");
    expect(getVisaTypeDestinationCountry("tourist_evisa")).toBeNull();
    expect(getVisaTypeDestinationCountry("   ")).toBeNull();
    expect(
      getCanonicalApplicationProductCountry("vietnam", "PH_ETRAVEL_DEPARTURE_CARD"),
    ).toBe("philippines");
  });

  it("keeps destination keys stable across product and country aliases", () => {
    expect(getVisaDestinationKey("stale-country", "PH_ETRAVEL_DEPARTURE_CARD")).toBe(
      "philippines::ph_etravel_departure_card",
    );
    expect(getVisaDestinationKey("United States", " B1/B2 ")).toBe("united_states::ds160");
  });
});
