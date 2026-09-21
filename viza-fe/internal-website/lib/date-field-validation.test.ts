import { describe, expect, it } from "vitest";
import {
  getDateFieldValueState,
  isAllowedDateSentinel,
  type DateFieldValidationRules,
} from "./date-field-validation";

describe("date field sentinel validation", () => {
  it("accepts the unknown sentinel only when the schema allows it", () => {
    expect(isAllowedDateSentinel("DO_NOT_KNOW", { allow_do_not_know: true })).toBe(true);
    expect(isAllowedDateSentinel("DO_NOT_KNOW", { allow_unknown: true })).toBe(true);
    expect(isAllowedDateSentinel("DO_NOT_KNOW", { allow_unknown: "true" })).toBe(false);
    expect(isAllowedDateSentinel("DO_NOT_KNOW", {})).toBe(false);
    expect(getDateFieldValueState("DO_NOT_KNOW", { allow_do_not_know: true })).toBe("allowed_sentinel");
    expect(getDateFieldValueState("DO_NOT_KNOW", {})).toBe("invalid");
  });

  it("accepts both not-applicable schema spellings without weakening dates", () => {
    expect(isAllowedDateSentinel("DOES_NOT_APPLY", { allow_does_not_apply: true })).toBe(true);
    expect(isAllowedDateSentinel("DOES_NOT_APPLY", { has_does_not_apply: true })).toBe(true);
    expect(isAllowedDateSentinel("DOES_NOT_APPLY", {})).toBe(false);
    expect(getDateFieldValueState("2024-02-29", {})).toBe("valid");
    expect(getDateFieldValueState("2023-02-29", {})).toBe("invalid");
  });

  it("keeps year-only dates behind their explicit schema rule", () => {
    const rules: DateFieldValidationRules = { allow_year_only: true };
    expect(getDateFieldValueState("1988", rules)).toBe("year_only");
    expect(getDateFieldValueState("1988", {})).toBe("invalid");
  });

  it("accepts a calendar-valid month without inventing a day", () => {
    const rules: DateFieldValidationRules = { minimum_date_precision: "month" };
    expect(getDateFieldValueState("2026-11", rules)).toBe("month_only");
    expect(getDateFieldValueState("2026-13", rules)).toBe("invalid");
    expect(getDateFieldValueState("2026", rules)).toBe("invalid");
    expect(getDateFieldValueState("2023-02-29", rules)).toBe("invalid");
  });

  it("accepts year and month or year-only values at year precision", () => {
    const rules: DateFieldValidationRules = { minimum_date_precision: "year" };
    expect(getDateFieldValueState("2026", rules)).toBe("year_only");
    expect(getDateFieldValueState("2026-11", rules)).toBe("month_only");
    expect(getDateFieldValueState("2026-11-01", rules)).toBe("valid");
    expect(getDateFieldValueState("2026-00", rules)).toBe("invalid");
  });

  it("keeps partial precision out of Date comparisons", () => {
    expect(getDateFieldValueState("2026-11", { minimum_date_precision: "day" })).toBe("invalid");
  });
});
