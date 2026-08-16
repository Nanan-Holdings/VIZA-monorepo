import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  APPLICATION_SCHEMA_UI_COMPONENTS,
  compileApplicationSchemaForUi,
  type ApplicationSchemaUiIssue,
} from "@/lib/application-schema-ui-contract";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type WizardStep,
} from "@/types/visa-form-fields";

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
    step.fields.push(dbRowToFormField(row));
    stepMap.set(row.step_number, step);
  }
  return [...stepMap.values()]
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((step) => ({
      ...step,
      fields: [...step.fields].sort((a, b) => a.displayOrder - b.displayOrder),
    }));
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

async function main() {
  const visaTypeFilter = readArgument("visa-type");
  const strict = process.argv.includes("--strict");
  const json = process.argv.includes("--json");
  const summaryOnly = process.argv.includes("--summary");
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
  const reports = [...rowsByVisaType.entries()]
    .map(([, visaRows]) => compileApplicationSchemaForUi(buildSteps(visaRows)).report)
    .sort((a, b) => a.visaType.localeCompare(b.visaType));

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
