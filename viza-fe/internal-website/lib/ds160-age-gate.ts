import { isDs160VisaType } from "@/lib/submission-queue";
import {
  getDs160OfficialOptions,
  resolveDs160OfficialOptionValue,
} from "@/lib/ds160-official-options";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

/**
 * CEAC hides the Work/Education/Training pages for applicants younger than
 * fourteen on the observed DS-160 flow.  Keep this value in one place so the
 * wizard, progress calculation, review and assistant use the same boundary.
 */
export const DS160_WORK_EDUCATION_MINIMUM_AGE = 14;

const WORK_EDUCATION_STEP_PATTERN = /work\s*[/&]\s*education|work\s+education|education\s*[/&]\s*employment|^occupation\b/i;
const US_CONTACT_STEP_PATTERN = /(?:u\.?\s*s\.?\s*)?(?:point\s+of\s+)?contact/i;

/**
 * CEAC's ESTA/VWP question was observed for these 37 nationality codes on
 * 2026-09-21. The aliases below are populated from the current official
 * nationality catalog, so older ISO codes and displayed labels resolve to the
 * same CEAC code without changing the saved answer.
 */
export const DS160_ESTA_NATIONALITY_CODES = new Set([
  "ANDO", "ASTL", "AUST", "BELG", "BRNI", "CZEC", "DEN", "EST", "ETH",
  "FIN", "FRAN", "GER", "GRC", "HUNG", "ICLD", "IRE", "ITLY", "JPN",
  "KOR", "LATV", "LCHT", "LITH", "LXM", "MLTA", "MON", "NETH", "NZLD",
  "NORW", "PORT", "SMAR", "SING", "SVK", "SVN", "SPN", "SWDN", "SWTZ",
  "GRBR",
]);

function normalizeNationalityAlias(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function buildDs160NationalityAliasMap(): Map<string, string> {
  const aliases = new Map<string, string>();
  const add = (value: unknown, code: string) => {
    if (typeof value !== "string" || !value.trim()) return;
    const normalized = normalizeNationalityAlias(value);
    if (normalized) aliases.set(normalized, code);
  };

  for (const source of ["CEAC_NATIONALITIES", "CEAC_OTHER_NATIONALITIES"] as const) {
    for (const option of getDs160OfficialOptions(source) ?? []) {
      if (typeof option === "string") continue;
      const code = typeof option.official_value === "string"
        ? option.official_value
        : option.value;
      if (!DS160_ESTA_NATIONALITY_CODES.has(code)) continue;
      add(code, code);
      add(option.value, code);
      add(option.label_en, code);
      add(option.label_zh, code);
      add(option.official_label, code);
      add(option.code, code);
      add(option.flagCountryCode, code);
    }
  }

  return aliases;
}

const DS160_NATIONALITY_ALIASES = buildDs160NationalityAliasMap();

function resolveDs160NationalityCode(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = normalizeNationalityAlias(value);
  const direct = normalized ? DS160_NATIONALITY_ALIASES.get(normalized) : undefined;
  if (direct) return direct;
  const resolved = resolveDs160OfficialOptionValue("CEAC_NATIONALITIES", value);
  const resolvedAlias = normalizeNationalityAlias(resolved);
  return resolvedAlias ? DS160_NATIONALITY_ALIASES.get(resolvedAlias) ?? null : null;
}

function isAffirmativeAnswer(value: string | undefined): boolean {
  const normalized = value?.trim().toUpperCase().replace(/[\s-]+/gu, "_");
  return normalized === "YES" || normalized === "Y" || normalized === "TRUE" || normalized === "1" || normalized === "是";
}

/** Return whether a CEAC_ESTA-gated field belongs on the current DS-160 page. */
export function isDs160NationalityGateVisible(
  field: Pick<VisaFormFieldRow, "validationRules">,
  answers: Readonly<Record<string, string>>,
): boolean {
  if (field.validationRules?.nationality_gate !== "CEAC_ESTA") return true;

  const primaryCode = resolveDs160NationalityCode(
    answers.nationality_country ?? answers.nationality ?? answers.current_nationality,
  );
  if (primaryCode && DS160_ESTA_NATIONALITY_CODES.has(primaryCode)) return true;

  // CEAC also exposes this question when an active repeated other-nationality
  // row is a VWP nationality. Permanent-residency rows are deliberately not
  // considered; live CEAC kept the question hidden for that branch.
  if (!isAffirmativeAnswer(answers.other_nationality)) return false;
  return Object.entries(answers)
    .filter(([key]) => /^other_nationality_country(?:__\d+)?$/u.test(key))
    .some(([, value]) => {
      const code = resolveDs160NationalityCode(value);
      return code !== null && DS160_ESTA_NATIONALITY_CODES.has(code);
    });
}

function readMinimumAge(field: VisaFormFieldRow): number | null {
  const rules = field.validationRules;
  if (!rules) return null;
  const candidate = rules.minimum_age ?? rules.minimumAge ?? rules.min_age;
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) return null;
  return candidate;
}

function isWorkEducationStep(step: WizardStep): boolean {
  return WORK_EDUCATION_STEP_PATTERN.test(`${step.stepName} ${step.fields[0]?.stepName ?? ""}`.trim());
}

function normalizeAnswer(value: string | undefined): string {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
}

function parseDateOfBirth(value: string | undefined): { year: number; month: number; day: number } | null {
  const match = value?.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function getDs160Age(
  dateOfBirth: string | undefined,
  now: Date = new Date(),
): number | null {
  const birth = parseDateOfBirth(dateOfBirth);
  if (!birth || Number.isNaN(now.getTime())) return null;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  let age = year - birth.year;
  if (month < birth.month || (month === birth.month && day < birth.day)) age -= 1;
  return age >= 0 ? age : null;
}

export function isDs160WorkEducationVisible(
  answers: Readonly<Record<string, string>>,
  now: Date = new Date(),
): boolean {
  // A missing or malformed DOB must retain the fields.  The normal required
  // validation still asks for the DOB, so this fail-open path never silently
  // removes a required identity answer.
  const age = getDs160Age(answers.date_of_birth ?? answers.dateOfBirth, now);
  return age === null || age >= DS160_WORK_EDUCATION_MINIMUM_AGE;
}

/** CEAC omits U.S. Point of Contact when no plans use the H stay unit. */
export function isDs160UsContactVisible(
  answers: Readonly<Record<string, string>>,
): boolean {
  const plans = normalizeAnswer(answers.has_specific_plans ?? answers.has_specific_travel_plans);
  const durationUnit = normalizeAnswer(
    answers.intended_length_of_stay_unit ?? answers.intended_length_of_stay_units,
  );
  const isLessThanTwentyFourHours = new Set([
    "H",
    "LESS_THAN_24_HOURS",
  ]).has(durationUnit);
  return !(plans === "NO" && isLessThanTwentyFourHours);
}

function isUsContactStep(step: WizardStep): boolean {
  return US_CONTACT_STEP_PATTERN.test(`${step.stepName} ${step.fields[0]?.stepName ?? ""}`.trim());
}

export function isDs160FieldVisibleForAge(
  field: VisaFormFieldRow,
  step: WizardStep,
  visaType: string | null | undefined,
  answers: Readonly<Record<string, string>>,
  now: Date = new Date(),
): boolean {
  if (!isDs160VisaType(visaType ?? field.visaType)) return true;
  const minimumAge = readMinimumAge(field) ?? (isWorkEducationStep(step) ? DS160_WORK_EDUCATION_MINIMUM_AGE : null);
  if (minimumAge === null) return true;
  const age = getDs160Age(answers.date_of_birth ?? answers.dateOfBirth, now);
  return age === null || age >= minimumAge;
}

export function isDs160FieldVisibleForRuntime(
  field: VisaFormFieldRow,
  step: WizardStep,
  visaType: string | null | undefined,
  answers: Readonly<Record<string, string>>,
  now: Date = new Date(),
): boolean {
  if (isDs160VisaType(visaType ?? field.visaType) && !isDs160NationalityGateVisible(field, answers)) return false;
  if (!isDs160FieldVisibleForAge(field, step, visaType, answers, now)) return false;
  if (!isDs160VisaType(visaType ?? field.visaType) || !isUsContactStep(step)) return true;
  return isDs160UsContactVisible(answers);
}

export function getDs160AgeVisibleStep(
  step: WizardStep,
  visaType: string | null | undefined,
  answers: Readonly<Record<string, string>>,
  now: Date = new Date(),
): WizardStep {
  const fields = step.fields.filter((field) => isDs160FieldVisibleForRuntime(field, step, visaType, answers, now));
  return fields.length === step.fields.length ? step : { ...step, fields };
}
