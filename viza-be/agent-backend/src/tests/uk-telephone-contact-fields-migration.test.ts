import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../drizzle/0224_uk_telephone_contact_fields.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20261125110000_uk_telephone_contact_fields.sql",
    import.meta.url,
  ),
);
const seedPath = fileURLToPath(
  new URL("../../scripts/seed-uk-standard-visitor-form-fields.ts", import.meta.url),
);
const telephoneSnapshotPath = fileURLToPath(
  new URL(
    "../../../submission-service/uk-walk-out/page-standardTelephoneDetailsList.json",
    import.meta.url,
  ),
);
const contactSnapshotPath = fileURLToPath(
  new URL("../../../submission-service/uk-walk-out/batch-pages.json", import.meta.url),
);

const phonePurposeLabels = [
  "For use whilst in the UK",
  "For use whilst out of the UK",
] as const;
const phoneTypeLabels = [
  "Home telephone number",
  "Business telephone number",
  "Mobile telephone number",
] as const;
const contactLabels = [
  "I can be contacted by telephone call and text message (SMS)",
  "I can only be contacted by telephone call",
  "I can only be contacted by text message (SMS)",
  "I cannot be contacted by telephone call or text message (SMS)",
] as const;

describe("UK telephone/contact field contract", () => {
  it("keeps the frontend mirror byte-identical", () => {
    expect(readFileSync(mirrorPath)).toEqual(readFileSync(migrationPath));
  });

  it("matches the observed official phone and contact options", () => {
    const telephone = JSON.parse(readFileSync(telephoneSnapshotPath, "utf8")) as {
      fields: Array<{ id?: string; label?: string }>;
    };
    const contactPages = JSON.parse(readFileSync(contactSnapshotPath, "utf8")) as {
      standardContactingYouByTelephone?: {
        fields?: Array<{ id?: string; label?: string; options?: string[] }>;
      };
    };

    const observedPhoneFields = new Map(
      telephone.fields.map((field) => [field.id, field.label]),
    );
    expect(observedPhoneFields.get("telephoneNumberPurpose_useInUK")).toBe(phonePurposeLabels[0]);
    expect(observedPhoneFields.get("telephoneNumberPurpose_outsideUK")).toBe(phonePurposeLabels[1]);
    expect(observedPhoneFields.get("telephoneNumberType_home")).toBe(phoneTypeLabels[0]);
    expect(observedPhoneFields.get("telephoneNumberType_business")).toBe(phoneTypeLabels[1]);
    expect(observedPhoneFields.get("telephoneNumberType_mobile")).toBe(phoneTypeLabels[2]);

    const contactField = contactPages.standardContactingYouByTelephone?.fields?.find(
      (field) => field.id === "contactByTelephone_callAndText",
    );
    expect(contactField?.options).toEqual(contactLabels);
    expect(contactPages.standardContactingYouByTelephone?.fields?.map((field) => field.id)).toEqual([
      "contactByTelephone_callAndText",
      "callOnlyDontContactReason",
      "textOnlyDontContactReason",
      "noContactDontContactReason",
      "submit",
    ]);
  });

  it("publishes the same stable keys and conditional branches in seed and migration", () => {
    const seed = readFileSync(seedPath, "utf8");
    const migration = readFileSync(migrationPath, "utf8");
    for (const fieldName of [
      "phone_purpose_labels",
      "phone_type_labels",
      "contact_by_phone_label",
      "contact_call_only_reason",
      "contact_text_only_reason",
      "contact_no_contact_reason",
    ]) {
      expect(seed).toContain(`field_name: "${fieldName}"`);
      expect(migration).toContain(`'${fieldName}'`);
    }
    for (const label of [...phonePurposeLabels, ...phoneTypeLabels, ...contactLabels]) {
      expect(seed).toContain(label);
      expect(migration).toContain(label);
    }
    expect(seed).toContain("contact_by_phone_label === call_only");
    expect(seed).toContain("contact_by_phone_label === text_only");
    expect(seed).toContain("contact_by_phone_label === no_call_or_text");
    expect(migration).toContain("display_order = display_order + 6");
    expect(migration).not.toMatch(/visa_application_answers/i);
  });
});
