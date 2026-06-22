import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow } from "../bilingual-seed-row";
import { SGAC_FORM_FIELDS, SGAC_VISA_TYPE } from "./form-fields";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key);

const DIALING_CODES = ["86", "65", "60", "66", "62", "91", "84", "63", "1", "81", "82", "44", "61"];

function splitInternationalPhone(value: string) {
  const digits = value.replace(/\D+/g, "");
  const countryCode = DIALING_CODES.find((code) => digits.startsWith(code));
  if (!countryCode) return null;
  const number = digits.slice(countryCode.length);
  return /^\d{6,15}$/.test(number) ? { countryCode, number } : null;
}

async function migrateLegacyAnswers() {
  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .select("id")
    .eq("visa_type", SGAC_VISA_TYPE);
  if (applicationsError) throw applicationsError;
  const applicationIds = (applications ?? []).map((application) => application.id);
  if (applicationIds.length === 0) return;

  const { data: rows, error: rowsError } = await supabase
    .from("visa_application_answers")
    .select("application_id, field_name, value_text")
    .in("application_id", applicationIds);
  if (rowsError) throw rowsError;

  const byApplication = new Map<string, Record<string, string>>();
  for (const row of rows ?? []) {
    if (!row.value_text) continue;
    const answers = byApplication.get(row.application_id) ?? {};
    answers[row.field_name] = row.value_text;
    byApplication.set(row.application_id, answers);
  }

  const now = new Date().toISOString();
  const migratedRows: Array<{ application_id: string; field_name: string; value_text: string; updated_at: string }> = [];
  for (const [applicationId, answers] of byApplication) {
    const set = (fieldName: string, value: string | undefined) => {
      if (!value || answers[fieldName] === value) return;
      migratedRows.push({ application_id: applicationId, field_name: fieldName, value_text: value, updated_at: now });
    };

    if (!answers.full_name) {
      set("full_name", [answers.surname, answers.given_names].filter(Boolean).join(" "));
    }
    if (!answers.place_of_birth_country) {
      set("place_of_birth_country", answers.date_of_birth_country);
    }
    if (answers.recent_country_visit_history === "none") {
      set("recent_country_visit_history", "no");
    }
    if (answers.mode_of_travel === "air" && !answers.air_transport_type) {
      set("air_transport_type", "commercial");
    }
    if (!answers.mobile_country_code && answers.mobile_number?.startsWith("+")) {
      const phone = splitInternationalPhone(answers.mobile_number);
      if (phone) {
        set("mobile_country_code", phone.countryCode);
        set("mobile_number", phone.number);
      }
    }
  }

  if (migratedRows.length > 0) {
    const { error } = await supabase
      .from("visa_application_answers")
      .upsert(migratedRows, { onConflict: "application_id,field_name" });
    if (error) throw error;
  }
}

async function seed() {
  const { error: deleteError } = await supabase.from("visa_form_fields").delete().eq("visa_type", SGAC_VISA_TYPE);
  if (deleteError) throw deleteError;

  const rows = SGAC_FORM_FIELDS.map((field) => toBilingualSeedRow(SGAC_VISA_TYPE, field));
  for (let index = 0; index < rows.length; index += 20) {
    const { error } = await supabase.from("visa_form_fields").insert(rows.slice(index, index + 20));
    if (error) throw error;
  }
  await migrateLegacyAnswers();
  console.log(`Seeded ${rows.length} ICA-aligned SGAC fields.`);
}

void seed();
