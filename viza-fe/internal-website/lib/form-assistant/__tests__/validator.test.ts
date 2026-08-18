import { describe, expect, it } from "vitest";
import type { WizardStep } from "@/types/visa-form-fields";
import { validateApplicationAnswers } from "../validator";

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
        options: null,
        conditionalLogic: null,
      }],
    }];

    const result = validateApplicationAnswers({
      steps: declarationSteps,
      answers: { accepted_terms: "false" },
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["required_missing", "acceptance_required"]),
    );
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
});
