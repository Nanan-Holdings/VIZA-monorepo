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
import {
  findTravelAttraction,
  getTravelAttractionsForCity,
} from "@/components/client/travel/travel-attraction-knowledge";

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

  it("gives every dropdown destination at least ten map-ready attraction cards", () => {
    for (const destination of getDropdownDestinationContracts()) {
      expect(destination.attractions.length, destination.nameEn).toBeGreaterThanOrEqual(10);
      expect(destination.attractions.slice(0, 10).every((attraction) => {
        return (
          typeof attraction.latitude === "number" &&
          Number.isFinite(attraction.latitude) &&
          typeof attraction.longitude === "number" &&
          Number.isFinite(attraction.longitude) &&
          Boolean(attraction.image?.verified) &&
          Boolean(attraction.nameEn) &&
          Boolean(attraction.nameZh) &&
          Boolean(attraction.descriptionEn) &&
          Boolean(attraction.descriptionZh)
        );
      }), destination.nameEn).toBe(true);
    }
  });

  it("covers Changsha itinerary landmarks and food matching from the shared attraction layer", () => {
    const destination = findDropdownDestinationContract("Changsha");
    expect(destination?.attractions.length).toBeGreaterThanOrEqual(10);
    expect(destination?.attractions.map((item) => item.nameZh)).toEqual(
      expect.arrayContaining(["岳麓山", "橘子洲头", "长沙博物馆"])
    );

    expect(findTravelAttraction("长沙", "岳麓山")?.name).toBe("岳麓山");
    expect(findTravelAttraction("长沙", "橘子洲")?.name).toBe("橘子洲头");
    expect(findTravelAttraction("长沙", "长沙博物馆")?.name).toBe("长沙博物馆");
    expect(findTravelAttraction("长沙", "臭豆腐")?.name).toBe("坡子街 / 火宫殿");
    expect(getTravelAttractionsForCity("长沙").length).toBeGreaterThanOrEqual(10);
  });
});
