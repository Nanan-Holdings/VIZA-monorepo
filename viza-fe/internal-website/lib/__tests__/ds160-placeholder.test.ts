import { describe, expect, it } from "vitest";
import { getChinesePlaceholder } from "@/lib/ds160-translations";

describe("getChinesePlaceholder", () => {
  it("keeps a numeric dialling-code example as a number", () => {
    expect(getChinesePlaceholder("e.g. 86", "mobile_country_code")).toBe("例如：86");
  });
  it("still localises a country-name example", () => {
    expect(getChinesePlaceholder("e.g. China", "country_of_birth")).toBe("例如：中国");
  });
  it("keeps a passport-number example verbatim", () => {
    expect(getChinesePlaceholder("e.g. E12345678", "passport_number")).toBe("例如：E12345678");
  });
});
