import { describe, expect, test } from "vitest";
import { evaluateExpression } from "../form-utils";

describe("dynamic form conditional expressions", () => {
  test("matches any selected multi-select value", () => {
    expect(evaluateExpression(
      "countries_visited_last_14_days contains_any [AGO,BRA]",
      { countries_visited_last_14_days: "CHN,AGO" },
    )).toBe(true);
    expect(evaluateExpression(
      "countries_visited_last_14_days contains_any [AGO,BRA]",
      { countries_visited_last_14_days: "CHN,SGP" },
    )).toBe(false);
  });

  test("combines multi-select intersection with other trigger fields", () => {
    const expression = [
      "countries_visited_last_14_days contains_any [AGO,BRA]",
      "country_boarded in [AGO,BRA]",
      "nationality in [AGO,BRA]",
    ].join(" || ");

    expect(evaluateExpression(expression, {
      countries_visited_last_14_days: "CHN,SGP",
      country_boarded: "BRA",
      nationality: "CHN",
    })).toBe(true);
  });
});
