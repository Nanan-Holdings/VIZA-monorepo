import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { VisaFormFieldDbRow } from "@/types/visa-form-fields";

import {
  buildApplicationSchemaEdgeCaseCatalog,
  type ApplicationSchemaEdgeCaseCatalog,
} from "./catalog";

export async function loadApplicationSchemaEdgeCaseCatalog(): Promise<ApplicationSchemaEdgeCaseCatalog> {
  const supabase = createAdminClient();
  const rows: VisaFormFieldDbRow[] = [];

  for (let offset = 0; offset < 20_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_form_fields")
      .select("*")
      .order("visa_type")
      .order("step_number")
      .order("display_order")
      .range(offset, offset + 999);

    if (error) throw new Error(`Unable to load the application schema: ${error.message}`);
    rows.push(...((data ?? []) as VisaFormFieldDbRow[]));
    if ((data?.length ?? 0) < 1_000) break;
  }

  if (rows.length === 0) throw new Error("No visa form fields were found in the master schema.");
  return buildApplicationSchemaEdgeCaseCatalog(rows);
}
