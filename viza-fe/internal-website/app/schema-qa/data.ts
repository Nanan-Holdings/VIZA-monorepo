import "server-only";

import { compileApplicationSchemaForUi } from "@/lib/application-schema-ui-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type WizardStep,
} from "@/types/visa-form-fields";

const DEFAULT_VISA_TYPE = "TR_E_VISA";

function buildSteps(rows: VisaFormFieldDbRow[]): WizardStep[] {
  const steps = new Map<number, WizardStep>();
  for (const row of rows) {
    const step = steps.get(row.step_number) ?? {
      stepNumber: row.step_number,
      stepName: row.step_name || `Step ${row.step_number}`,
      fields: [],
    };
    step.fields.push(dbRowToFormField(row));
    steps.set(row.step_number, step);
  }
  return [...steps.values()]
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .map((step) => ({
      ...step,
      fields: [...step.fields].sort((left, right) => left.displayOrder - right.displayOrder),
    }));
}

export async function loadSchemaQaPreview(requestedVisaType?: string | null): Promise<{
  visaType: string;
  visaTypes: string[];
  steps: WizardStep[];
}> {
  const supabase = createAdminClient();
  const visaTypes = new Set<string>();
  for (let offset = 0; offset < 20_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_form_fields")
      .select("visa_type")
      .order("visa_type")
      .range(offset, offset + 999);
    if (error) throw new Error(`Unable to list visa schemas: ${error.message}`);
    for (const row of data ?? []) visaTypes.add(row.visa_type);
    if ((data?.length ?? 0) < 1_000) break;
  }

  const requested = requestedVisaType?.trim();
  const visaType = requested && visaTypes.has(requested)
    ? requested
    : visaTypes.has(DEFAULT_VISA_TYPE)
      ? DEFAULT_VISA_TYPE
      : [...visaTypes][0];
  if (!visaType) throw new Error("No visa schemas are available for QA preview.");

  const { data, error } = await supabase
    .from("visa_form_fields")
    .select("*")
    .eq("visa_type", visaType)
    .order("step_number")
    .order("display_order");
  if (error) throw new Error(`Unable to load ${visaType}: ${error.message}`);
  const compiled = compileApplicationSchemaForUi(buildSteps((data ?? []) as VisaFormFieldDbRow[]));

  return {
    visaType,
    visaTypes: [...visaTypes].sort(),
    steps: compiled.steps,
  };
}
