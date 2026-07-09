/**
 * Seed script: visa_form_fields for Indonesia B1 e-VoA.
 *
 * B1 and C1 are separate VIZA packages, but both are submitted through the
 * official Indonesia eVisa portal and share the same applicant form controls.
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

seedIndonesiaOfficialEVisaFields({
  supabase,
  visaType: "ID_B1_EVOA",
  fields: INDONESIA_OFFICIAL_EVISA_FIELDS.map((field) =>
    toBilingualSeedRow("ID_B1_EVOA", field),
  ),
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
