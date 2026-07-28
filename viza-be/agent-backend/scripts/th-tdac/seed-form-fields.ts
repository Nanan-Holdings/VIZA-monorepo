import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow } from "../bilingual-seed-row";
import { TH_TDAC_FORM_FIELDS, TH_TDAC_VISA_TYPE } from "./form-fields";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key);

async function seed() {
  // Preserve stable field IDs and avoid exposing an empty TDAC schema between
  // delete/insert requests while applicants may have the form open.
  const updatedAt = new Date().toISOString();
  const rows = TH_TDAC_FORM_FIELDS.map((field) => ({
    ...toBilingualSeedRow(TH_TDAC_VISA_TYPE, field),
    updated_at: updatedAt,
  }));
  for (let index = 0; index < rows.length; index += 20) {
    const { error } = await supabase
      .from("visa_form_fields")
      .upsert(rows.slice(index, index + 20), {
        onConflict: "visa_type,field_name",
      });
    if (error) throw error;
  }

  console.log(`Seeded ${rows.length} Thailand TDAC arrival-card fields.`);
}

void seed();
