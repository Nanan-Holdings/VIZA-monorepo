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
});
