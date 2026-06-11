import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

const EXISTING_NORMALIZED_FORM_TYPES = new Set([
  "B211A",
  "DS160",
  "UK_STANDARD_VISITOR",
  "EU_SCHENGEN_C_SHORT_STAY",
  "SG_ARRIVAL_CARD",
]);

function field(
  visaType: string,
  stepNumber: number,
  stepName: string,
  displayOrder: number,
  fieldName: string,
  label: string,
  fieldType: VisaFormFieldRow["fieldType"],
  options: {
    required?: boolean;
    placeholder?: string;
    validationRules?: Record<string, unknown>;
    optionValues?: Array<{ value: string; text: string }>;
  } = {},
): VisaFormFieldRow {
  return {
    id: `rag-${visaType}-${fieldName}`,
    visaType,
    fieldName,
    label,
    fieldType,
    required: options.required ?? false,
    stepNumber,
    stepName,
    displayOrder,
    placeholder: options.placeholder ?? null,
    validationRules: options.validationRules ?? null,
    options: options.optionValues ?? null,
    conditionalLogic: null,
  };
}

function yesNoOptions(): Array<{ value: string; text: string }> {
  return [
    { value: "yes", text: "Yes" },
    { value: "no", text: "No" },
  ];
}

export function shouldUseRagVisitorIntakeFallback(visaType: string): boolean {
  return !EXISTING_NORMALIZED_FORM_TYPES.has(visaType);
}

export function getRagVisitorIntakeSteps(visaType: string): WizardStep[] {
  const steps = [
    {
      stepNumber: 1,
      stepName: "Personal Information",
      fields: [
        field(visaType, 1, "Personal Information", 1, "full_name", "Full name as shown on passport", "text", {
          required: true,
          placeholder: "e.g. ZHANG XIAOMING",
        }),
        field(visaType, 1, "Personal Information", 2, "date_of_birth", "Date of birth", "date", {
          required: true,
          validationRules: { format: "YYYY-MM-DD" },
        }),
        field(visaType, 1, "Personal Information", 3, "nationality", "Current nationality", "country", {
          required: true,
          placeholder: "Select nationality",
        }),
        field(visaType, 1, "Personal Information", 4, "place_of_birth", "Place of birth", "text", {
          placeholder: "City and country of birth",
        }),
        field(visaType, 1, "Personal Information", 5, "email_address", "Email address", "text", {
          required: true,
          placeholder: "name@example.com",
          validationRules: { format: "email" },
        }),
      ],
    },
    {
      stepNumber: 2,
      stepName: "Passport Information",
      fields: [
        field(visaType, 2, "Passport Information", 1, "passport_number", "Passport number", "text", {
          required: true,
        }),
        field(visaType, 2, "Passport Information", 2, "passport_issuing_country", "Passport issuing country", "country", {
          required: true,
        }),
        field(visaType, 2, "Passport Information", 3, "passport_issue_date", "Passport issue date", "date", {
          validationRules: { format: "YYYY-MM-DD" },
        }),
        field(visaType, 2, "Passport Information", 4, "passport_expiry_date", "Passport expiry date", "date", {
          required: true,
          validationRules: { format: "YYYY-MM-DD" },
        }),
      ],
    },
    {
      stepNumber: 3,
      stepName: "Travel Information",
      fields: [
        field(visaType, 3, "Travel Information", 1, "visit_purpose", "Main purpose of visit", "select", {
          required: true,
          optionValues: [
            { value: "tourism", text: "Tourism" },
            { value: "family_visit", text: "Family or friends visit" },
            { value: "business_visit", text: "Short business visit" },
            { value: "transit", text: "Transit" },
            { value: "other", text: "Other visitor purpose" },
          ],
        }),
        field(visaType, 3, "Travel Information", 2, "arrival_date", "Planned arrival date", "date", {
          required: true,
          validationRules: { format: "YYYY-MM-DD" },
        }),
        field(visaType, 3, "Travel Information", 3, "departure_date", "Planned departure date", "date", {
          required: true,
          validationRules: { format: "YYYY-MM-DD" },
        }),
        field(visaType, 3, "Travel Information", 4, "entry_count", "Entry type needed", "select", {
          optionValues: [
            { value: "single", text: "Single entry" },
            { value: "multiple", text: "Multiple entries" },
            { value: "not_sure", text: "Not sure yet" },
          ],
        }),
        field(visaType, 3, "Travel Information", 5, "accommodation_name", "Hotel or host name", "text", {
          placeholder: "Hotel, host, or first accommodation",
        }),
        field(visaType, 3, "Travel Information", 6, "accommodation_address", "Accommodation address", "textarea", {
          placeholder: "Address of hotel, host, or first stay",
        }),
      ],
    },
    {
      stepNumber: 4,
      stepName: "Work / Education / Training",
      fields: [
        field(visaType, 4, "Work / Education / Training", 1, "current_occupation", "Current occupation", "text", {
          placeholder: "Your current job or student status",
        }),
        field(visaType, 4, "Work / Education / Training", 2, "employer_or_school", "Employer, school, or business name", "text"),
        field(visaType, 4, "Work / Education / Training", 3, "funding_source", "Who will pay for this trip?", "select", {
          optionValues: [
            { value: "self", text: "Myself" },
            { value: "family", text: "Family member" },
            { value: "sponsor", text: "Sponsor or host" },
            { value: "company", text: "Company or employer" },
            { value: "other", text: "Other" },
          ],
        }),
      ],
    },
    {
      stepNumber: 5,
      stepName: "Security and Background",
      fields: [
        field(visaType, 5, "Security and Background", 1, "has_previous_refusal", "Have you ever been refused a visa or entry?", "radio", {
          required: true,
          optionValues: yesNoOptions(),
        }),
        field(visaType, 5, "Security and Background", 2, "has_criminal_history", "Do you have any criminal history to declare?", "radio", {
          required: true,
          optionValues: yesNoOptions(),
        }),
        field(visaType, 5, "Security and Background", 3, "additional_notes", "Additional notes for review", "textarea", {
          placeholder: "Add anything that may affect this visitor application",
        }),
      ],
    },
  ];

  return steps;
}
