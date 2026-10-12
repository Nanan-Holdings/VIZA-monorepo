import { describe, expect, it } from "vitest";
import { validateAnswer } from "./field-guidance.routes.js";

function dateField(validationRules: Record<string, unknown> = {}) {
  return {
    fieldName: "father_date_of_birth",
    label: "Father's date of birth",
    fieldType: "date" as const,
    required: true,
    validationRules,
  };
}

describe("field guidance date sentinel validation", () => {
  it.each([
    ["DO_NOT_KNOW", { allow_do_not_know: true }],
    ["DO_NOT_KNOW", { allow_unknown: true }],
    ["DOES_NOT_APPLY", { allow_does_not_apply: true }],
    ["DOES_NOT_APPLY", { has_does_not_apply: true }],
  ] as const)("accepts an explicitly allowed date sentinel %s", (value, rules) => {
    expect(validateAnswer(
      dateField({
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        maxLength: 10,
        ...rules,
      }),
      value,
      {},
      "zh",
    )).toEqual({ severity: "ok", messages: [] });
  });

  it("rejects an unknown date sentinel when the schema does not allow it", () => {
    const result = validateAnswer(dateField(), "DO_NOT_KNOW", {}, "zh");
    const malformedRuleResult = validateAnswer(
      dateField({ allow_unknown: "true" }),
      "DO_NOT_KNOW",
      {},
      "zh",
    );

    expect(result.severity).toBe("error");
    expect(result.messages).toContain("日期格式无法识别。");
    expect(malformedRuleResult.severity).toBe("error");
  });

  it("does not weaken impossible-date validation", () => {
    const result = validateAnswer(
      dateField({ allow_do_not_know: true }),
      "2023-02-29",
      {},
      "zh",
    );

    expect(result.severity).toBe("error");
    expect(result.messages).toContain("日期格式无法识别。");
  });
});
