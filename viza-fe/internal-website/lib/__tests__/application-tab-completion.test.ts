import { describe, expect, test } from "vitest";
import type { DocumentCenterData } from "@/app/client/documents/actions";
import {
  computeAllTabCompletion,
  getContiguousCompletedCount,
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

describe("computeAllTabCompletion", () => {
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
});
