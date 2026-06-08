/**
 * Types for DB-driven visa application wizard
 */

export type VisaFormFieldOption =
  | string
  | {
      value: string;
      text?: string;
      label_zh?: string;
      label_en?: string;
      official_label?: string;
    };

export interface VisaFormFieldRow {
  id: string;
  visaType: string;
  fieldName: string;
  label: string;
  fieldType: "text" | "select" | "date" | "file" | "radio" | "checkbox" | "textarea" | "country";
  required: boolean;
  stepNumber: number;
  stepName: string | null;
  displayOrder: number;
  placeholder: string | null;
  validationRules: Record<string, unknown> | null;
  options: VisaFormFieldOption[] | null;
  conditionalLogic: Record<string, unknown> | null;
}

export interface WizardStep {
  stepNumber: number;
  stepName: string;
  fields: VisaFormFieldRow[];
}

// Supabase DB row shape (snake_case)
export interface VisaFormFieldDbRow {
  id: string;
  visa_type: string;
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string | null;
  display_order: number;
  placeholder: string | null;
  validation_rules: Record<string, unknown> | null;
  options: unknown | null;
  conditional_logic: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export function dbRowToFormField(row: VisaFormFieldDbRow): VisaFormFieldRow {
  return {
    id: row.id,
    visaType: row.visa_type,
    fieldName: row.field_name,
    label: row.label,
    fieldType: row.field_type as VisaFormFieldRow["fieldType"],
    required: row.required,
    stepNumber: row.step_number,
    stepName: row.step_name,
    displayOrder: row.display_order,
    placeholder: row.placeholder,
    validationRules: row.validation_rules,
    options: row.options as VisaFormFieldRow["options"],
    conditionalLogic: row.conditional_logic,
  };
}
