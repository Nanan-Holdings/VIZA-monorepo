import type {
  FormAssistantFieldReviewIssue,
  FormAssistantValidationResponse,
} from "@/types/form-assistant";
import type { WizardStep } from "@/types/visa-form-fields";

type LegacyValidationIssue = {
  code?: unknown;
  fieldName?: unknown;
  fieldNames?: unknown;
  message?: unknown;
  source?: unknown;
};

function normalizeValidationIssue(value: unknown): FormAssistantValidationResponse["errors"][number] | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as LegacyValidationIssue;
  if (typeof candidate.message !== "string" || !candidate.message.trim()) return null;
  const fieldNames = Array.isArray(candidate.fieldNames)
    ? candidate.fieldNames.filter((fieldName): fieldName is string => (
        typeof fieldName === "string" && Boolean(fieldName.trim())
      )).map((fieldName) => fieldName.trim())
    : typeof candidate.fieldName === "string" && candidate.fieldName.trim()
      ? [candidate.fieldName.trim()]
      : [];
  const source = candidate.source && typeof candidate.source === "object"
    ? candidate.source as { title?: unknown; url?: unknown }
    : null;
  return {
    code: typeof candidate.code === "string" && candidate.code.trim()
      ? candidate.code.trim()
      : "validation_issue",
    fieldNames,
    message: candidate.message.trim(),
    ...(source && typeof source.title === "string"
      ? { source: { title: source.title, url: typeof source.url === "string" ? source.url : null } }
      : {}),
  };
}

/**
 * Accept the canonical validator response plus the legacy single-field issue
 * shape used during rolling deploys. Invalid optional data is discarded so a
 * successful validation request can never crash the applicant's review page.
 */
export function normalizeFormAssistantValidationResponse(
  value: unknown,
): FormAssistantValidationResponse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const normalizeIssues = (issues: unknown) => Array.isArray(issues)
    ? issues.map(normalizeValidationIssue).filter((issue) => issue !== null)
    : [];
  const errors = normalizeIssues(candidate.errors);
  const warnings = normalizeIssues(candidate.warnings);
  const progress = candidate.progress && typeof candidate.progress === "object"
    ? candidate.progress as { completed?: unknown; total?: unknown }
    : {};
  const completed = typeof progress.completed === "number" && Number.isFinite(progress.completed)
    ? Math.max(0, progress.completed)
    : 0;
  const total = typeof progress.total === "number" && Number.isFinite(progress.total)
    ? Math.max(completed, progress.total)
    : completed;
  return {
    errors,
    warnings,
    progress: { completed, total },
    canReview: typeof candidate.canReview === "boolean"
      ? candidate.canReview
      : errors.length === 0 && warnings.length === 0,
    validationId: typeof candidate.validationId === "string" && candidate.validationId.trim()
      ? candidate.validationId
      : "legacy-validation",
  };
}

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
      for (const fieldName of issue.fieldNames ?? []) {
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
