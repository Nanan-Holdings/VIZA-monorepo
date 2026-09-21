import { describe, expect, it } from "vitest";
import type { WizardStep } from "@/types/visa-form-fields";
import { getAssistantProgress, validateApplicationAnswers } from "../validator";

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
  it("does not validate persistence-only compatibility aliases", () => {
    const compatibilitySteps: WizardStep[] = [{
      ...steps[0],
      fields: [{
        ...steps[0].fields[2],
        id: "legacy-provider",
        fieldName: "social_media_provider",
        label: "Legacy social provider",
        required: true,
        options: ["NOT_A_CURRENT_OPTION"],
        validationRules: { legacy_compatibility_only: true },
      }],
    }];
    const result = validateApplicationAnswers({
      steps: compatibilitySteps,
      answers: { social_media_provider: "historical-value" },
      visaType: "DS160",
    });

    expect(result.errors).toEqual([]);
    expect(result.missingFields).toEqual([]);
    expect(getAssistantProgress(compatibilitySteps, {
      social_media_provider: "",
    })).toEqual({ completed: 0, total: 0 });
  });

  it("surfaces the former-spouse count mismatch as a localized review error", () => {
    const formerSpouseSteps: WizardStep[] = [{
      stepNumber: 12,
      stepName: "Family Information: Former Spouse",
      fields: [
        {
          ...steps[0].fields[2],
          id: "former-count",
          fieldName: "number_of_former_spouses",
          label: "Number of Former Spouses",
          fieldType: "select",
          required: false,
          options: ["1", "2"],
          conditionalLogic: { showIf: "marital_status === divorced" },
          validationRules: null,
        },
        {
          ...steps[0].fields[3],
          id: "former-surname",
          fieldName: "former_spouse_surname",
          label: "Former Spouse's Surnames",
          fieldType: "text",
          required: false,
          options: null,
          validationRules: { repeatable: true, repeat_group: "former_spouses" },
          conditionalLogic: { showIf: "marital_status === divorced" },
        },
      ],
    }];

    const mismatch = validateApplicationAnswers({
      steps: formerSpouseSteps,
      answers: {
        marital_status: "divorced",
        number_of_former_spouses: "2",
        former_spouse_surname: "ZHANG",
      },
      visaType: "DS160",
      locale: "zh",
    });
    expect(mismatch.errors).toContainEqual(expect.objectContaining({
      code: "former_spouse_count_mismatch",
      fieldNames: ["number_of_former_spouses"],
      message: "声明的前任配偶人数为 2，但已填写 1 位。请使两者一致。",
    }));
    expect(mismatch.missingFields).toContainEqual(expect.objectContaining({
      fieldName: "number_of_former_spouses",
      reason: "invalid",
    }));

    const complete = validateApplicationAnswers({
      steps: formerSpouseSteps,
      answers: {
        marital_status: "divorced",
        number_of_former_spouses: "2",
        former_spouse_surname: "ZHANG",
        former_spouse_surname__2: "LI",
      },
      visaType: "DS160",
    });
    expect(complete.errors).toEqual([]);
    expect(complete.missingFields).toEqual([]);
  });

  it("surfaces incompatible U.S. contact relationship branches", () => {
    const usContactSteps: WizardStep[] = [{
      stepNumber: 13,
      stepName: "US Point of Contact",
      fields: [{
        ...steps[0].fields[2],
        id: "us-contact-relationship",
        fieldName: "us_contact_relationship",
        label: "U.S. Contact — Relationship",
        fieldType: "select",
        required: true,
        options: ["R", "S", "C", "B", "P", "H", "O"],
        validationRules: null,
        conditionalLogic: null,
      }],
    }];

    const organizationOnly = validateApplicationAnswers({
      steps: usContactSteps,
      answers: {
        us_contact_surname: "DO_NOT_KNOW",
        us_contact_given_names: "DO_NOT_KNOW",
        us_contact_organization: "HOTEL",
        us_contact_relationship: "R",
      },
      visaType: "DS160",
      locale: "zh",
    });
    expect(organizationOnly.errors).toContainEqual(expect.objectContaining({
      code: "us_contact_relationship_organization_only_relationship",
      fieldNames: ["us_contact_relationship"],
    }));

    const spouseWithWrongMaritalStatus = validateApplicationAnswers({
      steps: usContactSteps,
      answers: {
        us_contact_surname: "SMITH",
        us_contact_given_names: "JANE",
        us_contact_organization: "DO_NOT_KNOW",
        us_contact_relationship: "S",
        marital_status: "P",
      },
      visaType: "DS160",
    });
    expect(spouseWithWrongMaritalStatus.errors).toContainEqual(expect.objectContaining({
      code: "us_contact_relationship_spouse_marital_status",
    }));
  });

  it("surfaces incompatible immediate-relative spouse branches", () => {
    const immediateRelativeSteps: WizardStep[] = [{
      stepNumber: 8,
      stepName: "Family Information: Relatives",
      fields: [
        {
          ...steps[0].fields[2],
          visaType: "DS160",
          id: "has-immediate-us-relatives",
          fieldName: "has_immediate_us_relatives",
          label: "Immediate U.S. relatives",
          fieldType: "radio",
          required: true,
          options: ["yes", "no"],
          validationRules: null,
          conditionalLogic: null,
        },
        {
          ...steps[0].fields[2],
          visaType: "DS160",
          id: "us-relative-relationship",
          fieldName: "us_relative_relationship",
          label: "Relationship to You",
          fieldType: "select",
          required: false,
          options: ["SPOUSE", "FIANCE", "CHILD", "SIBLING"],
          validationRules: { repeatable: true, repeat_group: "us_relatives" },
          conditionalLogic: { showIf: "has_immediate_us_relatives === yes" },
        },
      ],
    }];

    const invalid = validateApplicationAnswers({
      steps: immediateRelativeSteps,
      answers: {
        has_immediate_us_relatives: "yes",
        us_relative_relationship: "SPOUSE",
        marital_status: "C",
      },
      visaType: "DS160",
      locale: "zh",
    });
    expect(invalid.errors).toContainEqual(expect.objectContaining({
      code: "ds160_immediate_relative_relationship_spouse_marital_status",
      fieldNames: ["us_relative_relationship", "marital_status"],
    }));

    const valid = validateApplicationAnswers({
      steps: immediateRelativeSteps,
      answers: {
        has_immediate_us_relatives: "yes",
        us_relative_relationship: "SPOUSE",
        marital_status: "M",
      },
      visaType: "DS160",
    });
    expect(valid.errors).toEqual([]);
  });

  it("surfaces duplicate DS-160 travel-purpose categories", () => {
    const tripPurposeSteps: WizardStep[] = [{
      stepNumber: 3,
      stepName: "Travel Information",
      fields: [
        {
          ...steps[0].fields[2],
          id: "trip-purpose",
          fieldName: "purpose_of_trip",
          label: "Purpose of Trip to the U.S.",
          fieldType: "select",
          required: true,
          options: ["A", "B", "C"],
          validationRules: { repeatable: true, repeat_group: "trip_purpose" },
          conditionalLogic: null,
        },
        {
          ...steps[0].fields[2],
          id: "trip-purpose-specify",
          fieldName: "purpose_of_trip_specify",
          label: "Specify",
          fieldType: "select",
          required: true,
          options: ["B1", "B2"],
          validationRules: { repeatable: true, repeat_group: "trip_purpose" },
          conditionalLogic: null,
        },
      ],
    }];

    const result = validateApplicationAnswers({
      steps: tripPurposeSteps,
      answers: {
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1",
        purpose_of_trip__2: "B",
        purpose_of_trip_specify__2: "B2",
      },
      visaType: "DS160",
      locale: "zh",
    });
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "ds160_trip_purpose_duplicate_category",
      fieldNames: ["purpose_of_trip__2"],
    }));
  });

  it("surfaces all active DS-160 nationality duplicate groups", () => {
    const nationalitySteps: WizardStep[] = [{
      stepNumber: 2,
      stepName: "Personal Information 2",
      fields: [
        {
          ...steps[0].fields[0],
          visaType: "DS160",
          fieldName: "nationality_country",
          label: "Nationality",
          fieldType: "text",
          required: true,
          options: null,
          validationRules: null,
          conditionalLogic: null,
        },
        {
          ...steps[0].fields[0],
          visaType: "DS160",
          fieldName: "other_nationality",
          label: "Other nationality",
          fieldType: "text",
          required: true,
          options: null,
          validationRules: null,
          conditionalLogic: null,
        },
        {
          ...steps[0].fields[3],
          visaType: "DS160",
          fieldName: "other_nationality_country",
          label: "Other nationality country",
          required: true,
          validationRules: { repeat_group: "other_nationalities" },
          conditionalLogic: { showIf: "other_nationality === yes" },
        },
        {
          ...steps[0].fields[0],
          visaType: "DS160",
          fieldName: "permanent_resident_other_country",
          label: "Permanent residence",
          fieldType: "text",
          required: true,
          options: null,
          validationRules: null,
          conditionalLogic: null,
        },
        {
          ...steps[0].fields[3],
          visaType: "DS160",
          fieldName: "other_permanent_resident_country",
          label: "Permanent residence country",
          required: true,
          validationRules: { repeat_group: "permanent_resident_countries" },
          conditionalLogic: { showIf: "permanent_resident_other_country === yes" },
        },
      ],
    }];
    const result = validateApplicationAnswers({
      steps: nationalitySteps,
      answers: {
        nationality_country: "CHIN",
        other_nationality: "yes",
        other_nationality_country: "China",
        permanent_resident_other_country: "yes",
        other_permanent_resident_country: "中国",
      },
      visaType: "DS160",
    });

    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "ds160_nationality_duplicate",
      fieldNames: ["nationality_country"],
    }));
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "ds160_nationality_duplicate",
      fieldNames: ["other_nationality_country"],
    }));
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "ds160_permanent_resident_duplicate",
      fieldNames: ["other_permanent_resident_country"],
    }));
    expect(result.errors.find((issue) => issue.fieldNames[0] === "other_permanent_resident_country")?.message)
      .toBe("The Other Permanent/Resident Country/Region listed has already been (entered or selected).");
  });

  it("validates and counts the visible required field in each repeated branch", () => {
    const repeatedSteps: WizardStep[] = [{
      stepNumber: 1, stepName: "Other nationalities",
      fields: [
        { ...steps[0].fields[2], fieldName: "has_passport", options: ["yes", "no"], validationRules: { repeat_group: "nationalities" } },
        { ...steps[0].fields[3], fieldName: "other_passport", label: "Other passport", validationRules: { repeat_group: "nationalities", pattern: "^[A-Z0-9]+$" }, conditionalLogic: { showIf: "has_passport === yes" } },
      ],
    }];
    const answers = { has_passport: "no", has_passport__2: "yes", other_passport: "hidden invalid!" };
    const missing = validateApplicationAnswers({ steps: repeatedSteps, answers, visaType: "DS160" });
    expect(missing.errors).toEqual([expect.objectContaining({ code: "required_missing", fieldNames: ["other_passport__2"] })]);
    expect(missing.progress).toEqual({ completed: 2, total: 3 });
    const invalid = validateApplicationAnswers({ steps: repeatedSteps, answers: { ...answers, other_passport__2: "invalid!" }, visaType: "DS160" });
    expect(invalid.errors).toEqual([expect.objectContaining({ code: "invalid_format", fieldNames: ["other_passport__2"] })]);
    const complete = validateApplicationAnswers({ steps: repeatedSteps, answers: { ...answers, other_passport__2: "P222" }, visaType: "DS160" });
    expect(complete.errors).toEqual([]);
    expect(complete.progress).toEqual({ completed: 3, total: 3 });
  });

  it("treats an explicitly allowed unknown date as complete and requires a real date after reset", () => {
    const unknownDateSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Family Information",
      fields: [{
        id: "father-dob",
        visaType: "DS160",
        fieldName: "father_date_of_birth",
        label: "Father's Date of Birth",
        fieldType: "date",
        required: true,
        stepNumber: 1,
        stepName: "Family Information",
        displayOrder: 1,
        placeholder: null,
        validationRules: { format: "DD-MMM-YYYY", allow_do_not_know: true },
        options: null,
        conditionalLogic: null,
      }],
    }];

    const unknown = validateApplicationAnswers({
      steps: unknownDateSteps,
      answers: { father_date_of_birth: "DO_NOT_KNOW" },
      visaType: "DS160",
    });
    expect(unknown.errors).toEqual([]);
    expect(unknown.missingFields).toEqual([]);
    expect(unknown.progress).toEqual({ completed: 1, total: 1 });

    const reset = validateApplicationAnswers({
      steps: unknownDateSteps,
      answers: { father_date_of_birth: "" },
      visaType: "DS160",
    });
    expect(reset.missingFields.map((field) => field.fieldName)).toEqual(["father_date_of_birth"]);

    const invalid = validateApplicationAnswers({
      steps: [{
        ...unknownDateSteps[0],
        fields: [{ ...unknownDateSteps[0].fields[0], validationRules: { format: "DD-MMM-YYYY" } }],
      }],
      answers: { father_date_of_birth: "DO_NOT_KNOW" },
      visaType: "DS160",
    });
    expect(invalid.errors).toEqual([
      expect.objectContaining({ code: "invalid_date", fieldNames: ["father_date_of_birth"] }),
    ]);
  });

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

  it("flags a past Philippines arrival alias even when its schema omitted min_date", () => {
    const philippinesSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Travel Details - Philippine Arrival",
      fields: [{
        id: "flight-arrival",
        visaType: "PH_ETRAVEL_ARRIVAL_CARD",
        fieldName: "flight_arrival_date",
        label: "Date of Arrival of Flight",
        fieldType: "date",
        required: true,
        stepNumber: 1,
        stepName: "Travel Details - Philippine Arrival",
        displayOrder: 1,
        placeholder: null,
        validationRules: { official_key: "arrival_date", canonical_format: "YYYY-MM-DD" },
        options: null,
        conditionalLogic: null,
      }],
    }];

    const result = validateApplicationAnswers({
      steps: philippinesSteps,
      answers: { flight_arrival_date: "2026-08-21" },
      visaType: "PH_ETRAVEL_ARRIVAL_CARD",
      now: new Date("2026-08-23T00:00:00Z"),
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "date_before_today",
        fieldNames: ["flight_arrival_date"],
        message: "Date of Arrival of Flight cannot be before today.",
      }),
    ]);
    expect(result.progress).toEqual({ completed: 0, total: 1 });
  });

  it("requires the DS-160 passport expiration date to be strictly after issuance", () => {
    const ds160PassportSteps: WizardStep[] = [{
      stepNumber: 7,
      stepName: "Passport Information",
      fields: [
        {
          id: "passport-issuance-date",
          visaType: "DS160",
          fieldName: "passport_issuance_date",
          label: "Issuance Date",
          fieldType: "date",
          required: true,
          stepNumber: 7,
          stepName: "Passport Information",
          displayOrder: 9,
          placeholder: null,
          validationRules: { format: "DD-MMM-YYYY" },
          options: null,
          conditionalLogic: null,
        },
        {
          id: "passport-expiration-date",
          visaType: "DS160",
          fieldName: "passport_expiration_date",
          label: "Expiration Date",
          fieldType: "date",
          required: true,
          stepNumber: 7,
          stepName: "Passport Information",
          displayOrder: 10,
          placeholder: null,
          validationRules: { format: "DD-MMM-YYYY", has_does_not_apply: true },
          options: null,
          conditionalLogic: null,
        },
      ],
    }];

    const equalDates = validateApplicationAnswers({
      steps: ds160PassportSteps,
      answers: {
        passport_issuance_date: "2030-11-01",
        passport_expiration_date: "2030-11-01",
      },
      visaType: "DS160",
      locale: "en",
    });
    expect(equalDates.errors).toEqual([
      expect.objectContaining({
        code: "passport_expiration_not_after_issuance",
        fieldNames: ["passport_expiration_date", "passport_issuance_date"],
        message: "Expiry date must be after the issue date",
      }),
    ]);

    const validDates = validateApplicationAnswers({
      steps: ds160PassportSteps,
      answers: {
        passport_issuance_date: "2030-11-01",
        passport_expiration_date: "2030-11-02",
      },
      visaType: "DS160",
    });
    expect(validDates.errors.some((issue) => issue.code === "passport_expiration_not_after_issuance")).toBe(false);
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
});
