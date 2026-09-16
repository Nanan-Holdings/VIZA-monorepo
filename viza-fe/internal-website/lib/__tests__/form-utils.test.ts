import { describe, expect, test } from "vitest";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";
import { evaluateExpression, evaluateShowIf } from "../form-utils";

const makeField = (overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow => ({
  id: overrides.fieldName ?? "test-field",
  visaType: "DS160",
  fieldName: "test_field",
  label: "Test field",
  fieldType: "text",
  required: false,
  stepNumber: 1,
  stepName: "Test",
  displayOrder: 1,
  placeholder: null,
  validationRules: null,
  options: null,
  conditionalLogic: null,
  ...overrides,
});

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

  test("reuses schema inference while reading the current toggle value", () => {
    const toggle = makeField({
      fieldName: "other_names_used",
      fieldType: "radio",
      options: ["yes", "no"],
    });
    const dependent = makeField({ fieldName: "other_name_surname" });
    const schema = [toggle, dependent];

    expect(evaluateShowIf(dependent, { other_names_used: "no" }, schema)).toBe(false);
    expect(evaluateShowIf(dependent, { other_names_used: "yes" }, schema)).toBe(true);
  });

  test("keeps repeat-group precedence and separate schema caches", () => {
    const usedToggle = makeField({
      fieldName: "family_members_used",
      fieldType: "radio",
      options: ["yes", "no"],
    });
    const hasToggle = makeField({
      fieldName: "has_family_members",
      fieldType: "radio",
      options: ["yes", "no"],
    });
    const repeatField = makeField({
      fieldName: "family_member_name",
      validationRules: { repeat_group: "family_members" },
    });

    // The *_used candidate wins even when the has_* field appears first.
    const schemaWithBoth = [hasToggle, usedToggle, repeatField];
    expect(evaluateShowIf(
      repeatField,
      { family_members_used: "no", has_family_members: "yes" },
      schemaWithBoth,
    )).toBe(false);
    expect(evaluateShowIf(
      repeatField,
      { family_members_used: "yes", has_family_members: "no" },
      schemaWithBoth,
    )).toBe(true);

    // The same field object can belong to schemas with different controllers.
    const schemaWithUsed = [usedToggle, repeatField];
    const schemaWithHas = [hasToggle, repeatField];
    expect(evaluateShowIf(repeatField, { family_members_used: "no" }, schemaWithUsed)).toBe(false);
    expect(evaluateShowIf(repeatField, { has_family_members: "yes" }, schemaWithHas)).toBe(true);
  });

  test("does not infer visibility for an explicitly empty conditionalLogic object", () => {
    const toggle = makeField({
      fieldName: "other_names_used",
      fieldType: "radio",
      options: ["yes", "no"],
    });
    const dependent = makeField({
      fieldName: "other_name_surname",
      conditionalLogic: {},
    });

    expect(evaluateShowIf(dependent, { other_names_used: "no" }, [toggle, dependent])).toBe(true);
  });
});
