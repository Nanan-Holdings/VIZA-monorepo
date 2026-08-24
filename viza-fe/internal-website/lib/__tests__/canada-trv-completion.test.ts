import { describe, expect, it } from "vitest";
import {
  getMissingCanadaTrvExternalGates,
  isCanadaTrvFieldValueValid,
} from "@/lib/canada-trv-completion";
import { computeAllTabCompletion } from "@/lib/application-tab-completion";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: "test",
    visaType: "CA_TRV",
    fieldName: "visit_details",
    label: "Visit details",
    fieldType: "textarea",
    required: true,
    stepNumber: 5,
    stepName: "Details of Visit to Canada",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

describe("Canada TRV completion contract", () => {
  it("rejects overlength purpose text and impossible or reversed dates", () => {
    expect(isCanadaTrvFieldValueValid(
      field({ validationRules: { maxLength: 475 } }),
      "x".repeat(476),
      {},
    )).toBe(false);
    expect(isCanadaTrvFieldValueValid(
      field({ fieldName: "intended_stay_from", fieldType: "date", validationRules: { format: "YYYY-MM-DD" } }),
      "2026-02-30",
      {},
    )).toBe(false);
    expect(isCanadaTrvFieldValueValid(
      field({ fieldName: "intended_stay_to", fieldType: "date", validationRules: { format: "YYYY-MM-DD" } }),
      "2026-09-01",
      { intended_stay_from: "2026-09-02" },
    )).toBe(false);
  });

  it("requires affirmative legal certification rather than any non-empty value", () => {
    const declaration = field({ fieldName: "applicant_declaration", fieldType: "checkbox" });
    expect(isCanadaTrvFieldValueValid(declaration, "no", {})).toBe(false);
    expect(isCanadaTrvFieldValueValid(declaration, "yes", {})).toBe(true);
  });

  it("keeps all legal and portal terms gates separate and fail-closed", () => {
    expect(getMissingCanadaTrvExternalGates({
      applicationConsentPresent: false,
      applicationSignaturePresent: false,
      portalTermsConsentPresent: false,
    })).toEqual([
      "canada_application_consent",
      "canada_application_signature",
      "canada_ircc_portal_terms_consent",
    ]);
    expect(getMissingCanadaTrvExternalGates({
      applicationConsentPresent: true,
      applicationSignaturePresent: true,
      portalTermsConsentPresent: true,
    })).toEqual([]);
  });

  it("does not complete Review while a purpose value or external runner gate is invalid", () => {
    const purposeField = field({ validationRules: { maxLength: 475 } });
    const base = {
      dbSteps: [{
        stepNumber: 5,
        stepName: "Details of Visit to Canada",
        fields: [purposeField],
      }],
      effectiveSteps: [
        { id: 0, name: "Details of Visit to Canada" },
        { id: 1, name: "Review Application" },
      ],
      documentCenterData: null,
      documentsLoaded: true,
      country: "canada",
      visaType: "CA_TRV",
      documentStepId: 10,
      reviewStepId: 1,
      teamStepId: 11,
      confirmationStepId: 12,
      showDocumentStep: false,
      showTeamStep: false,
    };

    const invalid = computeAllTabCompletion({
      ...base,
      answers: { visit_details: "x".repeat(476) },
      applicationConsentPresent: true,
      applicationSignaturePresent: true,
      canadaPortalTermsConsentPresent: true,
    });
    expect(invalid.completedStepIds).not.toContain(0);
    expect(invalid.completedStepIds).not.toContain(1);
    expect(invalid.missingFields).toContainEqual(expect.objectContaining({
      fieldName: "visit_details",
      reason: "invalid",
    }));

    const gated = computeAllTabCompletion({
      ...base,
      answers: { visit_details: "Tourism in Alberta." },
      applicationConsentPresent: false,
      applicationSignaturePresent: false,
      canadaPortalTermsConsentPresent: false,
    });
    expect(gated.completedStepIds).toContain(0);
    expect(gated.completedStepIds).not.toContain(1);
    expect(gated.missingFields.filter((item) => item.reason === "external_gate")).toHaveLength(3);
  });
});
