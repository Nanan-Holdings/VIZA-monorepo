/**
 * Seed script: visa_form_fields for Indonesia B1 e-VoA.
 *
 * B1 and C1 are separate VIZA packages. B1 is still submitted through the
 * official Indonesia eVisa portal, but the user-facing VIZA intake hides
 * controls that the B1 official flow derives from passport/address parsing or
 * does not ask for.
 *
 * Official portal: https://evisa.imigrasi.go.id/
 *
 * Run: npx tsx scripts/seed-id-b1-evoa-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow } from "./bilingual-seed-row";
import {
  INDONESIA_OFFICIAL_EVISA_FIELDS,
  seedIndonesiaOfficialEVisaFields,
} from "./seed-indonesia-official-evisa-fields";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const B1_HIDDEN_OR_NOT_APPLICABLE_FIELDS = new Set([
  "passport_bio_page_upload",
  "formal_photo_upload",
  "document_travel_id",
  "passport_issue_date",
  "province_name",
  "city_name",
  "district_name",
  "village_name",
  "bank_statement_upload",
]);

seedIndonesiaOfficialEVisaFields({
  supabase,
  visaType: "ID_B1_EVOA",
  fields: INDONESIA_OFFICIAL_EVISA_FIELDS
    .filter((field) => !B1_HIDDEN_OR_NOT_APPLICABLE_FIELDS.has(field.field_name))
    .map((field) => toBilingualSeedRow("ID_B1_EVOA", field)),
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
