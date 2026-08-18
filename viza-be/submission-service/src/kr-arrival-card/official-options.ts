/**
 * Korea e-Arrival Card option contract observed from the official
 * `/portal/apply/getApplyCd.do` response and the live form's selectors.
 *
 * The portal keeps the option codes stable across its Korean/English
 * presentation layers.  The runner sends these codes; the frontend owns the
 * translated labels.  Keeping the snapshot here lets us reject stale or
 * invented values before opening a browser session.
 */

export const KR_EARRIVAL_OPTION_SNAPSHOT_VERSION = "2026-08-18" as const;

/**
 * The reviewed 2026-08-18 official snapshot exposes no conditional question
 * keys.  Keep this explicit allowlist empty until a later, separately
 * reviewed snapshot adds a question; arbitrary `official_*` answers must not
 * become browser actions by accident.
 */
export const KR_EARRIVAL_ADDITIONAL_QUESTION_KEYS = [] as const;

export function isOfficialAdditionalQuestionKey(value: string): boolean {
  return (KR_EARRIVAL_ADDITIONAL_QUESTION_KEYS as readonly string[]).includes(value);
}

export interface KrOfficialOption {
  code: string;
  labelEn: string;
}

export const KR_EARRIVAL_GENDER_OPTIONS = [
  { code: "F", labelEn: "Female" },
  { code: "M", labelEn: "Male" },
  { code: "X", labelEn: "Third gender" },
] as const satisfies readonly KrOfficialOption[];

export const KR_EARRIVAL_PURPOSE_OPTIONS = [
  { code: "01", labelEn: "Tourism (individual)" },
  { code: "02", labelEn: "Tourism (group)" },
  { code: "03", labelEn: "Business" },
  { code: "04", labelEn: "Diplomacy/official duties" },
  { code: "05", labelEn: "Treatment/Medical care" },
  { code: "06", labelEn: "Visit (Family/relatives/friends, etc.)" },
  { code: "07", labelEn: "Meeting/event" },
  { code: "08", labelEn: "Employment" },
  { code: "09", labelEn: "Studies" },
  { code: "10", labelEn: "Sports game" },
  { code: "99", labelEn: "Others" },
] as const satisfies readonly KrOfficialOption[];

export const KR_EARRIVAL_OCCUPATION_OPTIONS = [
  { code: "01", labelEn: "Office worker" },
  { code: "02", labelEn: "Self-employed" },
  { code: "03", labelEn: "Student" },
  { code: "04", labelEn: "Unemployed" },
  { code: "05", labelEn: "Household activities" },
  { code: "06", labelEn: "Public official" },
  { code: "07", labelEn: "Agriculture and livestock industry" },
  { code: "99", labelEn: "Others" },
] as const satisfies readonly KrOfficialOption[];

const GENDER_CODES = new Set<string>(KR_EARRIVAL_GENDER_OPTIONS.map((option) => option.code));
const PURPOSE_CODES = new Set<string>(KR_EARRIVAL_PURPOSE_OPTIONS.map((option) => option.code));
const OCCUPATION_CODES = new Set<string>(KR_EARRIVAL_OCCUPATION_OPTIONS.map((option) => option.code));

function normalizedLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function codeFromValue(
  value: string,
  options: readonly KrOfficialOption[],
): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  const option = options.find((entry) =>
    entry.code === candidate || normalizedLabel(entry.labelEn) === normalizedLabel(candidate));
  return option?.code ?? null;
}

/** Resolve a saved code or an exact official English label to its portal code. */
export function officialGenderCode(value: string): string | null {
  return codeFromValue(value, KR_EARRIVAL_GENDER_OPTIONS);
}

export function officialPurposeCode(value: string): string | null {
  return codeFromValue(value, KR_EARRIVAL_PURPOSE_OPTIONS);
}

export function officialOccupationCode(value: string): string | null {
  return codeFromValue(value, KR_EARRIVAL_OCCUPATION_OPTIONS);
}

export function isOfficialGenderCode(value: string): boolean {
  return officialGenderCode(value) !== null;
}

export function isOfficialPurposeCode(value: string): boolean {
  return officialPurposeCode(value) !== null;
}

export function isOfficialOccupationCode(value: string): boolean {
  return officialOccupationCode(value) !== null;
}

export function officialOptionCodes(
  kind: "gender" | "purpose" | "occupation",
): ReadonlySet<string> {
  if (kind === "gender") return GENDER_CODES;
  if (kind === "purpose") return PURPOSE_CODES;
  return OCCUPATION_CODES;
}
