import { describe, expect, it } from "vitest";
import {
  LAZY_DESTINATION_CARD_TYPES,
  buildTravelCandidatePayload,
  extractDestinationIntentLabel,
  parseTravelIntent,
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

  it("parses and resolves Chinese natural-language destination typos before fallback", () => {
    const parsed = parseTravelIntent("我想要区长沙");
    expect(parsed.intent).toBe("choose_destination");
    expect(parsed.destinations[0]).toMatchObject({
      raw: "区长沙",
      normalized: "长沙",
      canonicalName: "Changsha",
      nameZh: "长沙",
      countryCode: "CN",
      resolutionMethod: "typo_alias_correction",
    });

    const resolution = resolveLocalDestinationText("我想要区长沙");
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(resolution.destinations[0].canonicalName).toBe("Changsha");
      const card = toTravelDestinationChatCard(
        resolution.destinations[0],
        "我想要区长沙"
      );
      expect(card.title).toBe("Changsha");
      expect(card.city).toBe("Changsha");
      expect(card.source_status).not.toBe("llm_generated");
      expect(card.subtitle).not.toContain("Temporary destination card");
      expect(card.highlights).not.toContain("temporary text fallback");
      expect(card.map_marker).toEqual({ lat: 28.2282, lng: 112.9388 });
    }
  });

  it("extracts ranged and Chinese durations from destination prompts", () => {
    const ranged = parseTravelIntent("我想去长沙 3-5天");
    expect(ranged.duration).toEqual({
      minDays: 3,
      maxDays: 5,
      raw: "3-5天",
    });

    const chinese = parseTravelIntent("长沙三天怎么玩");
    expect(chinese.duration).toEqual({
      minDays: 3,
      maxDays: 3,
      raw: "三天",
    });
  });

  it("asks for clarification on ambiguous destination names", () => {
    const georgia = resolveLocalDestinationText("Plan a trip to Georgia.");
    expect(georgia.status).toBe("ambiguous");
    if (georgia.status === "ambiguous") {
      expect(georgia.options.length).toBeGreaterThan(1);
      expect(georgia.clarificationQuestion).toContain("Georgia");
    }

    const shortChinese = resolveLocalDestinationText("我想去长");
    expect(shortChinese.status).toBe("ambiguous");
    if (shortChinese.status === "ambiguous") {
      expect(shortChinese.options.map((option) => option.canonicalName)).toEqual(
        ["Changsha", "Changchun", "Nagasaki"]
      );
    }
  });

  it("extracts multi-city destinations and trip hints", () => {
    const prompt = "帮我计划香港和澳门 5 天路线。";
    const resolution = resolveLocalDestinationText(prompt);
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      const payload = buildTravelCandidatePayload(
        resolution.destinations,
        prompt
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

  it("resolves high-confidence aliases without temporary cards", () => {
    const resolution = resolveLocalDestinationText("LA and Las Vegas for 6 days");
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(
        resolution.destinations.map((destination) => destination.canonicalName)
      ).toEqual(expect.arrayContaining(["Los Angeles", "Las Vegas"]));
      expect(resolution.tripHints.travelDays).toBe(6);
    }
  });

  it("does not convert undecided suggestion text into temporary cards", () => {
    const resolution = resolveLocalDestinationText("我不知道去哪");
    expect(resolution.status).toBe("unresolved");
  });

  it("does not create destination cards for visa questions or itinerary edits", () => {
    const visaQuestion = resolveLocalDestinationText("申根签证要准备什么");
    expect(visaQuestion.status).toBe("unresolved");

    const insuranceQuestion = resolveLocalDestinationText("旅行保险需要买吗");
    expect(insuranceQuestion.status).toBe("unresolved");

    const editCommand = resolveLocalDestinationText("删除第二天");
    expect(editCommand.status).toBe("unresolved");
  });

  it("resolves full Chinese itinerary prompts to the named destination", () => {
    const prompt = "帮我做一个伦敦 5 天旅行计划，8月4日出发，中等预算，包含航班、酒店、景点和餐厅。";
    const resolution = resolveLocalDestinationText(prompt);
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(resolution.destinations[0].canonicalName).toBe("London");
      const card = toTravelDestinationChatCard(
        resolution.destinations[0],
        prompt
      );
      expect(card.title).toBe("London");
      expect(card.title).not.toContain("中等预算");
      expect(card.suggested_days).toBe("5 days");
    }
  });

  it("resolves dropdown-contract cities that were not in the old resolver list", () => {
    const resolution = resolveLocalDestinationText(
      "帮我做一个拉斯维加斯和洛杉矶 6 天旅行计划。"
    );

    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(
        resolution.destinations.map((destination) => destination.canonicalName)
      ).toEqual(expect.arrayContaining(["Las Vegas", "Los Angeles"]));
      expect(resolution.destinations[0].coverImageUrl).toContain(
        "/travel/cities/"
      );
    }
  });
});
