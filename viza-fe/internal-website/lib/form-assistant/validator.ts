import { evaluateShowIf } from "@/lib/form-utils";
import { getMissingDynamicFormFields } from "@/lib/application-tab-completion";
import type { VisaFormFieldOption, WizardStep } from "@/types/visa-form-fields";
import type {
  FormAssistantProgress,
  FormAssistantValidationIssue,
} from "@/types/form-assistant";
import { SGAC_ICA_SOURCES } from "./constants";

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getAssistantProgress(
  steps: WizardStep[],
  answers: Record<string, string>,
): FormAssistantProgress {
  const visibleRequired = steps.flatMap((step) =>
    step.fields.filter(
      (field) => field.required && evaluateShowIf(field, answers, step.fields),
    ),
  );
  const completed = visibleRequired.filter((field) => answers[field.fieldName]?.trim()).length;
  return { completed, total: visibleRequired.length };
}

export function validateApplicationAnswers(params: {
  steps: WizardStep[];
  answers: Record<string, string>;
  visaType: string;
  now?: Date;
  locale?: string;
}): {
  errors: FormAssistantValidationIssue[];
  warnings: FormAssistantValidationIssue[];
  progress: FormAssistantProgress;
} {
  const { steps, answers, visaType } = params;
  const isZh = params.locale?.toLowerCase().startsWith("zh") ?? false;
  const message = (en: string, zh: string) => isZh ? zh : en;
  const errors: FormAssistantValidationIssue[] = getMissingDynamicFormFields(steps, answers).map(
    (missing) => ({
      code: "required_missing",
      fieldNames: [missing.fieldName],
      message: message(`${missing.label} is required.`, `${missing.label}为必填项。`),
    }),
  );
  const warnings: FormAssistantValidationIssue[] = [];

  for (const step of steps) {
    for (const field of step.fields) {
      if (!evaluateShowIf(field, answers, step.fields)) continue;
      const value = answers[field.fieldName]?.trim();
      if (!value) continue;
      const rules = field.validationRules ?? {};

      if (field.options?.length) {
        const allowed = new Set(field.options.map(optionValue));
        if (!allowed.has(value)) {
          errors.push({
            code: "invalid_option",
            fieldNames: [field.fieldName],
            message: message(`${field.label} must use an official option.`, `${field.label}必须使用官方选项。`),
          });
        }
      }

      if (typeof rules.pattern === "string") {
        try {
          if (!new RegExp(rules.pattern).test(value)) {
            errors.push({
              code: "invalid_format",
              fieldNames: [field.fieldName],
              message: message(`${field.label} has an invalid format.`, `${field.label}格式不正确。`),
            });
          }
        } catch {
          // A malformed schema regex must not make the form unusable.
        }
      }
      if (typeof rules.maxLength === "number" && value.length > rules.maxLength) {
        errors.push({
          code: "too_long",
          fieldNames: [field.fieldName],
          message: message(`${field.label} is longer than the allowed maximum.`, `${field.label}超过允许的最大长度。`),
        });
      }
      if (typeof rules.minLength === "number" && value.length < rules.minLength) {
        errors.push({
          code: "too_short",
          fieldNames: [field.fieldName],
          message: message(`${field.label} is shorter than the required minimum.`, `${field.label}短于要求的最小长度。`),
        });
      }
      if (field.fieldType === "date" && !parseIsoDate(value)) {
        errors.push({
          code: "invalid_date",
          fieldNames: [field.fieldName],
          message: message(`${field.label} must be a valid date.`, `${field.label}必须是有效日期。`),
        });
      }
    }
  }

  if (visaType.trim().toUpperCase() === "SG_ARRIVAL_CARD") {
    const arrival = parseIsoDate(answers.arrival_date ?? "");
    const departure = parseIsoDate(answers.departure_date ?? "");
    const passportExpiry = parseIsoDate(answers.passport_expiry_date ?? "");
    if (arrival && departure && departure < arrival) {
      errors.push({
        code: "departure_before_arrival",
        fieldNames: ["arrival_date", "departure_date"],
        message: message("Departure date cannot be before arrival date.", "离境日期不能早于抵达日期。"),
      });
    }
    if (arrival && passportExpiry && passportExpiry < arrival) {
      errors.push({
        code: "passport_expired_at_arrival",
        fieldNames: ["passport_expiry_date", "arrival_date"],
        message: message("The passport expires before the planned arrival date.", "护照将在计划抵达日期前到期。"),
      });
    }
    if (arrival) {
      const today = params.now ?? new Date();
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const lastAllowed = new Date(start);
      lastAllowed.setUTCDate(lastAllowed.getUTCDate() + 2);
      if (arrival < start || arrival > lastAllowed) {
        warnings.push({
          code: "sgac_three_day_window",
          fieldNames: ["arrival_date"],
          message: message(
            "ICA only accepts an SG Arrival Card submission within three days before arrival, including the arrival date.",
            "ICA 仅接受在抵达日前三天内（含抵达当日）提交新加坡电子入境卡。",
          ),
          source: SGAC_ICA_SOURCES[0],
        });
      }
    }
  }

  const dedupe = (issues: FormAssistantValidationIssue[]) =>
    Array.from(new Map(issues.map((issue) => [`${issue.code}:${issue.fieldNames.join(",")}`, issue])).values());

  return {
    errors: dedupe(errors),
    warnings: dedupe(warnings),
    progress: getAssistantProgress(steps, answers),
  };
}
