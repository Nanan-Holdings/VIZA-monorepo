import { describe, expect, it } from "vitest";
import {
  LAZY_DESTINATION_CARD_TYPES,
  buildTravelCandidatePayload,
  extractDestinationIntentLabel,
  resolveLocalDestinationText,
  searchLocalDestinations,
  toTravelDestinationChatCard,
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

  it("normalizes quick reply intent before creating destination cards", () => {
    expect(extractDestinationIntentLabel("我想去日本")).toBe("日本");
    expect(extractDestinationIntentLabel("想去欧洲")).toBe("欧洲");

    const japan = resolveLocalDestinationText("我想去日本");
    expect(japan.status).toBe("resolved");
    if (japan.status === "resolved") {
      const card = toTravelDestinationChatCard(japan.destinations[0], "我想去日本");
      expect(card.title).not.toBe("我想去日本");
      expect(card.city).toBe("Tokyo");
      expect(card.country).toBe("Japan");
    }

    const europe = resolveLocalDestinationText("想去欧洲");
    expect(europe.status).toBe("resolved");
    if (europe.status === "resolved") {
      const card = toTravelDestinationChatCard(europe.destinations[0], "想去欧洲");
      expect(card.title).not.toBe("想去欧洲");
      expect(card.title).toBe("Europe Classic Route");
    }
  });

  it("does not convert undecided suggestion text into temporary cards", () => {
    const resolution = resolveLocalDestinationText("我不知道去哪");
    expect(resolution.status).toBe("unresolved");
  });

  it("resolves full Chinese itinerary prompts to the named destination", () => {
    const resolution = resolveLocalDestinationText(
      "帮我做一个伦敦 5 天旅行计划，8月4日出发，中等预算，包含航班、酒店、景点和餐厅。"
    );
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(resolution.destinations[0].canonicalName).toBe("London");
      const card = toTravelDestinationChatCard(
        resolution.destinations[0],
        resolution.query
      );
      expect(card.title).toBe("London");
      expect(card.title).not.toContain("中等预算");
      expect(card.suggested_days).toBe("5 days");
    }
  });
});
