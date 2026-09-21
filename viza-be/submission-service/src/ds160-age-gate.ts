/**
 * Age-gated DS-160 sections confirmed against the live CEAC flow.
 *
 * CEAC omits Work/Education/Training for applicants younger than fourteen.
 * A missing or malformed date deliberately keeps the section active so a
 * runner can never drop required answers because an identity value is absent.
 */

export const DS160_WORK_EDUCATION_MINIMUM_AGE = 14;

const WORK_EDUCATION_PAGE_PATTERN = /work[_/\s-]*education|work[_/\s-]*education[_/\s-]*training/i;
const US_CONTACT_PAGE_PATTERN = /(?:u\.?\s*s\.?\s*)?(?:point\s+of\s+)?contact/i;

export type Ds160AgeGatedContractField = {
  page?: string;
  minimumAge?: unknown;
  minimum_age?: unknown;
};

function parseDateOfBirth(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isSafeInteger(year) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function getDs160Age(
  dateOfBirth: unknown,
  now: Date = new Date(),
): number | null {
  const birth = parseDateOfBirth(dateOfBirth);
  if (!birth || Number.isNaN(now.getTime())) return null;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  let age = currentYear - birth.year;
  if (currentMonth < birth.month || (currentMonth === birth.month && currentDay < birth.day)) age -= 1;
  return age >= 0 ? age : null;
}

export function isDs160WorkEducationVisible(
  answers: Readonly<Record<string, unknown>>,
  now: Date = new Date(),
): boolean {
  const dateOfBirth = answers.date_of_birth ?? answers.dateOfBirth;
  const age = getDs160Age(dateOfBirth, now);
  return age === null || age >= DS160_WORK_EDUCATION_MINIMUM_AGE;
}

export function isDs160WorkEducationPage(pageId: string): boolean {
  return pageId === "work_education_present" ||
    pageId === "work_education_previous" ||
    pageId === "work_education_additional";
}

function normalizeAnswer(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
}

/** CEAC omits the U.S. Point of Contact page for the no-plans, H-stay branch. */
export function isDs160UsContactVisible(
  answers: Readonly<Record<string, unknown>>,
): boolean {
  const plans = normalizeAnswer(answers.has_specific_plans ?? answers.has_specific_travel_plans);
  const durationUnit = normalizeAnswer(
    answers.intended_length_of_stay_unit ?? answers.intended_length_of_stay_units,
  );
  return !(plans === "NO" && (durationUnit === "H" || durationUnit === "LESS_THAN_24_HOURS"));
}

export function isDs160UsContactPage(pageName: string): boolean {
  return US_CONTACT_PAGE_PATTERN.test(pageName);
}

export function isDs160FieldAgeEligible(
  field: Ds160AgeGatedContractField,
  answers: Readonly<Record<string, unknown>>,
  now: Date = new Date(),
): boolean {
  const rawMinimumAge = field.minimumAge ?? field.minimum_age;
  const minimumAge = typeof rawMinimumAge === "number" && Number.isSafeInteger(rawMinimumAge) && rawMinimumAge >= 0
    ? rawMinimumAge
    : WORK_EDUCATION_PAGE_PATTERN.test(field.page ?? "")
      ? DS160_WORK_EDUCATION_MINIMUM_AGE
      : null;
  if (minimumAge === null) return true;
  const age = getDs160Age(answers.date_of_birth ?? answers.dateOfBirth, now);
  return age === null || age >= minimumAge;
}

export function isDs160FieldRuntimeVisible(
  field: Ds160AgeGatedContractField,
  answers: Readonly<Record<string, unknown>>,
  now: Date = new Date(),
): boolean {
  if (!isDs160FieldAgeEligible(field, answers, now)) return false;
  return !isDs160UsContactPage(field.page ?? "") || isDs160UsContactVisible(answers);
}
