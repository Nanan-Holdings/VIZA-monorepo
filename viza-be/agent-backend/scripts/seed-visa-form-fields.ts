/**
 * Seed script: visa_form_fields
 * Reads scraped form fields JSON and upserts into Supabase.
 * Run with: npm run seed:form-fields
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const JSON_PATH = path.resolve(__dirname, "../../../knowledge-base/scraped-form-fields.json");

interface ScrapedField {
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
  conditional_logic?: string | null;
}

interface ScrapedJSON {
  fields: ScrapedField[];
}

async function seed() {
  console.log("Starting visa_form_fields seed...\n");

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`JSON not found: ${JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  const data: ScrapedJSON = JSON.parse(raw);
  const fields = data.fields;

  console.log(`Found ${fields.length} fields to seed\n`);

  const rows = fields.map((f, idx) => {
    let options: unknown = f.options;
    // Strip UUID values from country list - just keep text labels to avoid bloat
    if (f.field_name === "selectCountry" && Array.isArray(f.options) && f.options.length > 10) {
      options = (f.options as Array<{value?: string; text?: string} | string>).map(o =>
        typeof o === "object" && o !== null && "text" in o ? (o as {text: string}).text : o
      );
    }

    return {
      visa_type: "B211A",
      field_name: f.field_name,
      label: f.label || f.field_name,
      field_type: f.field_type,
      required: f.required ?? false,
      step_number: f.step_number,
      step_name: f.step_name || `Step ${f.step_number}`,
      display_order: f.display_order ?? idx + 1,
      placeholder: f.placeholder ?? null,
      validation_rules: f.validation_rules ?? null,
      options: options ?? null,
      conditional_logic: f.conditional_logic ? { description: f.conditional_logic } : null,
    };
  });

  const BATCH = 10;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, data: result } = await supabase
      .from("visa_form_fields")
      .upsert(batch, { onConflict: "visa_type,field_name", ignoreDuplicates: false })
      .select("id, field_name");

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      inserted += result?.length ?? batch.length;
      console.log(`Batch ${Math.floor(i / BATCH) + 1}: ${result?.length ?? batch.length} upserted`);
    }
  }

  console.log(`\nDone: ${inserted} fields seeded`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
