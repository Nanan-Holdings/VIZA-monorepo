import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../drizzle/0226_uk_ads_agreement.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20261126100000_uk_ads_agreement.sql",
    import.meta.url,
  ),
);
const seedPath = fileURLToPath(
  new URL("../../scripts/seed-uk-standard-visitor-form-fields.ts", import.meta.url),
);

const officialQuestion =
  "Are you the employee of a licensed ADS tour operator submitting this application on behalf of an ADS group?";

describe("UK ADS agreement field contract", () => {
  it("keeps the frontend migration mirror byte-identical", () => {
    expect(readFileSync(mirrorPath)).toEqual(readFileSync(migrationPath));
  });

  it("publishes the observed China-only question and explicit yes/no options", () => {
    const seed = readFileSync(seedPath, "utf8");
    const migration = readFileSync(migrationPath, "utf8");

    for (const source of [seed, migration]) {
      expect(source).toContain("ads_tour_operator_employee");
      expect(source).toContain(officialQuestion);
      expect(source).toContain("country_of_nationality in [China,CN,CHN]");
      expect(source).toContain("adsAgreement");
      expect(source).toContain("Yes");
      expect(source).toContain("No");
    }
  });

  it("does not mutate saved applicant answers", () => {
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).not.toMatch(/visa_application_answers/i);
    expect(migration).toContain("ON CONFLICT (visa_type, field_name) DO UPDATE");
  });
});
