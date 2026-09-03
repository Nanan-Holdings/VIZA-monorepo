import { describe, expect, test } from "vitest";
import type { DocumentCenterData } from "@/app/client/documents/actions";
import {
  computeAllTabCompletion,
  getApplicationFieldErrorMessage,
  getContiguousCompletedCount,
  getMissingDynamicFormFields,
  getMissingRequiredDocumentRequirementKeys,
  getRequiredDocumentProgress,
} from "@/lib/application-tab-completion";
import type { WizardStep } from "@/types/visa-form-fields";

function field(
  fieldName: string,
  options: {
    label?: string;
    required?: boolean;
    showIf?: string;
    validationRules?: Record<string, unknown> | null;
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
    validationRules: options.validationRules ?? null,
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
  test("keeps Japan VJW placeholder text fields incomplete before enqueue", () => {
    const japanSteps: WizardStep[] = [
      {
        stepNumber: 1,
        stepName: "Traveller and Passport",
        fields: [field("residence_country", { label: "Residence country" })],
      },
      {
        stepNumber: 2,
        stepName: "Arrival and Stay",
        fields: [
          field("flight_number", { label: "Flight number" }),
          field("accommodation_name", { label: "Accommodation name" }),
          field("accommodation_prefecture", { label: "Accommodation prefecture" }),
          field("accommodation_city", { label: "Accommodation city" }),
          field("accommodation_address", { label: "Accommodation address" }),
        ],
      },
    ];
    const result = computeAllTabCompletion({
      dbSteps: japanSteps,
      effectiveSteps: [{ id: 0, name: "Traveller" }, { id: 1, name: "Stay" }],
      answers: {
        residence_country: "x",
        flight_number: "SQ111",
        accommodation_name: "x",
        accommodation_prefecture: "x",
        accommodation_city: "TK",
        accommodation_address: "x",
      },
      documentCenterData: null,
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
      documentStepId: 2,
      reviewStepId: 2,
      teamStepId: 3,
      confirmationStepId: 3,
      showDocumentStep: false,
      showTeamStep: false,
    });

    expect(result.missingFields.map((item) => item.fieldName)).toEqual([
      "residence_country",
      "flight_number",
      "accommodation_name",
      "accommodation_prefecture",
      "accommodation_address",
    ]);
    expect(result.missingFields.every((item) => item.reason === "invalid")).toBe(true);
    expect(result.completedStepIds).not.toContain(0);
    expect(result.completedStepIds).not.toContain(1);
  });

  test("keeps Japan VJW values outside the official numeric and format rules incomplete", () => {
    const japanSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Arrival and Stay",
      fields: [
        {
          ...field("planned_stay_days", {
            validationRules: { integer: true, min: 1, max: 90 },
          }),
          fieldType: "number" as const,
        },
        field("accommodation_phone", {
          validationRules: { pattern: "^[0-9]{10,15}$" },
        }),
        field("accommodation_postal_code", {
          required: false,
          validationRules: { pattern: "^[0-9]{3}-?[0-9]{4}$" },
        }),
      ],
    }];
    const input = {
      dbSteps: japanSteps,
      effectiveSteps: [{ id: 0, name: "Stay" }],
      documentCenterData: null,
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
      documentStepId: 1,
      reviewStepId: 1,
      teamStepId: 2,
      confirmationStepId: 2,
      showDocumentStep: false,
      showTeamStep: false,
    };

    const invalid = computeAllTabCompletion({
      ...input,
      answers: {
        planned_stay_days: "91",
        accommodation_phone: "03-1234-5678",
        accommodation_postal_code: "100",
      },
    });
    expect(invalid.missingFields).toMatchObject([
      { fieldName: "planned_stay_days", reason: "invalid" },
      { fieldName: "accommodation_phone", reason: "invalid" },
      { fieldName: "accommodation_postal_code", reason: "invalid" },
    ]);
    expect(getApplicationFieldErrorMessage(invalid.missingFields[0]!, {
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
      isZh: true,
    })).toBe("计划停留天数必须是 1 至 90 之间的整数。");

    const valid = computeAllTabCompletion({
      ...input,
      answers: {
        planned_stay_days: "90",
        accommodation_phone: "0312345678",
        accommodation_postal_code: "100-0001",
      },
    });
    expect(valid.missingFields).toEqual([]);
  });

  test("requires a Japan accommodation city to belong to the selected prefecture", () => {
    const prefectureField = {
      ...field("accommodation_prefecture"),
      fieldType: "select" as const,
      options: [
        { value: "13", label_zh: "东京都", label_en: "TOKYO TO" },
        { value: "28", label_zh: "兵库县", label_en: "HYOGO KEN" },
      ],
    };
    const cityField = {
      ...field("accommodation_city"),
      fieldType: "select" as const,
      validationRules: {
        dependent_on: "accommodation_prefecture",
        dependent_options: {
          "13": [{ value: "SHINJUKU KU", label_zh: "新宿区", label_en: "SHINJUKU KU" }],
          "28": [{ value: "KOBE SHI", label_zh: "神户市", label_en: "KOBE SHI" }],
        },
      },
    };
    const japanSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Arrival and Stay",
      fields: [prefectureField, cityField],
    }];

    expect(getMissingDynamicFormFields(japanSteps, {
      accommodation_prefecture: "13",
      accommodation_city: "KOBE SHI",
    }, {
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
    })).toMatchObject([{ fieldName: "accommodation_city", reason: "invalid" }]);

    expect(getMissingDynamicFormFields(japanSteps, {
      accommodation_prefecture: "13",
      accommodation_city: "SHINJUKU KU",
    }, {
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
    })).toEqual([]);
  });

  test("counts required document uploads in application readiness", () => {
    const documentData = vietnamDocsWithRequiredUploads();
    expect(getRequiredDocumentProgress(documentData)).toEqual({ completed: 2, total: 2 });

    documentData.documents = documentData.documents.slice(0, 1);
    expect(getRequiredDocumentProgress(documentData)).toEqual({ completed: 1, total: 2 });
    expect(getMissingRequiredDocumentRequirementKeys(documentData)).toEqual(["photo"]);
    expect(getRequiredDocumentProgress(null)).toEqual({ completed: 0, total: 1 });
    expect(getMissingRequiredDocumentRequirementKeys(null)).toEqual([]);

    documentData.documents[0]!.status = "processing";
    expect(getRequiredDocumentProgress(documentData)).toEqual({ completed: 0, total: 2 });
  });

  test("Saudi conditional branches count only the selected applicant path", () => {
    const saSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Saudi intake",
      fields: [
        { ...field("father_name"), visaType: "SA_E_VISA" },
        { ...field("applicant_is_minor"), visaType: "SA_E_VISA", fieldType: "radio" as const },
        { ...field("guardian_full_name", { showIf: "applicant_is_minor === yes" }), visaType: "SA_E_VISA" },
        { ...field("has_whatsapp"), visaType: "SA_E_VISA", fieldType: "radio" as const },
        { ...field("whatsapp_number", { showIf: "has_whatsapp === yes" }), visaType: "SA_E_VISA" },
        { ...field("accommodation_type"), visaType: "SA_E_VISA", fieldType: "radio" as const },
        { ...field("hotel_name", { showIf: "accommodation_type === hotel" }), visaType: "SA_E_VISA" },
        { ...field("private_residence_name", { showIf: "accommodation_type === residence" }), visaType: "SA_E_VISA" },
      ],
    }];

    const missing = getMissingDynamicFormFields(saSteps, {
      applicant_is_minor: "no",
      has_whatsapp: "no",
      accommodation_type: "hotel",
    }).map((item) => item.fieldName);

    expect(missing).toEqual(["father_name", "hotel_name"]);
    expect(missing).not.toContain("guardian_full_name");
    expect(missing).not.toContain("whatsapp_number");
    expect(missing).not.toContain("private_residence_name");
  });

  test("UAE mobile number stays dormant until the applicant selects Yes", () => {
    const aeSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "UAE accommodation",
      fields: [
        { ...field("has_uae_mobile"), visaType: "AE_TOURIST_VISA", fieldType: "radio" as const },
        { ...field("uae_mobile_number", { showIf: "has_uae_mobile === yes" }), visaType: "AE_TOURIST_VISA" },
      ],
    }];

    expect(getMissingDynamicFormFields(aeSteps, { has_uae_mobile: "no" })).toEqual([]);
    expect(getMissingDynamicFormFields(aeSteps, { has_uae_mobile: "yes" }))
      .toMatchObject([{ fieldName: "uae_mobile_number" }]);
  });

  test("optional schema rows become completion blockers when required_when is active", () => {
    const conditional = {
      ...field("live_required_detail", { required: false }),
      validationRules: { required_when: "controller === yes" },
    };
    const conditionalSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Conditional",
      fields: [conditional],
    }];

    expect(getMissingDynamicFormFields(conditionalSteps, { controller: "no" })).toEqual([]);
    expect(getMissingDynamicFormFields(conditionalSteps, { controller: "yes" }))
      .toMatchObject([{ fieldName: "live_required_detail" }]);
  });

  test("blocks final submission when an at-least-one-of official field group is empty", () => {
    const addressFields: WizardStep[] = [{
      stepNumber: 3,
      stepName: "Stay in Korea",
      fields: [
        field("stay_address_ko", {
          required: false,
          validationRules: { at_least_one_of: ["stay_address_ko", "stay_address_en"] },
        }),
        field("stay_address_en", {
          required: false,
          validationRules: { at_least_one_of: ["stay_address_ko", "stay_address_en"] },
        }),
      ],
    }];

    expect(getMissingDynamicFormFields(addressFields, {})).toMatchObject([
      { fieldName: "stay_address_ko", reason: "required" },
    ]);
    expect(getMissingDynamicFormFields(addressFields, { stay_address_en: "1 Sejong-daero" })).toEqual([]);
  });

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

  test("does not count a non-empty value that violates must_equal as complete", () => {
    const consent = {
      ...field("official_prerequisite"),
      visaType: "TR_E_VISA",
      fieldType: "radio" as const,
      validationRules: { must_equal: "yes" },
    };
    const consentSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Eligibility",
      fields: [consent],
    }];

    expect(getMissingDynamicFormFields(consentSteps, { official_prerequisite: "no" }))
      .toMatchObject([{ fieldName: "official_prerequisite" }]);
    expect(getMissingDynamicFormFields(consentSteps, { official_prerequisite: "yes" }))
      .toEqual([]);
  });

  test("does not count a non-empty display label as a completed official option", () => {
    const optionSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Traveller Information",
      fields: [{
        ...field("sex", { label: "Sex" }),
        fieldType: "select",
        options: [
          { value: "MALE", text: "Male", label_en: "Male", label_zh: "男" },
          { value: "FEMALE", text: "Female", label_en: "Female", label_zh: "女" },
        ],
      }],
    }];

    expect(getMissingDynamicFormFields(optionSteps, { sex: "male" })).toEqual([
      expect.objectContaining({ fieldName: "sex", reason: "invalid" }),
    ]);
    expect(getMissingDynamicFormFields(optionSteps, { sex: "MALE" })).toEqual([]);
  });

  test("flags past upcoming-arrival aliases without rejecting historical dates", () => {
    const dateSteps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Travel Details - Arrival",
      fields: [
        {
          ...field("flight_arrival_date", { label: "Date of Arrival of Flight" }),
          fieldType: "date",
          validationRules: { official_key: "arrival_date" },
        },
        {
          ...field("date_of_birth", { label: "Date of Birth" }),
          fieldType: "date",
        },
        {
          ...field("prior_visit_arrival_date", { label: "Prior visit arrival date" }),
          fieldType: "date",
        },
      ],
    }];
    const answers = {
      flight_arrival_date: "2026-08-21",
      date_of_birth: "2000-01-01",
      prior_visit_arrival_date: "2024-02-01",
    };

    expect(getMissingDynamicFormFields(dateSteps, answers, {
      now: new Date("2026-08-23T00:00:00Z"),
    })).toEqual([
      expect.objectContaining({
        fieldName: "flight_arrival_date",
        reason: "invalid",
      }),
    ]);
    expect(getMissingDynamicFormFields(dateSteps, {
      ...answers,
      flight_arrival_date: "2026-08-23",
    }, {
      now: new Date("2026-08-23T23:59:59Z"),
    })).toEqual([]);
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
