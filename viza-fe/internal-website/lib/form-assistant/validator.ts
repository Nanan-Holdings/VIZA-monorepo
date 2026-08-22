import { evaluateShowIf } from "@/lib/form-utils";
import { resolveLocalizedFieldLabel } from "@/lib/bilingual-schema-contract";
import {
  getMissingDynamicFormFields,
  type MissingApplicationField,
} from "@/lib/application-tab-completion";
import type { VisaFormFieldOption, WizardStep } from "@/types/visa-form-fields";
import type {
  FormAssistantProgress,
  FormAssistantValidationIssue,
} from "@/types/form-assistant";
import { SGAC_ICA_SOURCES } from "./constants";

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function normalizedOptionAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalOptionValue(
  options: VisaFormFieldOption[],
  rawValue: string,
): string | null {
  const direct = options.find((option) => optionValue(option) === rawValue);
  if (direct) return optionValue(direct);

  const normalized = normalizedOptionAlias(rawValue);
  if (!normalized) return null;
  const matches = new Set<string>();
  for (const option of options) {
    const candidates = typeof option === "string"
      ? [option]
      : [
          option.value,
          option.text,
          option.label_zh,
          option.label_en,
          option.official_label,
          option.official_value,
          option.portal_label,
          option.code,
        ];
    if (candidates.some((candidate) =>
      typeof candidate === "string" && normalizedOptionAlias(candidate) === normalized
    )) {
      matches.add(optionValue(option));
    }
  }
  return matches.size === 1 ? Array.from(matches)[0] ?? null : null;
}

function answerInstanceKey(fieldName: string, index: number): string {
  return index === 0 ? fieldName : `${fieldName}__${index + 1}`;
}

function answerInstanceSuffix(fieldName: string, answerKey: string): string {
  return answerKey.startsWith(`${fieldName}__`) ? answerKey.slice(fieldName.length) : "";
}

function fieldAnswerKeys(
  field: WizardStep["fields"][number],
  answers: Record<string, string>,
): string[] {
  const repeatGroup = field.validationRules?.repeat_group;
  if (typeof repeatGroup !== "string" || !repeatGroup.trim()) return [field.fieldName];

  const configuredMax = field.validationRules?.max_items;
  const maxItems = typeof configuredMax === "number" && configuredMax > 0
    ? Math.floor(configuredMax)
    : 5;
  const keys = new Set<string>([field.fieldName]);
  for (let index = 1; index < maxItems; index += 1) {
    const key = answerInstanceKey(field.fieldName, index);
    if (Object.prototype.hasOwnProperty.call(answers, key)) keys.add(key);
  }
  return Array.from(keys);
}

function hasMeaningfulAnswer(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 && normalized !== "[]" && normalized !== "{}";
}

function hasAnyFieldAnswer(
  field: WizardStep["fields"][number] | undefined,
  answers: Record<string, string>,
): boolean {
  if (!field) return false;
  return fieldAnswerKeys(field, answers).some((key) => hasMeaningfulAnswer(answers[key]));
}

function relatedAnswer(
  answers: Record<string, string>,
  fieldName: string,
  suffix: string,
): string {
  return (suffix ? answers[`${fieldName}${suffix}`] : undefined) ?? answers[fieldName] ?? "";
}

function isAllowedAnswerOverride(value: string, rules: Record<string, unknown>): boolean {
  return (
    (value === "DO_NOT_KNOW" && rules.allow_do_not_know === true) ||
    (value === "DOES_NOT_APPLY" && (rules.allow_does_not_apply === true || rules.has_does_not_apply === true))
  );
}

function isAllowedYearOnlyDate(value: string, rules: Record<string, unknown>): boolean {
  return rules.allow_year_only === true && /^\d{4}$/.test(value);
}

function optionValuesAreAllowed(
  field: WizardStep["fields"][number],
  value: string,
): boolean {
  if (!field.options?.length) return true;
  const allowed = new Set(field.options.map(optionValue));
  const selectedValues = field.fieldType === "multi_select"
    ? value.split(",").map((part) => part.trim()).filter(Boolean)
    : [value];
  return selectedValues.length > 0 && selectedValues.every((selected) => allowed.has(selected));
}

function usesPartialRemoteOptions(rules: Record<string, unknown>): boolean {
  return rules.remote_search === true ||
    typeof rules.official_options_source === "string" ||
    typeof rules.dynamic_option_source === "string";
}

export type CanonicalOptionAnswerPatch = {
  fieldName: string;
  previousValue: string;
  value: string;
};

export function canonicalizeApplicationOptionAnswers(
  steps: WizardStep[],
  sourceAnswers: Record<string, string>,
): { answers: Record<string, string>; patches: CanonicalOptionAnswerPatch[] } {
  const answers = { ...sourceAnswers };
  const patches: CanonicalOptionAnswerPatch[] = [];

  for (const field of steps.flatMap((step) => step.fields)) {
    if (
      !field.options?.length ||
      !["select", "radio", "country", "multi_select"].includes(field.fieldType)
    ) continue;

    for (const answerKey of fieldAnswerKeys(field, answers)) {
      const previousValue = answers[answerKey]?.trim();
      if (!previousValue) continue;
      const wholeValue = canonicalOptionValue(field.options, previousValue);
      let canonicalValue = wholeValue;
      if (!canonicalValue && field.fieldType === "multi_select") {
        const parts = previousValue.split(",").map((part) => part.trim()).filter(Boolean);
        const canonicalParts = parts.map((part) => canonicalOptionValue(field.options!, part));
        if (parts.length > 0 && canonicalParts.every((part): part is string => Boolean(part))) {
          canonicalValue = canonicalParts.join(",");
        }
      }
      if (!canonicalValue || canonicalValue === previousValue) continue;
      answers[answerKey] = canonicalValue;
      patches.push({ fieldName: answerKey, previousValue, value: canonicalValue });
    }
  }

  return { answers, patches };
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function parseApplicationDate(value: string): Date | null {
  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return buildUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Vietnam Pre-Arrival stores the official portal's controlled radio value
  // verbatim in DD/MM/YYYY instead of the shared form's ISO representation.
  const officialDayFirst = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (officialDayFirst) {
    return buildUtcDate(
      Number(officialDayFirst[3]),
      Number(officialDayFirst[2]),
      Number(officialDayFirst[1]),
    );
  }

  const chinese = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (chinese) return buildUtcDate(Number(chinese[1]), Number(chinese[2]), Number(chinese[3]));

  const officialMonthName = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (officialMonthName) {
    const month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
      .indexOf(officialMonthName[2].toUpperCase()) + 1;
    if (month > 0) return buildUtcDate(Number(officialMonthName[3]), month, Number(officialMonthName[1]));
  }

  return null;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfDayInTimeZone(value: Date, timeZone: string): Date {
  if (timeZone === "UTC") return startOfUtcDay(value);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return buildUtcDate(
      Number(dateParts.year),
      Number(dateParts.month),
      Number(dateParts.day),
    ) ?? startOfUtcDay(value);
  } catch {
    return startOfUtcDay(value);
  }
}

function isAcceptedCheckboxValue(value: string): boolean {
  return ["true", "yes", "1", "on"].includes(value.trim().toLowerCase());
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
  const missingNames = new Set(
    getMissingDynamicFormFields(steps, answers).map((field) => field.fieldName),
  );
  const completed = visibleRequired.filter((field) => !missingNames.has(field.fieldName)).length;
  return { completed, total: visibleRequired.length };
}

export function validateApplicationAnswers(params: {
  steps: WizardStep[];
  answers: Record<string, string>;
  visaType: string;
  now?: Date;
  timeZone?: string;
  locale?: string;
}): {
  errors: FormAssistantValidationIssue[];
  warnings: FormAssistantValidationIssue[];
  progress: FormAssistantProgress;
  missingFields: MissingApplicationField[];
} {
  const { steps, visaType } = params;
  const { answers } = canonicalizeApplicationOptionAnswers(steps, params.answers);
  const isZh = params.locale?.toLowerCase().startsWith("zh") ?? false;
  const message = (en: string, zh: string) => isZh ? zh : en;
  const fieldByName = new Map(steps.flatMap((step) => step.fields).map((field) => [field.fieldName, field]));
  const labelForField = (field: WizardStep["fields"][number]) =>
    resolveLocalizedFieldLabel(field, isZh ? "zh" : "en");
  const missingFields = getMissingDynamicFormFields(steps, answers).map((missing) => {
    const field = fieldByName.get(missing.fieldName);
    return field ? { ...missing, label: labelForField(field) } : missing;
  });
  const errors: FormAssistantValidationIssue[] = missingFields.flatMap((missing) => {
    const field = fieldByName.get(missing.fieldName);
    // A non-empty but invalid choice/acceptance is not also "missing". The
    // specific validator below owns that one actionable issue.
    if (hasAnyFieldAnswer(field, answers)) return [];
    return [{
      code: "required_missing",
      fieldNames: [missing.fieldName],
      message: message(`${missing.label} is required.`, `请填写${missing.label}。`),
    }];
  });
  const warnings: FormAssistantValidationIssue[] = [];

  for (const step of steps) {
    for (const field of step.fields) {
      if (!evaluateShowIf(field, answers, step.fields)) continue;
      const label = labelForField(field);
      for (const answerKey of fieldAnswerKeys(field, answers)) {
        const value = answers[answerKey]?.trim();
        if (!value) continue;
        const rules = field.validationRules ?? {};
        const suffix = answerInstanceSuffix(field.fieldName, answerKey);
        const allowedOverride = isAllowedAnswerOverride(value, rules);
        const yearOnlyDate = field.fieldType === "date" && isAllowedYearOnlyDate(value, rules);

        if (
          field.fieldType === "checkbox" &&
          (field.required || rules.mustBeTrue === true) &&
          !isAcceptedCheckboxValue(value)
        ) {
          errors.push({
            code: "acceptance_required",
            fieldNames: [answerKey],
            message: message(`${label} must be accepted.`, `请勾选并接受${label}。`),
          });
        }

        if (allowedOverride) continue;

        if (
          field.fieldType !== "checkbox" &&
          field.options?.length &&
          !usesPartialRemoteOptions(rules)
        ) {
          if (!optionValuesAreAllowed(field, value)) {
            errors.push({
              code: "invalid_option",
              fieldNames: [answerKey],
              message: message(`${label} must use an official option.`, `请为${label}选择官网提供的选项。`),
            });
          }
        }

        if (typeof rules.pattern === "string" && !yearOnlyDate) {
          try {
            if (!new RegExp(rules.pattern).test(value)) {
              errors.push({
                code: "invalid_format",
                fieldNames: [answerKey],
                message: message(`${label} has an invalid format.`, `${label}格式不正确。`),
              });
            }
          } catch {
            // A malformed schema regex must not make the form unusable.
          }
        }
        if (typeof rules.maxLength === "number" && value.length > rules.maxLength) {
          errors.push({
            code: "too_long",
            fieldNames: [answerKey],
            message: message(`${label} is longer than the allowed maximum.`, `${label}超过允许的最大长度。`),
          });
        }
        if (typeof rules.minLength === "number" && value.length < rules.minLength) {
          errors.push({
            code: "too_short",
            fieldNames: [answerKey],
            message: message(`${label} is shorter than the required minimum.`, `${label}短于要求的最小长度。`),
          });
        }
        const parsedDate = field.fieldType === "date" && !yearOnlyDate ? parseApplicationDate(value) : null;
        if (field.fieldType === "date" && !parsedDate && !yearOnlyDate) {
          errors.push({
            code: "invalid_date",
            fieldNames: [answerKey],
            message: message(`${label} must be a valid date.`, `请为${label}填写有效日期。`),
          });
        }
        if (
          yearOnlyDate &&
          (answerKey.toLowerCase().includes("birth") || field.fieldName.toLowerCase().includes("birth")) &&
          Number(value) > (params.now ?? new Date()).getUTCFullYear()
        ) {
          errors.push({
            code: "birth_year_in_future",
            fieldNames: [answerKey],
            message: message(`${label} cannot be later than the current year.`, `${label}不能晚于今年。`),
          });
        }

        const numericLengthRule = rules.numeric_length_when as {
          field?: unknown;
          equals?: unknown;
          length?: unknown;
        } | undefined;
        if (
          numericLengthRule &&
          typeof numericLengthRule.field === "string" &&
          typeof numericLengthRule.equals === "string" &&
          typeof numericLengthRule.length === "number" &&
          relatedAnswer(answers, numericLengthRule.field, suffix).trim() === numericLengthRule.equals &&
          !new RegExp(`^\\d{${numericLengthRule.length}}$`).test(value)
        ) {
          errors.push({
            code: "invalid_conditional_length",
            fieldNames: [answerKey, `${numericLengthRule.field}${suffix}`],
            message: message(
              `${label} must contain exactly ${numericLengthRule.length} digits for this selection.`,
              `在当前选项下，${label}必须为 ${numericLengthRule.length} 位纯数字。`,
            ),
          });
        }

        if (parsedDate) {
          const today = startOfDayInTimeZone(params.now ?? new Date(), params.timeZone ?? "UTC");
          if ((rules.min_date === "today" || rules.not_before_today === true) && parsedDate < today) {
            errors.push({
              code: "date_before_today",
              fieldNames: [answerKey],
              message: message(`${label} cannot be before today.`, `${label}不能早于今天。`),
            });
          }
          if (typeof rules.max_days_from_today === "number") {
            const lastAllowed = new Date(today);
            lastAllowed.setUTCDate(lastAllowed.getUTCDate() + Math.max(0, rules.max_days_from_today));
            if (parsedDate > lastAllowed) {
              errors.push({
                code: "date_after_submission_window",
                fieldNames: [answerKey],
                message: message(
                  `${label} is outside the permitted submission window.`,
                  `${label}超出允许的申报时间窗口。`,
                ),
              });
            }
          }
          const comparisonField = typeof rules.not_before_field === "string"
            ? rules.not_before_field
            : typeof rules.after_or_equal_field === "string"
              ? rules.after_or_equal_field
              : null;
          if (comparisonField) {
            const comparisonDate = parseApplicationDate(relatedAnswer(answers, comparisonField, suffix).trim());
            if (comparisonDate && parsedDate < comparisonDate) {
              errors.push({
                code: "date_before_related_field",
                fieldNames: [answerKey, `${comparisonField}${suffix}`],
                message: message(
                  `${label} cannot be before the related start date.`,
                  `${label}不能早于关联的开始日期。`,
                ),
              });
            }
          }
          if (typeof rules.min_days_after_field === "string") {
            const comparisonDate = parseApplicationDate(relatedAnswer(answers, rules.min_days_after_field, suffix).trim());
            const requiredDays = typeof rules.min_days_after_field_days === "number"
              ? Math.max(0, rules.min_days_after_field_days)
              : 0;
            if (comparisonDate) {
              const minimumDate = new Date(comparisonDate);
              minimumDate.setUTCDate(minimumDate.getUTCDate() + requiredDays);
              if (parsedDate < minimumDate) {
                errors.push({
                  code: "date_too_close_to_related_field",
                  fieldNames: [answerKey, `${rules.min_days_after_field}${suffix}`],
                  message: message(
                    `${label} must be at least ${requiredDays} day(s) after the related date.`,
                    `${label}必须至少晚于关联日期 ${requiredDays} 天。`,
                  ),
                });
              }
            }
          }
        }
      }
    }
  }

  if (visaType.trim().toUpperCase() === "SG_ARRIVAL_CARD") {
    const arrival = parseApplicationDate(answers.arrival_date ?? "");
    const departure = parseApplicationDate(answers.departure_date ?? "");
    const passportExpiry = parseApplicationDate(answers.passport_expiry_date ?? "");
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
      const start = startOfDayInTimeZone(today, params.timeZone ?? "UTC");
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
    missingFields,
  };
}
