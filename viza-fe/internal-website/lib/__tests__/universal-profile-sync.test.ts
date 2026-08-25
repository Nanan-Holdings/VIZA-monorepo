import { describe, expect, it } from "vitest";
import {
  buildUniversalProfileSyncCandidates,
  getUniversalProfileSyncChanges,
  preserveUnchangedUniversalProfileTranslations,
} from "@/lib/universal-profile-sync";
import type { UniversalProfileAnswerRecord } from "@/lib/universal-profile-fields";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

function field(
  fieldName: string,
  label: string,
  fieldType: VisaFormFieldRow["fieldType"] = "text",
  options: VisaFormFieldRow["options"] = null,
): VisaFormFieldRow {
  return {
    id: fieldName,
    visaType: "TEST_VISA",
    fieldName,
    label,
    fieldType,
    required: false,
    stepNumber: 1,
    stepName: fieldName === "intended_arrival_date" ? "Trip details" : "Personal details",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options,
    conditionalLogic: null,
  };
}

describe("Universal Profile application sync comparison", () => {
  it("returns only reusable answers that are new or changed", () => {
    const fields = [
      field("surname", "Surname"),
      field("phone", "Phone number"),
      field("email", "Email address", "email"),
      field("civil_status", "Marital Status", "select", [
        { value: "single", label_zh: "未婚", label_en: "Single" },
        { value: "married", label_zh: "已婚", label_en: "Married" },
      ]),
      field("intended_arrival_date", "Intended arrival date", "date"),
    ];
    const answers = [
      { field_name: "surname", value_text: "WANG" },
      { field_name: "surname_zh", value_text: "王" },
      { field_name: "phone", value_text: "+65 8123 4567" },
      { field_name: "email", value_text: "person@example.com" },
      { field_name: "civil_status", value_text: "married" },
      { field_name: "intended_arrival_date", value_text: "2026-09-01" },
    ];
    const existing: UniversalProfileAnswerRecord[] = [
      {
        canonicalKey: "surname",
        value: "LI",
        valueZh: "李",
        valueEn: "LI",
      },
      { canonicalKey: "email", value: "person@example.com" },
      { canonicalKey: "civil_status", value: "single" },
    ];

    const candidateResult = buildUniversalProfileSyncCandidates(fields, answers);
    const changes = getUniversalProfileSyncChanges(candidateResult.candidates, existing);

    expect(candidateResult.skippedCount).toBe(1);
    expect(changes.map((change) => change.canonicalKey)).toEqual([
      "surname",
      "phone",
      "civil_status",
    ]);
    expect(changes[0]).toMatchObject({
      kind: "updated",
      valueZh: "王",
      previousValueZh: "李",
      valueEn: "WANG",
      previousValueEn: "LI",
    });
    expect(changes[1]).toMatchObject({
      kind: "new",
      valueEn: "+65 8123 4567",
    });
    expect(changes[2]).toMatchObject({
      kind: "updated",
      valueZh: "已婚",
      previousValueZh: "未婚",
      valueEn: "Married",
      previousValueEn: "Single",
    });
  });

  it("treats whitespace-only differences as unchanged", () => {
    const candidateResult = buildUniversalProfileSyncCandidates(
      [field("employer_name", "Employer name")],
      [{ field_name: "employer_name", value_text: "VIZA   Holdings" }],
    );

    expect(getUniversalProfileSyncChanges(candidateResult.candidates, [
      { canonicalKey: "employer_name", value: " VIZA Holdings " },
    ])).toEqual([]);
  });

  it("keeps an existing translation when the canonical answer is unchanged", () => {
    const candidateResult = buildUniversalProfileSyncCandidates(
      [field("surname", "Surname")],
      [{ field_name: "surname", value_text: "WANG" }],
    );
    const existing: UniversalProfileAnswerRecord[] = [{
      canonicalKey: "surname",
      value: "WANG",
      valueZh: "王",
      valueEn: "WANG",
    }];
    const candidates = preserveUnchangedUniversalProfileTranslations(
      candidateResult.candidates,
      existing,
    );

    expect(candidates[0]).toMatchObject({ valueZh: "王", valueEn: "WANG" });
    expect(getUniversalProfileSyncChanges(candidates, existing)).toEqual([]);
  });
});
