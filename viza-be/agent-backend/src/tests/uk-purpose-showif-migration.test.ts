import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../drizzle/0220_uk_purpose_showif_values.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20261121153000_uk_purpose_showif_values.sql",
    import.meta.url,
  ),
);

const mappings = [
  ["short_study", "study"],
  ["medical", "medicalTreatment"],
  ["marriage_civil_partnership", "marriage"],
  ["academic_12m", "academic"],
] as const;

describe("UK purpose showIf migration", () => {
  it("ships a byte-identical frontend Supabase mirror", () => {
    expect(readFileSync(mirrorPath)).toEqual(readFileSync(migrationPath));
  });

  it("updates only the four proven mappings for the UK schema", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("UPDATE public.visa_form_fields");
    expect(sql).toContain("WHERE visa_type = 'UK_STANDARD_VISITOR'");
    expect(sql).toContain("jsonb_set(");
    expect(sql).toContain("conditional_logic->>'showIf'");

    for (const [oldValue, newValue] of mappings) {
      expect(sql).toContain(`purpose_of_visit === ${oldValue}`);
      expect(sql).toContain(`purpose_of_visit === ${newValue}`);
    }

    expect(sql).not.toMatch(/visa_application_answers/i);
    expect(sql).not.toContain("purpose_of_visit === ppe");
    expect(sql).not.toContain("purpose_of_visit === organ_donor");
    expect(sql).not.toContain("purpose_of_visit === clinical_training");
  });

  it("preserves conditional metadata while replacing showIf", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("'{showIf}'");
    expect(sql).toContain("false\n    ),");
    expect(sql).toContain("updated_at = NOW()");
  });
});
