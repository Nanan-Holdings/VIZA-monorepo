import { describe, expect, it } from "vitest";
import {
  LAZY_DESTINATION_CARD_TYPES,
  buildTravelCandidatePayload,
  resolveLocalDestinationText,
  searchLocalDestinations,
} from "@/lib/travel/destination-resolver";

describe("travel destination resolver", () => {
  it("resolves common destinations and aliases without fetching all rows", () => {
    const hongKong = searchLocalDestinations("HK", { limit: 5 });
    expect(hongKong[0]?.canonicalName).toBe("Hong Kong");

    const japaneseTokyo = resolveLocalDestinationText("帮我计划 東京 3 天旅行。");
    expect(japaneseTokyo.status).toBe("resolved");
    if (japaneseTokyo.status === "resolved") {
      expect(japaneseTokyo.destinations[0].canonicalName).toBe("Tokyo");
      expect(japaneseTokyo.tripHints.travelDays).toBe(3);
    }
  });

  it("handles common typos with fuzzy matching", () => {
    const singapore = resolveLocalDestinationText("帮我计划 Singaproe 3 天旅行。");
    expect(singapore.status).toBe("resolved");
    if (singapore.status === "resolved") {
      expect(singapore.destinations[0].canonicalName).toBe("Singapore");
    }

    const bangkok = resolveLocalDestinationText("Plan a trip to Bankok.");
    expect(bangkok.status).toBe("resolved");
    if (bangkok.status === "resolved") {
      expect(bangkok.destinations[0].canonicalName).toBe("Bangkok");
    }
  });

  it("asks for clarification on ambiguous destination names", () => {
    const georgia = resolveLocalDestinationText("Plan a trip to Georgia.");
    expect(georgia.status).toBe("ambiguous");
    if (georgia.status === "ambiguous") {
      expect(georgia.options.length).toBeGreaterThan(1);
      expect(georgia.clarificationQuestion).toContain("Georgia");
    }
  });

  it("extracts multi-city destinations and trip hints", () => {
    const resolution = resolveLocalDestinationText("帮我计划香港和澳门 5 天路线。");
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      const payload = buildTravelCandidatePayload(
        resolution.destinations,
        resolution.query
      );
      expect(payload.cities).toEqual(["Hong Kong", "Macau"]);
      expect(payload.travel_days).toBe(5);
    }
  });

  it("creates temporary fallback cards for plausible missing destinations", () => {
    const resolution = resolveLocalDestinationText("Plan a trip to Blue Lantern Bay.");
    expect(resolution.status).toBe("temporary");
    if (resolution.status === "temporary") {
      expect(resolution.destination.isVerified).toBe(false);
      expect(resolution.cards.map((card) => card.cardType)).toEqual(
        LAZY_DESTINATION_CARD_TYPES
      );
    }
  });
});
