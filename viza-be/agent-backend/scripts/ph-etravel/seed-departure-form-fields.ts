import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow } from "../bilingual-seed-row";
import {
  PH_ETRAVEL_DEPARTURE_FORM_FIELDS,
  PH_ETRAVEL_DEPARTURE_VISA_TYPE,
} from "./departure-form-fields";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key);

async function seed() {
  const { error: deleteError } = await supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", PH_ETRAVEL_DEPARTURE_VISA_TYPE);
  if (deleteError) throw deleteError;

  const rows = PH_ETRAVEL_DEPARTURE_FORM_FIELDS.map((field) =>
    toBilingualSeedRow(PH_ETRAVEL_DEPARTURE_VISA_TYPE, field),
  );
  for (let index = 0; index < rows.length; index += 20) {
    const { error } = await supabase.from("visa_form_fields").insert(rows.slice(index, index + 20));
    if (error) throw error;
  }
  console.log(`Seeded ${rows.length} Philippines eTravel departure-card fields.`);
}

void seed();
