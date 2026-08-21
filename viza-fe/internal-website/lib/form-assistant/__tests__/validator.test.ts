import { describe, expect, it } from "vitest";
import type { WizardStep } from "@/types/visa-form-fields";
import { VIETNAM_E_VISA_OFFICIAL_COUNTRY_OPTIONS } from "@/lib/vietnam-evisa-official-countries";
import {
  canonicalizeApplicationOptionAnswers,
  getAssistantProgress,
  validateApplicationAnswers,
} from "../validator";

const steps: WizardStep[] = [
  {
    stepNumber: 1,
    stepName: "Trip Information",
    fields: [
      {
        id: "arrival",
        visaType: "SG_ARRIVAL_CARD",
        fieldName: "arrival_date",
        label: "Date of Arrival",
        fieldType: "date",
        required: true,
        stepNumber: 1,
        stepName: "Trip Information",
        displayOrder: 1,
        placeholder: null,
        validationRules: { format: "YYYY-MM-DD" },
        options: null,
        conditionalLogic: null,
      },
      {
        id: "departure",
        visaType: "SG_ARRIVAL_CARD",
        fieldName: "departure_date",
        label: "Date of Departure",
        fieldType: "date",
        required: true,
        stepNumber: 1,
        stepName: "Trip Information",
        displayOrder: 2,
        placeholder: null,
        validationRules: { format: "YYYY-MM-DD" },
        options: null,
        conditionalLogic: null,
      },
      {
        id: "mode",
        visaType: "SG_ARRIVAL_CARD",
        fieldName: "mode_of_travel",
        label: "Mode of Travel",
        fieldType: "select",
        required: true,
        stepNumber: 1,
        stepName: "Trip Information",
        displayOrder: 3,
        placeholder: null,
        validationRules: null,
        options: ["air", "land", "sea"],
        conditionalLogic: null,
      },
      {
        id: "flight",
        visaType: "SG_ARRIVAL_CARD",
        fieldName: "transport_number",
        label: "Flight Number",
        fieldType: "text",
        required: true,
        stepNumber: 1,
        stepName: "Trip Information",
        displayOrder: 4,
        placeholder: null,
        validationRules: null,
        options: null,
        conditionalLogic: { showIf: "mode_of_travel === air" },
      },
    ],
  },
];

describe("validateApplicationAnswers", () => {
  it("recalculates conditional required fields and rejects invalid exact options", () => {
    const result = validateApplicationAnswers({
      steps,
      answers: {
        arrival_date: "2026-08-07",
        departure_date: "2026-08-09",
        mode_of_travel: "plane",
      },
      visaType: "SG_ARRIVAL_CARD",
      now: new Date("2026-08-06T00:00:00Z"),
    });
    expect(result.errors.some((issue) => issue.code === "invalid_option")).toBe(true);
    expect(result.errors.some((issue) => issue.fieldNames.includes("transport_number"))).toBe(false);
  });

  it("blocks impossible travel dates and warns outside ICA's three-day window", () => {
    const result = validateApplicationAnswers({
      steps,
      answers: {
        arrival_date: "2026-08-20",
        departure_date: "2026-08-19",
        mode_of_travel: "land",
      },
      visaType: "SG_ARRIVAL_CARD",
      now: new Date("2026-08-06T00:00:00Z"),
    });
    expect(result.errors.some((issue) => issue.code === "departure_before_arrival")).toBe(true);
    expect(result.warnings.some((issue) => issue.code === "sgac_three_day_window")).toBe(true);
  });

  it("uses Singapore's calendar date for ICA's three-day window", () => {
    const result = validateApplicationAnswers({
      steps,
      answers: {
        arrival_date: "2026-08-09",
        departure_date: "2026-08-10",
        mode_of_travel: "land",
      },
      visaType: "SG_ARRIVAL_CARD",
      now: new Date("2026-08-06T16:30:00Z"),
      timeZone: "Asia/Singapore",
    });

    expect(result.warnings.some((issue) => issue.code === "sgac_three_day_window")).toBe(false);
  });

  it("uses the product day boundary for date-window validation", () => {
    const malaysiaSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Trip Information",
      fields: [{
        ...steps[0]!.fields[0]!,
        visaType: "MY_MDAC_ARRIVAL_CARD",
        fieldName: "arrival_date",
        label: "Date of Arrival in Malaysia",
        validationRules: { min_date: "today" },
      }],
    }];
    const result = validateApplicationAnswers({
      steps: malaysiaSteps,
      answers: { arrival_date: "2026-08-17" },
      visaType: "MY_MDAC_ARRIVAL_CARD",
      now: new Date("2026-08-17T16:30:00.000Z"),
      timeZone: "Asia/Kuala_Lumpur",
    });

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "date_before_today", fieldNames: ["arrival_date"] }),
    ]));
  });

  it("requires true checkbox acceptance instead of treating false as complete", () => {
    const declarationSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Declaration",
      fields: [{
        id: "terms",
        visaType: "TW_ENTRY_PERMIT",
        fieldName: "accepted_terms",
        label: "Terms and conditions",
        fieldType: "checkbox",
        required: true,
        stepNumber: 1,
        stepName: "Declaration",
        displayOrder: 1,
        placeholder: null,
        validationRules: { mustBeTrue: true },
        options: [{ value: "yes", text: "I agree" }],
        conditionalLogic: null,
      }],
    }];

    const result = validateApplicationAnswers({
      steps: declarationSteps,
      answers: { accepted_terms: "false" },
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.errors.map((issue) => issue.code)).toEqual(["acceptance_required"]);
    expect(result.progress).toEqual({ completed: 0, total: 1 });
  });

  it("enforces Vietnam conditional numeric and schema date-window rules", () => {
    const vietnamSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Entry Information",
      fields: [
        {
          id: "visa-type",
          visaType: "VN_PREARRIVAL_DECLARATION",
          fieldName: "visa_type",
          label: "Visa type",
          fieldType: "select",
          required: true,
          stepNumber: 1,
          stepName: "Entry Information",
          displayOrder: 1,
          placeholder: null,
          validationRules: null,
          options: ["EV", "VR"],
          conditionalLogic: null,
        },
        {
          id: "visa-number",
          visaType: "VN_PREARRIVAL_DECLARATION",
          fieldName: "visa_number",
          label: "Visa number",
          fieldType: "text",
          required: true,
          stepNumber: 1,
          stepName: "Entry Information",
          displayOrder: 2,
          placeholder: null,
          validationRules: {
            numeric_length_when: { field: "visa_type", equals: "EV", length: 9 },
          },
          options: null,
          conditionalLogic: null,
        },
        {
          id: "arrival",
          visaType: "VN_PREARRIVAL_DECLARATION",
          fieldName: "expected_arrival_date",
          label: "Expected arrival date",
          fieldType: "date",
          required: true,
          stepNumber: 1,
          stepName: "Entry Information",
          displayOrder: 3,
          placeholder: null,
          validationRules: { min_date: "today", max_days_from_today: 2 },
          options: null,
          conditionalLogic: null,
        },
      ],
    }];

    const result = validateApplicationAnswers({
      steps: vietnamSteps,
      answers: {
        visa_type: "EV",
        visa_number: "12345678",
        expected_arrival_date: "2026-08-16",
      },
      visaType: "VN_PREARRIVAL_DECLARATION",
      now: new Date("2026-08-13T00:00:00Z"),
    });

    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["invalid_conditional_length", "date_after_submission_window"]),
    );
  });

  it("accepts Vietnam official day-first dates and remote official flight values", () => {
    const vietnamSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Entry Information",
      fields: [
        {
          id: "arrival",
          visaType: "VN_PREARRIVAL_DECLARATION",
          fieldName: "expected_arrival_date",
          label: "Expected Arrival Date (DD/MM/YYYY GMT+7)",
          fieldType: "date",
          required: true,
          stepNumber: 1,
          stepName: "Entry Information",
          displayOrder: 1,
          placeholder: null,
          validationRules: { min_date: "today", max_days_from_today: 2 },
          options: null,
          conditionalLogic: null,
        },
        {
          id: "flight",
          visaType: "VN_PREARRIVAL_DECLARATION",
          fieldName: "flight_number",
          label: "Flight Number",
          fieldType: "select",
          required: true,
          stepNumber: 1,
          stepName: "Entry Information",
          displayOrder: 2,
          placeholder: null,
          validationRules: {
            official_source: "prearrival_category:flight",
            remote_search: true,
          },
          options: [{ value: "other", text: "Other" }],
          conditionalLogic: null,
        },
      ],
    }];

    const result = validateApplicationAnswers({
      steps: vietnamSteps,
      answers: {
        expected_arrival_date: "20/08/2026",
        flight_number: "##HMZ2085_PQC",
      },
      visaType: "VN_PREARRIVAL_DECLARATION",
      now: new Date("2026-08-18T00:00:00Z"),
    });

    expect(result.errors).toEqual([]);
  });

  it("still rejects impossible Vietnam day-first dates", () => {
    const vietnamDateSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Entry Information",
      fields: [{
        id: "arrival",
        visaType: "VN_PREARRIVAL_DECLARATION",
        fieldName: "expected_arrival_date",
        label: "Expected Arrival Date",
        fieldType: "date",
        required: true,
        stepNumber: 1,
        stepName: "Entry Information",
        displayOrder: 1,
        placeholder: null,
        validationRules: null,
        options: null,
        conditionalLogic: null,
      }],
    }];

    const result = validateApplicationAnswers({
      steps: vietnamDateSteps,
      answers: { expected_arrival_date: "31/02/2026" },
      visaType: "VN_PREARRIVAL_DECLARATION",
    });

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_date" }),
    ]));
  });

  it("recalculates progress from the latest form draft", () => {
    expect(getAssistantProgress(steps, {
      arrival_date: "2026-08-20",
      departure_date: "2026-08-22",
      mode_of_travel: "land",
    })).toEqual({ completed: 3, total: 3 });

    expect(getAssistantProgress(steps, {
      arrival_date: "2026-08-20",
      departure_date: "2026-08-22",
      mode_of_travel: "air",
      transport_number: "SQ12",
    })).toEqual({ completed: 4, total: 4 });
  });

  it("replaces a corrected Malaysia date error with newly introduced cross-field issues", () => {
    const malaysiaSteps: WizardStep[] = [{
      stepNumber: 2,
      stepName: "Trip Information",
      fields: [
        {
          id: "arrival-date",
          visaType: "MY_MDAC_ARRIVAL_CARD",
          fieldName: "arrival_date",
          label: "Date of Arrival in Malaysia",
          fieldType: "date",
          required: true,
          stepNumber: 2,
          stepName: "Trip Information",
          displayOrder: 1,
          placeholder: null,
          validationRules: { min_date: "today" },
          options: null,
          conditionalLogic: null,
        },
        {
          id: "departure-date",
          visaType: "MY_MDAC_ARRIVAL_CARD",
          fieldName: "departure_date",
          label: "Date of Departure from Malaysia",
          fieldType: "date",
          required: true,
          stepNumber: 2,
          stepName: "Trip Information",
          displayOrder: 2,
          placeholder: null,
          validationRules: { after_or_equal_field: "arrival_date" },
          options: null,
          conditionalLogic: null,
        },
      ],
    }];
    const now = new Date("2026-08-18T00:00:00Z");

    const staleResult = validateApplicationAnswers({
      steps: malaysiaSteps,
      answers: { arrival_date: "2026-08-17", departure_date: "2026-08-23" },
      visaType: "MY_MDAC_ARRIVAL_CARD",
      now,
      locale: "zh",
    });
    expect(staleResult.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "date_before_today", fieldNames: ["arrival_date"] }),
    ]));

    const refreshedResult = validateApplicationAnswers({
      steps: malaysiaSteps,
      answers: { arrival_date: "2026-08-24", departure_date: "2026-08-23" },
      visaType: "MY_MDAC_ARRIVAL_CARD",
      now,
      locale: "zh",
    });
    expect(refreshedResult.errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "date_before_today" }),
    ]));
    expect(refreshedResult.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "date_before_related_field",
        fieldNames: ["departure_date", "arrival_date"],
      }),
    ]));
  });

  it("accepts Vietnam year-only birth dates and official country codes from the visible controls", () => {
    const vietnamSteps: WizardStep[] = [{
      stepNumber: 6,
      stepName: "Information About the Trip",
      fields: [
        {
          ...steps[0]!.fields[0]!,
          id: "relative-birth-date",
          visaType: "VN_E_VISA",
          fieldName: "relative_date_of_birth",
          label: "Relative's date of birth",
          validationRules: { label_zh: "在越亲属出生日期", allow_year_only: true },
        },
        {
          ...steps[0]!.fields[2]!,
          id: "relative-nationality",
          visaType: "VN_E_VISA",
          fieldName: "relative_nationality",
          label: "Relative's nationality",
          fieldType: "country",
          validationRules: { label_zh: "在越亲属国籍", source: "VN_E_VISA_OFFICIAL_COUNTRIES" },
          options: VIETNAM_E_VISA_OFFICIAL_COUNTRY_OPTIONS,
        },
      ],
    }];

    const result = validateApplicationAnswers({
      steps: vietnamSteps,
      answers: { relative_date_of_birth: "2001", relative_nationality: "PAN" },
      visaType: "VN_E_VISA",
      locale: "zh-CN",
      now: new Date("2026-08-19T00:00:00Z"),
    });

    expect(result.errors).toEqual([]);
    expect(result.missingFields).toEqual([]);
  });

  it("canonicalizes a historical localized option label to the official value", () => {
    const vietnamSteps: WizardStep[] = [{
      stepNumber: 6,
      stepName: "Information About the Trip",
      fields: [{
        ...steps[0]!.fields[2]!,
        id: "relative-nationality",
        visaType: "VN_E_VISA",
        fieldName: "relative_nationality",
        label: "Relative's nationality",
        fieldType: "country",
        validationRules: { label_zh: "在越亲属国籍", source: "VN_E_VISA_OFFICIAL_COUNTRIES" },
        options: VIETNAM_E_VISA_OFFICIAL_COUNTRY_OPTIONS,
      }],
    }];

    const result = validateApplicationAnswers({
      steps: vietnamSteps,
      answers: { relative_nationality: "巴拿马" },
      visaType: "VN_E_VISA",
      locale: "zh",
    });

    expect(result.errors).toEqual([]);
    expect(result.missingFields).toEqual([]);
    expect(canonicalizeApplicationOptionAnswers(
      vietnamSteps,
      { relative_nationality: "巴拿马" },
    ).patches).toEqual([{
      fieldName: "relative_nationality",
      previousValue: "巴拿马",
      value: "PAN",
    }]);
  });

  it("uses the Chinese schema label and emits one actionable issue for a truly invalid official choice", () => {
    const vietnamSteps: WizardStep[] = [{
      stepNumber: 6,
      stepName: "Information About the Trip",
      fields: [{
        ...steps[0]!.fields[2]!,
        id: "relative-nationality",
        visaType: "VN_E_VISA",
        fieldName: "relative_nationality",
        label: "Relative's nationality",
        fieldType: "country",
        validationRules: { label_zh: "在越亲属国籍", source: "VN_E_VISA_OFFICIAL_COUNTRIES" },
        options: VIETNAM_E_VISA_OFFICIAL_COUNTRY_OPTIONS,
      }],
    }];

    const result = validateApplicationAnswers({
      steps: vietnamSteps,
      answers: { relative_nationality: "火星" },
      visaType: "VN_E_VISA",
      locale: "zh",
    });

    expect(result.errors).toEqual([expect.objectContaining({
      code: "invalid_option",
      fieldNames: ["relative_nationality"],
      message: "请为在越亲属国籍选择官网提供的选项。",
    })]);
    expect(result.errors.some((issue) => issue.code === "required_missing")).toBe(false);
  });

  it("validates every populated repeat instance against its matching related answers", () => {
    const repeatedSteps: WizardStep[] = [{
      stepNumber: 6,
      stepName: "Information About the Trip",
      fields: [
        {
          ...steps[0]!.fields[0]!,
          id: "relative-birth-date",
          visaType: "VN_E_VISA",
          fieldName: "relative_date_of_birth",
          label: "Relative's date of birth",
          validationRules: {
            label_zh: "在越亲属出生日期",
            allow_year_only: true,
            repeatable: true,
            repeat_group: "vietnam_relatives",
            max_items: 5,
          },
        },
        {
          ...steps[0]!.fields[2]!,
          id: "relative-nationality",
          visaType: "VN_E_VISA",
          fieldName: "relative_nationality",
          label: "Relative's nationality",
          fieldType: "country",
          validationRules: {
            label_zh: "在越亲属国籍",
            repeatable: true,
            repeat_group: "vietnam_relatives",
            max_items: 5,
          },
          options: VIETNAM_E_VISA_OFFICIAL_COUNTRY_OPTIONS,
        },
      ],
    }];

    const result = validateApplicationAnswers({
      steps: repeatedSteps,
      answers: {
        relative_date_of_birth: "2001",
        relative_date_of_birth__2: "1999",
        relative_nationality: "PAN",
        relative_nationality__2: "not-official",
      },
      visaType: "VN_E_VISA",
      locale: "zh",
    });

    expect(result.errors).toEqual([expect.objectContaining({
      code: "invalid_option",
      fieldNames: ["relative_nationality__2"],
    })]);
  });

  it("accepts multi-select values and explicit schema-supported non-value answers", () => {
    const auditedSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Audited fields",
      fields: [
        {
          ...steps[0]!.fields[2]!,
          id: "purposes",
          fieldName: "purposes",
          fieldType: "multi_select",
          options: ["tourism", "business", "study"],
        },
        {
          ...steps[0]!.fields[0]!,
          id: "unknown-date",
          fieldName: "unknown_date",
          validationRules: { allow_do_not_know: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        },
        {
          ...steps[0]!.fields[0]!,
          id: "not-applicable-date",
          fieldName: "not_applicable_date",
          validationRules: { allow_does_not_apply: true },
        },
      ],
    }];

    const result = validateApplicationAnswers({
      steps: auditedSteps,
      answers: {
        purposes: "tourism,business",
        unknown_date: "DO_NOT_KNOW",
        not_applicable_date: "DOES_NOT_APPLY",
      },
      visaType: "AUDIT",
      locale: "zh",
    });

    expect(result.errors).toEqual([]);
  });

  it("accepts DS-160 official month-name dates and values from partial remote option lists", () => {
    const auditedSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Travel Information",
      fields: [
        {
          ...steps[0]!.fields[0]!,
          id: "ds160-date",
          visaType: "DS160",
          fieldName: "intended_arrival_date",
          validationRules: { format: "DD-MMM-YYYY" },
        },
        {
          ...steps[0]!.fields[2]!,
          id: "remote-country",
          visaType: "AUDIT",
          fieldName: "remote_country",
          fieldType: "select",
          validationRules: { official_options_source: "/api/official-countries" },
          options: [{ value: "fallback", text: "Fallback" }],
        },
      ],
    }];

    const result = validateApplicationAnswers({
      steps: auditedSteps,
      answers: {
        intended_arrival_date: "15-SEP-2026",
        remote_country: "LIVE_OFFICIAL_VALUE",
      },
      visaType: "AUDIT",
      locale: "zh",
    });

    expect(result.errors).toEqual([]);
    expect(result.missingFields).toEqual([]);
  });
});
