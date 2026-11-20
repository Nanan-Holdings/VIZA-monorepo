import { describe, expect, it } from "vitest";
import { isUkPlaceholderAnswer, sanitizeUkPlaceholderAnswers } from "./uk-placeholder-answers";

describe("UK draft placeholder contamination", () => {
  it.each([
    "门牌号 + 街道，例如：南京西路 88 号 / 88 Nanjing West Road",
    "小区/楼栋/单元/房号（如无可留空），例如：阳光花园 3 号楼 2 单元 501 室",
    "请填写城镇或城市", "请填写邮政编码", "例如：张", "e.g., 3 years",
    "For example: Xiaoming", "Please fill in town or city.",
    "Please fill out the form regarding this application.",
    "House number + street, for example: 88 Nanjing West Road",
    "Community/Building/Unit/Room Number (leave blank if none), for example: Sunshine Garden",
  ])("recognizes a stored hint: %s", (value) => {
    expect(isUkPlaceholderAnswer(value)).toBe(true);
  });

  it("clears canonical, translated and repeat-row hints while preserving real answers", () => {
    const answers = {
      home_address_city: "Please fill in town or city.",
      home_address_city_zh: "上海", home_address_city_en: "Shanghai",
      uk_accommodation_city__2_en: "Enter your town or city",
      surname: "Zhang", home_address_line_1: "88 Nanjing West Road",
      how_long_at_address: "3 years", home_address_postcode: "200000",
      __metadata: "Please enter a value",
    };
    expect(sanitizeUkPlaceholderAnswers(answers, "UK_STANDARD_VISITOR")).toEqual({
      ...answers, home_address_city: "", uk_accommodation_city__2_en: "",
    });
    expect(answers.home_address_city).toBe("Please fill in town or city.");
  });

  it("leaves other products and clean snapshots unchanged", () => {
    const answers = { surname: "For example: Zhang" };
    expect(sanitizeUkPlaceholderAnswers(answers, "DS160")).toBe(answers);
    const clean = { surname: "Zhang" };
    expect(sanitizeUkPlaceholderAnswers(clean, "UK_STANDARD_VISITOR")).toBe(clean);
  });
});
