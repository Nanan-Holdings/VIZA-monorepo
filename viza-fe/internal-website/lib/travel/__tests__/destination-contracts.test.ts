import { describe, expect, it } from "vitest";
import {
  buildLocalFirstDestinationPayload,
  createGeneratedDestinationDraft,
  findDropdownDestinationContract,
  getDropdownDestinationContracts,
  getLocalizedAttractionName,
  getLocalizedDestinationName,
  verifyTravelImageRelevance,
} from "@/lib/travel/destination-contracts";

const requiredCities = [
  "London",
  "Paris",
  "Tokyo",
  "Singapore",
  "Hong Kong",
  "Seoul",
  "Bangkok",
  "Dubai",
  "New York",
  "Los Angeles",
  "Las Vegas",
  "San Francisco",
  "Shanghai",
  "Guangzhou",
  "Hangzhou",
];

describe("local-first destination contracts", () => {
  it("covers required dropdown cities with local render data", () => {
    for (const city of requiredCities) {
      const destination = findDropdownDestinationContract(city);
      expect(destination, city).toBeTruthy();
      expect(destination?.latitude, city).toEqual(expect.any(Number));
      expect(destination?.longitude, city).toEqual(expect.any(Number));
      expect(destination?.coverImage?.verified, city).toBe(true);
      expect(destination?.attractions.length, city).toBeGreaterThanOrEqual(3);
      expect(
        destination?.attractions.filter((item) => item.image?.verified).length,
        city
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("builds an immediate local-first payload before enrichment", () => {
    const destination = findDropdownDestinationContract("Las Vegas");
    expect(destination).toBeTruthy();
    if (!destination) return;

    const payload = buildLocalFirstDestinationPayload(destination);
    expect(payload.coverImage?.imageUrl).toContain("/travel/cities/");
    expect(payload.attractionCards.length).toBeGreaterThanOrEqual(3);
    expect(payload.mapMarkers.length).toBeGreaterThanOrEqual(4);
    expect(payload.sourceStatus).toBe("local_verified");
    expect(payload.enrichment.needed).toBe(false);
  });

  it("keeps generated unknown destinations text-only with placeholder imagery", () => {
    const draft = createGeneratedDestinationDraft("Blue Lantern Bay");
    const payload = buildLocalFirstDestinationPayload(draft);

    expect(payload.sourceStatus).toBe("llm_generated");
    expect(payload.coverImage).toBeNull();
    expect(payload.mapMarkers).toEqual([]);
    expect(payload.missingFields).toContain("cover_image");
  });

  it("localizes destination and attraction names by locale", () => {
    const destination = findDropdownDestinationContract("Los Angeles");
    expect(destination).toBeTruthy();
    if (!destination) return;

    expect(getLocalizedDestinationName(destination, "zh")).toBe("洛杉矶");
    expect(getLocalizedDestinationName(destination, "en")).toBe("Los Angeles");

    const attraction = destination.attractions[0];
    expect(getLocalizedAttractionName(attraction, "zh")).toBe(attraction.nameZh);
    expect(getLocalizedAttractionName(attraction, "en")).toBe(attraction.nameEn);
  });

  it("does not match short Latin aliases inside unrelated destination names", () => {
    expect(findDropdownDestinationContract("LA")?.nameEn).toBe("Los Angeles");
    expect(findDropdownDestinationContract("Blue Lantern Bay")).toBeNull();
  });

  it("rejects placeholder or unrelated images as verified assets", () => {
    expect(
      verifyTravelImageRelevance({
        imageUrl: "/travel/cities/travel-fallback.svg",
        sourceUrl: "https://example.com/Los_Angeles",
        entityNames: ["Los Angeles"],
        cityNames: ["Los Angeles", "洛杉矶"],
      }).verified
    ).toBe(false);

    expect(
      verifyTravelImageRelevance({
        imageUrl: "/travel/cities/sanfrancisco.jpg",
        sourceUrl: "https://en.wikipedia.org/wiki/Golden_Gate_Bridge",
        entityNames: ["Guangzhou"],
        cityNames: ["Guangzhou", "广州"],
      }).verified
    ).toBe(false);
  });

  it("treats the dropdown list as the product contract", () => {
    expect(getDropdownDestinationContracts().length).toBeGreaterThan(100);
  });
});
