import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateShowIf,
  getRepeatInstanceCount,
} from "@/lib/form-utils";
import {
  computeAllTabCompletion,
  getMissingDynamicFormFields,
} from "@/lib/application-tab-completion";
import { validateApplicationAnswers } from "@/lib/form-assistant/validator";
import { getFormFieldSentinelState } from "@/lib/form-field-sentinels";
import type { VisaFormFieldRow, VisaFormFieldType, WizardStep } from "@/types/visa-form-fields";
import liveBranchMetadata from "./fixtures/ds160-live-branch-metadata-20260928.json";

type LiveBranchMetadata = typeof liveBranchMetadata;
type LiveSentinelField = LiveBranchMetadata["sentinelFields"][number];
type LiveSentinelOptionField = LiveBranchMetadata["sentinelOptionFields"][number];

const LEGACY_FIELDS = new Set(liveBranchMetadata.legacyCompatibilityOnly);
const LIVE_EXPORT_PATH = process.env.DS160_LIVE_SCHEMA_PATH
  ?? liveBranchMetadata.source;

function toField(
  name: string,
  options: {
    required?: boolean;
    repeatGroup?: string;
    maxItems?: number | null;
  } = {},
): VisaFormFieldRow {
  const validationRules: Record<string, unknown> = {};
  if (options.repeatGroup) validationRules.repeat_group = options.repeatGroup;
  if (options.maxItems !== undefined && options.maxItems !== null) {
    validationRules.max_items = options.maxItems;
  }
  return {
    id: name,
    visaType: "DS160",
    fieldName: name,
    label: name,
    fieldType: "text",
    required: options.required ?? true,
    stepNumber: 1,
    stepName: "DS-160 audit",
    displayOrder: 1,
    placeholder: null,
    validationRules,
    options: null,
    conditionalLogic: null,
  };
}

function sentinelField(meta: LiveSentinelField): VisaFormFieldRow {
  return {
    ...toField(meta.field_name),
    fieldType: meta.field_type as VisaFormFieldType,
    stepName: meta.step_name,
    validationRules: meta.validation_rules,
  };
}

function sentinelOptionField(meta: LiveSentinelOptionField): VisaFormFieldRow {
  return {
    id: meta.field_name,
    visaType: "DS160",
    fieldName: meta.field_name,
    label: meta.field_name,
    fieldType: meta.field_type as VisaFormFieldType,
    required: meta.required,
    stepNumber: 1,
    stepName: meta.step_name,
    displayOrder: 1,
    placeholder: null,
    validationRules: meta.validation_rules,
    options: meta.options as VisaFormFieldRow["options"],
    conditionalLogic: meta.conditional_logic,
  };
}

function singleFieldStep(field: VisaFormFieldRow): WizardStep {
  return {
    stepNumber: 1,
    stepName: field.stepName ?? "DS-160 audit",
    fields: [{ ...field, conditionalLogic: null, required: true }],
  };
}

function allowedSentinels(rules: Record<string, unknown>): string[] {
  const values: string[] = [];
  if (rules.allow_do_not_know === true || rules.allow_unknown === true) {
    values.push("DO_NOT_KNOW");
  }
  if (rules.allow_does_not_apply === true || rules.has_does_not_apply === true) {
    values.push("DOES_NOT_APPLY");
  }
  return values;
}

function readLiveRowsIfPresent(): Array<{
  field_name: string;
  validation_rules?: Record<string, unknown> | null;
  conditional_logic?: Record<string, unknown> | null;
}> | null {
  if (!existsSync(LIVE_EXPORT_PATH)) return null;
  return JSON.parse(readFileSync(LIVE_EXPORT_PATH, "utf8")) as Array<{
    field_name: string;
    validation_rules?: Record<string, unknown> | null;
    conditional_logic?: Record<string, unknown> | null;
  }>;
}

function branchField(meta: {
  field_name: string;
  field_type: string;
  required: boolean;
  step_name: string | null;
  validation_rules: Record<string, unknown> | null;
  conditional_logic: Record<string, unknown> | null;
}, conditionalLogic = meta.conditional_logic): VisaFormFieldRow {
  return {
    id: meta.field_name,
    visaType: "DS160",
    fieldName: meta.field_name,
    label: meta.field_name,
    fieldType: meta.field_type as VisaFormFieldType,
    required: meta.required,
    stepNumber: 1,
    stepName: meta.step_name ?? "DS-160 branch audit",
    displayOrder: 1,
    placeholder: null,
    validationRules: meta.validation_rules,
    options: null,
    conditionalLogic,
  };
}

function repeatControllerAnswers(group: string): Record<string, string> {
  const answers: Record<string, string> = {
    other_nationality: "yes",
    other_nationality_has_passport: "yes",
    permanent_resident_other_country: "yes",
    has_specific_plans: "yes",
    companion_group_travel: "no",
    has_been_in_us: "yes",
    has_us_drivers_license: "yes",
    has_been_refused: "yes",
    immigrant_petition_filed: "yes",
    has_other_phones: "yes",
    has_other_emails: "yes",
    social_media_platform: "FACEBOOK",
    has_other_social_media: "yes",
    lost_passport: "yes",
    has_immediate_us_relatives: "yes",
    marital_status: "divorced",
    has_previous_employer: "yes",
    has_attended_education: "yes",
    has_traveled_last_five_years: "yes",
    has_belonged_to_organization: "yes",
    has_served_military: "yes",
  };
  if (group === "trip_purpose" || group === "languages") return {};
  return answers;
}

function repeatProbeField(
  meta: {
    field_name: string;
    field_type: string;
    required: boolean;
    step_name: string | null;
    validation_rules: Record<string, unknown> | null;
    conditional_logic: Record<string, unknown> | null;
  },
  group: { group: string; max_items: number | null },
): VisaFormFieldRow {
  const field = branchField(meta);
  // Preserve each live field's required flag and conditional logic while
  // using a text probe value so this inventory test isolates repeat scoping
  // from date/option-format rules.
  return {
    ...field,
    fieldType: "text",
    validationRules: {
      repeat_group: group.group,
      ...(group.max_items === null ? {} : { max_items: group.max_items }),
    },
  };
}

function runtimeBranchAnswers(
  answers: Readonly<Record<string, string | undefined>>,
  target: { validation_rules: Record<string, unknown> | null },
): Record<string, string> {
  const runtimeAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string") runtimeAnswers[key] = value;
  }
  // The live CEAC_ESTA branch is only rendered for a Visa Waiver Program
  // nationality. Keep that runtime gate explicit in the probe while leaving
  // the saved true/false assignments independent of production evaluators.
  if (target.validation_rules?.nationality_gate === "CEAC_ESTA") {
    runtimeAnswers.nationality_country = "Singapore";
  }
  return runtimeAnswers;
}

describe("DS-160 live metadata branch inventory", () => {
  it("keeps the 337-row live export separated into 331 active and six compatibility rows", () => {
    expect(liveBranchMetadata.totalRows).toBe(337);
    expect(liveBranchMetadata.activeRows).toBe(331);
    expect(liveBranchMetadata.legacyCompatibilityOnly).toHaveLength(6);
    expect(new Set(liveBranchMetadata.legacyCompatibilityOnly).size).toBe(6);
    expect(liveBranchMetadata.conditionalBranches).toHaveLength(81);
    expect(liveBranchMetadata.repeatGroups).toHaveLength(22);
    expect(liveBranchMetadata.sentinelOptionFields.map((field) => field.field_name).sort())
      .toEqual(["partner_address_type", "spouse_address_type"]);
    expect(liveBranchMetadata.repeatGroups.map((group) => group.group)).not.toContain("specific_travel_plans");
    expect(liveBranchMetadata.repeatGroups
      .filter((group) => group.max_items === 1)
      .map((group) => group.group)
      .sort())
      .toEqual(["immigrant_petition", "visa_refused"]);
  });

  it("matches the current exported live metadata when the dated export is available", () => {
    const rows = readLiveRowsIfPresent();
    if (!rows) return;

    expect(rows).toHaveLength(liveBranchMetadata.totalRows);
    expect(rows.filter((row) => !LEGACY_FIELDS.has(row.field_name))).toHaveLength(liveBranchMetadata.activeRows);

    const conditionalExpressions = new Set(
      rows
        .filter((row) => !LEGACY_FIELDS.has(row.field_name))
        .map((row) => row.conditional_logic?.showIf)
        .filter((value): value is string => typeof value === "string"),
    );
    expect([...conditionalExpressions].sort()).toEqual(
      liveBranchMetadata.conditionalBranches.map((branch) => branch.showIf).sort(),
    );

    const repeatGroups = new Set(
      rows
        .filter((row) => !LEGACY_FIELDS.has(row.field_name))
        .map((row) => row.validation_rules?.repeat_group)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    );
    expect([...repeatGroups].sort()).toEqual(
      liveBranchMetadata.repeatGroups.map((group) => group.group).sort(),
    );
  });

  it("accepts every live allowed sentinel and rejects its unsupported counterpart", () => {
    for (const meta of liveBranchMetadata.sentinelFields) {
      const field = sentinelField(meta);
      const step = singleFieldStep(field);
      const allowed = allowedSentinels(meta.validation_rules);
      expect(allowed.length, `${meta.field_name} must expose a sentinel branch`).toBeGreaterThan(0);

      for (const value of allowed) {
        const accepted = validateApplicationAnswers({
          steps: [step],
          answers: { [meta.field_name]: value },
          visaType: "DS160",
        });
        expect(accepted.errors, `${meta.field_name} ${value}`).toEqual([]);
        expect(accepted.missingFields, `${meta.field_name} ${value}`).toEqual([]);
        expect(accepted.progress, `${meta.field_name} ${value}`).toEqual({ completed: 1, total: 1 });
        expect(getFormFieldSentinelState(value.toLowerCase(), meta.validation_rules)).toBe("allowed");

        const unsupported = value === "DO_NOT_KNOW" ? "DOES_NOT_APPLY" : "DO_NOT_KNOW";
        const rejected = validateApplicationAnswers({
          steps: [step],
          answers: { [meta.field_name]: unsupported },
          visaType: "DS160",
        });
        expect(rejected.missingFields.map((item) => item.fieldName), `${meta.field_name} ${unsupported}`)
          .toContain(meta.field_name);
        expect(rejected.progress, `${meta.field_name} ${unsupported}`).toEqual({ completed: 0, total: 1 });
        expect(rejected.errors, `${meta.field_name} ${unsupported}`).toEqual([
          expect.objectContaining({
            code: field.fieldType === "date" ? "invalid_date" : "unsupported_sentinel",
            fieldNames: [meta.field_name],
          }),
        ]);
      }
    }
  });

  it("keeps stale unsupported employer N/A answers incomplete", () => {
    const field = toField("employer_name");
    const answers = { employer_name: "does_not_apply" };
    const missing = getMissingDynamicFormFields([singleFieldStep(field)], answers, { now: new Date("2026-09-28T00:00:00Z") });
    expect(missing).toEqual([
      expect.objectContaining({ fieldName: "employer_name", reason: "invalid" }),
    ]);
    const validation = validateApplicationAnswers({
      steps: [singleFieldStep(field)],
      answers,
      visaType: "DS160",
    });
    expect(validation.progress).toEqual({ completed: 0, total: 1 });
    expect(validation.errors[0]).toEqual(expect.objectContaining({ code: "unsupported_sentinel" }));
  });

  it("keeps the declared lower-case enum distinct from unsupported N/A values", () => {
    for (const meta of liveBranchMetadata.sentinelOptionFields) {
      const field = sentinelOptionField(meta);
      const step = singleFieldStep(field);
      // The raw sentinel helper still rejects the canonical uppercase token
      // when no sentinel rule is declared. The validator canonicalizes a
      // case-insensitive match back to the exact declared option first.
      expect(getFormFieldSentinelState("DO_NOT_KNOW", meta.validation_rules), meta.field_name)
        .toBe("unsupported");
      for (const acceptedValue of ["do_not_know", "DO_NOT_KNOW"]) {
        const acceptedAnswer = { [meta.field_name]: acceptedValue };
        const acceptedValidation = validateApplicationAnswers({
          steps: [step],
          answers: acceptedAnswer,
          visaType: "DS160",
        });
        expect(acceptedValidation.errors, `${meta.field_name} ${acceptedValue}`).toEqual([]);
        expect(acceptedValidation.missingFields, `${meta.field_name} ${acceptedValue}`).toEqual([]);
        expect(acceptedValidation.progress, `${meta.field_name} ${acceptedValue}`)
          .toEqual({ completed: 1, total: 1 });
        if (acceptedValue === "do_not_know") {
          expect(getMissingDynamicFormFields([step], acceptedAnswer, {
            visaType: "DS160",
            now: new Date("2026-09-28T00:00:00Z"),
          }), meta.field_name).toEqual([]);
        }
      }

      const rejectedAnswer = { [meta.field_name]: "DOES_NOT_APPLY" };
      const rejectedValidation = validateApplicationAnswers({
        steps: [step],
        answers: rejectedAnswer,
        visaType: "DS160",
      });
      expect(rejectedValidation.errors, `${meta.field_name} unsupported sentinel`)
        .not.toEqual([]);
      expect(rejectedValidation.missingFields.map((item) => item.fieldName), `${meta.field_name} unsupported sentinel`)
        .toContain(meta.field_name);
      expect(rejectedValidation.progress, `${meta.field_name} unsupported sentinel`)
        .toEqual({ completed: 0, total: 1 });
      expect(getMissingDynamicFormFields([step], rejectedAnswer, {
        visaType: "DS160",
        now: new Date("2026-09-28T00:00:00Z"),
      }).map((item) => item.fieldName), `${meta.field_name} unsupported sentinel`)
        .toContain(meta.field_name);
    }
  });

  it("uses independent true/false fixtures to verify every active conditional branch", () => {
    for (const branch of liveBranchMetadata.conditionalBranches) {
      const target = branchField(branch.target);
      // Controller metadata is retained in the fixture, while the probe
      // intentionally removes controller conditions so this branch is tested
      // independently of a parent branch's visibility.
      const controllers = branch.controllers.map((controller) =>
        ({ ...branchField(controller, null), required: false }),
      );
      const step: WizardStep = {
        stepNumber: 1,
        stepName: "DS-160 branch audit",
        fields: [target, ...controllers],
      };
      const trueValues = runtimeBranchAnswers(branch.trueAnswers, branch.target);
      const falseValues = runtimeBranchAnswers(branch.falseAnswers, branch.target);

      expect(evaluateShowIf(target, trueValues, step.fields), `${branch.showIf} true`).toBe(true);
      expect(evaluateShowIf(target, falseValues, step.fields), `${branch.showIf} false`).toBe(false);

      const trueMissing = getMissingDynamicFormFields([step], trueValues, {
        visaType: "DS160",
        now: new Date("2026-09-28T00:00:00Z"),
      });
      const falseMissing = getMissingDynamicFormFields([step], falseValues, {
        visaType: "DS160",
        now: new Date("2026-09-28T00:00:00Z"),
      });
      if (target.required) {
        expect(trueMissing.map((item) => item.fieldName), `${branch.showIf} completion true`)
          .toContain(target.fieldName);
      } else {
        // The live schema has one optional conditional target
        // (intended_arrival_date). It must remain optional to the dynamic
        // validator, while the DS-160 page-level CEAC gate requires it when
        // the traveler has no specific plans. Exercise that separate gate
        // with the real tab-completion path instead of treating the field as
        // unconditionally required in this probe.
        expect(trueMissing.map((item) => item.fieldName), `${branch.showIf} completion true`)
          .not.toContain(target.fieldName);
        const tabCompletion = computeAllTabCompletion({
          dbSteps: [{ ...step, stepName: "Travel Information" }],
          effectiveSteps: [{ id: 0, name: "Travel Information" }],
          answers: trueValues,
          documentCenterData: null,
          country: "united_states",
          visaType: "DS160",
          documentStepId: 1,
          reviewStepId: 2,
          teamStepId: 3,
          confirmationStepId: 4,
          showDocumentStep: false,
          showTeamStep: false,
          now: new Date("2026-09-28T00:00:00Z"),
        });
        expect(tabCompletion.missingFields.map((item) => item.fieldName), `${branch.showIf} CEAC gate true`)
          .toContain(target.fieldName);
      }
      expect(falseMissing.map((item) => item.fieldName), `${branch.showIf} completion false`)
        .not.toContain(target.fieldName);

      const trueValidation = validateApplicationAnswers({
        steps: [step],
        answers: trueValues,
        visaType: "DS160",
      });
      const falseValidation = validateApplicationAnswers({
        steps: [step],
        answers: falseValues,
        visaType: "DS160",
      });
      if (target.required) {
        expect(trueValidation.missingFields.map((item) => item.fieldName), `${branch.showIf} validator true`)
          .toContain(target.fieldName);
      } else {
        expect(trueValidation.missingFields.map((item) => item.fieldName), `${branch.showIf} validator true`)
          .not.toContain(target.fieldName);
      }
      expect(falseValidation.missingFields.map((item) => item.fieldName), `${branch.showIf} validator false`)
        .not.toContain(target.fieldName);
    }
  });

  it("checks second-row required scope for every active repeat group without inventing rows for one-item explanations", () => {
    for (const group of liveBranchMetadata.repeatGroups) {
      const fields = group.fields.map((meta) => repeatProbeField(meta, group));
      const controllerNames = new Set(group.members);
      const controllers = group.controllers
        .filter((controller) => !controllerNames.has(controller.field_name))
        .map((controller) => ({
          ...branchField(controller, null),
          fieldType: "text" as const,
          required: false,
        }));
      const step: WizardStep = { stepNumber: 1, stepName: "DS-160 repeat audit", fields };
      step.fields.push(...controllers);
      const answers: Record<string, string> = repeatControllerAnswers(group.group);
      for (const field of fields) answers[field.fieldName] = "row-one";
      Object.assign(answers, repeatControllerAnswers(group.group));

      if (group.members.length > 1 && group.max_items !== 1) {
        const first = group.members[0];
        const second = group.members[1];
        if (!first || !second) throw new Error(`Repeat fixture ${group.group} is empty`);
        answers[`${first}__2`] = "row-two";
        const missing = getMissingDynamicFormFields([step], answers, { now: new Date("2026-09-28T00:00:00Z") });
        expect(missing.map((item) => item.fieldName), group.group).toContain(`${second}__2`);
        expect(getRepeatInstanceCount(fields[0]!, answers, fields), group.group).toBe(2);
      } else {
        if (group.members.length === 1 && group.max_items !== 1) {
          const onlyMember = group.members[0];
          if (!onlyMember) throw new Error(`Repeat fixture ${group.group} is empty`);
          answers[`${onlyMember}__2`] = "row-two";
          expect(getRepeatInstanceCount(fields[0]!, answers, fields), group.group).toBe(2);
        } else if (group.max_items === 1) {
          const onlyMember = group.members[0];
          if (!onlyMember) throw new Error(`Repeat fixture ${group.group} is empty`);
          answers[`${onlyMember}__2`] = "stale-second-row";
        }
        const missing = getMissingDynamicFormFields([step], answers, { now: new Date("2026-09-28T00:00:00Z") });
        expect(missing.filter((item) => item.fieldName.endsWith("__2")), group.group).toEqual([]);
        if (group.max_items === 1) {
          expect(getRepeatInstanceCount(fields[0]!, answers, fields), group.group).toBe(1);
        }
      }
    }
  });
});
