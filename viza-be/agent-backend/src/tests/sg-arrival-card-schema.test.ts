import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const seedSource = readFileSync(
  new URL("../../scripts/seed-sg-arrival-card-form-fields.ts", import.meta.url),
  "utf8",
);

function extractFieldNames(): string[] {
  return Array.from(seedSource.matchAll(/field_name:\s*"([^"]+)"/g), (match) => match[1]);
}

describe("Singapore SG Arrival Card schema seed", () => {
  test("uses a dedicated SGAC visa type with core arrival-card fields", () => {
    expect(seedSource).toContain('const VISA_TYPE = "SG_ARRIVAL_CARD"');
    expect(seedSource).toContain("SG Arrival Card is not a visa");
    expect(seedSource).toContain("free of charge");
    expect(seedSource).toContain("within three (3) days");

    const fieldNames = new Set(extractFieldNames());
    expect(fieldNames.size).toBeGreaterThanOrEqual(30);
    expect(fieldNames).toEqual(
      expect.objectContaining({
        has: expect.any(Function),
      }),
    );
    for (const requiredField of [
      "surname",
      "given_names",
      "date_of_birth",
      "nationality",
      "passport_number",
      "passport_expiry_date",
      "arrival_date",
      "mode_of_travel",
      "transport_number",
      "accommodation_address",
      "email_address",
      "health_declaration",
      "official_submission_acknowledgement",
      "final_declaration",
    ]) {
      expect(fieldNames.has(requiredField), `${requiredField} missing`).toBe(true);
    }
  });

  test("includes bilingual Chinese labels for every field", () => {
    const fieldNames = extractFieldNames();
    const labelZhMatches = Array.from(seedSource.matchAll(/validation_rules:\s*rules\("([^"]+)"/g));

    expect(labelZhMatches.length).toBe(fieldNames.length);
    for (const match of labelZhMatches) {
      expect(/[\u3400-\u9fff]/.test(match[1])).toBe(true);
    }
  });
});
