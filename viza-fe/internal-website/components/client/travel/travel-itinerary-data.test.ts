import { describe, expect, it } from "vitest";
import { createTripTitle } from "./travel-itinerary-data";

describe("createTripTitle", () => {
  it("keeps a single-city title descriptive in both interface languages", () => {
    expect(createTripTitle(5, ["东京"], "zh")).toBe("5天东京经典游");
    expect(createTripTitle(5, ["Tokyo"], "en")).toBe(
      "5-day Tokyo classic trip"
    );
  });

  it("summarizes long Chinese city lists instead of concatenating every city", () => {
    expect(
      createTripTitle(
        364,
        ["布宜诺斯艾利斯", "悉尼", "多伦多", "北京", "开罗", "新德里"],
        "zh"
      )
    ).toBe("364天布宜诺斯艾利斯、悉尼、多伦多等6城经典游");
  });

  it("summarizes long English city lists and handles duplicate labels", () => {
    expect(
      createTripTitle(
        20,
        ["Buenos Aires", "Sydney", "Toronto", "Toronto", "Beijing"],
        "en"
      )
    ).toBe("20-day Buenos Aires, Sydney, Toronto +1 city classic trip");
  });

  it("falls back to a custom-trip title when no city is available", () => {
    expect(createTripTitle(3, [], "zh")).toBe("3天定制旅行");
    expect(createTripTitle(3, [], "en")).toBe("3-day custom trip");
  });
});
