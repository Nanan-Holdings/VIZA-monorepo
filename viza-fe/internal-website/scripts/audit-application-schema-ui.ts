import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  APPLICATION_SCHEMA_UI_COMPONENTS,
  compileApplicationSchemaForUi,
  type ApplicationSchemaUiIssue,
} from "@/lib/application-schema-ui-contract";
import {
  hasFieldSpecificExplanation,
  isFormAssistantConfirmationField,
} from "@/lib/form-assistant/constants";
import { shouldUseRagVisitorIntakeFallback } from "@/lib/rag-visitor-intake-form";
import { SEARCHABLE_VISA_DESTINATIONS } from "@/lib/visa-destinations";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type VisaFormFieldRow,
  type WizardStep,
} from "@/types/visa-form-fields";
import {
  normalizeBilingualFormField,
  normalizeBilingualWizardSteps,
} from "@/lib/bilingual-schema-contract";
import { augmentThailandTouristEVisaSteps } from "@/lib/thailand-tourist-evisa-form-overrides";
import { augmentVietnamEVisaOfficialParitySteps } from "@/lib/vietnam-evisa-form-parity";

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

function buildSteps(rows: VisaFormFieldDbRow[]): WizardStep[] {
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
  return [...stepMap.values()]
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((step) => ({
      ...step,
      fields: [...step.fields].sort((a, b) => a.displayOrder - b.displayOrder),
    }));
}

function applyRuntimeSchemaPatches(steps: WizardStep[], visaType: string): WizardStep[] {
  const vietnamPatched = visaType === "VN_E_VISA"
    ? augmentVietnamEVisaOfficialParitySteps(steps)
    : steps;
  const countryPatched = visaType === "TH_TOURIST_E_VISA"
    ? augmentThailandTouristEVisaSteps(vietnamPatched)
    : vietnamPatched;
  return visaType === "VN_E_VISA"
    ? normalizeBilingualWizardSteps(countryPatched)
    : countryPatched;
}

function formatIssue(issue: ApplicationSchemaUiIssue) {
  const fields = issue.fieldNames.join(", ");
  const steps = issue.stepNumbers.join(", ");
  return [
    `  [${issue.severity.toUpperCase()}] ${issue.code}: ${fields} (step ${steps})`,
    `    ${issue.message}`,
    `    Guidance: ${issue.guidance}`,
  ].join("\n");
}

function assistantCoverage(steps: WizardStep[]) {
  const fields = steps.flatMap((step) => step.fields);
  const hasHelper = (field: VisaFormFieldRow) => [
    field.validationRules?.helper_en,
    field.validationRules?.helper_zh,
  ].some((value) => typeof value === "string" && value.trim());
  return {
    fields: fields.length,
    confirmations: fields.filter(isFormAssistantConfirmationField).length,
    uploads: fields.filter((field) => field.fieldType === "file").length,
    semanticExplanations: fields.filter(hasFieldSpecificExplanation).length,
    schemaHelpers: fields.filter(hasHelper).length,
  };
}

async function main() {
  const visaTypeFilter = readArgument("visa-type");
  const strict = process.argv.includes("--strict");
  const json = process.argv.includes("--json");
  const summaryOnly = process.argv.includes("--summary");
  const assistantSummary = process.argv.includes("--assistant");
  const env = readLocalEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service-role key in .env.local");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows: VisaFormFieldDbRow[] = [];
  for (let offset = 0; offset < 20_000; offset += 1_000) {
    let query = supabase
      .from("visa_form_fields")
      .select("*")
      .order("visa_type")
      .order("step_number")
      .order("display_order")
      .range(offset, offset + 999);
    if (visaTypeFilter) query = query.eq("visa_type", visaTypeFilter);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as VisaFormFieldDbRow[]));
    if ((data?.length ?? 0) < 1_000) break;
  }
  if (rows.length === 0) throw new Error(`No visa_form_fields rows found${visaTypeFilter ? ` for ${visaTypeFilter}` : ""}`);

  const rowsByVisaType = new Map<string, VisaFormFieldDbRow[]>();
  for (const row of rows) {
    rowsByVisaType.set(row.visa_type, [...(rowsByVisaType.get(row.visa_type) ?? []), row]);
  }
  const compiledByVisaType = [...rowsByVisaType.entries()]
    .map(([visaType, visaRows]) => {
      const steps = applyRuntimeSchemaPatches(buildSteps(visaRows), visaType);
      return {
        visaType,
        report: compileApplicationSchemaForUi(steps).report,
        assistant: assistantCoverage(steps),
      };
    })
    .sort((a, b) => a.visaType.localeCompare(b.visaType));
  const reports = compiledByVisaType.map((item) => item.report);
  const selectableProducts = SEARCHABLE_VISA_DESTINATIONS.filter((destination) => destination.kind !== "group");
  const catalogueCoverage = selectableProducts.map((destination) => {
    const schemaVisaType = resolveVisaFormSchemaVisaType(destination.visaType, destination.country);
    return {
      ...destination,
      schemaVisaType,
      source: rowsByVisaType.has(schemaVisaType)
        ? "database"
        : shouldUseRagVisitorIntakeFallback(schemaVisaType)
          ? "reviewed-fallback"
          : "missing",
    };
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
  } else {
    const totals = reports.reduce(
      (current, report) => ({
        fields: current.fields + report.fieldCount,
        errors: current.errors + report.summary.errors,
        warnings: current.warnings + report.summary.warnings,
        guidance: current.guidance + report.summary.guidance,
        designEdgeCases: current.designEdgeCases + report.summary.designEdgeCases,
      }),
      { fields: 0, errors: 0, warnings: 0, guidance: 0, designEdgeCases: 0 },
    );
    const issueCounts = reports
      .flatMap((report) => report.issues)
      .reduce<Record<string, number>>((counts, issue) => ({
        ...counts,
        [issue.code]: (counts[issue.code] ?? 0) + 1,
      }), {});
    process.stdout.write(
      `Application schema/UI audit: ${reports.length} visa types, ${totals.fields} fields\n` +
      `Errors: ${totals.errors}; warnings: ${totals.warnings}; guidance: ${totals.guidance}; design edge cases: ${totals.designEdgeCases}\n` +
      `Issue counts: ${Object.entries(issueCounts).sort(([a], [b]) => a.localeCompare(b)).map(([code, count]) => `${code}=${count}`).join(", ")}\n\n`,
    );
    if (assistantSummary) {
      const databaseProducts = catalogueCoverage.filter((product) => product.source === "database").length;
      const fallbackProducts = catalogueCoverage.filter((product) => product.source === "reviewed-fallback").length;
      const missingProducts = catalogueCoverage.filter((product) => product.source === "missing");
      process.stdout.write(
        `Assistant catalogue coverage: ${catalogueCoverage.length} selectable products across ` +
        `${new Set(catalogueCoverage.map((product) => product.country)).size} countries; ` +
        `database=${databaseProducts}, reviewed fallback=${fallbackProducts}, missing=${missingProducts.length}\n`,
      );
      if (missingProducts.length > 0) {
        process.stdout.write(
          `  Missing assistant schemas: ${missingProducts.map((product) => `${product.country}/${product.visaType}`).join(", ")}\n`,
        );
      }
      process.stdout.write("\n");
    }

    for (const report of reports) {
      const usedComponents = APPLICATION_SCHEMA_UI_COMPONENTS
        .filter((component) => report.componentUsage[component] > 0)
        .map((component) => `${component}=${report.componentUsage[component]}`)
        .join(", ");
      process.stdout.write(
        `${report.visaType}: ${report.fieldCount} fields; ` +
        `${report.summary.errors} errors, ${report.summary.warnings} warnings, ` +
        `${report.summary.guidance} guidance\n  Components: ${usedComponents}\n`,
      );
      if (assistantSummary) {
        const coverage = compiledByVisaType.find((item) => item.visaType === report.visaType)!.assistant;
        process.stdout.write(
          `  Assistant: confirmations=${coverage.confirmations}, uploads=${coverage.uploads}, ` +
          `semantic explanations=${coverage.semanticExplanations}, schema helpers=${coverage.schemaHelpers}\n`,
        );
      }
      if (!summaryOnly) {
        for (const issue of report.issues) process.stdout.write(`${formatIssue(issue)}\n`);
      }
      process.stdout.write("\n");
    }
  }

  if (strict && reports.some((report) => report.summary.errors > 0)) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
