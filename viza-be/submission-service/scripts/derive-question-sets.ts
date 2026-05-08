/**
 * Derive question sets per (country, visa_type) (PROD-001).
 *
 * For each registered country, reads:
 *   - canonical answer keys from `src/<cc>/runner.ts` (CanonicalAnswers interface)
 *   - per-field label/required hints from the latest BOT-001 recon walk
 *     (`recon-out/<date>/<cc>/selectors.json`)
 *
 * and emits a JSON snapshot under `db/seeds/question-sets/<country>.json`.
 * If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, upserts into
 * `question_set` + `question_field` tables (migration 0069).
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node scripts/derive-question-sets.ts
 *   QSET_DRY=1 to skip Supabase upsert
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

interface BranchRule {
  when: { field: string; equals: string };
}

interface CountryConfig {
  code: string;
  country: string;
  visaType: string;
  reconSubdir: string;
  /** Canonical answer keys + a default widget type. */
  fields: Array<{
    name: string;
    widget: string;
    required?: boolean;
    label?: string;
    options?: Array<{ value: string; text: string }>;
    branch?: BranchRule;
  }>;
}

const ROSTER: CountryConfig[] = [
  {
    code: "kh",
    country: "KH",
    visaType: "tourist_evisa",
    reconSubdir: "kh",
    fields: [
      { name: "surname", widget: "text", required: true },
      { name: "given_names", widget: "text", required: true },
      { name: "date_of_birth", widget: "date", required: true },
      { name: "nationality", widget: "select", required: true },
      { name: "passport_number", widget: "text", required: true },
      { name: "passport_expiry_date", widget: "date", required: true },
      { name: "passport_issuing_country", widget: "select", required: true },
      { name: "email", widget: "email", required: true },
      { name: "phone", widget: "tel", required: true },
      { name: "visa_purpose", widget: "select", required: true },
    ],
  },
  {
    code: "la",
    country: "LA",
    visaType: "tourist_evisa",
    reconSubdir: "la",
    fields: [
      { name: "surname", widget: "text", required: true },
      { name: "given_names", widget: "text", required: true },
      { name: "date_of_birth", widget: "date", required: true },
      { name: "nationality", widget: "select", required: true },
      { name: "passport_number", widget: "text", required: true },
      { name: "passport_expiry_date", widget: "date", required: true },
      { name: "email", widget: "email", required: true },
      { name: "phone", widget: "tel", required: true },
      { name: "intended_arrival_date", widget: "date", required: true },
      { name: "port_of_entry", widget: "select", required: true },
      { name: "occupation", widget: "text", required: true },
    ],
  },
  {
    code: "lk",
    country: "LK",
    visaType: "eta",
    reconSubdir: "lk",
    fields: [
      { name: "surname", widget: "text", required: true },
      { name: "given_names", widget: "text", required: true },
      { name: "date_of_birth", widget: "date", required: true },
      { name: "nationality", widget: "select", required: true },
      { name: "passport_number", widget: "text", required: true },
      { name: "passport_expiry_date", widget: "date", required: true },
      { name: "email", widget: "email", required: true },
      { name: "phone", widget: "tel", required: true },
      { name: "intended_arrival_date", widget: "date", required: true },
      { name: "port_of_arrival", widget: "select", required: true },
      { name: "occupation", widget: "text", required: true },
      { name: "address_in_sri_lanka", widget: "textarea", required: true },
      {
        name: "visa_variant",
        widget: "select",
        required: true,
        options: [
          { value: "tourist_double", text: "Tourist (double entry)" },
          { value: "transit", text: "Transit" },
          { value: "business", text: "Business" },
        ],
      },
    ],
  },
  {
    code: "za",
    country: "ZA",
    visaType: "tourist_evisa",
    reconSubdir: "za",
    fields: [
      { name: "surname", widget: "text", required: true },
      { name: "given_names", widget: "text", required: true },
      { name: "date_of_birth", widget: "date", required: true },
      { name: "nationality", widget: "select", required: true },
      { name: "passport_number", widget: "text", required: true },
      { name: "passport_expiry_date", widget: "date", required: true },
      { name: "passport_issuing_country", widget: "select", required: true },
      { name: "email", widget: "email", required: true },
      { name: "phone", widget: "tel", required: true },
      { name: "intended_arrival_date", widget: "date", required: true },
      { name: "intended_departure_date", widget: "date", required: true },
      { name: "purpose_of_visit", widget: "select", required: true },
      { name: "occupation", widget: "text", required: true },
    ],
  },
  {
    code: "in",
    country: "IN",
    visaType: "tourist_evisa",
    reconSubdir: "in",
    fields: [
      { name: "surname", widget: "text", required: true },
      { name: "given_names", widget: "text", required: true },
      { name: "date_of_birth", widget: "date", required: true },
      { name: "nationality", widget: "select", required: true },
      { name: "passport_number", widget: "text", required: true },
      { name: "passport_expiry_date", widget: "date", required: true },
      { name: "email", widget: "email", required: true },
      { name: "phone", widget: "tel", required: true },
      {
        name: "visa_purpose",
        widget: "select",
        required: true,
        options: [
          { value: "tourism", text: "Tourism" },
          { value: "business", text: "Business" },
          { value: "medical", text: "Medical" },
          { value: "conference", text: "Conference" },
        ],
      },
      { name: "intended_arrival_date", widget: "date", required: true },
      { name: "port_of_arrival", widget: "select", required: true },
      {
        name: "hospital_name",
        widget: "text",
        required: true,
        branch: { when: { field: "visa_purpose", equals: "medical" } },
      },
      {
        name: "conference_name",
        widget: "text",
        required: true,
        branch: { when: { field: "visa_purpose", equals: "conference" } },
      },
    ],
  },
];

interface FieldCapture {
  field_id?: string;
  field_name?: string;
  label: string;
  field_type: string;
  required: boolean;
  options?: Array<{ value: string; text: string }>;
}

async function loadReconHints(reconSubdir: string): Promise<Record<string, FieldCapture>> {
  const reconRoot = path.resolve(__dirname, "..", "recon-out");
  let buckets: string[] = [];
  try {
    buckets = (await fs.readdir(reconRoot))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  } catch {
    return {};
  }
  for (const date of buckets.reverse()) {
    const p = path.join(reconRoot, date, reconSubdir, "selectors.json");
    try {
      const raw = await fs.readFile(p, "utf8");
      const arr = JSON.parse(raw) as FieldCapture[];
      const map: Record<string, FieldCapture> = {};
      for (const f of arr) {
        const key = (f.field_name || f.field_id || "").toLowerCase();
        if (key && !map[key]) map[key] = f;
      }
      return map;
    } catch {
      continue;
    }
  }
  return {};
}

function titleCase(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

interface DerivedField {
  field_name: string;
  label: string;
  widget_type: string;
  required: boolean;
  options?: Array<{ value: string; text: string }>;
  branch?: BranchRule;
  ordinal: number;
}

interface DerivedQuestionSet {
  country: string;
  visa_type: string;
  version: string;
  derived_from: string;
  fields: DerivedField[];
}

async function deriveOne(cfg: CountryConfig): Promise<DerivedQuestionSet> {
  const recon = await loadReconHints(cfg.reconSubdir);
  const fields: DerivedField[] = cfg.fields.map((f, idx) => {
    const hint = recon[f.name];
    return {
      field_name: f.name,
      label: f.label || hint?.label || titleCase(f.name),
      widget_type: f.widget,
      required: f.required ?? hint?.required ?? false,
      options: f.options || hint?.options,
      branch: f.branch,
      ordinal: idx,
    };
  });
  return {
    country: cfg.country,
    visa_type: cfg.visaType,
    version: "v1",
    derived_from: `runner:src/${cfg.code}/runner.ts + recon-out/<latest>/${cfg.reconSubdir}`,
    fields,
  };
}

async function writeSnapshot(repoRoot: string, qset: DerivedQuestionSet): Promise<string> {
  const outDir = path.join(repoRoot, "db", "seeds", "question-sets");
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${qset.country.toLowerCase()}.json`);
  await fs.writeFile(file, JSON.stringify(qset, null, 2), "utf8");
  return file;
}

async function upsertSupabase(qset: DerivedQuestionSet): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(`[${qset.country}] supabase env not set — skipping upsert`);
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: setRow, error: setErr } = await supabase
    .from("question_set")
    .upsert(
      {
        country: qset.country,
        visa_type: qset.visa_type,
        version: qset.version,
        derived_from: qset.derived_from,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "country,visa_type,version" },
    )
    .select("id")
    .single();
  if (setErr || !setRow) {
    throw new Error(`question_set upsert failed: ${setErr?.message}`);
  }
  await supabase.from("question_field").delete().eq("question_set_id", setRow.id);
  const rows = qset.fields.map((f) => ({
    question_set_id: setRow.id,
    field_name: f.field_name,
    label: f.label,
    widget_type: f.widget_type,
    required: f.required,
    options: f.options ?? null,
    branch: f.branch ?? null,
    ordinal: f.ordinal,
  }));
  const { error: insErr } = await supabase.from("question_field").insert(rows);
  if (insErr) {
    throw new Error(`question_field insert failed: ${insErr.message}`);
  }
  console.log(`[${qset.country}] upserted ${rows.length} fields → question_set ${setRow.id}`);
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const dryRun = process.env.QSET_DRY === "1";
  for (const cfg of ROSTER) {
    const qset = await deriveOne(cfg);
    const file = await writeSnapshot(repoRoot, qset);
    console.log(`[${cfg.country}] ${qset.fields.length} fields → ${path.relative(repoRoot, file)}`);
    if (!dryRun) {
      await upsertSupabase(qset);
    }
  }
  console.log(`\n[derive-question-sets] done — ${ROSTER.length} countries`);
}

main().catch((err) => {
  console.error("[derive-question-sets] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
