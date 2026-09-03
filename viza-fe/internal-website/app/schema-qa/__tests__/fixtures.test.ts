import { describe, expect, it } from "vitest";

import type { WizardStep } from "@/types/visa-form-fields";

import {
  buildSchemaQaPreviewAnswers,
  getSchemaQaMissingRequiredFields,
  MOCK_RESIDENTIAL_ADDRESS,
} from "../fixtures";

describe("schema QA preview fixtures", () => {
  it("fills visible required questions and reveals no hidden yes-branch by default", () => {
    const steps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Test",
      fields: [
        {
          id: "address",
          visaType: "TR_E_VISA",
          fieldName: "residence_address",
          label: "Residence address",
          fieldType: "text",
          required: true,
          stepNumber: 1,
          stepName: "Test",
          displayOrder: 1,
          placeholder: null,
          validationRules: null,
          options: null,
          conditionalLogic: null,
        },
        {
          id: "history",
          visaType: "TR_E_VISA",
          fieldName: "has_criminal_history",
          label: "Criminal history",
          fieldType: "radio",
          required: true,
          stepNumber: 1,
          stepName: "Test",
          displayOrder: 2,
          placeholder: null,
          validationRules: null,
          options: ["yes", "no"],
          conditionalLogic: null,
        },
        {
          id: "details",
          visaType: "TR_E_VISA",
          fieldName: "has_criminal_history_details",
          label: "Details",
          fieldType: "textarea",
          required: true,
          stepNumber: 1,
          stepName: "Test",
          displayOrder: 3,
          placeholder: null,
          validationRules: null,
          options: null,
          conditionalLogic: { showIf: "has_criminal_history === yes" },
        },
      ],
    }];

    const answers = buildSchemaQaPreviewAnswers(steps, "TR_E_VISA");
    expect(answers.residence_address).toBe(MOCK_RESIDENTIAL_ADDRESS);
    expect(answers.has_criminal_history).toBe("no");
    expect(answers).not.toHaveProperty("has_criminal_history_details");
    expect(getSchemaQaMissingRequiredFields(steps, answers)).toEqual([]);
  });

  it("uses the route destination for destination-scoped country fields", () => {
    const steps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Travel",
      fields: [{
        id: "destination",
        visaType: "EU_SCHENGEN_C_SHORT_STAY",
        fieldName: "destination_country",
        label: "Destination country",
        fieldType: "country",
        required: true,
        stepNumber: 1,
        stepName: "Travel",
        displayOrder: 1,
        placeholder: null,
        validationRules: null,
        options: null,
        conditionalLogic: null,
      }],
    }];

    const answers = buildSchemaQaPreviewAnswers(steps, "EU_SCHENGEN_C_SHORT_STAY", {
      destinationCountryCode: "FRA",
    });

    expect(answers.destination_country).toBe("FRA");
  });
});
