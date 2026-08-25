import {
  resolveOptionDisplayLabel,
} from "@/lib/bilingual-schema-contract";
import { getChineseLabel, getEnglishLabel } from "@/lib/ds160-translations";
import { isSyntheticQaValue } from "@/lib/applications/qa-safety";
import {
  canonicalizeUniversalProfileFieldName,
  getUniversalProfileCategory,
  isReusableUniversalProfileField,
  splitUniversalProfileRepeatKey,
  type UniversalProfileAnswerRecord,
  type UniversalProfileCategory,
} from "@/lib/universal-profile-fields";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

export interface UniversalProfileSyncCandidate {
  canonicalKey: string;
  sourceFieldName: string;
  value: string;
  valueZh: string | null;
  valueEn: string | null;
  labelZh: string;
  labelEn: string;
  displayValueZh: string;
  displayValueEn: string;
  category: UniversalProfileCategory;
  field: VisaFormFieldRow;
}

export interface UniversalProfileSyncChange {
  canonicalKey: string;
  kind: "new" | "updated";
  labelZh: string;
  labelEn: string;
  valueZh: string;
  valueEn: string;
  previousValueZh?: string;
  previousValueEn?: string;
}

interface ApplicationAnswerRow {
  field_name: string;
  value_text: string | null;
}

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function normalizeComparable(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function formatDisplayValue(
  field: VisaFormFieldRow,
  value: string,
  localizedValue: string | null | undefined,
  side: "zh" | "en",
): string {
  const explicitValue = cleanOptional(localizedValue);
  if (field.fieldType === "multi_select") {
    return value
      .split(",")
      .map((item) => {
        const trimmed = item.trim();
        return resolveOptionDisplayLabel(field.options, trimmed, side) ?? trimmed;
      })
      .join(", ");
  }

  const optionLabel = resolveOptionDisplayLabel(field.options, value, side);
  if (optionLabel) return optionLabel;
  return explicitValue ?? value;
}

function fieldOrder(fields: VisaFormFieldRow[]): Map<string, number> {
  return new Map(
    [...fields]
      .sort((left, right) =>
        left.stepNumber - right.stepNumber
        || left.displayOrder - right.displayOrder,
      )
      .map((field, index) => [field.fieldName, index]),
  );
}

export function buildUniversalProfileSyncCandidates(
  fields: VisaFormFieldRow[],
  answerRows: ApplicationAnswerRow[],
): { candidates: UniversalProfileSyncCandidate[]; skippedCount: number } {
  const fieldsByName = new Map(fields.map((field) => [field.fieldName, field]));
  const answers = new Map(
    answerRows.map((row) => [row.field_name, row.value_text?.trim() ?? ""] as const),
  );
  const orderByFieldName = fieldOrder(fields);
  const candidatesByKey = new Map<string, UniversalProfileSyncCandidate>();
  let skippedCount = 0;

  const orderedAnswers = [...answers.entries()].sort(([left], [right]) => {
    const leftBase = splitUniversalProfileRepeatKey(left).baseKey;
    const rightBase = splitUniversalProfileRepeatKey(right).baseKey;
    return (orderByFieldName.get(leftBase) ?? Number.MAX_SAFE_INTEGER)
      - (orderByFieldName.get(rightBase) ?? Number.MAX_SAFE_INTEGER)
      || left.localeCompare(right);
  });

  for (const [fieldName, value] of orderedAnswers) {
    if (
      !value
      || fieldName.endsWith("_zh")
      || fieldName.endsWith("_en")
      || fieldName.startsWith("__")
    ) {
      continue;
    }

    const { baseKey, repeatSuffix } = splitUniversalProfileRepeatKey(fieldName);
    const field = fieldsByName.get(baseKey);
    if (!field || !isReusableUniversalProfileField(field)) {
      skippedCount += 1;
      continue;
    }

    const valueZh = cleanOptional(answers.get(`${fieldName}_zh`));
    const valueEn = cleanOptional(answers.get(`${fieldName}_en`));
    if (
      isSyntheticQaValue(value)
      || isSyntheticQaValue(valueZh)
      || isSyntheticQaValue(valueEn)
    ) {
      skippedCount += 1;
      continue;
    }

    const canonicalKey = `${canonicalizeUniversalProfileFieldName(baseKey)}${repeatSuffix}`;
    if (candidatesByKey.has(canonicalKey)) continue;

    candidatesByKey.set(canonicalKey, {
      canonicalKey,
      sourceFieldName: fieldName,
      value,
      valueZh,
      valueEn,
      labelZh: getChineseLabel(field.label),
      labelEn: getEnglishLabel(field.label),
      displayValueZh: formatDisplayValue(field, value, valueZh, "zh"),
      displayValueEn: formatDisplayValue(field, value, valueEn, "en"),
      category: getUniversalProfileCategory(canonicalKey, field.stepName ?? ""),
      field,
    });
  }

  return { candidates: [...candidatesByKey.values()], skippedCount };
}

function valuesMatch(
  candidate: UniversalProfileSyncCandidate,
  existing: UniversalProfileAnswerRecord,
): boolean {
  return normalizeComparable(candidate.value) === normalizeComparable(existing.value)
    && normalizeComparable(candidate.valueZh) === normalizeComparable(existing.valueZh)
    && normalizeComparable(candidate.valueEn) === normalizeComparable(existing.valueEn);
}

export function preserveUnchangedUniversalProfileTranslations(
  candidates: UniversalProfileSyncCandidate[],
  existingAnswers: UniversalProfileAnswerRecord[],
): UniversalProfileSyncCandidate[] {
  const existingByKey = new Map(
    existingAnswers.map((answer) => [answer.canonicalKey, answer]),
  );

  return candidates.map((candidate) => {
    const existing = existingByKey.get(candidate.canonicalKey);
    if (
      !existing
      || normalizeComparable(candidate.value) !== normalizeComparable(existing.value)
    ) {
      return candidate;
    }

    const valueZh = candidate.valueZh ?? cleanOptional(existing.valueZh);
    const valueEn = candidate.valueEn ?? cleanOptional(existing.valueEn);
    return {
      ...candidate,
      valueZh,
      valueEn,
      displayValueZh: formatDisplayValue(candidate.field, candidate.value, valueZh, "zh"),
      displayValueEn: formatDisplayValue(candidate.field, candidate.value, valueEn, "en"),
    };
  });
}

export function getUniversalProfileSyncChanges(
  candidates: UniversalProfileSyncCandidate[],
  existingAnswers: UniversalProfileAnswerRecord[],
): UniversalProfileSyncChange[] {
  const existingByKey = new Map(
    existingAnswers.map((answer) => [answer.canonicalKey, answer]),
  );

  return candidates.flatMap((candidate) => {
    const existing = existingByKey.get(candidate.canonicalKey);
    if (existing && valuesMatch(candidate, existing)) return [];

    return [{
      canonicalKey: candidate.canonicalKey,
      kind: existing ? "updated" as const : "new" as const,
      labelZh: candidate.labelZh,
      labelEn: candidate.labelEn,
      valueZh: candidate.displayValueZh,
      valueEn: candidate.displayValueEn,
      previousValueZh: existing
        ? formatDisplayValue(
            candidate.field,
            existing.value,
            existing.valueZh,
            "zh",
          )
        : undefined,
      previousValueEn: existing
        ? formatDisplayValue(
            candidate.field,
            existing.value,
            existing.valueEn,
            "en",
          )
        : undefined,
    }];
  });
}
