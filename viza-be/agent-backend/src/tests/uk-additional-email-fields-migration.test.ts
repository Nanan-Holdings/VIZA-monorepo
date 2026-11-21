import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../drizzle/0219_uk_additional_email_fields.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20261121150000_uk_additional_email_fields.sql",
    import.meta.url,
  ),
);
const seedPath = fileURLToPath(
  new URL("../../scripts/seed-uk-standard-visitor-form-fields.ts", import.meta.url),
);

describe("UK additional email schema migration", () => {
  it("ships a byte-identical frontend Supabase mirror", () => {
    expect(readFileSync(mirrorPath)).toEqual(readFileSync(migrationPath));
  });

  it("keeps the seed and migration on the same canonical field contract", () => {
    const seed = readFileSync(seedPath, "utf8");
    const migration = readFileSync(migrationPath, "utf8");

    expect(seed).toMatch(
      /field_name: "has_alternative_email"[\s\S]*?required: true[\s\S]*?display_order: 2[\s\S]*?options: YES_NO/,
    );
    expect(seed).toMatch(
      /field_name: "alternative_email_address"[\s\S]*?required: true[\s\S]*?display_order: 3[\s\S]*?showIf: "has_alternative_email === yes"/,
    );
    expect(migration).toContain("'has_alternative_email'");
    expect(migration).toContain("'alternative_email_address'");
    expect(migration).toContain("has_alternative_email === yes");
    expect(migration).toContain("label_zh");
    expect(migration).toContain("ON CONFLICT (visa_type, field_name) DO UPDATE");
  });

  it("shifts the legacy contact rows at most once and preserves answers", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toMatch(
      /field_name = 'phone_number'[\s\S]*?display_order = 2[\s\S]*?display_order = display_order \+ 2/i,
    );
    expect(migration).toContain("field_name NOT IN ('has_alternative_email', 'alternative_email_address')");
    expect(migration).not.toMatch(/visa_application_answers/i);
  });
});
