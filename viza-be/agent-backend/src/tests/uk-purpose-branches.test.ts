import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type WalkField = { options?: string[] };

const seedPath = fileURLToPath(
  new URL("../../scripts/seed-uk-standard-visitor-form-fields.ts", import.meta.url),
);
const officialPurposePath = fileURLToPath(
  new URL(
    "../../../../viza-be/submission-service/uk-walk-out/page-purposeOfVisitForVV.json",
    import.meta.url,
  ),
);

function seedPurposeOptions() {
  const seed = readFileSync(seedPath, "utf8");
  const purposeLine = seed
    .split("\n")
    .find((line) => line.includes('field_name: "purpose_of_visit"'));
  expect(purposeLine, "purpose_of_visit seed field is missing").toBeDefined();

  return [...purposeLine!.matchAll(/\{ value: "([^"]+)", text: "([^"]+)" \}/g)].map(
    ([, value, text]) => ({ value, text }),
  );
}

describe("UK Standard Visitor purpose branches", () => {
  it("keeps the purpose selector identical to the captured Access UK options", () => {
    const official = JSON.parse(readFileSync(officialPurposePath, "utf8")) as {
      fields?: WalkField[];
    };
    const officialOptions = official.fields?.[0]?.options;
    expect(officialOptions).toBeDefined();

    expect(seedPurposeOptions().map(({ text }) => text)).toEqual(officialOptions);
    expect(seedPurposeOptions().map(({ value }) => value)).toEqual([
      "tourism",
      "business",
      "transit",
      "academic",
      "marriage",
      "medicalTreatment",
      "study",
      "other",
    ]);
  });

  it("uses the stored purpose values for every supported conditional branch", () => {
    const seed = readFileSync(seedPath, "utf8");
    const options = seedPurposeOptions().map(({ value }) => value);
    const branchValues = {
      IS_BUSINESS: "business",
      IS_STUDY: "study",
      IS_MEDICAL: "medicalTreatment",
      IS_TRANSIT: "transit",
      IS_MARRIAGE: "marriage",
      IS_ACADEMIC: "academic",
    } as const;

    for (const [constant, value] of Object.entries(branchValues)) {
      expect(seed).toContain(`const ${constant} = "purpose_of_visit === ${value}";`);
      expect(options, `${constant} points at an unavailable option`).toContain(value);
    }
  });

  it("does not invent selector values for unsupported specialised branches", () => {
    const options = seedPurposeOptions().map(({ value }) => value);

    for (const value of ["ppe", "organ_donor", "clinical_training"]) {
      expect(options).not.toContain(value);
    }
  });
});
