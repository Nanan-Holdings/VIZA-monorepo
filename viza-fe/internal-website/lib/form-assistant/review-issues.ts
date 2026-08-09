import type {
  FormAssistantFieldReviewIssue,
  FormAssistantValidationResponse,
} from "@/types/form-assistant";
import type { WizardStep } from "@/types/visa-form-fields";

export function getBaseAnswerFieldName(fieldName: string): string {
  return fieldName.replace(/__\d+$/, "");
}

export function buildFormAssistantFieldReviewIssues(
  validation: FormAssistantValidationResponse | null,
  steps: WizardStep[],
): FormAssistantFieldReviewIssue[] {
  if (!validation) return [];

  const fieldOrder = new Map<string, number>();
  steps.forEach((step, stepIndex) => {
    [...step.fields]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .forEach((field, fieldIndex) => {
        fieldOrder.set(field.fieldName, stepIndex * 10_000 + fieldIndex);
      });
  });

  const byField = new Map<string, Omit<FormAssistantFieldReviewIssue, "nextFieldName">>();
  const addIssues = (
    issues: FormAssistantValidationResponse["errors"],
    severity: FormAssistantFieldReviewIssue["severity"],
  ) => {
    for (const issue of issues) {
      for (const fieldName of issue.fieldNames) {
        const baseFieldName = getBaseAnswerFieldName(fieldName);
        if (!fieldOrder.has(baseFieldName)) continue;
        const current = byField.get(fieldName);
        if (current?.severity === "error") continue;
        byField.set(fieldName, { fieldName, message: issue.message, severity });
      }
    }
  };

  addIssues(validation.errors, "error");
  addIssues(validation.warnings, "warning");

  const ordered = Array.from(byField.values()).sort((left, right) => {
    const leftBase = getBaseAnswerFieldName(left.fieldName);
    const rightBase = getBaseAnswerFieldName(right.fieldName);
    return (fieldOrder.get(leftBase) ?? Number.MAX_SAFE_INTEGER) -
      (fieldOrder.get(rightBase) ?? Number.MAX_SAFE_INTEGER);
  });

  return ordered.map((issue, index) => ({
    ...issue,
    nextFieldName: ordered[index + 1]?.fieldName ?? null,
  }));
}
