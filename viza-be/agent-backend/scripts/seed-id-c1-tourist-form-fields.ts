/**
 * Seed script: visa_form_fields for Indonesia C1 Tourist Single Entry Visa.
 *
 * This mirrors the official Indonesia eVisa portal controls observed in the
 * live C1 flow:
 *   1. Fill personal information, passport information, Indonesia stay
 *      address, and payment method.
 *   2. Review declarations and submit.
 *
 * Passport, photo, and the C1 financial statement are intentionally managed
 * in VIZA Document Center. This prevents duplicate upload screens while
 * preserving the official portal's required file constraints.
 *
 * Official portal: https://evisa.imigrasi.go.id/
 *
 * Run: npx tsx scripts/seed-id-c1-tourist-form-fields.ts
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

const C1_DOCUMENT_CENTER_FIELDS = new Set([
  "passport_bio_page_upload",
  "formal_photo_upload",
  "bank_statement_upload",
]);

seedIndonesiaOfficialEVisaFields({
  supabase,
  visaType: "ID_C1_TOURIST",
  fields: INDONESIA_OFFICIAL_EVISA_FIELDS
    .filter((field) => !C1_DOCUMENT_CENTER_FIELDS.has(field.field_name))
    .map((field) => toBilingualSeedRow("ID_C1_TOURIST", field)),
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
