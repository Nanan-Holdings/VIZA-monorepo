import {
  getDs160OfficialOptions,
  resolveDs160OfficialOptionValue,
} from "@/lib/ds160-official-options";

export type Ds160NationalityDuplicateIssueKind =
  | "nationality_duplicate"
  | "permanent_resident_duplicate";

export interface Ds160NationalityDuplicateIssue {
  kind: Ds160NationalityDuplicateIssueKind;
  fieldNames: string[];
}

type CountrySource = "CEAC_GEOGRAPHY" | "CEAC_NATIONALITIES" | "CEAC_OTHER_NATIONALITIES";

const COUNTRY_SOURCES: readonly CountrySource[] = [
  "CEAC_GEOGRAPHY",
  "CEAC_NATIONALITIES",
  "CEAC_OTHER_NATIONALITIES",
];

function normalizeCountryAlias(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function isOfficialOption(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function buildCountryAliasIndex(): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const source of COUNTRY_SOURCES) {
    for (const option of getDs160OfficialOptions(source) ?? []) {
      if (!isOfficialOption(option)) continue;
      const code = typeof option.official_value === "string"
        ? option.official_value
        : typeof option.value === "string"
          ? option.value
          : null;
      if (!code) continue;
      for (const candidate of [
        code,
        option.value,
        option.label_en,
        option.label_zh,
        option.official_label,
        option.code,
        option.flagCountryCode,
      ]) {
        if (typeof candidate !== "string" || !candidate.trim()) continue;
        const normalized = normalizeCountryAlias(candidate);
        if (normalized) aliases.set(normalized, code);
      }
    }
  }
  return aliases;
}

const COUNTRY_ALIAS_INDEX = buildCountryAliasIndex();

function resolveCountryCode(value: string | undefined, source: CountrySource): string | null {
  if (!value?.trim()) return null;
  const normalized = normalizeCountryAlias(value);
  const direct = normalized ? COUNTRY_ALIAS_INDEX.get(normalized) : undefined;
  if (direct) return direct;

  const resolved = resolveDs160OfficialOptionValue(source, value);
  const resolvedAlias = normalizeCountryAlias(resolved);
  return resolvedAlias ? COUNTRY_ALIAS_INDEX.get(resolvedAlias) ?? null : null;
}

function isAffirmative(value: string | undefined): boolean {
  const normalized = value?.trim().toUpperCase().replace(/[\s-]+/gu, "_");
  return normalized === "YES" || normalized === "Y" || normalized === "TRUE" || normalized === "1" || normalized === "是";
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function repeatKeys(
  answers: Readonly<Record<string, string>>,
  fieldName: string,
): string[] {
  const prefix = `${fieldName}__`;
  return Object.keys(answers)
    .filter((key) => key === fieldName || key.startsWith(prefix) && /^\d+$/u.test(key.slice(prefix.length)))
    .sort((left, right) => {
      const leftIndex = Number(left.match(/__(\d+)$/u)?.[1] ?? "1");
      const rightIndex = Number(right.match(/__(\d+)$/u)?.[1] ?? "1");
      return leftIndex - rightIndex;
    });
}

interface CountryEntry {
  key: string;
  country: string;
  kind: Ds160NationalityDuplicateIssueKind;
}

function collectCountryEntries(answers: Readonly<Record<string, string>>): CountryEntry[] {
  const entries: CountryEntry[] = [];
  const primary = answers.nationality_country ?? answers.nationality ?? answers.current_nationality;
  const primaryCode = resolveCountryCode(primary, "CEAC_NATIONALITIES");
  if (primaryCode && hasValue(primary)) {
    entries.push({ key: "nationality_country", country: primaryCode, kind: "nationality_duplicate" });
  }

  if (isAffirmative(answers.other_nationality)) {
    for (const key of repeatKeys(answers, "other_nationality_country")) {
      const country = resolveCountryCode(answers[key], "CEAC_OTHER_NATIONALITIES");
      if (country && hasValue(answers[key])) {
        entries.push({ key, country, kind: "nationality_duplicate" });
      }
    }
  }

  if (isAffirmative(answers.permanent_resident_other_country)) {
    for (const key of repeatKeys(answers, "other_permanent_resident_country")) {
      const country = resolveCountryCode(answers[key], "CEAC_GEOGRAPHY");
      if (country && hasValue(answers[key])) {
        entries.push({ key, country, kind: "permanent_resident_duplicate" });
      }
    }
  }

  return entries;
}

/** Return the active country fields that CEAC would reject as duplicates. */
export function findDs160DuplicateNationalityFields(
  answers: Readonly<Record<string, string>>,
): string[] {
  const firstByCountry = new Map<string, CountryEntry>();
  const duplicates = new Set<string>();
  for (const entry of collectCountryEntries(answers)) {
    const first = firstByCountry.get(entry.country);
    if (first) {
      duplicates.add(first.key);
      duplicates.add(entry.key);
    } else {
      firstByCountry.set(entry.country, entry);
    }
  }
  return [...duplicates];
}

function issueKindForField(fieldName: string): Ds160NationalityDuplicateIssueKind {
  return fieldName.replace(/__\d+$/u, "") === "other_permanent_resident_country"
    ? "permanent_resident_duplicate"
    : "nationality_duplicate";
}

/** Return the duplicate issue for one visible country control. */
export function getDs160NationalityDuplicateIssue(
  answers: Readonly<Record<string, string>>,
  fieldName: string,
): Ds160NationalityDuplicateIssue | null {
  const fieldNames = findDs160DuplicateNationalityFields(answers);
  if (!fieldNames.includes(fieldName)) return null;
  return { kind: issueKindForField(fieldName), fieldNames };
}

export function getDs160NationalityDuplicateMessage(
  issue: Ds160NationalityDuplicateIssue,
  isZh: boolean,
): string {
  if (issue.kind === "permanent_resident_duplicate") {
    return isZh
      ? "所列的其他永久居民国家/地区已经输入或选择。"
      : "The Other Permanent/Resident Country/Region listed has already been (entered or selected).";
  }
  return isZh
    ? "所列的其他国家/地区来源（国籍）已经输入或选择。"
    : "The Other Country/Region of Origin (Nationality) listed has already been (entered or selected).";
}

export function getDs160NationalityDuplicateMessageForField(
  fieldName: string,
  isZh: boolean,
): string {
  return getDs160NationalityDuplicateMessage({
    kind: issueKindForField(fieldName),
    fieldNames: [fieldName],
  }, isZh);
}
