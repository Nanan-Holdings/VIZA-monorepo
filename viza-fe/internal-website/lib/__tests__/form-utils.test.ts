import { describe, expect, test } from "vitest";
import { evaluateExpression, evaluateShowIf } from "../form-utils";

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

  test("evaluates Taiwan occupation not-in visibility without update loops", () => {
    const companyField = {
      fieldName: "company_name",
      conditionalLogic: { showIf: "current_occupation not in [61,62]" },
    } as any;
    const titleField = {
      fieldName: "job_title",
      conditionalLogic: { showIf: "current_occupation not in [14,61,62]" },
    } as any;

    expect(evaluateShowIf(companyField, { current_occupation: "14" })).toBe(true);
    expect(evaluateShowIf(titleField, { current_occupation: "14" })).toBe(false);
    expect(evaluateShowIf(companyField, { current_occupation: "62" })).toBe(false);
    expect(evaluateShowIf(titleField, { current_occupation: "62" })).toBe(false);
    expect(evaluateShowIf(companyField, { current_occupation: "61" })).toBe(false);
    expect(evaluateShowIf(titleField, { current_occupation: "61" })).toBe(false);
    expect(evaluateShowIf(companyField, { current_occupation: "52" })).toBe(true);
    expect(evaluateShowIf(titleField, { current_occupation: "52" })).toBe(true);
  });
});
