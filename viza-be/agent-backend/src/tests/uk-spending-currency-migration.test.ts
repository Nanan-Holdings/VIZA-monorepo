import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../drizzle/0227_uk_spending_currency_gbp.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20261126170000_uk_spending_currency_gbp.sql",
    import.meta.url,
  ),
);
const seedPath = fileURLToPath(
  new URL("../../scripts/seed-uk-standard-visitor-form-fields.ts", import.meta.url),
);

describe("UK GBP spending field contract", () => {
  it("keeps the frontend migration mirror byte-identical", () => {
    expect(readFileSync(mirrorPath)).toEqual(readFileSync(migrationPath));
  });

  it("limits both spending currency choices to GBP and labels amounts in GBP", () => {
    const seed = readFileSync(seedPath, "utf8");
    const migration = readFileSync(migrationPath, "utf8");
    expect(seed).toContain("planned_spend_currency");
    expect(seed).toContain("monthly_outgoings_currency");
    expect(migration.match(/options = '\[\{"value":"GBP"/gu)).toHaveLength(2);
    expect(migration).toContain("Provide the amount in Pounds Sterling (GBP).");
    expect(migration).not.toMatch(/\b(?:CNY|USD|EUR)\b/u);
  });

  it("changes only schema metadata and leaves applicant answers untouched", () => {
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).not.toMatch(/visa_application_answers/i);
    expect(migration.match(/UPDATE public\.visa_form_fields/gu)).toHaveLength(4);
  });
});
