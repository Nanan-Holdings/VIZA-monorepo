import type { Page } from "@playwright/test";
import {
  ds160WorkAdditionalMappings,
  ds160WorkAdditionalRepeaterSelectors as selectors,
} from "../ds160-form-mappings";
import {
  clickVerifiedBooleanRadio,
  ensureRepeaterRowCount,
  fillVerifiedText,
  selectVerifiedOption,
  visibleEnabledLocators,
} from "./verified-controls";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export interface Ds160MilitaryService {
  country: string;
  branch: string;
  rank: string;
  specialty: string;
  from: { day: string; month: string; year: string };
  to: { day: string; month: string; year: string };
}

export interface Ds160WorkAdditionalPlan {
  hasClanTribe: boolean;
  clanTribeName: string | null;
  languages: string[];
  hasCountriesVisited: boolean;
  countriesVisited: string[];
  hasOrganization: boolean;
  organizations: string[];
  hasSpecializedSkills: boolean;
  specializedSkillsExplain: string | null;
  hasServedMilitary: boolean;
  militaryServices: Ds160MilitaryService[];
  hasServedParamilitary: boolean;
  paramilitaryExplain: string | null;
}

interface RawMilitaryService {
  country: string;
  branch: string;
  rank: string;
  specialty: string;
  startDate: string;
  endDate: string;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function mergedAnswers(
  answers: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...profile, ...answers };
}

function normalizedBoolean(value: unknown): boolean | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(normalized)) return true;
  if (["n", "no", "false", "0"].includes(normalized)) return false;
  return null;
}

function parseArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function indexedValues(record: Record<string, unknown>, baseKey: string): string[] {
  const rows = new Map<number, string>();
  for (const [key, value] of Object.entries(record)) {
    if (key === baseKey) {
      rows.set(1, String(value ?? "").trim());
      continue;
    }
    const match = key.match(new RegExp(`^${baseKey}__(\\d+)$`));
    if (match) rows.set(Number(match[1]), String(value ?? "").trim());
  }
  if (rows.size === 0) return [];
  const max = Math.max(...rows.keys());
  return Array.from({ length: max }, (_, index) => rows.get(index + 1) ?? "");
}

function stringRows(
  record: Record<string, unknown>,
  arrayKey: string,
  baseKey: string,
): { valid: boolean; values: string[] } {
  if (hasOwn(record, arrayKey)) {
    const parsed = parseArray(record[arrayKey]);
    if (!parsed || !parsed.every((item) => typeof item === "string")) return { valid: false, values: [] };
    return { valid: true, values: parsed.map((item) => item.trim()) };
  }
  return { valid: true, values: indexedValues(record, baseKey) };
}

function militaryRows(record: Record<string, unknown>): { valid: boolean; values: RawMilitaryService[] } {
  if (hasOwn(record, "military_services[]")) {
    const parsed = parseArray(record["military_services[]"]);
    if (!parsed) return { valid: false, values: [] };
    const values: RawMilitaryService[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return { valid: false, values: [] };
      const row = item as Record<string, unknown>;
      values.push({
        country: String(row.country ?? "").trim(),
        branch: String(row.branch ?? "").trim(),
        rank: String(row.rank ?? row.position ?? "").trim(),
        specialty: String(row.specialty ?? "").trim(),
        startDate: String(row.startDate ?? row.start_date ?? row.dateFrom ?? "").trim(),
        endDate: String(row.endDate ?? row.end_date ?? row.dateTo ?? "").trim(),
      });
    }
    return { valid: true, values };
  }

  const keys = [
    "military_country",
    "military_branch",
    "military_rank",
    "military_specialty",
    "military_date_from",
    "military_date_to",
  ];
  const columns = Object.fromEntries(keys.map((key) => [key, indexedValues(record, key)])) as Record<string, string[]>;
  const count = Math.max(0, ...Object.values(columns).map((values) => values.length));
  return {
    valid: true,
    values: Array.from({ length: count }, (_, index) => ({
      country: columns.military_country[index] ?? "",
      branch: columns.military_branch[index] ?? "",
      rank: columns.military_rank[index] ?? "",
      specialty: columns.military_specialty[index] ?? "",
      startDate: columns.military_date_from[index] ?? "",
      endDate: columns.military_date_to[index] ?? "",
    })),
  };
}

function parseDate(value: string): Ds160MilitaryService["from"] | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { day: iso[3], month: MONTHS[month - 1], year: iso[1] };
  }
  const display = /^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})$/.exec(value);
  if (!display || !MONTHS.includes(display[2].toUpperCase())) return null;
  const day = Number(display[1]);
  if (day < 1 || day > 31) return null;
  return { day: String(day).padStart(2, "0"), month: display[2].toUpperCase(), year: display[3] };
}

function requiredGate(
  record: Record<string, unknown>,
  canonicalKey: string,
  aliases: string[] = [],
): { value: boolean | null; key: string } {
  for (const key of [canonicalKey, ...aliases]) {
    if (!hasOwn(record, key)) continue;
    return { value: normalizedBoolean(record[key]), key: canonicalKey };
  }
  return { value: null, key: canonicalKey };
}

export function findMissingDs160WorkAdditionalAnswers(
  answers: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): string[] {
  const record = mergedAnswers(answers, profile);
  const missing: string[] = [];

  const clan = requiredGate(record, "has_clan_tribe");
  if (clan.value === null) missing.push(clan.key);
  if (clan.value === true && !String(record.clan_tribe_name ?? "").trim()) missing.push("clan_tribe_name");

  const languages = stringRows(record, "languages[]", "language_name");
  if (!languages.valid || languages.values.length === 0) {
    missing.push("language_name");
  } else {
    languages.values.forEach((value, index) => {
      if (!value) missing.push(index === 0 ? "language_name" : `language_name__${index + 1}`);
    });
  }

  const countriesGate = requiredGate(record, "has_countries_visited", ["has_traveled_last_five_years"]);
  if (countriesGate.value === null) missing.push(countriesGate.key);
  if (countriesGate.value === true) {
    const countries = stringRows(record, "traveled_countries[]", "traveled_country");
    if (!countries.valid || countries.values.length === 0) missing.push("traveled_country");
    countries.values.forEach((value, index) => {
      if (!value) missing.push(index === 0 ? "traveled_country" : `traveled_country__${index + 1}`);
    });
  }

  const organizationGate = requiredGate(record, "has_organization", ["has_belonged_to_organization"]);
  if (organizationGate.value === null) missing.push(organizationGate.key);
  if (organizationGate.value === true) {
    const organizations = stringRows(record, "organizations[]", "organization_name");
    if (!organizations.valid || organizations.values.length === 0) missing.push("organization_name");
    organizations.values.forEach((value, index) => {
      if (!value) missing.push(index === 0 ? "organization_name" : `organization_name__${index + 1}`);
    });
  }

  const skillsGate = requiredGate(record, "has_specialized_skills");
  if (skillsGate.value === null) missing.push(skillsGate.key);
  if (skillsGate.value === true && !String(record.specialized_skills_explain ?? "").trim()) {
    missing.push("specialized_skills_explain");
  }

  const militaryGate = requiredGate(record, "has_served_military");
  if (militaryGate.value === null) missing.push(militaryGate.key);
  if (militaryGate.value === true) {
    const military = militaryRows(record);
    if (!military.valid || military.values.length === 0) missing.push("military_services[]");
    military.values.forEach((row, index) => {
      const suffix = index === 0 ? "" : `__${index + 1}`;
      if (!row.country) missing.push(`military_country${suffix}`);
      if (!row.branch) missing.push(`military_branch${suffix}`);
      if (!row.rank) missing.push(`military_rank${suffix}`);
      if (!row.specialty) missing.push(`military_specialty${suffix}`);
      if (!parseDate(row.startDate)) missing.push(`military_date_from${suffix}`);
      if (!parseDate(row.endDate)) missing.push(`military_date_to${suffix}`);
    });
  }

  const paramilitaryGate = requiredGate(record, "has_served_paramilitary", ["has_served_insurgent"]);
  if (paramilitaryGate.value === null) missing.push(paramilitaryGate.key);
  if (paramilitaryGate.value === true && !String(record.paramilitary_explain ?? "").trim()) {
    missing.push("paramilitary_explain");
  }

  return [...new Set(missing)];
}

export function buildDs160WorkAdditionalPlan(
  answers: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Ds160WorkAdditionalPlan {
  const record = mergedAnswers(answers, profile);
  const missing = findMissingDs160WorkAdditionalAnswers(record);
  if (missing.length > 0) throw new Error(`DS-160 Work/Education Additional is incomplete: ${missing.join(", ")}`);

  const hasClanTribe = requiredGate(record, "has_clan_tribe").value!;
  const hasCountriesVisited = requiredGate(record, "has_countries_visited", ["has_traveled_last_five_years"]).value!;
  const hasOrganization = requiredGate(record, "has_organization", ["has_belonged_to_organization"]).value!;
  const hasSpecializedSkills = requiredGate(record, "has_specialized_skills").value!;
  const hasServedMilitary = requiredGate(record, "has_served_military").value!;
  const hasServedParamilitary = requiredGate(record, "has_served_paramilitary", ["has_served_insurgent"]).value!;
  const rawMilitary = militaryRows(record).values;

  return {
    hasClanTribe,
    clanTribeName: hasClanTribe ? String(record.clan_tribe_name).trim() : null,
    languages: stringRows(record, "languages[]", "language_name").values,
    hasCountriesVisited,
    countriesVisited: hasCountriesVisited
      ? stringRows(record, "traveled_countries[]", "traveled_country").values
      : [],
    hasOrganization,
    organizations: hasOrganization
      ? stringRows(record, "organizations[]", "organization_name").values
      : [],
    hasSpecializedSkills,
    specializedSkillsExplain: hasSpecializedSkills
      ? String(record.specialized_skills_explain).trim()
      : null,
    hasServedMilitary,
    militaryServices: hasServedMilitary
      ? rawMilitary.map((row) => ({
        country: row.country,
        branch: row.branch,
        rank: row.rank,
        specialty: row.specialty,
        from: parseDate(row.startDate)!,
        to: parseDate(row.endDate)!,
      }))
      : [],
    hasServedParamilitary,
    paramilitaryExplain: hasServedParamilitary
      ? String(record.paramilitary_explain).trim()
      : null,
  };
}

async function assertMilitaryControlCounts(page: Page, expected: number): Promise<void> {
  const requiredSelectors = [
    selectors.militaryCountry,
    selectors.militaryBranch,
    selectors.militaryRank,
    selectors.militarySpecialty,
    selectors.militaryFromDay,
    selectors.militaryFromMonth,
    selectors.militaryFromYear,
    selectors.militaryToDay,
    selectors.militaryToMonth,
    selectors.militaryToYear,
  ];
  for (const selector of requiredSelectors) {
    if ((await visibleEnabledLocators(page, selector)).length !== expected) {
      throw new Error("CEAC military service rows are incomplete");
    }
  }
}

/** Fill and read back the complete Work/Education Additional page without advancing. */
export async function fillWorkEducationAdditionalPage(
  page: Page,
  answers: Record<string, string>,
  profile: Record<string, unknown> = {},
): Promise<void> {
  const plan = buildDs160WorkAdditionalPlan(answers, profile);

  await clickVerifiedBooleanRadio(page, ds160WorkAdditionalMappings.has_clan_tribe.selector, plan.hasClanTribe, "has_clan_tribe");
  if (plan.hasClanTribe) {
    await fillVerifiedText(page, selectors.clanTribeName, plan.clanTribeName!, "clan_tribe_name");
  }

  await ensureRepeaterRowCount(page, selectors.languageName, selectors.languageAddAnother, plan.languages.length, "language_name");
  for (let index = 0; index < plan.languages.length; index += 1) {
    await fillVerifiedText(page, selectors.languageName, plan.languages[index], "language_name", index);
  }

  await clickVerifiedBooleanRadio(page, ds160WorkAdditionalMappings.has_countries_visited.selector, plan.hasCountriesVisited, "has_countries_visited");
  if (plan.hasCountriesVisited) {
    await ensureRepeaterRowCount(page, selectors.traveledCountry, selectors.traveledCountryAddAnother, plan.countriesVisited.length, "traveled_country");
    for (let index = 0; index < plan.countriesVisited.length; index += 1) {
      await selectVerifiedOption(page, selectors.traveledCountry, plan.countriesVisited[index], "traveled_country", index);
    }
  }

  await clickVerifiedBooleanRadio(page, ds160WorkAdditionalMappings.has_organization.selector, plan.hasOrganization, "has_organization");
  if (plan.hasOrganization) {
    await ensureRepeaterRowCount(page, selectors.organizationName, selectors.organizationAddAnother, plan.organizations.length, "organization_name");
    for (let index = 0; index < plan.organizations.length; index += 1) {
      await fillVerifiedText(page, selectors.organizationName, plan.organizations[index], "organization_name", index);
    }
  }

  await clickVerifiedBooleanRadio(page, ds160WorkAdditionalMappings.has_specialized_skills.selector, plan.hasSpecializedSkills, "has_specialized_skills");
  if (plan.hasSpecializedSkills) {
    await fillVerifiedText(page, selectors.specializedSkillsExplain, plan.specializedSkillsExplain!, "specialized_skills_explain");
  }

  await clickVerifiedBooleanRadio(page, ds160WorkAdditionalMappings.has_served_military.selector, plan.hasServedMilitary, "has_served_military");
  if (plan.hasServedMilitary) {
    await ensureRepeaterRowCount(page, selectors.militaryCountry, selectors.militaryAddAnother, plan.militaryServices.length, "military_service");
    await assertMilitaryControlCounts(page, plan.militaryServices.length);
    for (let index = 0; index < plan.militaryServices.length; index += 1) {
      const row = plan.militaryServices[index];
      await selectVerifiedOption(page, selectors.militaryCountry, row.country, "military_country", index);
      await fillVerifiedText(page, selectors.militaryBranch, row.branch, "military_branch", index);
      await fillVerifiedText(page, selectors.militaryRank, row.rank, "military_rank", index);
      await fillVerifiedText(page, selectors.militarySpecialty, row.specialty, "military_specialty", index);
      await selectVerifiedOption(page, selectors.militaryFromDay, row.from.day, "military_date_from_day", index);
      await selectVerifiedOption(page, selectors.militaryFromMonth, row.from.month, "military_date_from_month", index);
      await fillVerifiedText(page, selectors.militaryFromYear, row.from.year, "military_date_from_year", index);
      await selectVerifiedOption(page, selectors.militaryToDay, row.to.day, "military_date_to_day", index);
      await selectVerifiedOption(page, selectors.militaryToMonth, row.to.month, "military_date_to_month", index);
      await fillVerifiedText(page, selectors.militaryToYear, row.to.year, "military_date_to_year", index);
    }
  }

  await clickVerifiedBooleanRadio(page, ds160WorkAdditionalMappings.has_served_insurgent.selector, plan.hasServedParamilitary, "has_served_paramilitary");
  if (plan.hasServedParamilitary) {
    await fillVerifiedText(page, selectors.paramilitaryExplain, plan.paramilitaryExplain!, "paramilitary_explain");
  }
}
