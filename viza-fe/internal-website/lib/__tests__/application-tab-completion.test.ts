import { describe, expect, test } from "vitest";
import type { DocumentCenterData } from "@/app/client/documents/actions";
import {
  computeAllTabCompletion,
  getContiguousCompletedCount,
  getMissingDynamicFormFields,
} from "@/lib/application-tab-completion";
import type { WizardStep } from "@/types/visa-form-fields";

function field(
  fieldName: string,
  options: {
    label?: string;
    required?: boolean;
    showIf?: string;
  } = {},
) {
  return {
    id: fieldName,
    visaType: "DS160",
    fieldName,
    label: options.label ?? fieldName,
    fieldType: "text" as const,
    required: options.required ?? true,
    stepNumber: 1,
    stepName: "Travel Information",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: options.showIf ? { showIf: options.showIf } : null,
  };
}

const steps: WizardStep[] = [
  {
    stepNumber: 1,
    stepName: "Travel Information",
    fields: [
      field("has_specific_travel_plans"),
      field("purpose_of_trip"),
      field("purpose_of_trip_specify"),
      field("arrival_date", { required: false, showIf: "has_specific_plans === yes" }),
      field("intended_arrival_date", { required: false, showIf: "has_specific_plans === no" }),
      field("intended_length_of_stay_value", { required: false, showIf: "has_specific_plans === no" }),
      field("intended_length_of_stay_unit", { required: false, showIf: "has_specific_plans === no" }),
    ],
  },
];

const stepRefs = [
  { id: 0, name: "Travel" },
  { id: 1, name: "Documents" },
  { id: 2, name: "Review" },
  { id: 3, name: "Team" },
  { id: 4, name: "Confirmation" },
];

function docs(status = "approved"): DocumentCenterData {
  return {
    applicantId: "applicant",
    applications: [],
    selectedApplication: null,
    packageSummary: null,
    requirements: [
      {
        key: "passport_copy",
        documentType: "passport_copy",
        labelEn: "Passport",
        labelZh: "护照",
        description: null,
        required: true,
        sortOrder: 1,
        accept: [],
        source: "fallback",
      },
    ],
    documents: [
      {
        id: "doc",
        applicationId: "application",
        documentType: "passport_copy",
        requirementKey: "passport_copy",
        filename: "passport.pdf",
        status,
        rejectionReason: null,
        required: true,
        reviewNotes: null,
        reviewedAt: null,
        createdAt: null,
        updatedAt: null,
        source: "application_documents",
      },
    ],
    ocrExtractions: [],
  };
}

function vietnamDocsWithRequiredUploads(): DocumentCenterData {
  return {
    ...docs(),
    requirements: [
      {
        key: "passport_copy",
        documentType: "passport_copy",
        labelEn: "Passport data page image",
        labelZh: "护照资料页图片",
        description: null,
        required: true,
        sortOrder: 10,
        accept: [],
        source: "document_requirements",
      },
      {
        key: "photo",
        documentType: "photo",
        labelEn: "Portrait photo",
        labelZh: "本人证件照片",
        description: null,
        required: true,
        sortOrder: 20,
        accept: [],
        source: "document_requirements",
      },
      {
        key: "travel_itinerary",
        documentType: "travel_itinerary",
        labelEn: "Travel itinerary",
        labelZh: "旅行行程（可选）",
        description: null,
        required: false,
        sortOrder: 30,
        accept: [],
        source: "document_requirements",
      },
    ],
    documents: [
      {
        id: "passport-doc",
        applicationId: "application",
        documentType: "passport_copy",
        requirementKey: "passport_copy",
        filename: "passport.jpg",
        status: "uploaded",
        rejectionReason: null,
        required: true,
        reviewNotes: null,
        reviewedAt: null,
        createdAt: null,
        updatedAt: null,
        source: "application_documents",
      },
      {
        id: "photo-doc",
        applicationId: "application",
        documentType: "photo",
        requirementKey: "photo",
        filename: "photo.jpg",
        status: "uploaded",
        rejectionReason: null,
        required: true,
        reviewNotes: null,
        reviewedAt: null,
        createdAt: null,
        updatedAt: null,
        source: "application_documents",
      },
    ],
  };
}

describe("computeAllTabCompletion", () => {
  test("does not count a false required checkbox as complete", () => {
    const checkbox = {
      ...field("accepted_terms"),
      visaType: "TW_ENTRY_PERMIT",
      fieldType: "checkbox" as const,
      validationRules: { mustBeTrue: true },
    };
    const declarationSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Declaration",
      fields: [checkbox],
    }];

    expect(getMissingDynamicFormFields(declarationSteps, { accepted_terms: "false" }))
      .toMatchObject([{ fieldName: "accepted_terms" }]);
    expect(getMissingDynamicFormFields(declarationSteps, { accepted_terms: "true" }))
      .toEqual([]);
  });

  test("keeps a select field missing when a non-empty prefill is not an official option", () => {
    const birthCountry = {
      ...field("place_of_birth", { label: "Place of Birth" }),
      visaType: "MY_MDAC_ARRIVAL_CARD",
      fieldType: "select" as const,
      options: [
        { value: "CHN", text: "CHINA", label_zh: "中国" },
        { value: "SGP", text: "SINGAPORE", label_zh: "新加坡" },
      ],
    };
    const countrySteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Traveller Information",
      fields: [birthCountry],
    }];

    expect(getMissingDynamicFormFields(countrySteps, { place_of_birth: "Changsha" }))
      .toMatchObject([{ fieldName: "place_of_birth" }]);
    expect(getMissingDynamicFormFields(countrySteps, { place_of_birth: "CHN" }))
      .toEqual([]);
  });

  test("does not reject a live official value against a partial fallback option list", () => {
    const remoteCountry = {
      ...field("place_of_birth", { label: "Place of Birth" }),
      visaType: "AUDIT",
      fieldType: "select" as const,
      validationRules: { official_options_source: "/api/official-countries" },
      options: [{ value: "fallback", text: "Fallback" }],
    };
    const countrySteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Traveller Information",
      fields: [remoteCountry],
    }];

    expect(getMissingDynamicFormFields(countrySteps, { place_of_birth: "LIVE_OFFICIAL_VALUE" }))
      .toEqual([]);
  });

  test("uses the same __2 suffix as the repeatable form for its second instance", () => {
    const repeatedPassport = {
      ...field("other_passport_number", { label: "Other passport number" }),
      validationRules: {
        repeatable: true,
        repeat_group: "other_passports",
        max_items: 3,
      },
    };
    const repeatSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Other passports",
      fields: [repeatedPassport],
    }];

    expect(getMissingDynamicFormFields(repeatSteps, { other_passport_number__2: "E1234567" }))
      .toEqual([]);
  });

  test("derives TDAC transit status from same-day dates before validating accommodation", () => {
    const tdacSteps: WizardStep[] = [
      {
        stepNumber: 1,
        stepName: "Trip Information",
        fields: [
          { ...field("arrival_date"), visaType: "TH_TDAC_ARRIVAL_CARD" },
          { ...field("departure_date"), visaType: "TH_TDAC_ARRIVAL_CARD" },
        ],
      },
      {
        stepNumber: 2,
        stepName: "Accommodation Information",
        fields: [
          {
            ...field("accommodation_type", { showIf: "is_transit_traveler !== yes" }),
            visaType: "TH_TDAC_ARRIVAL_CARD",
          },
          {
            ...field("province", { showIf: "is_transit_traveler !== yes" }),
            visaType: "TH_TDAC_ARRIVAL_CARD",
          },
          {
            ...field("address_in_thailand", { showIf: "is_transit_traveler !== yes" }),
            visaType: "TH_TDAC_ARRIVAL_CARD",
          },
        ],
      },
    ];
    const result = computeAllTabCompletion({
      dbSteps: tdacSteps,
      effectiveSteps: [{ id: 0, name: "Trip" }, { id: 1, name: "Accommodation" }],
      answers: { arrival_date: "2026-08-08", departure_date: "2026-08-08" },
      documentCenterData: null,
      country: "thailand",
      visaType: "TH_TDAC_ARRIVAL_CARD",
      documentStepId: 2,
      reviewStepId: 2,
      teamStepId: 3,
      confirmationStepId: 3,
      showDocumentStep: false,
      showTeamStep: false,
    });

    expect(result.missingFields).toEqual([]);
    expect(result.completedStepIds).toEqual([0, 1, 2]);
  });

  test("clears a stale TDAC transit answer when the departure date changes", () => {
    const tdacAccommodationStep: WizardStep = {
      stepNumber: 1,
      stepName: "Accommodation Information",
      fields: [{
        ...field("accommodation_type", { showIf: "is_transit_traveler !== yes" }),
        visaType: "TH_TDAC_ARRIVAL_CARD",
      }],
    };
    const result = computeAllTabCompletion({
      dbSteps: [tdacAccommodationStep],
      effectiveSteps: [{ id: 0, name: "Accommodation" }],
      answers: {
        arrival_date: "2026-08-08",
        departure_date: "2026-08-09",
        is_transit_traveler: "yes",
      },
      documentCenterData: null,
      country: "thailand",
      visaType: "TH_TDAC_ARRIVAL_CARD",
      documentStepId: 1,
      reviewStepId: 1,
      teamStepId: 2,
      confirmationStepId: 2,
      showDocumentStep: false,
      showTeamStep: false,
    });

    expect(result.missingFields.map((item) => item.fieldName)).toContain("accommodation_type");
  });

  test("marks tabs complete from loaded saved answers without visited state", () => {
    const result = computeAllTabCompletion({
      dbSteps: steps,
      effectiveSteps: stepRefs,
      answers: {
        has_specific_travel_plans: "no",
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1/B2",
        intended_arrival_date: "2026-10-01",
        intended_length_of_stay_value: "10",
        intended_length_of_stay_unit: "DAY(S)",
      },
      documentCenterData: docs(),
      country: "united_states",
      visaType: "DS160",
      documentStepId: 1,
      reviewStepId: 2,
      teamStepId: 3,
      confirmationStepId: 4,
      showTeamStep: true,
    });

    expect(result.missingFields).toEqual([]);
    expect(result.completedStepIds).toEqual([0, 1, 2, 3]);
    expect(getContiguousCompletedCount(stepRefs, result.completedStepIds)).toBe(4);
  });

  test("uses the has_specific_plans alias when evaluating conditional visibility", () => {
    const result = computeAllTabCompletion({
      dbSteps: steps,
      effectiveSteps: stepRefs,
      answers: {
        has_specific_travel_plans: "yes",
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1/B2",
        arrival_date: "2026-10-01",
      },
      documentCenterData: docs(),
      country: "united_states",
      visaType: "DS160",
      documentStepId: 1,
      reviewStepId: 2,
      teamStepId: 3,
      confirmationStepId: 4,
      showTeamStep: true,
    });

    expect(result.missingFields.map((item) => item.fieldName)).not.toContain("intended_arrival_date");
    expect(result.completedStepIds).toContain(0);
  });

  test("blocks DS-160 submission when CEAC-required travel fields are missing", () => {
    const result = computeAllTabCompletion({
      dbSteps: steps,
      effectiveSteps: stepRefs,
      answers: {
        has_specific_travel_plans: "no",
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1/B2",
      },
      documentCenterData: docs(),
      country: "united_states",
      visaType: "DS160",
      documentStepId: 1,
      reviewStepId: 2,
      teamStepId: 3,
      confirmationStepId: 4,
      showTeamStep: true,
    });

    expect(result.completedStepIds).not.toContain(0);
    expect(result.completedStepIds).not.toContain(2);
    expect(result.missingFields.map((item) => item.fieldName)).toEqual(
      expect.arrayContaining([
        "intended_arrival_date",
        "intended_length_of_stay_value",
        "intended_length_of_stay_unit",
      ]),
    );
  });

  test("required documents participate in tab completion", () => {
    const result = computeAllTabCompletion({
      dbSteps: steps,
      effectiveSteps: stepRefs,
      answers: {
        has_specific_travel_plans: "no",
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1/B2",
        intended_arrival_date: "2026-10-01",
        intended_length_of_stay_value: "10",
        intended_length_of_stay_unit: "DAY(S)",
      },
      documentCenterData: docs("missing"),
      country: "united_states",
      visaType: "DS160",
      documentStepId: 1,
      reviewStepId: 2,
      teamStepId: 3,
      confirmationStepId: 4,
      showTeamStep: true,
    });

    expect(result.completedStepIds).not.toContain(1);
    expect(result.missingFields.map((item) => item.fieldName)).toContain("supporting_documents");
  });

  test("SGAC completion does not invent a supporting-documents requirement", () => {
    const result = computeAllTabCompletion({
      dbSteps: steps,
      effectiveSteps: [
        stepRefs[0],
        { id: 1, name: "审核申请", sourceName: "Review" },
        { id: 2, name: "确认", sourceName: "Confirmation" },
      ],
      answers: {
        has_specific_travel_plans: "no",
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1/B2",
        intended_arrival_date: "2026-10-01",
        intended_length_of_stay_value: "10",
        intended_length_of_stay_unit: "DAY(S)",
      },
      documentCenterData: null,
      documentsLoaded: true,
      country: "singapore",
      visaType: "SG_ARRIVAL_CARD",
      documentStepId: 1,
      reviewStepId: 1,
      teamStepId: 2,
      confirmationStepId: 2,
      showDocumentStep: false,
      showTeamStep: false,
    });

    expect(result.missingFields.map((item) => item.fieldName)).not.toContain("supporting_documents");
    expect(result.completedStepIds).toEqual([0, 1]);
  });

  test("Vietnam document completion accepts required passport and photo without optional itinerary", () => {
    const result = computeAllTabCompletion({
      dbSteps: steps,
      effectiveSteps: stepRefs,
      answers: {
        has_specific_travel_plans: "no",
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1/B2",
        intended_arrival_date: "2026-10-01",
        intended_length_of_stay_value: "10",
        intended_length_of_stay_unit: "DAY(S)",
      },
      documentCenterData: vietnamDocsWithRequiredUploads(),
      country: "vietnam",
      visaType: "VN_E_VISA",
      documentStepId: 1,
      reviewStepId: 2,
      teamStepId: 3,
      confirmationStepId: 4,
      showTeamStep: true,
    });

    expect(result.missingFields.map((item) => item.fieldName)).not.toContain("supporting_documents");
    expect(result.completedStepIds).toContain(1);
  });
});
