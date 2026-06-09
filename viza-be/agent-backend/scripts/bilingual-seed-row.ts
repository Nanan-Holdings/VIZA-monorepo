import { normalizeBilingualFormField } from "../../../viza-fe/internal-website/lib/bilingual-schema-contract";
import type {
  VisaFormFieldOption,
  VisaFormFieldRow,
} from "../../../viza-fe/internal-website/types/visa-form-fields";

export interface BilingualSeedField {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string | null;
  validation_rules?: Record<string, unknown> | null;
  options?: unknown[] | null;
  conditional_logic?: Record<string, unknown> | string | null;
}

export interface BilingualSeedRow {
  visa_type: string;
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder: string | null;
  validation_rules: Record<string, unknown> | null;
  options: VisaFormFieldOption[] | null;
  conditional_logic: Record<string, unknown> | null;
}

function normalizeConditionalLogic(
  value: BilingualSeedField["conditional_logic"],
): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") return { description: value };
  return value;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptions(options: unknown[] | null | undefined): VisaFormFieldOption[] | null {
  if (!Array.isArray(options)) return null;

  const normalized: VisaFormFieldOption[] = [];
  for (const option of options) {
    if (typeof option === "string") {
      normalized.push(option);
      continue;
    }

    if (!option || typeof option !== "object") continue;
    const record = option as Record<string, unknown>;
    const value = clean(record.value);
    if (!value) continue;

    normalized.push({
      value,
      ...(clean(record.text) ? { text: clean(record.text) } : {}),
      ...(clean(record.label_zh) ? { label_zh: clean(record.label_zh) } : {}),
      ...(clean(record.label_en) ? { label_en: clean(record.label_en) } : {}),
      ...(clean(record.official_label) ? { official_label: clean(record.official_label) } : {}),
    });
  }

  return normalized.length > 0 ? normalized : null;
}

export function toBilingualSeedRow(
  visaType: string,
  field: BilingualSeedField,
): BilingualSeedRow {
  const options = normalizeOptions(field.options);
  const normalized = normalizeBilingualFormField({
    id: `seed:${visaType}:${field.field_name}`,
    visaType,
    fieldName: field.field_name,
    label: field.label,
    fieldType: field.field_type as VisaFormFieldRow["fieldType"],
    required: field.required,
    stepNumber: field.step_number,
    stepName: field.step_name,
    displayOrder: field.display_order,
    placeholder: field.placeholder ?? null,
    validationRules: field.validation_rules ?? null,
    options,
    conditionalLogic: normalizeConditionalLogic(field.conditional_logic),
  });

  return {
    visa_type: visaType,
    field_name: field.field_name,
    label: field.label,
    field_type: field.field_type,
    required: field.required,
    step_number: field.step_number,
    step_name: field.step_name,
    display_order: field.display_order,
    placeholder: field.placeholder ?? null,
    validation_rules: normalized.validationRules,
    options: normalized.options,
    conditional_logic: normalized.conditionalLogic,
  };
}
