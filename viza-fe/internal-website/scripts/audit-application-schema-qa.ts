import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeBilingualFormField, normalizeBilingualWizardSteps } from "@/lib/bilingual-schema-contract";
import { evaluateShowIf, isRequiredUnlessSatisfied } from "@/lib/form-utils";
import { getDs160CeacMissingFields } from "@/lib/application-tab-completion";
import { augmentThailandTouristEVisaSteps } from "@/lib/thailand-tourist-evisa-form-overrides";
import { augmentVietnamEVisaOfficialParitySteps } from "@/lib/vietnam-evisa-form-parity";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type VisaFormFieldRow,
  type WizardStep,
} from "@/types/visa-form-fields";

type ApplicationRow = {
  id: string;
  country: string;
  visa_type: string;
  created_at: string;
};

function readLocalEnv() {
  const values: Record<string, string> = {};
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    values[trimmed.slice(0, separator)] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function readArgument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim();
}

function hasValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized !== "" && normalized !== "[]" && normalized !== "{}";
}

function repeatKey(fieldName: string, index: number) {
  return index === 0 ? fieldName : `${fieldName}__${index}`;
}

function fieldIsComplete(field: VisaFormFieldRow, answers: Record<string, string>) {
  const rules = field.validationRules as { repeat_group?: string; max_items?: number } | null;
  if (!rules?.repeat_group) return hasValue(answers[field.fieldName]);
  const maxItems = typeof rules.max_items === "number" && rules.max_items > 0 ? rules.max_items : 1;
  return Array.from({ length: maxItems }, (_, index) => repeatKey(field.fieldName, index)).some((key) =>
    hasValue(answers[key]),
  );
}

function buildSteps(visaType: string, rows: VisaFormFieldDbRow[]) {
  const stepMap = new Map<number, WizardStep>();
  for (const row of rows) {
    const step = stepMap.get(row.step_number) ?? {
      stepNumber: row.step_number,
      stepName: row.step_name || `Step ${row.step_number}`,
      fields: [],
    };
    step.fields.push(normalizeBilingualFormField(dbRowToFormField(row)));
    stepMap.set(row.step_number, step);
  }
  const base = [...stepMap.values()].sort((a, b) => a.stepNumber - b.stepNumber);
  const vietnamPatched = visaType === "VN_E_VISA" ? augmentVietnamEVisaOfficialParitySteps(base) : base;
  const patched = visaType === "TH_TOURIST_E_VISA"
    ? augmentThailandTouristEVisaSteps(vietnamPatched)
    : vietnamPatched;
  return visaType === "VN_E_VISA" ? normalizeBilingualWizardSteps(patched) : patched;
}

async function main() {
  const applicantId = readArgument("applicant-id");
  const createdAfter = readArgument("created-after");
  if (!applicantId || !createdAfter) {
    throw new Error(
      "Usage: npm run qa:audit-schema-drafts -- --applicant-id=<id> --created-after=<ISO timestamp>",
    );
  }

  const env = readLocalEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: applicationRows, error: applicationError } = await supabase
    .from("applications")
    .select("id,country,visa_type,created_at")
    .eq("applicant_id", applicantId)
    .eq("purpose", "VIZA_PLACEHOLDER_DRY_RUN")
    .gte("created_at", createdAfter)
    .order("created_at", { ascending: false });
  if (applicationError) throw new Error(applicationError.message);

  const latestByVisaType = new Map<string, ApplicationRow>();
  for (const row of (applicationRows ?? []) as ApplicationRow[]) {
    if (!latestByVisaType.has(row.visa_type)) latestByVisaType.set(row.visa_type, row);
  }
  const applications = [...latestByVisaType.values()];
  if (applications.length === 0) throw new Error("No matching dry-run QA drafts were found");

  const visaTypes = applications.map((application) => application.visa_type);
  const formRows: VisaFormFieldDbRow[] = [];
  for (let offset = 0; offset < 10_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_form_fields")
      .select("*")
      .in("visa_type", visaTypes)
      .order("visa_type")
      .order("step_number")
      .order("display_order")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    formRows.push(...((data ?? []) as VisaFormFieldDbRow[]));
    if ((data?.length ?? 0) < 1_000) break;
  }

  const applicationIds = applications.map((application) => application.id);
  const answerRows: Array<{ application_id: string; field_name: string; value_text: string }> = [];
  for (let offset = 0; offset < 10_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_application_answers")
      .select("application_id,field_name,value_text")
      .in("application_id", applicationIds)
      .order("application_id")
      .order("field_name")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    answerRows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1_000) break;
  }

  const report = applications
    .map((application) => {
      const answers = Object.fromEntries(
        answerRows
          .filter((row) => row.application_id === application.id)
          .map((row) => [row.field_name, row.value_text ?? ""]),
      );
      const steps = buildSteps(
        application.visa_type,
        formRows.filter((row) => row.visa_type === application.visa_type),
      );
      const missing = steps.flatMap((step) =>
        step.fields
          .filter(
            (field) =>
              field.required &&
              !isRequiredUnlessSatisfied(field, answers) &&
              evaluateShowIf(field, answers, step.fields) &&
              !fieldIsComplete(field, answers),
          )
          .map((field) => ({
            step: step.stepName,
            fieldName: field.fieldName,
            label: field.label,
            fieldType: field.fieldType,
            options: field.options?.slice(0, 12).map((option) =>
              typeof option === "string" ? option : option.value,
            ) ?? [],
          })),
      );
      const ds160Missing = application.visa_type === "DS160"
        ? getDs160CeacMissingFields(steps, steps.map((_, index) => index), answers).map((field) => ({
            step: field.stepName,
            fieldName: field.fieldName,
            label: field.label,
            fieldType: "ceac_required",
            options: [] as string[],
          }))
        : [];
      const dedupedMissing = [
        ...new Map([...missing, ...ds160Missing].map((field) => [field.fieldName, field])).values(),
      ];
      return {
        country: application.country,
        visaType: application.visa_type,
        applicationId: application.id,
        schemaFields: steps.reduce((total, step) => total + step.fields.length, 0),
        savedAnswers: Object.keys(answers).length,
        missingRequiredCount: dedupedMissing.length,
        missingRequired: dedupedMissing,
      };
    })
    .sort((a, b) => a.visaType.localeCompare(b.visaType));

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
