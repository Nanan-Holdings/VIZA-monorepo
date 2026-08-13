import { describe, expect, it } from "vitest";
import type { FormAssistantValidationResponse } from "@/types/form-assistant";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";
import {
  buildFormAssistantFieldReviewIssues,
  normalizeFormAssistantValidationResponse,
} from "./review-issues";

function field(fieldName: string, displayOrder: number, visaType: string): VisaFormFieldRow {
  return {
    id: `${visaType}:${fieldName}`,
    visaType,
    fieldName,
    label: fieldName,
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Application",
    displayOrder,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
  };
}

function validation(
  errors: FormAssistantValidationResponse["errors"],
  warnings: FormAssistantValidationResponse["warnings"] = [],
): FormAssistantValidationResponse {
  return {
    errors,
    warnings,
    progress: { completed: 0, total: 0 },
    canReview: false,
    validationId: "validation-1",
  };
}

describe("buildFormAssistantFieldReviewIssues", () => {
  it("normalizes legacy single-field issues from a rolling deployment", () => {
    expect(normalizeFormAssistantValidationResponse({
      errors: [{ code: "legacy", fieldName: "passport_number", message: "Check passport" }],
      warnings: [{ code: "global", fieldNames: null, message: "Check all answers" }],
      progress: null,
      canReview: false,
    })).toMatchObject({
      errors: [{ code: "legacy", fieldNames: ["passport_number"], message: "Check passport" }],
      warnings: [{ code: "global", fieldNames: [], message: "Check all answers" }],
      progress: { completed: 0, total: 0 },
      canReview: false,
    });
  });

  it("drops malformed issues instead of crashing final review", () => {
    expect(normalizeFormAssistantValidationResponse({
      errors: [null, { fieldNames: [null, "arrival_date"], message: "  Check the date  " }],
      warnings: "not-an-array",
    })).toMatchObject({
      errors: [{ fieldNames: ["arrival_date"], message: "Check the date" }],
      warnings: [],
    });
  });

  it.each(["SG_ARRIVAL_CARD", "VN_E_VISA", "AU_VISITOR_600", "UK_STANDARD_VISITOR"]) (
    "orders navigation by the shared schema for %s",
    (visaType) => {
      const steps: WizardStep[] = [{
        stepNumber: 1,
        stepName: "Application",
        fields: [field("later", 20, visaType), field("first", 10, visaType)],
      }];
      const result = buildFormAssistantFieldReviewIssues(validation([
        { code: "later", fieldNames: ["later"], message: "Later issue" },
        { code: "first", fieldNames: ["first"], message: "First issue" },
      ]), steps);

      expect(result.map((issue) => issue.fieldName)).toEqual(["first", "later"]);
      expect(result[0]?.nextFieldName).toBe("later");
      expect(result[1]?.nextFieldName).toBeNull();
    },
  );

  it("expands cross-field issues, keeps repeat instances, and ignores unknown fields", () => {
    const steps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Application",
      fields: [field("arrival_date", 1, "TH_TDAC"), field("hotel_name", 2, "TH_TDAC")],
    }];
    const result = buildFormAssistantFieldReviewIssues(validation([
      {
        code: "date-stay",
        fieldNames: ["arrival_date", "hotel_name__2", "not_in_schema"],
        message: "Check these answers together.",
      },
    ]), steps);

    expect(result.map((issue) => issue.fieldName)).toEqual(["arrival_date", "hotel_name__2"]);
  });

  it("keeps an error when the same field also has a warning", () => {
    const steps: WizardStep[] = [{
      stepNumber: 1,
      stepName: "Application",
      fields: [field("passport_number", 1, "JP_E_VISA")],
    }];
    const result = buildFormAssistantFieldReviewIssues(validation(
      [{ code: "error", fieldNames: ["passport_number"], message: "Invalid format" }],
      [{ code: "warning", fieldNames: ["passport_number"], message: "Please confirm" }],
    ), steps);

    expect(result).toEqual([{
      fieldName: "passport_number",
      message: "Invalid format",
      severity: "error",
      nextFieldName: null,
    }]);
  });
});
