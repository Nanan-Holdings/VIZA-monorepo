import { type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";

const TH_ADDRESS_MAX_LENGTH = 215;

const OPTIONAL_TH_ADDRESS_FIELDS = new Set([
  "home_address_city",
  "home_address_state",
  "home_address_district",
  "home_address_postcode",
  "home_address_postal_code",
]);

function patchThailandTouristField(field: VisaFormFieldRow): VisaFormFieldRow {
  if (field.fieldName === "home_address_line1") {
    return {
      ...field,
      validationRules: {
        ...(field.validationRules ?? {}),
        maxLength: TH_ADDRESS_MAX_LENGTH,
      },
    };
  }

  if (OPTIONAL_TH_ADDRESS_FIELDS.has(field.fieldName)) {
    return {
      ...field,
      required: false,
    };
  }

  return field;
}

export function augmentThailandTouristEVisaSteps(steps: WizardStep[]): WizardStep[] {
  return steps.map((step) => ({
    ...step,
    fields: step.fields.map(patchThailandTouristField),
  }));
}
