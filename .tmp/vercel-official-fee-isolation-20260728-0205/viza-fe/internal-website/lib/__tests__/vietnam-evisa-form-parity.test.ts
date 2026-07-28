import { describe, expect, it } from "vitest";
import { augmentVietnamEVisaOfficialParitySteps } from "../vietnam-evisa-form-parity";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

function field(input: Partial<VisaFormFieldRow> & { fieldName: string; displayOrder: number }): VisaFormFieldRow {
  return {
    id: `field-${input.fieldName}`,
    visaType: "VN_E_VISA",
    fieldName: input.fieldName,
    label: input.label ?? input.fieldName,
    fieldType: input.fieldType ?? "text",
    required: input.required ?? true,
    stepNumber: input.stepNumber ?? 6,
    stepName: input.stepName ?? "Trip Information",
    displayOrder: input.displayOrder,
    placeholder: input.placeholder ?? null,
    validationRules: input.validationRules ?? null,
    options: input.options ?? null,
    conditionalLogic: input.conditionalLogic ?? null,
  };
}

describe("augmentVietnamEVisaOfficialParitySteps", () => {
  it("inserts missing relatives fields immediately after the relatives yes/no question", () => {
    const steps: WizardStep[] = [
      {
        stepNumber: 6,
        stepName: "Trip Information",
        fields: [
          field({
            fieldName: "has_relatives_in_vietnam",
            label: "Do you have relatives currently residing in Viet Nam?",
            fieldType: "radio",
            displayOrder: 13,
          }),
          field({
            fieldName: "relative_full_name_in_vn",
            label: "Relative's full name",
            displayOrder: 14,
          }),
          field({
            fieldName: "relative_address_in_vn",
            label: "Relative's address in Vietnam",
            displayOrder: 15,
          }),
          field({
            fieldName: "visited_vietnam_in_last_year",
            label: "Have you ever been to Viet Nam in the last 01 year?",
            fieldType: "radio",
            displayOrder: 16,
          }),
        ],
      },
    ];

    const step = augmentVietnamEVisaOfficialParitySteps(steps).find((item) => item.stepNumber === 6);
    const names = step?.fields.map((item) => item.fieldName);

    expect(names?.slice(0, 7)).toEqual([
      "has_relatives_in_vietnam",
      "relative_full_name_in_vn",
      "relative_date_of_birth",
      "relative_nationality",
      "relative_relationship",
      "relative_address_in_vn",
      "visited_vietnam_in_last_year",
    ]);
    for (const fieldName of [
      "relative_full_name_in_vn",
      "relative_date_of_birth",
      "relative_nationality",
      "relative_relationship",
      "relative_address_in_vn",
    ]) {
      const relativeField = step?.fields.find((item) => item.fieldName === fieldName);
      expect(relativeField?.conditionalLogic).toEqual({ showIf: "has_relatives_in_vietnam === yes" });
      expect(relativeField?.validationRules?.repeat_group).toBe("vietnam_relatives");
    }
  });

  it("moves scattered existing relatives fields into the single Vietnam eVisa relatives form group", () => {
    const steps: WizardStep[] = [
      {
        stepNumber: 6,
        stepName: "Trip Information",
        fields: [
          field({
            fieldName: "has_relatives_in_vietnam",
            label: "Do you have relatives currently residing in Viet Nam?",
            fieldType: "radio",
            displayOrder: 13,
          }),
          field({
            fieldName: "relative_full_name_in_vn",
            label: "Relative's full name",
            displayOrder: 14,
          }),
          field({
            fieldName: "relative_address_in_vn",
            label: "Relative's address in Vietnam",
            displayOrder: 15,
          }),
        ],
      },
      {
        stepNumber: 9,
        stepName: "Legacy relatives",
        fields: [
          field({
            fieldName: "relative_date_of_birth",
            label: "Legacy date of birth",
            displayOrder: 1,
            stepNumber: 9,
            stepName: "Legacy relatives",
          }),
          field({
            fieldName: "relative_nationality",
            label: "Legacy nationality",
            fieldType: "country",
            displayOrder: 2,
            stepNumber: 9,
            stepName: "Legacy relatives",
          }),
          field({
            fieldName: "relative_relationship",
            label: "Legacy relationship",
            displayOrder: 3,
            stepNumber: 9,
            stepName: "Legacy relatives",
          }),
        ],
      },
    ];

    const patched = augmentVietnamEVisaOfficialParitySteps(steps);
    const stepSix = patched.find((item) => item.stepNumber === 6);
    const stepNine = patched.find((item) => item.stepNumber === 9);

    expect(stepSix?.fields.map((item) => item.fieldName).slice(0, 6)).toEqual([
      "has_relatives_in_vietnam",
      "relative_full_name_in_vn",
      "relative_date_of_birth",
      "relative_nationality",
      "relative_relationship",
      "relative_address_in_vn",
    ]);
    expect(stepNine?.fields.some((item) => item.fieldName.startsWith("relative_"))).toBe(false);
  });
});
