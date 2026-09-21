import { describe, expect, test } from "vitest";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";
import { evaluateExpression, evaluateShowIf, getRepeatInstanceCount, getRepeatInstanceValues } from "../form-utils";

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
  test("does not show a social-media identifier before a platform is selected", () => {
    const expression = "social_media_platform !== NONE && social_media_platform !== null";
    expect(evaluateExpression(expression, {})).toBe(false);
    expect(evaluateExpression(expression, { social_media_platform: "" })).toBe(false);
    expect(evaluateExpression(expression, { social_media_platform: "NONE" })).toBe(false);
    expect(evaluateExpression(expression, { social_media_platform: "INSTAGRAM" })).toBe(true);
    expect(evaluateExpression("social_media_platform === null", {})).toBe(true);
    expect(evaluateExpression("social_media_platform === _empty", {})).toBe(true);
  });

  test("scopes repeated controllers without inheriting answers or changing outer controllers", () => {
    const controller = makeField({ fieldName: "has_passport", validationRules: { repeat_group: "nationalities" } });
    const passport = makeField({
      fieldName: "passport",
      validationRules: { repeat_group: "nationalities" },
      conditionalLogic: { showIf: "has_other_nationality === yes && has_passport === yes" },
    });
    const fields = [controller, passport];
    const answers = { has_other_nationality: "yes", has_passport: "no", has_passport__2: "yes", passport: "FIRST" };
    const second = getRepeatInstanceValues(passport, 1, answers, fields);
    expect(evaluateShowIf(passport, answers, fields)).toBe(false);
    expect(evaluateShowIf(passport, second, fields)).toBe(true);
    expect(second.passport).toBe("");
    expect(second.has_other_nationality).toBe("yes");
    expect(answers.passport).toBe("FIRST");
    expect(getRepeatInstanceValues(passport, 0, answers, fields)).toBe(answers);
    expect(getRepeatInstanceCount(passport, answers, fields)).toBe(2);
    expect(getRepeatInstanceCount(passport, { unrelated__9: "x" }, fields)).toBe(1);
    expect(getRepeatInstanceCount(passport, { has_passport__3_en: "yes" }, fields)).toBe(3);
    expect(getRepeatInstanceCount(passport, { has_passport__2: "", passport__2_zh: "" }, fields)).toBe(1);
  });

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

  test("hides nested visa-loss fields when the visa controller is hidden", () => {
    const hasVisa = makeField({
      fieldName: "has_us_visa",
      fieldType: "radio",
      stepNumber: 5,
      options: ["yes", "no"],
    });
    const visaLost = makeField({
      fieldName: "visa_lost_or_stolen",
      fieldType: "radio",
      stepNumber: 5,
      options: ["yes", "no"],
      conditionalLogic: { showIf: "has_us_visa === yes" },
    });
    const yearLost = makeField({
      fieldName: "year_visa_lost_or_stolen",
      stepNumber: 5,
      conditionalLogic: { showIf: "visa_lost_or_stolen === yes" },
    });
    const schema = [hasVisa, visaLost, yearLost];

    expect(evaluateShowIf(yearLost, {
      has_us_visa: "no",
      visa_lost_or_stolen: "yes",
      year_visa_lost_or_stolen: "2024",
    }, schema)).toBe(false);
    expect(evaluateShowIf(yearLost, {
      has_us_visa: "yes",
      visa_lost_or_stolen: "yes",
    }, schema)).toBe(true);
  });

  test("hides nested companion group fields when companions are disabled", () => {
    const hasCompanions = makeField({
      fieldName: "has_companions",
      fieldType: "radio",
      stepNumber: 4,
      options: ["yes", "no"],
    });
    const groupTravel = makeField({
      fieldName: "companion_group_travel",
      fieldType: "radio",
      stepNumber: 4,
      options: ["yes", "no"],
      conditionalLogic: { showIf: "has_companions === yes" },
    });
    const groupName = makeField({
      fieldName: "companion_group_name",
      stepNumber: 4,
      conditionalLogic: { showIf: "companion_group_travel === yes" },
    });
    const schema = [hasCompanions, groupTravel, groupName];

    expect(evaluateShowIf(groupName, {
      has_companions: "no",
      companion_group_travel: "yes",
      companion_group_name: "stale group",
    }, schema)).toBe(false);
    expect(evaluateShowIf(groupName, {
      has_companions: "yes",
      companion_group_travel: "yes",
    }, schema)).toBe(true);
  });

  test("hides social-media identifiers when the inferred platform controller is hidden", () => {
    const hasSocialMedia = makeField({
      fieldName: "has_social_media",
      fieldType: "radio",
      stepNumber: 6,
      options: ["yes", "no"],
    });
    const platform = makeField({
      fieldName: "social_media_platform",
      fieldType: "select",
      stepNumber: 6,
      options: ["INSTAGRAM", "NONE"],
      validationRules: { repeatable: true, repeat_group: "social_media" },
    });
    const handle = makeField({
      fieldName: "social_media_handle",
      stepNumber: 6,
      validationRules: { repeatable: true, repeat_group: "social_media" },
      conditionalLogic: {
        showIf: "social_media_platform !== NONE && social_media_platform !== null",
      },
    });
    const schema = [hasSocialMedia, platform, handle];

    expect(evaluateShowIf(handle, {
      has_social_media: "no",
      social_media_platform: "INSTAGRAM",
      social_media_handle: "stale handle",
    }, schema)).toBe(false);
    expect(evaluateShowIf(handle, {
      has_social_media: "yes",
      social_media_platform: "INSTAGRAM",
    }, schema)).toBe(true);
  });

  test("keeps an OR branch visible when another satisfied branch is hidden", () => {
    const root = makeField({
      fieldName: "root_toggle",
      fieldType: "radio",
      options: ["yes", "no"],
    });
    const hidden = makeField({
      fieldName: "hidden_controller",
      fieldType: "radio",
      options: ["yes", "no"],
      conditionalLogic: { showIf: "root_toggle === yes" },
    });
    const visible = makeField({
      fieldName: "visible_controller",
      fieldType: "radio",
      options: ["yes", "no"],
    });
    const target = makeField({
      fieldName: "or_target",
      conditionalLogic: { showIf: "hidden_controller === yes || visible_controller === yes" },
    });
    const schema = [root, hidden, visible, target];

    expect(evaluateShowIf(target, {
      root_toggle: "no",
      hidden_controller: "yes",
      visible_controller: "yes",
    }, schema)).toBe(true);
  });

  test("does not infer controller visibility across steps", () => {
    const root = makeField({
      fieldName: "root_toggle",
      fieldType: "radio",
      stepNumber: 1,
      options: ["yes", "no"],
    });
    const controller = makeField({
      fieldName: "step_one_controller",
      fieldType: "radio",
      stepNumber: 1,
      options: ["yes", "no"],
      conditionalLogic: { showIf: "root_toggle === yes" },
    });
    const target = makeField({
      fieldName: "step_two_target",
      stepNumber: 2,
      conditionalLogic: { showIf: "step_one_controller === yes" },
    });

    expect(evaluateShowIf(target, {
      root_toggle: "no",
      step_one_controller: "yes",
    }, [root, controller, target])).toBe(true);
  });

  test("terminates recursive controller checks for cyclic conditions", () => {
    const first = makeField({
      fieldName: "first",
      conditionalLogic: { showIf: "second === yes" },
    });
    const second = makeField({
      fieldName: "second",
      conditionalLogic: { showIf: "first === yes" },
    });

    expect(evaluateShowIf(first, { first: "yes", second: "yes" }, [first, second])).toBe(true);
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
